"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDbPath = setDbPath;
exports.getDatabase = getDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let dbPath = '';
function setDbPath(p) { dbPath = p; }
let db;
function getDatabase() {
    if (!db) {
        db = new better_sqlite3_1.default(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}
function initSchema() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      release_year TEXT,
      synopsis TEXT,
      observations TEXT,
      rating REAL,
      duration INTEGER,
      watched INTEGER DEFAULT 0,
      cover_path TEXT,
      cover_path_thumb TEXT,
      backdrop_path TEXT,
      tipo TEXT NOT NULL CHECK(tipo IN ('filme','serie')),
      watched_status TEXT DEFAULT 'assistido' CHECK(watched_status IN ('assistido','assistindo','nao_assistido','nao_lembro')),
      tmdb_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS genres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS media_genres_link (
      media_id INTEGER,
      genre_id INTEGER,
      PRIMARY KEY (media_id, genre_id),
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
      FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_tags_link (
      media_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (media_id, tag_id),
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_people_link (
      media_id INTEGER,
      person_id INTEGER,
      role TEXT NOT NULL,
      PRIMARY KEY (media_id, person_id, role),
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_lists_link (
      media_id INTEGER,
      list_id INTEGER,
      PRIMARY KEY (media_id, list_id),
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      tipo          TEXT NOT NULL CHECK(tipo IN ('filme','serie')),
      release_year  TEXT,
      synopsis      TEXT,
      cover_path    TEXT,
      backdrop_path TEXT,
      duration      INTEGER,
      director      TEXT,
      genres        TEXT DEFAULT '[]',
      cast          TEXT DEFAULT '[]',
      tmdb_id       INTEGER,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
    // Migration: adicionar backdrop_path se não existir
    try {
        db.prepare('SELECT backdrop_path FROM media LIMIT 1').get();
    }
    catch {
        db.exec('ALTER TABLE media ADD COLUMN backdrop_path TEXT');
    }
    // Migration: criar watchlist em bancos antigos
    try {
        db.prepare('SELECT id FROM watchlist LIMIT 1').get();
    }
    catch {
        db.exec(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT NOT NULL,
        tipo          TEXT NOT NULL CHECK(tipo IN ('filme','serie')),
        release_year  TEXT,
        synopsis      TEXT,
        cover_path    TEXT,
        backdrop_path TEXT,
        duration      INTEGER,
        director      TEXT,
        genres        TEXT DEFAULT '[]',
        cast          TEXT DEFAULT '[]',
        tmdb_id       INTEGER,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
}
