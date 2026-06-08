"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllMedia = getAllMedia;
exports.getMediaById = getMediaById;
exports.addMedia = addMedia;
exports.updateMedia = updateMedia;
exports.deleteMedia = deleteMedia;
exports.getAllTags = getAllTags;
exports.getAllGenres = getAllGenres;
exports.getAllLists = getAllLists;
exports.createList = createList;
exports.updateList = updateList;
exports.deleteList = deleteList;
exports.getMediaInList = getMediaInList;
exports.addMediaToList = addMediaToList;
exports.removeMediaFromList = removeMediaFromList;
exports.getStats = getStats;
const database_js_1 = require("./database.js");
// -- MEDIA -------------------------------------------------------------------
function getAllMedia() {
    const db = (0, database_js_1.getDatabase)();
    const rows = db.prepare(`
    SELECT * FROM media ORDER BY created_at DESC
  `).all();
    return rows.map(row => ({
        ...row,
        genres: getGenresForMedia(row.id),
        tags: getTagsForMedia(row.id),
        cast: getCastForMedia(row.id),
        director: getDirectorForMedia(row.id),
    }));
}
function getMediaById(id) {
    const db = (0, database_js_1.getDatabase)();
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    if (!row)
        return null;
    return {
        ...row,
        genres: getGenresForMedia(id),
        tags: getTagsForMedia(id),
        cast: getCastForMedia(id),
        director: getDirectorForMedia(id),
    };
}
function addMedia(input) {
    const db = (0, database_js_1.getDatabase)();
    const { genres = [], tags = [], director, cast = [], ...mediaFields } = input;
    const stmt = db.prepare(`
    INSERT INTO media (
      title, release_year, synopsis, observations, rating,
      duration, watched, cover_path, cover_path_thumb, backdrop_path,
      tipo, watched_status, tmdb_id
    ) VALUES (
      @title, @release_year, @synopsis, @observations, @rating,
      @duration, @watched, @cover_path, @cover_path_thumb, @backdrop_path,
      @tipo, @watched_status, @tmdb_id
    )
  `);
    const result = stmt.run({
        title: mediaFields.title,
        release_year: mediaFields.release_year ?? null,
        synopsis: mediaFields.synopsis ?? null,
        observations: mediaFields.observations ?? null,
        rating: mediaFields.rating ?? null,
        duration: mediaFields.duration ?? null,
        watched: mediaFields.watched ?? null,
        cover_path: mediaFields.cover_path ?? null,
        cover_path_thumb: mediaFields.cover_path_thumb ?? null,
        backdrop_path: mediaFields.backdrop_path ?? null,
        tipo: mediaFields.tipo,
        watched_status: mediaFields.watched_status ?? 'assistido',
        tmdb_id: mediaFields.tmdb_id ?? null,
    });
    const mediaId = result.lastInsertRowid;
    if (genres.length > 0)
        setGenresForMedia(mediaId, genres);
    if (tags.length > 0)
        setTagsForMedia(mediaId, tags);
    if (director || cast.length > 0)
        setPeopleForMedia(mediaId, director, cast);
    return mediaId;
}
function updateMedia(id, input) {
    const db = (0, database_js_1.getDatabase)();
    const { genres, tags, director, cast, ...fields } = input;
    const setClauses = Object.keys(fields)
        .map(k => `${k} = @${k}`)
        .join(', ');
    if (setClauses) {
        db.prepare(`UPDATE media SET ${setClauses} WHERE id = @id`)
            .run({ ...fields, id });
    }
    if (genres !== undefined)
        setGenresForMedia(id, genres);
    if (tags !== undefined)
        setTagsForMedia(id, tags);
    if (director !== undefined || cast !== undefined) {
        setPeopleForMedia(id, director, cast ?? []);
    }
    return true;
}
function deleteMedia(id) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM media WHERE id = ?').run(id);
    return true;
}
// -- ASSOCIAÇÕES -------------------------------------------------------------
function getGenresForMedia(mediaId) {
    const db = (0, database_js_1.getDatabase)();
    const rows = db.prepare(`
    SELECT g.name FROM genres g
    JOIN media_genres_link l ON l.genre_id = g.id
    WHERE l.media_id = ?
  `).all(mediaId);
    return rows.map(r => r.name);
}
function getTagsForMedia(mediaId) {
    const db = (0, database_js_1.getDatabase)();
    const rows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN media_tags_link l ON l.tag_id = t.id
    WHERE l.media_id = ?
  `).all(mediaId);
    return rows.map(r => r.name);
}
function getCastForMedia(mediaId) {
    const db = (0, database_js_1.getDatabase)();
    const rows = db.prepare(`
    SELECT p.name FROM people p
    JOIN media_people_link l ON l.person_id = p.id
    WHERE l.media_id = ? AND l.role = 'actor'
  `).all(mediaId);
    return rows.map(r => r.name);
}
function getDirectorForMedia(mediaId) {
    const db = (0, database_js_1.getDatabase)();
    const row = db.prepare(`
    SELECT p.name FROM people p
    JOIN media_people_link l ON l.person_id = p.id
    WHERE l.media_id = ? AND l.role = 'director'
    LIMIT 1
  `).get(mediaId);
    return row?.name;
}
function setGenresForMedia(mediaId, genres) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM media_genres_link WHERE media_id = ?').run(mediaId);
    for (const name of genres) {
        let row = db.prepare('SELECT id FROM genres WHERE name = ?').get(name);
        if (!row) {
            const r = db.prepare('INSERT INTO genres (name) VALUES (?)').run(name);
            row = { id: r.lastInsertRowid };
        }
        db.prepare('INSERT OR IGNORE INTO media_genres_link (media_id, genre_id) VALUES (?, ?)').run(mediaId, row.id);
    }
}
function setTagsForMedia(mediaId, tags) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM media_tags_link WHERE media_id = ?').run(mediaId);
    for (const name of tags) {
        let row = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
        if (!row) {
            const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
            row = { id: r.lastInsertRowid };
        }
        db.prepare('INSERT OR IGNORE INTO media_tags_link (media_id, tag_id) VALUES (?, ?)').run(mediaId, row.id);
    }
}
function setPeopleForMedia(mediaId, director, cast = []) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM media_people_link WHERE media_id = ?').run(mediaId);
    const people = [];
    if (director)
        people.push({ name: director, role: 'director' });
    for (const name of cast)
        people.push({ name, role: 'actor' });
    for (const person of people) {
        let row = db.prepare('SELECT id FROM people WHERE name = ?').get(person.name);
        if (!row) {
            const r = db.prepare('INSERT INTO people (name) VALUES (?)').run(person.name);
            row = { id: r.lastInsertRowid };
        }
        db.prepare('INSERT OR IGNORE INTO media_people_link (media_id, person_id, role) VALUES (?, ?, ?)').run(mediaId, row.id, person.role);
    }
}
// -- TAGS --------------------------------------------------------------------
function getAllTags() {
    const db = (0, database_js_1.getDatabase)();
    return db.prepare('SELECT * FROM tags ORDER BY name').all();
}
// -- GÊNEROS -----------------------------------------------------------------
function getAllGenres() {
    const db = (0, database_js_1.getDatabase)();
    return db.prepare('SELECT * FROM genres ORDER BY name').all();
}
function getAllLists() {
    const db = (0, database_js_1.getDatabase)();
    return db.prepare(`
    SELECT l.*, COUNT(ml.media_id) as media_count
    FROM lists l
    LEFT JOIN media_lists_link ml ON ml.list_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `).all();
}
function createList(name, description = '') {
    const db = (0, database_js_1.getDatabase)();
    const r = db.prepare('INSERT INTO lists (name, description) VALUES (?, ?)').run(name, description);
    return r.lastInsertRowid;
}
function updateList(id, name, description) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('UPDATE lists SET name = ?, description = ? WHERE id = ?').run(name, description, id);
    return true;
}
function deleteList(id) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM lists WHERE id = ?').run(id);
    return true;
}
function getMediaInList(listId) {
    const db = (0, database_js_1.getDatabase)();
    const rows = db.prepare(`
    SELECT m.* FROM media m
    JOIN media_lists_link ml ON ml.media_id = m.id
    WHERE ml.list_id = ?
    ORDER BY m.title
  `).all(listId);
    return rows.map(row => ({
        ...row,
        genres: getGenresForMedia(row.id),
        tags: getTagsForMedia(row.id),
        cast: getCastForMedia(row.id),
        director: getDirectorForMedia(row.id),
    }));
}
function addMediaToList(mediaId, listId) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('INSERT OR IGNORE INTO media_lists_link (media_id, list_id) VALUES (?, ?)').run(mediaId, listId);
    return true;
}
function removeMediaFromList(mediaId, listId) {
    const db = (0, database_js_1.getDatabase)();
    db.prepare('DELETE FROM media_lists_link WHERE media_id = ? AND list_id = ?').run(mediaId, listId);
    return true;
}
// -- ESTATÍSTICAS ------------------------------------------------------------
function getStats() {
    const db = (0, database_js_1.getDatabase)();
    const total = db.prepare('SELECT COUNT(*) as n FROM media').get().n;
    const filmes = db.prepare("SELECT COUNT(*) as n FROM media WHERE tipo = 'filme'").get().n;
    const series = db.prepare("SELECT COUNT(*) as n FROM media WHERE tipo = 'serie'").get().n;
    const assistidos = db.prepare("SELECT COUNT(*) as n FROM media WHERE watched_status = 'assistido'").get().n;
    const naoAssistidos = db.prepare("SELECT COUNT(*) as n FROM media WHERE watched_status = 'nao_assistido'").get().n;
    const avgRow = db.prepare('SELECT AVG(rating) as avg FROM media WHERE rating IS NOT NULL').get();
    return {
        total,
        filmes,
        series,
        assistidos,
        naoAssistidos,
        mediaRating: avgRow.avg ? Math.round(avgRow.avg * 10) / 10 : 0,
    };
}
