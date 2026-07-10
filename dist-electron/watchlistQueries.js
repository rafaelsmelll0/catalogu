"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllWatchlist = getAllWatchlist;
exports.addToWatchlist = addToWatchlist;
exports.removeFromWatchlist = removeFromWatchlist;
exports.findDuplicateInWatchlist = findDuplicateInWatchlist;
exports.getWatchlistCount = getWatchlistCount;
exports.promoteToMedia = promoteToMedia;
const database_js_1 = require("./database.js");
const queries_js_1 = require("./queries.js");
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
function findDuplicateInWatchlist(tmdbId, title, releaseYear) {
    const db = (0, database_js_1.getDatabase)();
    if (tmdbId) {
        const row = db.prepare('SELECT * FROM watchlist WHERE tmdb_id = ?').get(tmdbId);
        if (row)
            return parseRow(row);
    }
    const row = db.prepare('SELECT * FROM watchlist WHERE LOWER(title) = LOWER(?) AND release_year = ?').get(title, releaseYear ?? '');
    return row ? parseRow(row) : null;
}
function getWatchlistCount() {
    const db = (0, database_js_1.getDatabase)();
    return db.prepare('SELECT COUNT(*) as n FROM watchlist').get().n;
}
/**
 * Promove um item de Próximos para o catálogo, preservando os vínculos com listas.
 *
 * Feito numa única transação: lê as listas do item da watchlist, cria a mídia no
 * catálogo, religa a nova mídia a essas listas e só então remove o item da watchlist.
 * Sem isso, o ON DELETE CASCADE de watchlist_lists_link apagaria os vínculos e o
 * título sumiria das listas ao ser marcado como assistido.
 */
function promoteToMedia(watchlistId, media) {
    const db = (0, database_js_1.getDatabase)();
    const run = db.transaction(() => {
        const listRows = db
            .prepare('SELECT list_id FROM watchlist_lists_link WHERE watchlist_id = ?')
            .all(watchlistId);
        const mediaId = (0, queries_js_1.addMedia)(media);
        const linkStmt = db.prepare('INSERT OR IGNORE INTO media_lists_link (media_id, list_id) VALUES (?, ?)');
        for (const { list_id } of listRows) {
            linkStmt.run(mediaId, list_id);
        }
        db.prepare('DELETE FROM watchlist WHERE id = ?').run(watchlistId);
        return mediaId;
    });
    return run();
}
