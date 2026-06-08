"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importFromV2Db = importFromV2Db;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const tmdb_js_1 = require("./tmdb.js");
const database_js_1 = require("./database.js");
function getV2Data(v2db, mediaId) {
    const genres = v2db.prepare(`
    SELECT g.name FROM genres g
    JOIN media_genres_link l ON l.genre_id = g.id
    WHERE l.media_id = ?
  `).all(mediaId);
    const tags = v2db.prepare(`
    SELECT t.name FROM tags t
    JOIN media_tags_link l ON l.tag_id = t.id
    WHERE l.media_id = ?
  `).all(mediaId);
    const people = v2db.prepare(`
    SELECT p.name, l.role FROM people p
    JOIN media_people_link l ON l.person_id = p.id
    WHERE l.media_id = ?
  `).all(mediaId);
    return { genres, tags, people };
}
function alreadyExists(title, releaseYear, tmdbId) {
    const db = (0, database_js_1.getDatabase)();
    if (tmdbId) {
        const row = db.prepare('SELECT id FROM media WHERE tmdb_id = ?').get(tmdbId);
        if (row)
            return true;
    }
    const row = db.prepare('SELECT id FROM media WHERE LOWER(title) = LOWER(?) AND release_year = ?')
        .get(title, releaseYear ?? '');
    return !!row;
}
function insertMedia(v2, tmdbId, posterUrl, backdropUrl, cast, director, genres, tags) {
    const db = (0, database_js_1.getDatabase)();
    const validStatuses = ['assistido', 'assistindo', 'nao_assistido', 'nao_lembro'];
    const watched_status = validStatuses.includes(v2.watched_status) ? v2.watched_status : 'assistido';
    const stmt = db.prepare(`
    INSERT INTO media (
      title, release_year, synopsis, observations, rating,
      duration, watched, cover_path, backdrop_path, tipo, watched_status, tmdb_id, created_at
    ) VALUES (
      @title, @release_year, @synopsis, @observations, @rating,
      @duration, @watched, @cover_path, @backdrop_path, @tipo, @watched_status, @tmdb_id, @created_at
    )
  `);
    const result = stmt.run({
        title: v2.title,
        release_year: v2.release_year ?? null,
        synopsis: v2.synopsis ?? null,
        observations: v2.observations ?? null,
        rating: v2.rating ?? null,
        duration: v2.duration ?? null,
        watched: v2.watched ?? null,
        cover_path: posterUrl ?? null,
        backdrop_path: backdropUrl ?? null,
        tipo: 'filme',
        watched_status,
        tmdb_id: tmdbId ?? null,
        created_at: v2.created_at ?? new Date().toISOString(),
    });
    const mediaId = result.lastInsertRowid;
    for (const g of genres) {
        let row = db.prepare('SELECT id FROM genres WHERE name = ?').get(g);
        if (!row) {
            const r = db.prepare('INSERT INTO genres (name) VALUES (?)').run(g);
            row = { id: r.lastInsertRowid };
        }
        db.prepare('INSERT OR IGNORE INTO media_genres_link (media_id, genre_id) VALUES (?, ?)').run(mediaId, row.id);
    }
    for (const t of tags) {
        let row = db.prepare('SELECT id FROM tags WHERE name = ?').get(t);
        if (!row) {
            const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(t);
            row = { id: r.lastInsertRowid };
        }
        db.prepare('INSERT OR IGNORE INTO media_tags_link (media_id, tag_id) VALUES (?, ?)').run(mediaId, row.id);
    }
    const people = [];
    if (director)
        people.push({ name: director, role: 'director' });
    for (const c of cast)
        people.push({ name: c, role: 'actor' });
    for (const person of people) {
        let row = db.prepare('SELECT id FROM people WHERE name = ?').get(person.name);
        if (!row) {
            const r = db.prepare('INSERT INTO people (name) VALUES (?)').run(person.name);
            row = { id: r.lastInsertRowid };
        }
        db.prepare('INSERT OR IGNORE INTO media_people_link (media_id, person_id, role) VALUES (?, ?, ?)').run(mediaId, row.id, person.role);
    }
    return mediaId;
}
async function importFromV2Db(dbPath, onProgress) {
    const v2db = new better_sqlite3_1.default(dbPath, { readonly: true });
    const v2medias = v2db.prepare(`
    SELECT * FROM media WHERE tipo = 'filme' ORDER BY title
  `).all();
    const importResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
    const total = v2medias.length;
    for (let i = 0; i < total; i++) {
        const v2 = v2medias[i];
        onProgress({ current: i + 1, total, title: v2.title, status: 'searching' });
        if (alreadyExists(v2.title, v2.release_year, v2.tmdb_id)) {
            onProgress({ current: i + 1, total, title: v2.title, status: 'skipped' });
            importResult.skipped++;
            continue;
        }
        const { genres, tags, people } = getV2Data(v2db, v2.id);
        const genreNames = genres.map(g => g.name);
        const tagNames = tags.map(t => t.name);
        const director = people.find(p => p.role === 'director')?.name ?? null;
        const cast = people.filter(p => p.role === 'actor').map(p => p.name);
        try {
            const results = await (0, tmdb_js_1.searchMovies)(v2.title);
            let matched = null;
            if (results && results.length > 0) {
                const year = v2.release_year ? v2.release_year.trim() : null;
                const byYear = year ? results.filter(r => (r.release_date ?? '').startsWith(year)) : results;
                const candidates = byYear.length > 0 ? byYear : results;
                if (candidates.length === 1) {
                    matched = candidates[0];
                }
                else if (candidates.length > 1 && v2.duration) {
                    for (const candidate of candidates.slice(0, 3)) {
                        try {
                            const details = await (0, tmdb_js_1.getMovieDetails)(candidate.id);
                            if (Math.abs((details.runtime ?? 0) - (v2.duration ?? 0)) <= 5) {
                                matched = candidate;
                                break;
                            }
                        }
                        catch { /* tenta próximo */ }
                    }
                    if (!matched)
                        matched = candidates[0];
                }
                else {
                    matched = candidates[0];
                }
            }
            if (matched) {
                const details = await (0, tmdb_js_1.getMovieDetails)(matched.id);
                const posterUrl = (0, tmdb_js_1.getPosterUrl)(details.poster_path, 'w500');
                const backdropUrl = details.backdrop_path
                    ? (0, tmdb_js_1.getBackdropUrl)(details.backdrop_path, 'w1280')
                    : null;
                const tmdbDir = details.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null;
                const tmdbCast = (details.credits?.cast ?? []).slice(0, 5).map((c) => c.name);
                const tmdbGenres = (details.genres ?? []).map((g) => g.name);
                insertMedia(v2, matched.id, posterUrl, backdropUrl, cast.length > 0 ? cast : tmdbCast, director ?? tmdbDir, genreNames.length > 0 ? genreNames : tmdbGenres, tagNames);
                onProgress({ current: i + 1, total, title: v2.title, status: 'found' });
                importResult.imported++;
            }
            else {
                insertMedia(v2, null, null, null, cast, director, genreNames, tagNames);
                onProgress({ current: i + 1, total, title: v2.title, status: 'not_found' });
                importResult.imported++;
            }
            await new Promise(r => setTimeout(r, 250));
        }
        catch (err) {
            importResult.failed++;
            importResult.errors.push(`${v2.title}: ${String(err)}`);
            onProgress({ current: i + 1, total, title: v2.title, status: 'error' });
        }
    }
    v2db.close();
    return importResult;
}
