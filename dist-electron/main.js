"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_js_1 = require("./database.js");
const queries_js_1 = require("./queries.js");
const tmdb_js_1 = require("./tmdb.js");
const watchlistQueries_js_1 = require("./watchlistQueries.js");
const import_js_1 = require("./import.js");
const updateBackdrops_js_1 = require("./updateBackdrops.js");
const isDev = process.env.NODE_ENV === 'development';
function registerIpcHandlers() {
    electron_1.ipcMain.handle('media:getAll', () => (0, queries_js_1.getAllMedia)());
    electron_1.ipcMain.handle('media:getById', (_e, id) => (0, queries_js_1.getMediaById)(id));
    electron_1.ipcMain.handle('media:add', (_e, input) => (0, queries_js_1.addMedia)(input));
    electron_1.ipcMain.handle('media:update', (_e, id, input) => (0, queries_js_1.updateMedia)(id, input));
    electron_1.ipcMain.handle('media:delete', (_e, id) => (0, queries_js_1.deleteMedia)(id));
    electron_1.ipcMain.handle('tags:getAll', () => (0, queries_js_1.getAllTags)());
    electron_1.ipcMain.handle('genres:getAll', () => (0, queries_js_1.getAllGenres)());
    electron_1.ipcMain.handle('stats:get', () => (0, queries_js_1.getStats)());
    electron_1.ipcMain.handle('tmdb:searchMovies', (_e, query) => (0, tmdb_js_1.searchMovies)(query));
    electron_1.ipcMain.handle('tmdb:searchSeries', (_e, query) => (0, tmdb_js_1.searchSeries)(query));
    electron_1.ipcMain.handle('tmdb:movieDetails', (_e, id) => (0, tmdb_js_1.getMovieDetails)(id));
    electron_1.ipcMain.handle('tmdb:tvDetails', (_e, id) => (0, tmdb_js_1.getTvDetails)(id));
    electron_1.ipcMain.handle('tmdb:posterUrl', (_e, p) => (0, tmdb_js_1.getPosterUrl)(p));
    electron_1.ipcMain.handle('tmdb:backdropUrl', (_e, p) => (0, tmdb_js_1.getBackdropUrl)(p));
    electron_1.ipcMain.handle('lists:getAll', () => (0, queries_js_1.getAllLists)());
    electron_1.ipcMain.handle('lists:create', (_e, name, desc) => (0, queries_js_1.createList)(name, desc));
    electron_1.ipcMain.handle('lists:update', (_e, id, name, desc) => (0, queries_js_1.updateList)(id, name, desc));
    electron_1.ipcMain.handle('lists:delete', (_e, id) => (0, queries_js_1.deleteList)(id));
    electron_1.ipcMain.handle('lists:getMedia', (_e, listId) => (0, queries_js_1.getMediaInList)(listId));
    electron_1.ipcMain.handle('lists:addMedia', (_e, mediaId, listId) => (0, queries_js_1.addMediaToList)(mediaId, listId));
    electron_1.ipcMain.handle('lists:removeMedia', (_e, mediaId, listId) => (0, queries_js_1.removeMediaFromList)(mediaId, listId));
    electron_1.ipcMain.handle('backup:selectDb', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            title: 'Selecionar banco do CineUp v2',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
    electron_1.ipcMain.handle('backup:import', async (event, dbPath) => {
        return (0, import_js_1.importFromV2Db)(dbPath, (progress) => {
            event.sender.send('backup:progress', progress);
        });
    });
    // Watchlist
    electron_1.ipcMain.handle('watchlist:getAll', () => (0, watchlistQueries_js_1.getAllWatchlist)());
    electron_1.ipcMain.handle('watchlist:add', (_e, input) => {
        try {
            return { success: true, id: (0, watchlistQueries_js_1.addToWatchlist)(input) };
        }
        catch (err) {
            if (String(err).includes('DUPLICATE'))
                return { success: false, error: 'duplicate' };
            throw err;
        }
    });
    electron_1.ipcMain.handle('watchlist:remove', (_e, id) => (0, watchlistQueries_js_1.removeFromWatchlist)(id));
    electron_1.ipcMain.handle('watchlist:count', () => (0, watchlistQueries_js_1.getWatchlistCount)());
    electron_1.ipcMain.handle('backdrop:updateAll', async (event) => {
        return (0, updateBackdrops_js_1.updateAllBackdrops)((progress) => {
            event.sender.send('backdrop:progress', progress);
        });
    });
}
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 1400, height: 900, minWidth: 1024, minHeight: 700,
        backgroundColor: '#141414',
        icon: path_1.default.join(__dirname, '../src/assets/catalogu.ico'),
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: '#141414', symbolColor: '#ffffff', height: 32 },
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    }
    else {
        win.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    (0, database_js_1.setDbPath)(path_1.default.join(electron_1.app.getPath('userData'), 'catalogu.db'));
    registerIpcHandlers();
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
