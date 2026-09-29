import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import path from 'path'
import { setDbPath, getDatabase, closeDatabase } from './database.js'
import {
  getAllMedia, getMediaById, addMedia,
  updateMedia, deleteMedia, getAllTags,
  getAllGenres, getStats,
  getAllLists, createList, updateList, deleteList,
  getMediaInList, addMediaToList, removeMediaFromList,
  addWatchlistItemToList, removeWatchlistItemFromList,
  addManyToList, reorderList, getListIdsFor,
  type ListKind, type UpdateListInput, type ListEntryRef,
  findDuplicateInMedia,
} from './queries.js'
import { searchMovies, searchSeries, getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'
import {
  getAllWatchlist, addToWatchlist, removeFromWatchlist, getWatchlistCount,
  findDuplicateInWatchlist, promoteToMedia,
  type AddWatchlistInput,
} from './watchlistQueries.js'
import type { AddMediaInput } from './queries.js'
import { exportBackup, mergeBackup } from './backup.js'
import { scanCollections, countPendingScan, getFranchises, getFranchiseForList, createListForFranchise } from './collections.js'
import { addTmdbToWatchlist } from './tmdbImport.js'
import { getPublicSettings, saveSettings, getActiveConfig, type SaveSettingsInput } from './aiSettings.js'
import { listModels, AiError } from './aiClient.js'
import {
  getProfile, generateProfile, saveProfileText,
  recommend, getLastRecommendations, setFeedback, addSuggestionToWatchlist, addSuggestionToCatalog,
  completeList, suggestLists, createListFromProposal,
  type Verdict, type WatchedFields,
} from './aiService.js'
import type { RecommendRequest } from './aiPrompts.js'
import { updateAllImages, type ImageUpdateProgress, type ImageUpdateResult } from './updateImages.js'
import { registerImageScheme, serveImageProtocol, localizeMediaImages, deleteLocalImage } from './imageStore.js'
import fs from 'fs'
import Database from 'better-sqlite3'

const isDev = process.env.NODE_ENV === 'development'

// Dev/testes: permite apontar para uma pasta de dados separada (não mexe no catálogo real).
if (process.env.CATALOGU_USER_DATA) app.setPath('userData', process.env.CATALOGU_USER_DATA)

// Precisa rodar antes de app.whenReady() para o renderer poder carregar catimg://
registerImageScheme()

function registerIpcHandlers() {
  ipcMain.handle('media:getAll',      () => getAllMedia())
  ipcMain.handle('media:getById',     (_e, id: number) => getMediaById(id))
  ipcMain.handle('media:add',         async (_e, input) => addMedia(await localizeMediaImages(input)))
  ipcMain.handle('media:update',      async (_e, id: number, input: Partial<AddMediaInput>) => {
    // Capa/fundo trocados por URL também viram webp local; o arquivo antigo é apagado.
    const before    = getMediaById(id)
    const localized = await localizeMediaImages(input)
    updateMedia(id, localized)
    if (before && 'cover_path' in input && before.cover_path !== localized.cover_path) deleteLocalImage(before.cover_path)
    if (before && 'backdrop_path' in input && before.backdrop_path !== localized.backdrop_path) deleteLocalImage(before.backdrop_path)
    return true
  })
  ipcMain.handle('media:delete',      (_e, id: number) => {
    const images = deleteMedia(id)
    deleteLocalImage(images?.cover_path)
    deleteLocalImage(images?.backdrop_path)
    return true
  })
  ipcMain.handle('tags:getAll',       () => getAllTags())
  ipcMain.handle('genres:getAll',     () => getAllGenres())
  ipcMain.handle('stats:get',         () => getStats())
  ipcMain.handle('tmdb:searchMovies', (_e, query: string) => searchMovies(query))
  ipcMain.handle('tmdb:searchSeries', (_e, query: string) => searchSeries(query))
  ipcMain.handle('tmdb:movieDetails', (_e, id: number)    => getMovieDetails(id))
  ipcMain.handle('tmdb:tvDetails',    (_e, id: number)    => getTvDetails(id))
  ipcMain.handle('tmdb:posterUrl',    (_e, p: string)     => getPosterUrl(p))
  ipcMain.handle('tmdb:backdropUrl',  (_e, p: string)     => getBackdropUrl(p))
  ipcMain.handle('lists:getAll',      () => getAllLists())
  ipcMain.handle('lists:create',      (_e, name: string, desc: string, kind?: ListKind) => createList(name, desc, kind))
  ipcMain.handle('lists:update',      (_e, id: number, patch: UpdateListInput) => updateList(id, patch))
  ipcMain.handle('lists:delete',      (_e, id: number) => deleteList(id))
  ipcMain.handle('lists:getMedia',    (_e, listId: number) => getMediaInList(listId))
  ipcMain.handle('lists:addMedia',    (_e, mediaId: number, listId: number) => addMediaToList(mediaId, listId))
  ipcMain.handle('lists:removeMedia',          (_e, mediaId: number, listId: number)     => removeMediaFromList(mediaId, listId))
  ipcMain.handle('lists:addWatchlistItem',    (_e, watchlistId: number, listId: number) => addWatchlistItemToList(watchlistId, listId))
  ipcMain.handle('lists:removeWatchlistItem', (_e, watchlistId: number, listId: number) => removeWatchlistItemFromList(watchlistId, listId))
  ipcMain.handle('lists:addMany',     (_e, listId: number, entries: ListEntryRef[]) => addManyToList(listId, entries))
  ipcMain.handle('lists:reorder',     (_e, listId: number, ordered: ListEntryRef[]) => reorderList(listId, ordered))
  ipcMain.handle('lists:idsFor',      (_e, entry: ListEntryRef) => getListIdsFor(entry))

  // Franquias (coleções do TMDB)
  ipcMain.handle('franchises:pendingScan', () => countPendingScan())
  ipcMain.handle('franchises:scan', (event) => scanCollections(p => {
    if (!event.sender.isDestroyed()) event.sender.send('franchises:progress', p)
  }))
  ipcMain.handle('franchises:getAll',     () => getFranchises())
  ipcMain.handle('franchises:forList',    (_e, listId: number) => getFranchiseForList(listId))
  ipcMain.handle('franchises:createList', (_e, collectionId: number) => createListForFranchise(collectionId))
  ipcMain.handle('franchises:unlink',     (_e, listId: number) => updateList(listId, { tmdb_collection_id: null }))
  ipcMain.handle('tmdb:addToWatchlist',   async (_e, tmdbId: number, tipo: 'filme' | 'serie', listId?: number) => {
    try {
      return { ok: true as const, data: await addTmdbToWatchlist(tmdbId, tipo, listId) }
    } catch (err) {
      log.error('tmdb:addToWatchlist', err)
      return { ok: false as const, error: 'Não foi possível adicionar. Verifique sua conexão.' }
    }
  })

  // IA — erros viram { ok: false, error } com mensagem pronta para o usuário
  const aiCall = <T>(fn: () => Promise<T> | T) => async () => {
    try {
      return { ok: true as const, data: await fn() }
    } catch (err) {
      if (!(err instanceof AiError)) log.error('[ai] erro inesperado:', err)
      return { ok: false as const, error: err instanceof AiError ? err.message : 'Erro inesperado na IA. Veja o log.' }
    }
  }
  ipcMain.handle('ai:getSettings',  () => getPublicSettings())
  ipcMain.handle('ai:saveSettings', (_e, input: SaveSettingsInput) => aiCall(() => saveSettings(input))())
  ipcMain.handle('ai:listModels',   () => aiCall(async () => {
    const cfg = getActiveConfig()
    if (!cfg) throw new AiError('Salve uma chave de API primeiro.')
    return listModels(cfg)
  })())
  ipcMain.handle('ai:getProfile',      () => getProfile())
  ipcMain.handle('ai:generateProfile', () => aiCall(() => generateProfile())())
  ipcMain.handle('ai:saveProfile',     (_e, text: string) => aiCall(() => saveProfileText(text))())
  ipcMain.handle('ai:recommend',       (_e, req: RecommendRequest) => aiCall(() => recommend(req))())
  ipcMain.handle('ai:lastRecommendations', () => getLastRecommendations())
  ipcMain.handle('ai:feedback', (_e, tmdbId: number, tipo: 'filme' | 'serie', title: string, year: string | null, verdict: Verdict | null) =>
    aiCall(() => setFeedback(tmdbId, tipo, title, year, verdict))())
  ipcMain.handle('ai:addToWatchlist', (_e, tmdbId: number, tipo: 'filme' | 'serie') =>
    aiCall(() => addSuggestionToWatchlist(tmdbId, tipo))())
  ipcMain.handle('ai:completeList',  (_e, listId: number) => aiCall(() => completeList(listId))())
  ipcMain.handle('ai:suggestLists',  () => aiCall(() => suggestLists())())
  ipcMain.handle('ai:createList',    (_e, p: Parameters<typeof createListFromProposal>[0]) => aiCall(() => createListFromProposal(p))())
  ipcMain.handle('ai:addToCatalog', (_e, tmdbId: number, tipo: 'filme' | 'serie', fields: WatchedFields) =>
    aiCall(() => addSuggestionToCatalog(tmdbId, tipo, fields))())

  // Watchlist
  ipcMain.handle('watchlist:getAll', () => getAllWatchlist())
  ipcMain.handle('watchlist:add',    async (_e, input: AddWatchlistInput) => {
    try {
      return { success: true, id: addToWatchlist(await localizeMediaImages(input)) }
    } catch (err) {
      if (String(err).includes('DUPLICATE')) return { success: false, error: 'duplicate' }
      throw err
    }
  })
  ipcMain.handle('watchlist:remove', (_e, id: number) => {
    const images = removeFromWatchlist(id)
    deleteLocalImage(images?.cover_path)
    deleteLocalImage(images?.backdrop_path)
    return true
  })
  ipcMain.handle('watchlist:count',  ()               => getWatchlistCount())
  ipcMain.handle('watchlist:promote', async (_e, watchlistId: number, media: AddMediaInput) =>
    promoteToMedia(watchlistId, await localizeMediaImages(media))
  )

  // Verificações de duplicata
  ipcMain.handle('media:findDuplicate',     (_e, tmdbId: number | null, title: string, releaseYear?: string, tipo?: 'filme' | 'serie') =>
    findDuplicateInMedia(tmdbId, title, releaseYear, tipo)
  )
  ipcMain.handle('watchlist:findDuplicate', (_e, tmdbId: number | null, title: string, releaseYear?: string, tipo?: 'filme' | 'serie') =>
    findDuplicateInWatchlist(tmdbId, title, releaseYear, tipo)
  )

  // Atualizar imagens (capa + backdrop)
  // Uma execução por vez: se a tela de Configurações for reaberta no meio do
  // processo, o renderer recebe a mesma promise em vez de disparar outra rodada.
  let imagesRun: Promise<ImageUpdateResult> | null = null
  ipcMain.handle('images:isRunning', () => imagesRun !== null)
  ipcMain.handle('images:updateAll', (event) => {
    if (!imagesRun) {
      imagesRun = updateAllImages((progress: ImageUpdateProgress) => {
        if (!event.sender.isDestroyed()) event.sender.send('images:progress', progress)
      }).finally(() => { imagesRun = null })
    }
    return imagesRun
  })

  // Exportar backup do banco
  ipcMain.handle('backup:export', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Exportar backup do Catalogu',
      defaultPath: `catalogu_backup_${localDateStamp()}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    try {
      // backup() da API do SQLite inclui o que ainda está no -wal (cópia de arquivo não incluía)
      await exportBackup(getDatabase(), result.filePath)
      return { success: true, path: result.filePath }
    } catch (err) {
      log.error('Erro ao exportar backup:', err)
      return { success: false, error: String(err) }
    }
  })

  // Selecionar .db para importar
  ipcMain.handle('backup:selectDbV3', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar backup do Catalogu',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Importar backup v3 (mesclar ou substituir)
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })
  // O renderer pergunta o estado ao montar: o download pode ter terminado antes dele ouvir os eventos.
  ipcMain.handle('update:getState', () => updateStatus)
  ipcMain.handle('update:retry', () => {
    updateStatus = { state: 'idle' }
    return autoUpdater.checkForUpdates().catch(err => log.error('Falha ao checar atualizações:', err))
  })

  ipcMain.handle('backup:importV3', async (_e, dbPath: string, mode: 'merge' | 'replace') => {
    const dbDest = path.join(app.getPath('userData'), 'catalogu.db')
    try {
      if (mode === 'replace') {
        assertCatalogBackup(dbPath)

        // Rede de segurança: guarda o banco atual antes de sobrescrever.
        const safetyDir = path.join(app.getPath('userData'), 'backups')
        fs.mkdirSync(safetyDir, { recursive: true })
        await exportBackup(getDatabase(), path.join(safetyDir, `antes-de-substituir_${localDateStamp()}_${Date.now()}.db`))

        // Fecha e esquece a conexão atual; a próxima chamada reabre o arquivo novo
        // (e roda as migrations, caso o backup seja de uma versão antiga).
        closeDatabase()
        for (const ext of ['-wal', '-shm']) fs.rmSync(dbDest + ext, { force: true })
        fs.copyFileSync(dbPath, dbDest)
        getDatabase()
        return { success: true, imported: 0, skipped: 0, mode: 'replace' }
      }

      const res = mergeBackup(getDatabase(), dbPath)
      return { success: true, mode: 'merge', ...res }
    } catch (err) {
      log.error('Erro ao importar backup:', err)
      return { success: false, error: String(err) }
    }
  })
}

/** Lança erro se o arquivo não for um banco do Catalogu (evita substituir o catálogo por outro .db qualquer). */
function assertCatalogBackup(dbPath: string) {
  const src = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const ok = src.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'media'").get()
    if (!ok) throw new Error('Arquivo não parece ser um backup do Catalogu (tabela media não encontrada).')
  } finally {
    src.close()
  }
}

type UpdateStatus =
  | { state: 'idle' }
  | { state: 'available';   version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready';       version: string }
  | { state: 'error';       message: string }

let updateStatus: UpdateStatus = { state: 'idle' }

function setupAutoUpdater(win: BrowserWindow) {
  autoUpdater.logger = log
  ;(autoUpdater.logger as any).transports.file.level = 'info'

  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.autoDownload = true

  const send = (channel: string, payload?: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
  let version = ''

  autoUpdater.on('update-available', (info) => {
    version = info.version
    updateStatus = { state: 'available', version }
    send('update:available', { version })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent)
    updateStatus = { state: 'downloading', version, percent }
    send('update:progress', { percent })
  })

  autoUpdater.on('update-downloaded', () => {
    updateStatus = { state: 'ready', version }
    send('update:downloaded')
  })

  autoUpdater.on('error', (err) => {
    log.error('Erro no auto-updater:', err)
    // Só avisa se um download estava em andamento; falha ao apenas checar
    // (ex.: sem internet) não precisa incomodar.
    if (updateStatus.state === 'available' || updateStatus.state === 'downloading') {
      updateStatus = { state: 'error', message: String(err?.message ?? err) }
      send('update:error', updateStatus)
    }
  })

  // checkForUpdates (sem "AndNotify"): o aviso é o card do próprio app, sem notificação nativa duplicada.
  autoUpdater.checkForUpdates().catch(err => log.error('Falha ao checar atualizações:', err))
}

/** Data local YYYY-MM-DD (toISOString usa UTC e vira o dia seguinte à noite no Brasil). */
function localDateStamp(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 700,
    backgroundColor: '#141414',
    icon: path.join(__dirname, '../src/assets/catalogu.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#141414', symbolColor: '#ffffff', height: 32 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  // Links com target=_blank (ex.: "pegar chave de API") abrem no navegador padrão.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  serveImageProtocol()
  setDbPath(path.join(app.getPath('userData'), 'catalogu.db'))
  registerIpcHandlers()
  const win = createWindow()
  setupAutoUpdater(win)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
