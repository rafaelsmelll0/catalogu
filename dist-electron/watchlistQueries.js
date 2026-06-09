"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllWatchlist = getAllWatchlist;
exports.addToWatchlist = addToWatchlist;
exports.removeFromWatchlist = removeFromWatchlist;
exports.getWatchlistCount = getWatchlistCount;
const database_js_1 = require("./database.js");
function parseRow(row) {
    return {
        ...row,
        genres: JSON.parse(row.genres ?? '[]'),
        cast: JSON.parse(row.cast ?? '[]'),
    };
}
function getAllWatchlist() {
    const db = (0, database_js_1.getDatabase)();
    const rows = db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all();
    return rows.map(parseRow);
}
function addToWatchlist(input) {
    const db = (0, database_js_1.getDatabase)();
    if (input.tmdb_id) {
        const exists = db.prepare('SELECT id FROM watchlist WHERE tmdb_id = ?').get(input.tmdb_id);
        if (exists)
            throw new Error('DUPLICATE');
    }
    const stmt = db.prepare(`
    INSERT INTO watchlist (
      title, tipo, release_year, synopsis,
      cover_path, backdrop_path, duration,
      director, genres, cast, tmdb_id
    ) VALUES (
      @title, @tipo, @release_year, @synopsis,
      @cover_path, @backdrop_path, @duration,
      @director, @genres, @cast, @tmdb_id
    )
  `);
    const result = stmt.run({
        title: input.title,
        tipo: input.tipo,
        release_year: input.release_year ?? null,
        synopsis: input.synopsis ?? null,
        cover_path: input.cover_path ?? null,
        backdrop_path: input.backdrop_path ?? null,
        duration: input.duration ?? null,
        director: input.director ?? null,
        genres: JSON.stringify(input.genres ?? []),
        cast: JSON.stringify(input.cast ?? []),
        tmdb_id: input.tmdb_id ?? null,
    });
    return result.lastInsertRowid;
}
function removeFromWatchlist(id) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM watchlist WHERE id = ?').run(id);
    return true;
}
function getWatchlistCount() {
    const db = (0, database_js_1.getDatabase)();
    return db.prepare('SELECT COUNT(*) as n FROM watchlist').get().n;
}
