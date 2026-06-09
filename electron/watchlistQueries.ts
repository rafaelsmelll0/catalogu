import { getDatabase } from './database.js'

export interface WatchlistRow {
  id:            number
  title:         string
  tipo:          'filme' | 'serie'
  release_year?: string
  synopsis?:     string
  cover_path?:   string
  backdrop_path?: string
  duration?:     number
  director?:     string
  genres:        string[]
  cast:          string[]
  tmdb_id?:      number
  created_at:    string
}

interface WatchlistRowRaw extends Omit<WatchlistRow, 'genres' | 'cast'> {
  genres: string
  cast:   string
}

function parseRow(row: WatchlistRowRaw): WatchlistRow {
  return {
    ...row,
    genres: JSON.parse(row.genres ?? '[]'),
    cast:   JSON.parse(row.cast   ?? '[]'),
  }
}

export interface AddWatchlistInput {
  title:         string
  tipo:          'filme' | 'serie'
  release_year?: string
  synopsis?:     string
  cover_path?:   string
  backdrop_path?: string
  duration?:     number
  director?:     string
  genres?:       string[]
  cast?:         string[]
  tmdb_id?:      number
}

export function getAllWatchlist(): WatchlistRow[] {
  const db   = getDatabase()
  const rows = db.prepare('SELECT * FROM watchlist ORDER BY created_at DESC').all() as WatchlistRowRaw[]
  return rows.map(parseRow)
}

export function addToWatchlist(input: AddWatchlistInput): number {
  const db = getDatabase()

  if (input.tmdb_id) {
    const exists = db.prepare('SELECT id FROM watchlist WHERE tmdb_id = ?').get(input.tmdb_id)
    if (exists) throw new Error('DUPLICATE')
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
  `)

  const result = stmt.run({
    title:         input.title,
    tipo:          input.tipo,
    release_year:  input.release_year  ?? null,
    synopsis:      input.synopsis      ?? null,
    cover_path:    input.cover_path    ?? null,
    backdrop_path: input.backdrop_path ?? null,
    duration:      input.duration      ?? null,
    director:      input.director      ?? null,
    genres:        JSON.stringify(input.genres ?? []),
    cast:          JSON.stringify(input.cast   ?? []),
    tmdb_id:       input.tmdb_id       ?? null,
  })

  return result.lastInsertRowid as number
}

export function removeFromWatchlist(id: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(id)
  return true
}

export function getWatchlistCount(): number {
  const db = getDatabase()
  return (db.prepare('SELECT COUNT(*) as n FROM watchlist').get() as { n: number }).n
}
