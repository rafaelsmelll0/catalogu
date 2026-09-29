import { getDatabase } from './database.js'
import { addMedia, getMediaById, type AddMediaInput } from './queries.js'

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
    const exists = db.prepare('SELECT id FROM watchlist WHERE tmdb_id = ? AND tipo = ?').get(input.tmdb_id, input.tipo)
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

/** Remove o item e devolve os caminhos de imagem dele (para apagar arquivos locais órfãos). */
export function removeFromWatchlist(id: number): { cover_path: string | null; backdrop_path: string | null } | null {
  const db = getDatabase()
  const row = db.prepare('SELECT cover_path, backdrop_path FROM watchlist WHERE id = ?').get(id) as
    { cover_path: string | null; backdrop_path: string | null } | undefined
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(id)
  return row ?? null
}

/** Mesma regra de findDuplicateInMedia: o tipo separa IDs de filme e de série no TMDB. */
export function findDuplicateInWatchlist(
  tmdbId: number | null,
  title: string,
  releaseYear?: string,
  tipo?: 'filme' | 'serie',
): WatchlistRow | null {
  const db = getDatabase()

  if (tmdbId) {
    const row = (tipo
      ? db.prepare('SELECT * FROM watchlist WHERE tmdb_id = ? AND tipo = ?').get(tmdbId, tipo)
      : db.prepare('SELECT * FROM watchlist WHERE tmdb_id = ?').get(tmdbId)) as WatchlistRowRaw | undefined
    if (row) return parseRow(row)
  }

  const row = (tipo
    ? db.prepare(
        "SELECT * FROM watchlist WHERE LOWER(title) = LOWER(?) AND COALESCE(release_year, '') = ? AND tipo = ?",
      ).get(title, releaseYear ?? '', tipo)
    : db.prepare(
        "SELECT * FROM watchlist WHERE LOWER(title) = LOWER(?) AND COALESCE(release_year, '') = ?",
      ).get(title, releaseYear ?? '')) as WatchlistRowRaw | undefined

  return row ? parseRow(row) : null
}

export function getWatchlistCount(): number {
  const db = getDatabase()
  return (db.prepare('SELECT COUNT(*) as n FROM watchlist').get() as { n: number }).n
}

/**
 * Promove um item de Próximos para o catálogo, preservando os vínculos com listas.
 *
 * Feito numa única transação: lê as listas do item da watchlist, cria a mídia no
 * catálogo, religa a nova mídia a essas listas e só então remove o item da watchlist.
 * Sem isso, o ON DELETE CASCADE de watchlist_lists_link apagaria os vínculos e o
 * título sumiria das listas ao ser marcado como assistido.
 */
export function promoteToMedia(watchlistId: number, media: AddMediaInput): number {
  const db = getDatabase()

  const run = db.transaction((): number => {
    const listRows = db
      .prepare('SELECT list_id FROM watchlist_lists_link WHERE watchlist_id = ?')
      .all(watchlistId) as { list_id: number }[]

    const mediaId = addMedia(media)

    const linkStmt = db.prepare(
      'INSERT OR IGNORE INTO media_lists_link (media_id, list_id) VALUES (?, ?)'
    )
    for (const { list_id } of listRows) {
      linkStmt.run(mediaId, list_id)
    }

    db.prepare('DELETE FROM watchlist WHERE id = ?').run(watchlistId)

    return mediaId
  })

  return run()
}

/**
 * Caminho inverso da promoção: um título do catálogo que na verdade ainda não foi
 * visto volta para Próximos, levando gêneros, elenco, diretor, imagens, coleção e
 * os vínculos com listas. Tudo numa transação.
 */
export function demoteToWatchlist(mediaId: number): number {
  const db = getDatabase()

  const run = db.transaction((): number => {
    const media = getMediaById(mediaId)
    if (!media) throw new Error('Título não encontrado.')

    const dup = findDuplicateInWatchlist(media.tmdb_id ?? null, media.title, media.release_year, media.tipo)
    const watchlistId = dup?.id ?? addToWatchlist({
      title:         media.title,
      tipo:          media.tipo,
      release_year:  media.release_year,
      synopsis:      media.synopsis,
      cover_path:    media.cover_path,
      backdrop_path: media.backdrop_path,
      duration:      media.duration,
      director:      media.director,
      genres:        media.genres ?? [],
      cast:          media.cast ?? [],
      tmdb_id:       media.tmdb_id,
    })

    const col = db.prepare('SELECT tmdb_collection_id, collection_checked FROM media WHERE id = ?').get(mediaId) as
      { tmdb_collection_id: number | null; collection_checked: number } | undefined
    if (col) {
      db.prepare('UPDATE watchlist SET tmdb_collection_id = ?, collection_checked = ? WHERE id = ?')
        .run(col.tmdb_collection_id, col.collection_checked, watchlistId)
    }

    db.prepare(`
      INSERT OR IGNORE INTO watchlist_lists_link (watchlist_id, list_id, position)
      SELECT ?, list_id, position FROM media_lists_link WHERE media_id = ?
    `).run(watchlistId, mediaId)

    // As imagens passam a ser do item de Próximos: apaga só a linha, não os arquivos.
    db.prepare('DELETE FROM media WHERE id = ?').run(mediaId)
    return watchlistId
  })

  return run()
}
