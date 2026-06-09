import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { setDbPath } from './database.js'
import {
  getAllMedia, getMediaById, addMedia,
  updateMedia, deleteMedia, getAllTags,
  getAllGenres, getStats,
  getAllLists, createList, updateList, deleteList,
  getMediaInList, addMediaToList, removeMediaFromList,
} from './queries.js'
import { searchMovies, searchSeries, getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'
import {
  getAllWatchlist, addToWatchlist, removeFromWatchlist, getWatchlistCount,
  type AddWatchlistInput,
} from './watchlistQueries.js'
import { importFromV2Db, type ImportProgress } from './import.js'
import { updateAllBackdrops, type BackdropUpdateProgress } from './updateBackdrops.js'

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
  ipcMain.handle('lists:removeMedia', (_e, mediaId: number, listId: number) => removeMediaFromList(mediaId, listId))

  ipcMain.handle('backup:selectDb', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar banco do CineUp v2',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('backup:import', async (event, dbPath: string) => {
    return importFromV2Db(dbPath, (progress: ImportProgress) => {
      event.sender.send('backup:progress', progress)
    })
  })

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

  ipcMain.handle('backdrop:updateAll', async (event) => {
    return updateAllBackdrops((progress: BackdropUpdateProgress) => {
      event.sender.send('backdrop:progress', progress)
    })
  })
}

function createWindow() {
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
}

app.whenReady().then(() => {
  setDbPath(path.join(app.getPath('userData'), 'catalogu.db'))
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
