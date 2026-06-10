import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import path from 'path'
import { setDbPath } from './database.js'
import {
  getAllMedia, getMediaById, addMedia,
  updateMedia, deleteMedia, getAllTags,
  getAllGenres, getStats,
  getAllLists, createList, updateList, deleteList,
  getMediaInList, addMediaToList, removeMediaFromList,
  addWatchlistItemToList, removeWatchlistItemFromList,
  findDuplicateInMedia,
} from './queries.js'
import { searchMovies, searchSeries, getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'
import {
  getAllWatchlist, addToWatchlist, removeFromWatchlist, getWatchlistCount,
  findDuplicateInWatchlist,
  type AddWatchlistInput,
} from './watchlistQueries.js'
import { updateAllImages, type ImageUpdateProgress } from './updateImages.js'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development'

function registerIpcHandlers() {
  ipcMain.handle('media:getAll',      () => getAllMedia())
  ipcMain.handle('media:getById',     (_e, id: number) => getMediaById(id))
  ipcMain.handle('media:add',         (_e, input) => addMedia(input))
  ipcMain.handle('media:update',      (_e, id: number, input) => updateMedia(id, input))
  ipcMain.handle('media:delete',      (_e, id: number) => deleteMedia(id))
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
  ipcMain.handle('lists:create',      (_e, name: string, desc: string) => createList(name, desc))
  ipcMain.handle('lists:update',      (_e, id: number, name: string, desc: string) => updateList(id, name, desc))
  ipcMain.handle('lists:delete',      (_e, id: number) => deleteList(id))
  ipcMain.handle('lists:getMedia',    (_e, listId: number) => getMediaInList(listId))
  ipcMain.handle('lists:addMedia',    (_e, mediaId: number, listId: number) => addMediaToList(mediaId, listId))
  ipcMain.handle('lists:removeMedia',          (_e, mediaId: number, listId: number)     => removeMediaFromList(mediaId, listId))
  ipcMain.handle('lists:addWatchlistItem',    (_e, watchlistId: number, listId: number) => addWatchlistItemToList(watchlistId, listId))
  ipcMain.handle('lists:removeWatchlistItem', (_e, watchlistId: number, listId: number) => removeWatchlistItemFromList(watchlistId, listId))

  // Watchlist
  ipcMain.handle('watchlist:getAll', () => getAllWatchlist())
  ipcMain.handle('watchlist:add',    (_e, input: AddWatchlistInput) => {
    try {
      return { success: true, id: addToWatchlist(input) }
    } catch (err) {
      if (String(err).includes('DUPLICATE')) return { success: false, error: 'duplicate' }
      throw err
    }
  })
  ipcMain.handle('watchlist:remove', (_e, id: number) => removeFromWatchlist(id))
  ipcMain.handle('watchlist:count',  ()               => getWatchlistCount())

  // Verificações de duplicata
  ipcMain.handle('media:findDuplicate',     (_e, tmdbId: number | null, title: string, releaseYear?: string) =>
    findDuplicateInMedia(tmdbId, title, releaseYear)
  )
  ipcMain.handle('watchlist:findDuplicate', (_e, tmdbId: number | null, title: string, releaseYear?: string) =>
    findDuplicateInWatchlist(tmdbId, title, releaseYear)
  )

  // Atualizar imagens (capa + backdrop)
  ipcMain.handle('images:updateAll', async (event) => {
    return updateAllImages((progress: ImageUpdateProgress) => {
      event.sender.send('images:progress', progress)
    })
  })

  // Exportar backup do banco
  ipcMain.handle('backup:export', async () => {
    const dbSrc = path.join(app.getPath('userData'), 'catalogu.db')
    const result = await dialog.showSaveDialog({
      title: 'Exportar backup do Catalogu',
      defaultPath: `catalogu_backup_${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    try {
      fs.copyFileSync(dbSrc, result.filePath)
      return { success: true, path: result.filePath }
    } catch (err) {
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

  ipcMain.handle('backup:importV3', async (_e, dbPath: string, mode: 'merge' | 'replace') => {
    const dbDest = path.join(app.getPath('userData'), 'catalogu.db')
    try {
      if (mode === 'replace') {
        const { getDatabase } = await import('./database.js')
        try { (getDatabase() as any).close() } catch {}
        fs.copyFileSync(dbPath, dbDest)
        const { setDbPath } = await import('./database.js')
        setDbPath(dbDest)
        return { success: true, imported: 0, skipped: 0, mode: 'replace' }
      }

      const Database = (await import('better-sqlite3')).default
      const srcDb = new Database(dbPath, { readonly: true })
      const { getDatabase } = await import('./database.js')
      const destDb = getDatabase()

      const srcMedia = srcDb.prepare('SELECT * FROM media').all() as any[]
      let imported = 0
      let skipped  = 0

      for (const m of srcMedia) {
        const exists = m.tmdb_id
          ? destDb.prepare('SELECT id FROM media WHERE tmdb_id = ?').get(m.tmdb_id)
          : destDb.prepare('SELECT id FROM media WHERE LOWER(title) = LOWER(?) AND release_year = ?').get(m.title, m.release_year ?? '')

        if (exists) { skipped++; continue }

        destDb.prepare(`
          INSERT INTO media (
            title, release_year, synopsis, observations, rating,
            duration, watched, cover_path, backdrop_path,
            tipo, watched_status, tmdb_id, created_at
          ) VALUES (
            @title, @release_year, @synopsis, @observations, @rating,
            @duration, @watched, @cover_path, @backdrop_path,
            @tipo, @watched_status, @tmdb_id, @created_at
          )
        `).run({
          title:          m.title,
          release_year:   m.release_year  ?? null,
          synopsis:       m.synopsis      ?? null,
          observations:   m.observations  ?? null,
          rating:         m.rating        ?? null,
          duration:       m.duration      ?? null,
          watched:        m.watched       ?? null,
          cover_path:     m.cover_path    ?? null,
          backdrop_path:  m.backdrop_path ?? null,
          tipo:           m.tipo,
          watched_status: m.watched_status ?? 'assistido',
          tmdb_id:        m.tmdb_id       ?? null,
          created_at:     m.created_at    ?? new Date().toISOString(),
        })
        imported++
      }

      srcDb.close()
      return { success: true, imported, skipped, mode: 'merge' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

function setupAutoUpdater(win: BrowserWindow) {
  autoUpdater.logger = log
  ;(autoUpdater.logger as any).transports.file.level = 'info'

  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.autoDownload = true

  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update:available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send('update:progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update:downloaded')
  })

  autoUpdater.on('error', (err) => {
    log.error('Erro no auto-updater:', err)
  })
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
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  setDbPath(path.join(app.getPath('userData'), 'catalogu.db'))
  registerIpcHandlers()
  const win = createWindow()
  setupAutoUpdater(win)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
