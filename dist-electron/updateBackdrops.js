"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAllBackdrops = updateAllBackdrops;
const database_js_1 = require("./database.js");
const tmdb_js_1 = require("./tmdb.js");
async function updateAllBackdrops(onProgress) {
    const db = (0, database_js_1.getDatabase)();
    const items = db.prepare(`
    SELECT id, title, tmdb_id FROM media
    WHERE tipo = 'filme' AND (backdrop_path IS NULL OR backdrop_path = '')
    ORDER BY title
  `).all();
    const result = { updated: 0, skipped: 0, failed: 0 };
    const total = items.length;
    for (let i = 0; i < total; i++) {
        const item = items[i];
        if (!item.tmdb_id) {
            onProgress({ current: i + 1, total, title: item.title, status: 'no_tmdb' });
            result.skipped++;
            continue;
        }
        onProgress({ current: i + 1, total, title: item.title, status: 'updating' });
        try {
            const details = await (0, tmdb_js_1.getMovieDetails)(item.tmdb_id);
            const backdropUrl = details.backdrop_path
                ? (0, tmdb_js_1.getBackdropUrl)(details.backdrop_path, 'w1280')
                : null;
            if (!backdropUrl) {
                onProgress({ current: i + 1, total, title: item.title, status: 'no_backdrop' });
                result.skipped++;
                continue;
            }
            db.prepare('UPDATE media SET backdrop_path = ? WHERE id = ?').run(backdropUrl, item.id);
            onProgress({ current: i + 1, total, title: item.title, status: 'updated' });
            result.updated++;
            await new Promise(r => setTimeout(r, 200));
        }
        catch {
            result.failed++;
            onProgress({ current: i + 1, total, title: item.title, status: 'error' });
        }
    }
    return result;
}
