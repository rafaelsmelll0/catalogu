import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'
import { exportBackup, mergeBackup } from '../backup.js'

/**
 * Cria um banco em arquivo com o schema atual do app (via database.ts).
 * vi.resetModules() descarta a conexão cacheada, então cada chamada gera uma
 * conexão nova apontando para o arquivo pedido.
 */
async function openAppDb(file: string): Promise<Database.Database> {
  vi.resetModules()
  const database = await import('../database.js')
  database.setDbPath(file)
  return database.getDatabase()
}

let dir: string
let opened: Database.Database[] = []

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogu-backup-'))
  opened = []
})

afterEach(() => {
  for (const d of opened) { try { d.close() } catch { /* já fechado */ } }
  fs.rmSync(dir, { recursive: true, force: true })
})

async function makeDb(name: string) {
  const db = await openAppDb(path.join(dir, name))
  opened.push(db)
  return db
}

/** Fecha o banco de origem (checkpoint do WAL) para que o merge leia o arquivo completo. */
function closeDb(db: Database.Database) {
  db.close()
  opened = opened.filter(d => d !== db)
}

function insertMedia(db: Database.Database, m: Record<string, unknown>): number {
  const row = {
    title: null, release_year: null, synopsis: null, observations: null, rating: null,
    duration: null, watched: 1, cover_path: null, cover_path_thumb: null, backdrop_path: null,
    tipo: 'filme', watched_status: 'assistido', tmdb_id: null, watched_date: null,
    created_at: '2024-01-15 10:00:00',
    ...m,
  }
  const info = db.prepare(`
    INSERT INTO media (title, release_year, synopsis, observations, rating, duration, watched,
      cover_path, cover_path_thumb, backdrop_path, tipo, watched_status, tmdb_id, watched_date, created_at)
    VALUES (@title, @release_year, @synopsis, @observations, @rating, @duration, @watched,
      @cover_path, @cover_path_thumb, @backdrop_path, @tipo, @watched_status, @tmdb_id, @watched_date, @created_at)
  `).run(row)
  return Number(info.lastInsertRowid)
}

function named(db: Database.Database, table: string, name: string): number {
  db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(name)
  return (db.prepare(`SELECT id FROM ${table} WHERE name = ?`).get(name) as { id: number }).id
}

function link(db: Database.Database, mediaId: number, opts: {
  genres?: string[]; tags?: string[]; people?: [string, string][]; lists?: string[]
}) {
  for (const g of opts.genres ?? []) {
    db.prepare('INSERT INTO media_genres_link (media_id, genre_id) VALUES (?, ?)').run(mediaId, named(db, 'genres', g))
  }
  for (const t of opts.tags ?? []) {
    db.prepare('INSERT INTO media_tags_link (media_id, tag_id) VALUES (?, ?)').run(mediaId, named(db, 'tags', t))
  }
  for (const [p, role] of opts.people ?? []) {
    db.prepare('INSERT INTO media_people_link (media_id, person_id, role) VALUES (?, ?, ?)').run(mediaId, named(db, 'people', p), role)
  }
  for (const l of opts.lists ?? []) {
    db.prepare('INSERT INTO media_lists_link (media_id, list_id) VALUES (?, ?)').run(mediaId, named(db, 'lists', l))
  }
}

function insertWatchlist(db: Database.Database, w: Record<string, unknown>): number {
  const row = {
    title: null, tipo: 'filme', release_year: null, synopsis: null, cover_path: null,
    backdrop_path: null, duration: null, director: null, genres: '[]', cast: '[]',
    tmdb_id: null, created_at: '2024-02-01 12:00:00',
    ...w,
  }
  const info = db.prepare(`
    INSERT INTO watchlist (title, tipo, release_year, synopsis, cover_path, backdrop_path, duration,
      director, genres, "cast", tmdb_id, created_at)
    VALUES (@title, @tipo, @release_year, @synopsis, @cover_path, @backdrop_path, @duration,
      @director, @genres, @cast, @tmdb_id, @created_at)
  `).run(row)
  return Number(info.lastInsertRowid)
}

function mediaByTitle(db: Database.Database, title: string, tipo = 'filme') {
  return db.prepare('SELECT * FROM media WHERE title = ? AND tipo = ?').get(title, tipo) as any
}

function namesFor(db: Database.Database, mediaId: number, table: string, linkTable: string, fk: string): string[] {
  return (db.prepare(`
    SELECT e.name FROM ${linkTable} l JOIN ${table} e ON e.id = l.${fk} WHERE l.media_id = ? ORDER BY e.name
  `).all(mediaId) as { name: string }[]).map(r => r.name)
}

function listsOfMedia(db: Database.Database, mediaId: number): string[] {
  return namesFor(db, mediaId, 'lists', 'media_lists_link', 'list_id')
}

describe('mergeBackup — catálogo completo', () => {
  it('importa media com todas as colunas, gêneros, tags, pessoas, listas e watchlist', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    const matrix = insertMedia(src, {
      title: 'Matrix', release_year: '1999', synopsis: 'Hacker', observations: 'rever',
      rating: 5, duration: 136, cover_path: 'catimg://covers/603.webp',
      cover_path_thumb: 'catimg://thumbs/603.webp', backdrop_path: 'https://img/bd.jpg',
      tmdb_id: 603, watched_date: '2023-12-25', watched_status: 'assistido',
    })
    link(src, matrix, {
      genres: ['Ação', 'Ficção científica'], tags: ['favorito'],
      people: [['Lana Wachowski', 'director'], ['Keanu Reeves', 'actor']],
      lists: ['Top 10'],
    })
    src.prepare("UPDATE lists SET description = 'Os melhores' WHERE name = 'Top 10'").run()
    const wl = insertWatchlist(src, {
      title: 'Duna', release_year: '2021', tmdb_id: 438631, director: 'Denis Villeneuve',
      genres: '["Ficção científica"]', cast: '["Timothée Chalamet"]', cover_path: 'catimg://covers/438631.webp',
    })
    src.prepare('INSERT INTO watchlist_lists_link (watchlist_id, list_id) VALUES (?, ?)')
      .run(wl, named(src, 'lists', 'Top 10'))
    closeDb(src)

    const dest = await makeDb('dest.db')
    const res = mergeBackup(dest, srcFile)

    expect(res).toEqual({ imported: 1, skipped: 0, watchlistImported: 1, watchlistSkipped: 0, listsCreated: 1 })

    const m = mediaByTitle(dest, 'Matrix')
    expect(m).toMatchObject({
      release_year: '1999', synopsis: 'Hacker', observations: 'rever', rating: 5, duration: 136,
      cover_path: 'catimg://covers/603.webp', cover_path_thumb: 'catimg://thumbs/603.webp',
      backdrop_path: 'https://img/bd.jpg', tmdb_id: 603, watched_date: '2023-12-25',
      watched_status: 'assistido', created_at: '2024-01-15 10:00:00',
    })
    expect(namesFor(dest, m.id, 'genres', 'media_genres_link', 'genre_id')).toEqual(['Ação', 'Ficção científica'])
    expect(namesFor(dest, m.id, 'tags', 'media_tags_link', 'tag_id')).toEqual(['favorito'])
    const people = dest.prepare(`
      SELECT p.name, l.role FROM media_people_link l JOIN people p ON p.id = l.person_id
      WHERE l.media_id = ? ORDER BY p.name
    `).all(m.id)
    expect(people).toEqual([
      { name: 'Keanu Reeves', role: 'actor' },
      { name: 'Lana Wachowski', role: 'director' },
    ])
    expect(listsOfMedia(dest, m.id)).toEqual(['Top 10'])
    expect(dest.prepare("SELECT description FROM lists WHERE name = 'Top 10'").get()).toEqual({ description: 'Os melhores' })

    const w = dest.prepare("SELECT * FROM watchlist WHERE title = 'Duna'").get() as any
    expect(w).toMatchObject({
      release_year: '2021', tmdb_id: 438631, director: 'Denis Villeneuve',
      genres: '["Ficção científica"]', cast: '["Timothée Chalamet"]',
      cover_path: 'catimg://covers/438631.webp', created_at: '2024-02-01 12:00:00',
    })
    const wlLists = dest.prepare(`
      SELECT l.name FROM watchlist_lists_link x JOIN lists l ON l.id = x.list_id WHERE x.watchlist_id = ?
    `).all(w.id)
    expect(wlLists).toEqual([{ name: 'Top 10' }])
  })

  it('pula duplicatas, reusa gêneros/pessoas existentes e mescla listas de títulos já existentes', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    const a = insertMedia(src, { title: 'Matrix', release_year: '1999', tmdb_id: 603, observations: 'versão do backup' })
    link(src, a, { genres: ['Drama'], lists: ['favoritos', 'Anos 90'] })
    const b = insertMedia(src, { title: 'Filme Caseiro', release_year: '2010' })   // sem tmdb_id
    link(src, b, { lists: ['Favoritos'] })
    const c = insertMedia(src, { title: 'Novo', release_year: '2020', tmdb_id: 1 })
    link(src, c, { genres: ['Ação'], people: [['Keanu Reeves', 'actor']], lists: ['FAVORITOS'] })
    closeDb(src)

    const dest = await makeDb('dest.db')
    const destMatrix = insertMedia(dest, { title: 'Matrix', release_year: '1999', tmdb_id: 603, observations: 'local' })
    link(dest, destMatrix, { genres: ['Ação'], lists: ['Favoritos'] })
    insertMedia(dest, { title: 'filme caseiro', release_year: '2010' })
    named(dest, 'people', 'Keanu Reeves')

    const res = mergeBackup(dest, srcFile)
    expect(res).toMatchObject({ imported: 1, skipped: 2, listsCreated: 1 })

    // Não duplicou nem sobrescreveu o existente
    expect(dest.prepare("SELECT COUNT(*) AS n FROM media WHERE tmdb_id = 603").get()).toEqual({ n: 1 })
    expect(mediaByTitle(dest, 'Matrix').observations).toBe('local')
    expect(dest.prepare("SELECT COUNT(*) AS n FROM media WHERE LOWER(title) = 'filme caseiro'").get()).toEqual({ n: 1 })
    // Gêneros de título pulado não são mexidos
    expect(namesFor(dest, destMatrix, 'genres', 'media_genres_link', 'genre_id')).toEqual(['Ação'])

    // Listas: "favoritos"/"FAVORITOS" casam com "Favoritos"; "Anos 90" é criada
    expect(dest.prepare('SELECT COUNT(*) AS n FROM lists').get()).toEqual({ n: 2 })
    expect(listsOfMedia(dest, destMatrix)).toEqual(['Anos 90', 'Favoritos'])
    const caseiro = dest.prepare("SELECT id FROM media WHERE LOWER(title) = 'filme caseiro'").get() as { id: number }
    expect(listsOfMedia(dest, caseiro.id)).toEqual(['Favoritos'])

    // Importado reusa gênero/pessoa já existentes (sem duplicar)
    const novo = mediaByTitle(dest, 'Novo')
    expect(namesFor(dest, novo.id, 'genres', 'media_genres_link', 'genre_id')).toEqual(['Ação'])
    expect(dest.prepare("SELECT COUNT(*) AS n FROM genres WHERE name = 'Ação'").get()).toEqual({ n: 1 })
    expect(dest.prepare("SELECT COUNT(*) AS n FROM people WHERE name = 'Keanu Reeves'").get()).toEqual({ n: 1 })
    expect(listsOfMedia(dest, novo.id)).toEqual(['Favoritos'])
  })

  it('mesmo tmdb_id em filme e série NÃO é duplicata', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    insertMedia(src, { title: 'Fargo', release_year: '2014', tmdb_id: 275, tipo: 'serie' })
    insertMedia(src, { title: 'Fargo', release_year: '1996', tmdb_id: 275, tipo: 'filme' })
    closeDb(src)

    const dest = await makeDb('dest.db')
    insertMedia(dest, { title: 'Fargo', release_year: '1996', tmdb_id: 275, tipo: 'filme' })

    const res = mergeBackup(dest, srcFile)
    expect(res).toMatchObject({ imported: 1, skipped: 1 })
    expect(mediaByTitle(dest, 'Fargo', 'serie')).toBeTruthy()
    expect(dest.prepare('SELECT COUNT(*) AS n FROM media').get()).toEqual({ n: 2 })
  })

  it('título igual sem tmdb_id mas tipo diferente também não é duplicata', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    insertMedia(src, { title: 'Shogun', release_year: null, tipo: 'serie' })
    closeDb(src)

    const dest = await makeDb('dest.db')
    insertMedia(dest, { title: 'Shogun', release_year: null, tipo: 'filme' })
    expect(mergeBackup(dest, srcFile)).toMatchObject({ imported: 1, skipped: 0 })
  })

  it('watchlist: pula duplicata em Próximos (mesclando listas) e o que já está no catálogo', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    const dup = insertWatchlist(src, { title: 'Duna', release_year: '2021', tmdb_id: 438631 })
    insertWatchlist(src, { title: 'Oppenheimer', release_year: '2023', tmdb_id: 872585 })   // já assistido no destino
    insertWatchlist(src, { title: 'Curta Indie', release_year: '2019' })                    // já assistido (título+ano)
    insertWatchlist(src, { title: 'Duna', release_year: '2021', tmdb_id: 438631, tipo: 'serie' }) // outro tipo → novo
    src.prepare('INSERT INTO watchlist_lists_link (watchlist_id, list_id) VALUES (?, ?)').run(dup, named(src, 'lists', 'Sci-fi'))
    closeDb(src)

    const dest = await makeDb('dest.db')
    const destDuna = insertWatchlist(dest, { title: 'Duna', release_year: '2021', tmdb_id: 438631 })
    insertMedia(dest, { title: 'Oppenheimer', release_year: '2023', tmdb_id: 872585 })
    insertMedia(dest, { title: 'curta indie', release_year: '2019' })

    const res = mergeBackup(dest, srcFile)
    expect(res).toMatchObject({ watchlistImported: 1, watchlistSkipped: 3, listsCreated: 1 })
    expect(dest.prepare('SELECT COUNT(*) AS n FROM watchlist').get()).toEqual({ n: 2 })
    expect(dest.prepare("SELECT COUNT(*) AS n FROM watchlist WHERE title = 'Oppenheimer'").get()).toEqual({ n: 0 })
    const links = dest.prepare(`
      SELECT l.name FROM watchlist_lists_link x JOIN lists l ON l.id = x.list_id WHERE x.watchlist_id = ?
    `).all(destDuna)
    expect(links).toEqual([{ name: 'Sci-fi' }])
  })

  it('watchlist: item que também está no catálogo do próprio backup não volta para Próximos', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    insertMedia(src, { title: 'Alien', release_year: '1979', tmdb_id: 348 })
    insertWatchlist(src, { title: 'Alien', release_year: '1979', tmdb_id: 348 })
    closeDb(src)

    const dest = await makeDb('dest.db')
    expect(mergeBackup(dest, srcFile)).toMatchObject({ imported: 1, watchlistImported: 0, watchlistSkipped: 1 })
  })

  it('merge repetido é idempotente', async () => {
    const srcFile = path.join(dir, 'src.db')
    const src = await makeDb('src.db')
    const id = insertMedia(src, { title: 'Matrix', release_year: '1999', tmdb_id: 603 })
    link(src, id, { genres: ['Ação'], lists: ['Top'] })
    insertWatchlist(src, { title: 'Duna', release_year: '2021', tmdb_id: 438631 })
    closeDb(src)

    const dest = await makeDb('dest.db')
    mergeBackup(dest, srcFile)
    const second = mergeBackup(dest, srcFile)
    expect(second).toEqual({ imported: 0, skipped: 1, watchlistImported: 0, watchlistSkipped: 1, listsCreated: 0 })
    expect(dest.prepare('SELECT COUNT(*) AS n FROM media_lists_link').get()).toEqual({ n: 1 })
    expect(dest.prepare('SELECT COUNT(*) AS n FROM media_genres_link').get()).toEqual({ n: 1 })
  })
})

describe('mergeBackup — backups de schema antigo', () => {
  it('funciona sem watchlist, watched_date, backdrop_path, cover_path_thumb, description e watchlist_lists_link', async () => {
    const srcFile = path.join(dir, 'old.db')
    const old = new Database(srcFile)
    old.exec(`
      CREATE TABLE media (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, release_year TEXT, synopsis TEXT,
        observations TEXT, rating REAL, duration INTEGER, watched INTEGER DEFAULT 0, cover_path TEXT,
        tipo TEXT NOT NULL, watched_status TEXT DEFAULT 'assistido', tmdb_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE genres (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
      CREATE TABLE lists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
      CREATE TABLE media_genres_link (media_id INTEGER, genre_id INTEGER, PRIMARY KEY (media_id, genre_id));
      CREATE TABLE media_lists_link (media_id INTEGER, list_id INTEGER, PRIMARY KEY (media_id, list_id));
      INSERT INTO media (title, release_year, tipo, tmdb_id, cover_path, created_at)
        VALUES ('Antigo', '1980', 'filme', 99, 'catimg://covers/99.webp', '2022-05-10 08:30:00');
      INSERT INTO genres (name) VALUES ('Terror');
      INSERT INTO media_genres_link VALUES (1, 1);
      INSERT INTO lists (name) VALUES ('Clássicos');
      INSERT INTO media_lists_link VALUES (1, 1);
    `)
    old.close()

    const dest = await makeDb('dest.db')
    const res = mergeBackup(dest, srcFile)
    expect(res).toEqual({ imported: 1, skipped: 0, watchlistImported: 0, watchlistSkipped: 0, listsCreated: 1 })

    const m = mediaByTitle(dest, 'Antigo')
    expect(m).toMatchObject({
      watched_date: '2022-05-10', backdrop_path: null, cover_path_thumb: null,
      cover_path: 'catimg://covers/99.webp', tmdb_id: 99,
    })
    expect(namesFor(dest, m.id, 'genres', 'media_genres_link', 'genre_id')).toEqual(['Terror'])
    expect(listsOfMedia(dest, m.id)).toEqual(['Clássicos'])
    expect(dest.prepare("SELECT description FROM lists WHERE name = 'Clássicos'").get()).toEqual({ description: null })
  })

  it('funciona com watchlist antiga sem backdrop_path e sem watchlist_lists_link', async () => {
    const srcFile = path.join(dir, 'old.db')
    const old = new Database(srcFile)
    old.exec(`
      CREATE TABLE media (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, release_year TEXT,
        tipo TEXT NOT NULL, tmdb_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE watchlist (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, tipo TEXT NOT NULL,
        release_year TEXT, tmdb_id INTEGER, genres TEXT, cast TEXT);
      INSERT INTO watchlist (title, tipo, release_year, tmdb_id, genres) VALUES ('Futuro', 'serie', '2025', 5, '["Drama"]');
    `)
    old.close()

    const dest = await makeDb('dest.db')
    const res = mergeBackup(dest, srcFile)
    expect(res).toMatchObject({ imported: 0, watchlistImported: 1 })
    const w = dest.prepare("SELECT * FROM watchlist WHERE title = 'Futuro'").get() as any
    expect(w).toMatchObject({ tipo: 'serie', genres: '["Drama"]', cast: '[]', backdrop_path: null })
    expect(w.created_at).toBeTruthy()
  })

  it('rejeita arquivo sem tabela media e não altera o destino', async () => {
    const srcFile = path.join(dir, 'lixo.db')
    const junk = new Database(srcFile)
    junk.exec('CREATE TABLE foo (x INTEGER)')
    junk.close()

    const dest = await makeDb('dest.db')
    expect(() => mergeBackup(dest, srcFile)).toThrow(/media/)
    expect(dest.prepare('SELECT COUNT(*) AS n FROM media').get()).toEqual({ n: 0 })
    // srcDb foi fechado: dá para apagar o arquivo (no Windows falharia se aberto)
    expect(() => fs.unlinkSync(srcFile)).not.toThrow()
  })

  it('erro no meio faz rollback de tudo e fecha a origem', async () => {
    const srcFile = path.join(dir, 'bad.db')
    const bad = new Database(srcFile)
    bad.exec(`
      CREATE TABLE media (id INTEGER PRIMARY KEY, title TEXT, release_year TEXT, tipo TEXT, tmdb_id INTEGER);
      INSERT INTO media VALUES (1, 'Bom', '2000', 'filme', 10);
      INSERT INTO media VALUES (2, 'Tipo inválido', '2001', 'documentario', 11);
    `)
    bad.close()

    const dest = await makeDb('dest.db')
    expect(() => mergeBackup(dest, srcFile)).toThrow()
    expect(dest.prepare('SELECT COUNT(*) AS n FROM media').get()).toEqual({ n: 0 })
    expect(() => fs.unlinkSync(srcFile)).not.toThrow()
  })
})

describe('exportBackup', () => {
  it('inclui linhas ainda no WAL (escritas logo antes do export)', async () => {
    const db = await makeDb('live.db')
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    db.pragma('wal_autocheckpoint = 0')   // garante que a linha fica só no WAL
    insertMedia(db, { title: 'Recém-cadastrado', release_year: '2026', tmdb_id: 777 })

    // Prova de que copiar o .db cru perderia a linha (o bug antigo)
    const rawCopy = path.join(dir, 'raw.db')
    fs.copyFileSync(path.join(dir, 'live.db'), rawCopy)
    const raw = new Database(rawCopy, { readonly: true })
    const rawHas = raw.prepare("SELECT name FROM sqlite_master WHERE name = 'media'").get()
      ? raw.prepare("SELECT COUNT(*) AS n FROM media WHERE tmdb_id = 777").get()
      : { n: 0 }
    raw.close()
    expect(rawHas).toEqual({ n: 0 })

    const out = path.join(dir, 'export.db')
    await exportBackup(db, out)
    expect(fs.existsSync(out)).toBe(true)

    const check = new Database(out, { readonly: true })
    expect(check.prepare("SELECT title FROM media WHERE tmdb_id = 777").get()).toEqual({ title: 'Recém-cadastrado' })
    check.close()
  })

  it('round-trip: export e depois merge em outro banco', async () => {
    const live = await makeDb('live.db')
    const id = insertMedia(live, { title: 'Round', release_year: '2001', tmdb_id: 42 })
    link(live, id, { genres: ['Comédia'], lists: ['L1'] })
    insertWatchlist(live, { title: 'Depois', release_year: '2027', tmdb_id: 43 })
    const out = path.join(dir, 'export.db')
    await exportBackup(live, out)

    const dest = await makeDb('dest.db')
    const res = mergeBackup(dest, out)
    expect(res).toEqual({ imported: 1, skipped: 0, watchlistImported: 1, watchlistSkipped: 0, listsCreated: 1 })
    expect(() => fs.unlinkSync(out)).not.toThrow()
  })
})
