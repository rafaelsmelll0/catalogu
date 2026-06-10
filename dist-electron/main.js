"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const electron_log_1 = __importDefault(require("electron-log"));
const path_1 = __importDefault(require("path"));
const database_js_1 = require("./database.js");
const queries_js_1 = require("./queries.js");
const tmdb_js_1 = require("./tmdb.js");
const watchlistQueries_js_1 = require("./watchlistQueries.js");
const updateImages_js_1 = require("./updateImages.js");
const fs_1 = __importDefault(require("fs"));
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
    electron_1.ipcMain.handle('lists:addWatchlistItem', (_e, watchlistId, listId) => (0, queries_js_1.addWatchlistItemToList)(watchlistId, listId));
    electron_1.ipcMain.handle('lists:removeWatchlistItem', (_e, watchlistId, listId) => (0, queries_js_1.removeWatchlistItemFromList)(watchlistId, listId));
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
    // Verificações de duplicata
    electron_1.ipcMain.handle('media:findDuplicate', (_e, tmdbId, title, releaseYear) => (0, queries_js_1.findDuplicateInMedia)(tmdbId, title, releaseYear));
    electron_1.ipcMain.handle('watchlist:findDuplicate', (_e, tmdbId, title, releaseYear) => (0, watchlistQueries_js_1.findDuplicateInWatchlist)(tmdbId, title, releaseYear));
    // Atualizar imagens (capa + backdrop)
    electron_1.ipcMain.handle('images:updateAll', async (event) => {
        return (0, updateImages_js_1.updateAllImages)((progress) => {
            event.sender.send('images:progress', progress);
        });
    });
    // Exportar backup do banco
    electron_1.ipcMain.handle('backup:export', async () => {
        const dbSrc = path_1.default.join(electron_1.app.getPath('userData'), 'catalogu.db');
        const result = await electron_1.dialog.showSaveDialog({
            title: 'Exportar backup do Catalogu',
            defaultPath: `catalogu_backup_${new Date().toISOString().slice(0, 10)}.db`,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        });
        if (result.canceled || !result.filePath)
            return { success: false };
        try {
            fs_1.default.copyFileSync(dbSrc, result.filePath);
            return { success: true, path: result.filePath };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    // Selecionar .db para importar
    electron_1.ipcMain.handle('backup:selectDbV3', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            title: 'Selecionar backup do Catalogu',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
    // Importar backup v3 (mesclar ou substituir)
    electron_1.ipcMain.handle('update:install', () => {
        electron_updater_1.autoUpdater.quitAndInstall();
    });
    electron_1.ipcMain.handle('backup:importV3', async (_e, dbPath, mode) => {
        const dbDest = path_1.default.join(electron_1.app.getPath('userData'), 'catalogu.db');
        try {
            if (mode === 'replace') {
                const { getDatabase } = await Promise.resolve().then(() => __importStar(require('./database.js')));
                try {
                    getDatabase().close();
                }
                catch { }
                fs_1.default.copyFileSync(dbPath, dbDest);
                const { setDbPath } = await Promise.resolve().then(() => __importStar(require('./database.js')));
                setDbPath(dbDest);
                return { success: true, imported: 0, skipped: 0, mode: 'replace' };
            }
            const Database = (await Promise.resolve().then(() => __importStar(require('better-sqlite3')))).default;
            const srcDb = new Database(dbPath, { readonly: true });
            const { getDatabase } = await Promise.resolve().then(() => __importStar(require('./database.js')));
            const destDb = getDatabase();
            const srcMedia = srcDb.prepare('SELECT * FROM media').all();
            let imported = 0;
            let skipped = 0;
            for (const m of srcMedia) {
                const exists = m.tmdb_id
                    ? destDb.prepare('SELECT id FROM media WHERE tmdb_id = ?').get(m.tmdb_id)
                    : destDb.prepare('SELECT id FROM media WHERE LOWER(title) = LOWER(?) AND release_year = ?').get(m.title, m.release_year ?? '');
                if (exists) {
                    skipped++;
                    continue;
                }
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
                    title: m.title,
                    release_year: m.release_year ?? null,
                    synopsis: m.synopsis ?? null,
                    observations: m.observations ?? null,
                    rating: m.rating ?? null,
                    duration: m.duration ?? null,
                    watched: m.watched ?? null,
                    cover_path: m.cover_path ?? null,
                    backdrop_path: m.backdrop_path ?? null,
                    tipo: m.tipo,
                    watched_status: m.watched_status ?? 'assistido',
                    tmdb_id: m.tmdb_id ?? null,
                    created_at: m.created_at ?? new Date().toISOString(),
                });
                imported++;
            }
            srcDb.close();
            return { success: true, imported, skipped, mode: 'merge' };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
}
function setupAutoUpdater(win) {
    electron_updater_1.autoUpdater.logger = electron_log_1.default;
    electron_updater_1.autoUpdater.logger.transports.file.level = 'info';
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;
    electron_updater_1.autoUpdater.autoDownload = true;
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        win.webContents.send('update:available', { version: info.version });
    });
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        win.webContents.send('update:progress', { percent: Math.round(progress.percent) });
    });
    electron_updater_1.autoUpdater.on('update-downloaded', () => {
        win.webContents.send('update:downloaded');
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        electron_log_1.default.error('Erro no auto-updater:', err);
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
    return win;
}
electron_1.app.whenReady().then(() => {
    (0, database_js_1.setDbPath)(path_1.default.join(electron_1.app.getPath('userData'), 'catalogu.db'));
    registerIpcHandlers();
    const win = createWindow();
    setupAutoUpdater(win);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
