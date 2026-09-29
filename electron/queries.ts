import { getDatabase } from './database.js'

// -- TIPOS -------------------------------------------------------------------

export interface MediaRow {
  id: number
  title: string
  release_year?: string
  synopsis?: string
  observations?: string
  rating?: number
  duration?: number
  watched?: number
  cover_path?: string
  cover_path_thumb?: string
  backdrop_path?: string
  tipo: 'filme' | 'serie'
  watched_status: 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'
  tmdb_id?: number
  watched_date?: string
  created_at: string
  genres?: string[]
  tags?: string[]
  cast?: string[]
  director?: string
}

export interface AddMediaInput {
  title: string
  release_year?: string
  synopsis?: string
  observations?: string
  rating?: number
  duration?: number
  watched?: number
  cover_path?: string
  cover_path_thumb?: string
  backdrop_path?: string
  tipo: 'filme' | 'serie'
  watched_status?: 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'
  tmdb_id?: number
  watched_date?: string
  genres?: string[]
  tags?: string[]
  director?: string
  cast?: string[]
}

// -- MEDIA -------------------------------------------------------------------

export function getAllMedia(): MediaRow[] {
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT * FROM media ORDER BY created_at DESC
  `).all() as MediaRow[]

  // Em lote: uma query por tipo de associação (5 no total), em vez de 4 por linha.
  // Evita o N+1 que fica caro conforme o catálogo cresce.
  const genres    = getNameMapByMedia('genres',  'media_genres_link', 'genre_id')
  const tags      = getNameMapByMedia('tags',    'media_tags_link',   'tag_id')
  const cast      = getPeopleMapByMedia('actor')
  const directors = getPeopleMapByMedia('director')

  return rows.map(row => ({
    ...row,
    genres:   genres.get(row.id)    ?? [],
    tags:     tags.get(row.id)      ?? [],
    cast:     cast.get(row.id)      ?? [],
    director: directors.get(row.id)?.[0],
  }))
}

/** Mapa media_id -> nomes, para gêneros ou tags, em uma única query. */
function getNameMapByMedia(
  nameTable: 'genres' | 'tags',
  linkTable: 'media_genres_link' | 'media_tags_link',
  fkColumn: 'genre_id' | 'tag_id',
  onlyIds?: number[],
): Map<number, string[]> {
  const db = getDatabase()
  const filter = onlyIds ? 'WHERE l.media_id IN (SELECT value FROM json_each(?))' : ''
  const stmt = db.prepare(`
    SELECT l.media_id AS mediaId, n.name AS name
    FROM ${nameTable} n
    JOIN ${linkTable} l ON l.${fkColumn} = n.id
    ${filter}
  `)
  const rows = (onlyIds ? stmt.all(JSON.stringify(onlyIds)) : stmt.all()) as { mediaId: number; name: string }[]
  return groupNames(rows)
}

/** Mapa media_id -> nomes de pessoas por papel (actor/director), em uma única query. */
function getPeopleMapByMedia(role: 'actor' | 'director', onlyIds?: number[]): Map<number, string[]> {
  const db = getDatabase()
  const filter = onlyIds ? 'AND l.media_id IN (SELECT value FROM json_each(?))' : ''
  const stmt = db.prepare(`
    SELECT l.media_id AS mediaId, p.name AS name
    FROM people p
    JOIN media_people_link l ON l.person_id = p.id
    WHERE l.role = ? ${filter}
  `)
  const rows = (onlyIds ? stmt.all(role, JSON.stringify(onlyIds)) : stmt.all(role)) as { mediaId: number; name: string }[]
  return groupNames(rows)
}

function groupNames(rows: { mediaId: number; name: string }[]): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const r of rows) {
    const arr = map.get(r.mediaId)
    if (arr) arr.push(r.name)
    else map.set(r.mediaId, [r.name])
  }
  return map
}

export function getMediaById(id: number): MediaRow | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined
  if (!row) return null
  return {
    ...row,
    genres:   getGenresForMedia(id),
    tags:     getTagsForMedia(id),
    cast:     getCastForMedia(id),
    director: getDirectorForMedia(id),
  }
}

export function addMedia(input: AddMediaInput): number {
  const db = getDatabase()
  // Transação: a mídia e seus vínculos (gêneros, pessoas, tags) entram juntos ou nada entra.
  // Dentro de outra transação (ex.: promoteToMedia) o better-sqlite3 usa savepoint.
  return db.transaction(() => insertMedia(input))()
}

function insertMedia(input: AddMediaInput): number {
  const db = getDatabase()

  const { genres = [], tags = [], director, cast = [], ...mediaFields } = input

  const stmt = db.prepare(`
    INSERT INTO media (
      title, release_year, synopsis, observations, rating,
      duration, watched, cover_path, cover_path_thumb, backdrop_path,
      tipo, watched_status, tmdb_id, watched_date
    ) VALUES (
      @title, @release_year, @synopsis, @observations, @rating,
      @duration, @watched, @cover_path, @cover_path_thumb, @backdrop_path,
      @tipo, @watched_status, @tmdb_id, @watched_date
    )
  `)

  const result = stmt.run({
    title:            mediaFields.title,
    release_year:     mediaFields.release_year     ?? null,
    synopsis:         mediaFields.synopsis         ?? null,
    observations:     mediaFields.observations     ?? null,
    rating:           mediaFields.rating           ?? null,
    duration:         mediaFields.duration         ?? null,
    watched:          mediaFields.watched          ?? null,
    cover_path:       mediaFields.cover_path       ?? null,
    cover_path_thumb: mediaFields.cover_path_thumb ?? null,
    backdrop_path:    mediaFields.backdrop_path    ?? null,
    tipo:             mediaFields.tipo,
    watched_status:   mediaFields.watched_status   ?? 'assistido',
    tmdb_id:          mediaFields.tmdb_id          ?? null,
    watched_date:     mediaFields.watched_date     ?? null,
  })

  const mediaId = result.lastInsertRowid as number

  if (genres.length > 0)           setGenresForMedia(mediaId, genres)
  if (tags.length > 0)             setTagsForMedia(mediaId, tags)
  if (director || cast.length > 0) setPeopleForMedia(mediaId, director, cast)

  return mediaId
}

/** Colunas de media que o renderer pode alterar via updateMedia. */
const UPDATABLE_COLUMNS = new Set([
  'title', 'release_year', 'synopsis', 'observations', 'rating', 'duration', 'watched',
  'cover_path', 'cover_path_thumb', 'backdrop_path', 'tipo', 'watched_status',
  'tmdb_id', 'watched_date',
])

export function updateMedia(id: number, input: Partial<AddMediaInput>): boolean {
  const db = getDatabase()
  const { genres, tags, director, cast, ...rest } = input

  // Só aceita colunas conhecidas: os nomes viram SQL, então nada vindo de fora entra cru.
  const fields = Object.fromEntries(
    Object.entries(rest).filter(([k]) => UPDATABLE_COLUMNS.has(k)),
  )
  const setClauses = Object.keys(fields)
    .map(k => `${k} = @${k}`)
    .join(', ')

  db.transaction(() => {
    if (setClauses) {
      db.prepare(`UPDATE media SET ${setClauses} WHERE id = @id`)
        .run({ ...fields, id })
    }

    if (genres !== undefined) setGenresForMedia(id, genres)
    if (tags !== undefined)   setTagsForMedia(id, tags)
    if (director !== undefined || cast !== undefined) {
      setPeopleForMedia(id, director, cast ?? [])
    }
  })()

  return true
}

/**
 * Remove a mídia e devolve os caminhos de imagem que ela usava, para o chamador
 * apagar os arquivos locais (catimg://) que ficariam órfãos.
 */
export function deleteMedia(id: number): { cover_path: string | null; backdrop_path: string | null } | null {
  const db = getDatabase()
  const row = db.prepare('SELECT cover_path, backdrop_path FROM media WHERE id = ?').get(id) as
    { cover_path: string | null; backdrop_path: string | null } | undefined
  db.prepare('DELETE FROM media WHERE id = ?').run(id)
  return row ?? null
}

/**
 * Procura um título já cadastrado. IDs do TMDB de filme e de série são espaços
 * distintos (o mesmo número pode ser um filme e uma série), por isso o tipo entra
 * na comparação quando informado.
 */
export function findDuplicateInMedia(
  tmdbId: number | null,
  title: string,
  releaseYear?: string,
  tipo?: 'filme' | 'serie',
): MediaRow | null {
  const db = getDatabase()

  if (tmdbId) {
    const row = (tipo
      ? db.prepare('SELECT * FROM media WHERE tmdb_id = ? AND tipo = ?').get(tmdbId, tipo)
      : db.prepare('SELECT * FROM media WHERE tmdb_id = ?').get(tmdbId)) as MediaRow | undefined
    if (row) return row
  }

  const row = (tipo
    ? db.prepare(
        "SELECT * FROM media WHERE LOWER(title) = LOWER(?) AND COALESCE(release_year, '') = ? AND tipo = ?",
      ).get(title, releaseYear ?? '', tipo)
    : db.prepare(
        "SELECT * FROM media WHERE LOWER(title) = LOWER(?) AND COALESCE(release_year, '') = ?",
      ).get(title, releaseYear ?? '')) as MediaRow | undefined

  return row ?? null
}

// -- ASSOCIAÇÕES -------------------------------------------------------------

function getGenresForMedia(mediaId: number): string[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT g.name FROM genres g
    JOIN media_genres_link l ON l.genre_id = g.id
    WHERE l.media_id = ?
  `).all(mediaId) as { name: string }[]
  return rows.map(r => r.name)
}

function getTagsForMedia(mediaId: number): string[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN media_tags_link l ON l.tag_id = t.id
    WHERE l.media_id = ?
  `).all(mediaId) as { name: string }[]
  return rows.map(r => r.name)
}

function getCastForMedia(mediaId: number): string[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT p.name FROM people p
    JOIN media_people_link l ON l.person_id = p.id
    WHERE l.media_id = ? AND l.role = 'actor'
  `).all(mediaId) as { name: string }[]
  return rows.map(r => r.name)
}

function getDirectorForMedia(mediaId: number): string | undefined {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT p.name FROM people p
    JOIN media_people_link l ON l.person_id = p.id
    WHERE l.media_id = ? AND l.role = 'director'
    LIMIT 1
  `).get(mediaId) as { name: string } | undefined
  return row?.name
}

function setGenresForMedia(mediaId: number, genres: string[]) {
  const db = getDatabase()
  db.prepare('DELETE FROM media_genres_link WHERE media_id = ?').run(mediaId)
  for (const name of genres) {
    let row = db.prepare('SELECT id FROM genres WHERE name = ?').get(name) as { id: number } | undefined
    if (!row) {
      const r = db.prepare('INSERT INTO genres (name) VALUES (?)').run(name)
      row = { id: r.lastInsertRowid as number }
    }
    db.prepare('INSERT OR IGNORE INTO media_genres_link (media_id, genre_id) VALUES (?, ?)').run(mediaId, row.id)
  }
}

function setTagsForMedia(mediaId: number, tags: string[]) {
  const db = getDatabase()
  db.prepare('DELETE FROM media_tags_link WHERE media_id = ?').run(mediaId)
  for (const name of tags) {
    let row = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined
    if (!row) {
      const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name)
      row = { id: r.lastInsertRowid as number }
    }
    db.prepare('INSERT OR IGNORE INTO media_tags_link (media_id, tag_id) VALUES (?, ?)').run(mediaId, row.id)
  }
}

function setPeopleForMedia(mediaId: number, director?: string, cast: string[] = []) {
  const db = getDatabase()
  db.prepare('DELETE FROM media_people_link WHERE media_id = ?').run(mediaId)

  const people: { name: string; role: string }[] = []
  if (director) people.push({ name: director, role: 'director' })
  for (const name of cast) people.push({ name, role: 'actor' })

  for (const person of people) {
    let row = db.prepare('SELECT id FROM people WHERE name = ?').get(person.name) as { id: number } | undefined
    if (!row) {
      const r = db.prepare('INSERT INTO people (name) VALUES (?)').run(person.name)
      row = { id: r.lastInsertRowid as number }
    }
    db.prepare('INSERT OR IGNORE INTO media_people_link (media_id, person_id, role) VALUES (?, ?, ?)').run(mediaId, row.id, person.role)
  }
}

// -- TAGS --------------------------------------------------------------------

export function getAllTags() {
  const db = getDatabase()
  return db.prepare('SELECT * FROM tags ORDER BY name').all()
}

// -- GÊNEROS -----------------------------------------------------------------

export function getAllGenres() {
  const db = getDatabase()
  return db.prepare('SELECT * FROM genres ORDER BY name').all()
}

// -- LISTAS ------------------------------------------------------------------

export type ListKind = 'franquia' | 'saga' | 'tema' | 'livre'
export type ListSortMode = 'lancamento' | 'manual' | 'titulo' | 'nota'

const LIST_KINDS: ListKind[]     = ['franquia', 'saga', 'tema', 'livre']
const SORT_MODES: ListSortMode[] = ['lancamento', 'manual', 'titulo', 'nota']

export interface ListRow {
  id:                 number
  name:               string
  description:        string
  kind:               ListKind
  sort_mode:          ListSortMode
  tmdb_collection_id: number | null
  media_count:        number
  /** títulos do catálogo com status "assistido" */
  watched_count:      number
  /** média das notas (> 0) dos títulos da lista, ou null */
  avg_rating:         number | null
  /** minutos somados dos filmes assistidos */
  watched_minutes:    number
}

export function getAllLists(): ListRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT l.id, l.name, COALESCE(l.description, '') AS description,
      l.kind, l.sort_mode, l.tmdb_collection_id,
      (SELECT COUNT(*) FROM media_lists_link ml WHERE ml.list_id = l.id) +
      (SELECT COUNT(*) FROM watchlist_lists_link wl WHERE wl.list_id = l.id) AS media_count,
      (SELECT COUNT(*) FROM media_lists_link ml JOIN media m ON m.id = ml.media_id
        WHERE ml.list_id = l.id AND m.watched_status = 'assistido') AS watched_count,
      (SELECT ROUND(AVG(m.rating), 1) FROM media_lists_link ml JOIN media m ON m.id = ml.media_id
        WHERE ml.list_id = l.id AND m.rating > 0) AS avg_rating,
      (SELECT COALESCE(SUM(m.duration), 0) FROM media_lists_link ml JOIN media m ON m.id = ml.media_id
        WHERE ml.list_id = l.id AND m.watched_status = 'assistido' AND m.tipo = 'filme' AND m.duration > 0) AS watched_minutes
    FROM lists l
    ORDER BY l.name COLLATE NOCASE
  `).all() as ListRow[]
}

export function createList(name: string, description = '', kind: ListKind = 'livre'): number {
  const db = getDatabase()
  const k = LIST_KINDS.includes(kind) ? kind : 'livre'
  const r = db.prepare("INSERT INTO lists (name, description, kind, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)").run(name, description, k)
  return r.lastInsertRowid as number
}

export interface UpdateListInput {
  name?:               string
  description?:        string
  kind?:               ListKind
  sort_mode?:          ListSortMode
  tmdb_collection_id?: number | null
}

export function updateList(id: number, patch: UpdateListInput): boolean {
  const db = getDatabase()
  const sets: string[] = []
  const params: Record<string, unknown> = { id }
  if (patch.name !== undefined)        { sets.push('name = @name'); params.name = patch.name }
  if (patch.description !== undefined) { sets.push('description = @description'); params.description = patch.description }
  if (patch.kind && LIST_KINDS.includes(patch.kind))            { sets.push('kind = @kind'); params.kind = patch.kind }
  if (patch.sort_mode && SORT_MODES.includes(patch.sort_mode))  { sets.push('sort_mode = @sort_mode'); params.sort_mode = patch.sort_mode }
  if (patch.tmdb_collection_id !== undefined) { sets.push('tmdb_collection_id = @cid'); params.cid = patch.tmdb_collection_id }
  if (sets.length) db.prepare(`UPDATE lists SET ${sets.join(', ')} WHERE id = @id`).run(params)
  return true
}

export function deleteList(id: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM lists WHERE id = ?').run(id)
  return true
}

export interface MediaInListRow extends MediaRow {
  isProximo:    boolean
  watchlistId?: number
  position:     number | null
  tmdb_collection_id?: number | null
}

/** Ordena os itens de uma lista conforme o modo escolhido (puro, exportado para testes). */
export function sortListItems<T extends { title: string; release_year?: string | null; rating?: number | null; position: number | null }>(
  items: T[], mode: ListSortMode,
): T[] {
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, 'pt-BR')
  const year    = (t: T) => Number(t.release_year) || 9999
  const sorted  = [...items]
  switch (mode) {
    case 'titulo': return sorted.sort(byTitle)
    case 'nota':   return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byTitle(a, b))
    case 'manual':
      // Itens sem posição (adicionados antes de ordenar) vão para o fim, por ano.
      return sorted.sort((a, b) =>
        (a.position ?? Infinity) - (b.position ?? Infinity) || year(a) - year(b) || byTitle(a, b))
    default:
      return sorted.sort((a, b) => year(a) - year(b) || byTitle(a, b))
  }
}

export function getMediaInList(listId: number): MediaInListRow[] {
  const db = getDatabase()
  const list = db.prepare('SELECT sort_mode FROM lists WHERE id = ?').get(listId) as { sort_mode: ListSortMode } | undefined

  const mediaRows = db.prepare(`
    SELECT m.*, ml.position AS position FROM media m
    JOIN media_lists_link ml ON ml.media_id = m.id
    WHERE ml.list_id = ?
  `).all(listId) as (MediaRow & { position: number | null })[]

  // Associações em lote só para os títulos da lista (evita 4 consultas por título)
  const ids = mediaRows.map(r => r.id)
  const genres    = getNameMapByMedia('genres', 'media_genres_link', 'genre_id', ids)
  const tags      = getNameMapByMedia('tags',   'media_tags_link',   'tag_id',   ids)
  const cast      = getPeopleMapByMedia('actor', ids)
  const directors = getPeopleMapByMedia('director', ids)

  const catalogItems: MediaInListRow[] = mediaRows.map(row => ({
    ...row,
    genres:    genres.get(row.id)    ?? [],
    tags:      tags.get(row.id)      ?? [],
    cast:      cast.get(row.id)      ?? [],
    director:  directors.get(row.id)?.[0],
    isProximo: false,
  }))

  interface WatchlistLinkRaw {
    id: number; title: string; tipo: string; release_year: string
    synopsis: string; cover_path: string; backdrop_path: string
    duration: number; director: string; genres: string; cast: string
    tmdb_id: number; created_at: string; position: number | null
    tmdb_collection_id: number | null
  }

  const watchlistRows = db.prepare(`
    SELECT w.*, wl.position AS position FROM watchlist w
    JOIN watchlist_lists_link wl ON wl.watchlist_id = w.id
    WHERE wl.list_id = ?
  `).all(listId) as WatchlistLinkRaw[]

  const watchlistItems: MediaInListRow[] = watchlistRows.map(row => ({
    id:             -(row.id),
    title:          row.title,
    tipo:           row.tipo as 'filme' | 'serie',
    release_year:   row.release_year,
    synopsis:       row.synopsis,
    cover_path:     row.cover_path,
    backdrop_path:  row.backdrop_path,
    duration:       row.duration,
    director:       row.director,
    genres:         JSON.parse(row.genres ?? '[]'),
    cast:           JSON.parse(row.cast   ?? '[]'),
    tmdb_id:        row.tmdb_id,
    tmdb_collection_id: row.tmdb_collection_id,
    created_at:     row.created_at,
    watched_status: 'nao_assistido' as const,
    isProximo:      true,
    watchlistId:    row.id,
    position:       row.position,
    tags:           [],
  }))

  return sortListItems([...catalogItems, ...watchlistItems], list?.sort_mode ?? 'lancamento')
}

/** Próxima posição livre na lista (novos itens entram no fim da ordem manual). */
function nextPosition(listId: number): number {
  const db = getDatabase()
  const row = db.prepare(`
    SELECT MAX(p) AS p FROM (
      SELECT position AS p FROM media_lists_link WHERE list_id = ?
      UNION ALL
      SELECT position AS p FROM watchlist_lists_link WHERE list_id = ?
    )
  `).get(listId, listId) as { p: number | null }
  return (row.p ?? 0) + 1
}

export function addMediaToList(mediaId: number, listId: number): boolean {
  const db = getDatabase()
  db.prepare('INSERT OR IGNORE INTO media_lists_link (media_id, list_id, position) VALUES (?, ?, ?)').run(mediaId, listId, nextPosition(listId))
  return true
}

export function removeMediaFromList(mediaId: number, listId: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM media_lists_link WHERE media_id = ? AND list_id = ?').run(mediaId, listId)
  return true
}

export function addWatchlistItemToList(watchlistId: number, listId: number): boolean {
  const db = getDatabase()
  db.prepare('INSERT OR IGNORE INTO watchlist_lists_link (watchlist_id, list_id, position) VALUES (?, ?, ?)').run(watchlistId, listId, nextPosition(listId))
  return true
}

export function removeWatchlistItemFromList(watchlistId: number, listId: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM watchlist_lists_link WHERE watchlist_id = ? AND list_id = ?').run(watchlistId, listId)
  return true
}

/** Referência a um item de lista: título do catálogo ou item de Próximos. */
export interface ListEntryRef {
  kind: 'media' | 'watchlist'
  id:   number
}

/** Adiciona vários itens de uma vez (seleção múltipla), numa transação. */
export function addManyToList(listId: number, entries: ListEntryRef[]): number {
  const db = getDatabase()
  let added = 0
  db.transaction(() => {
    for (const e of entries) {
      const r = e.kind === 'media'
        ? db.prepare('INSERT OR IGNORE INTO media_lists_link (media_id, list_id, position) VALUES (?, ?, ?)').run(e.id, listId, nextPosition(listId))
        : db.prepare('INSERT OR IGNORE INTO watchlist_lists_link (watchlist_id, list_id, position) VALUES (?, ?, ?)').run(e.id, listId, nextPosition(listId))
      added += r.changes
    }
  })()
  return added
}

/** Salva a ordem manual (arrastar e soltar) e passa a lista para o modo manual. */
export function reorderList(listId: number, ordered: ListEntryRef[]): boolean {
  const db = getDatabase()
  const setMedia = db.prepare('UPDATE media_lists_link SET position = ? WHERE list_id = ? AND media_id = ?')
  const setWatch = db.prepare('UPDATE watchlist_lists_link SET position = ? WHERE list_id = ? AND watchlist_id = ?')
  db.transaction(() => {
    ordered.forEach((e, i) => (e.kind === 'media' ? setMedia : setWatch).run(i + 1, listId, e.id))
    db.prepare("UPDATE lists SET sort_mode = 'manual' WHERE id = ?").run(listId)
  })()
  return true
}

/** Ids das listas que contêm um título (para os detalhes e o seletor de listas). */
export function getListIdsFor(entry: ListEntryRef): number[] {
  const db = getDatabase()
  const rows = entry.kind === 'media'
    ? db.prepare('SELECT list_id FROM media_lists_link WHERE media_id = ?').all(entry.id)
    : db.prepare('SELECT list_id FROM watchlist_lists_link WHERE watchlist_id = ?').all(entry.id)
  return (rows as { list_id: number }[]).map(r => r.list_id)
}

// -- ESTATÍSTICAS ------------------------------------------------------------

export function getStats() {
  const db = getDatabase()

  const total         = (db.prepare('SELECT COUNT(*) as n FROM media').get() as { n: number }).n
  const filmes        = (db.prepare("SELECT COUNT(*) as n FROM media WHERE tipo = 'filme'").get() as { n: number }).n
  const series        = (db.prepare("SELECT COUNT(*) as n FROM media WHERE tipo = 'serie'").get() as { n: number }).n
  const assistidos    = (db.prepare("SELECT COUNT(*) as n FROM media WHERE watched_status = 'assistido'").get() as { n: number }).n
  const naoAssistidos = (db.prepare("SELECT COUNT(*) as n FROM media WHERE watched_status = 'nao_assistido'").get() as { n: number }).n
  // Nota 0 = "sem nota" (o formulário não salva 0; os não assistidos ficavam com 0 e puxavam a média para baixo)
  const avgRow        = db.prepare('SELECT AVG(rating) as avg FROM media WHERE rating > 0').get() as { avg: number | null }

  let proximos = 0
  try {
    proximos = (db.prepare('SELECT COUNT(*) as n FROM watchlist').get() as { n: number }).n
  } catch { /* tabela pode não existir em bancos antigos */ }

  // Gênero favorito (mais frequente no catálogo)
  const generoRow = db.prepare(`
    SELECT g.name AS name, COUNT(*) AS n
    FROM genres g
    JOIN media_genres_link l ON l.genre_id = g.id
    GROUP BY g.id
    ORDER BY n DESC, g.name ASC
    LIMIT 1
  `).get() as { name: string; n: number } | undefined

  // Tempo assistido: soma das durações (minutos) dos filmes assistidos.
  // Em séries, duration guarda o número de episódios, então elas ficam de fora.
  const minutos = (db.prepare(`
    SELECT COALESCE(SUM(duration), 0) AS min
    FROM media
    WHERE watched_status = 'assistido' AND tipo = 'filme' AND duration > 0
  `).get() as { min: number }).min

  // Distribuição de notas por estrela (1..5)
  const distribuicaoNotas = (db.prepare(`
    SELECT CAST(ROUND(rating) AS INTEGER) AS estrela, COUNT(*) AS n
    FROM media
    WHERE rating IS NOT NULL AND rating > 0
    GROUP BY estrela
    ORDER BY estrela
  `).all() as { estrela: number; n: number }[]).map(r => ({ estrela: r.estrela, count: r.n }))

  // Assistidos por ano (usa a data assistida)
  const porAno = (db.prepare(`
    SELECT substr(watched_date, 1, 4) AS ano, COUNT(*) AS n
    FROM media
    WHERE watched_date IS NOT NULL AND watched_status = 'assistido'
    GROUP BY ano
    ORDER BY ano
  `).all() as { ano: string; n: number }[]).map(r => ({ ano: r.ano, count: r.n }))

  return {
    total,
    filmes,
    series,
    assistidos,
    naoAssistidos,
    mediaRating: avgRow.avg ? Math.round(avgRow.avg * 10) / 10 : 0,
    proximos,
    generoFavorito: generoRow ? { name: generoRow.name, count: generoRow.n } : null,
    minutosAssistidos: minutos,
    horasAssistidas: Math.round(minutos / 60),
    distribuicaoNotas,
    porAno,
  }
}
