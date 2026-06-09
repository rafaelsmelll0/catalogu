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

  return rows.map(row => ({
    ...row,
    genres:   getGenresForMedia(row.id),
    tags:     getTagsForMedia(row.id),
    cast:     getCastForMedia(row.id),
    director: getDirectorForMedia(row.id),
  }))
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

  const { genres = [], tags = [], director, cast = [], ...mediaFields } = input

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
  })

  const mediaId = result.lastInsertRowid as number

  if (genres.length > 0)           setGenresForMedia(mediaId, genres)
  if (tags.length > 0)             setTagsForMedia(mediaId, tags)
  if (director || cast.length > 0) setPeopleForMedia(mediaId, director, cast)

  return mediaId
}

export function updateMedia(id: number, input: Partial<AddMediaInput>): boolean {
  const db = getDatabase()
  const { genres, tags, director, cast, ...fields } = input

  const setClauses = Object.keys(fields)
    .map(k => `${k} = @${k}`)
    .join(', ')

  if (setClauses) {
    db.prepare(`UPDATE media SET ${setClauses} WHERE id = @id`)
      .run({ ...fields, id })
  }

  if (genres !== undefined) setGenresForMedia(id, genres)
  if (tags !== undefined)   setTagsForMedia(id, tags)
  if (director !== undefined || cast !== undefined) {
    setPeopleForMedia(id, director, cast ?? [])
  }

  return true
}

export function deleteMedia(id: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM media WHERE id = ?').run(id)
  return true
}

export function findDuplicateInMedia(tmdbId: number | null, title: string, releaseYear?: string): MediaRow | null {
  const db = getDatabase()

  if (tmdbId) {
    const row = db.prepare('SELECT * FROM media WHERE tmdb_id = ?').get(tmdbId) as MediaRow | undefined
    if (row) return row
  }

  const row = db.prepare(
    'SELECT * FROM media WHERE LOWER(title) = LOWER(?) AND release_year = ?'
  ).get(title, releaseYear ?? '') as MediaRow | undefined

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

export interface ListRow {
  id:          number
  name:        string
  description: string
  media_count: number
}

export function getAllLists(): ListRow[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT l.*, COUNT(ml.media_id) as media_count
    FROM lists l
    LEFT JOIN media_lists_link ml ON ml.list_id = l.id
    GROUP BY l.id
    ORDER BY l.name
  `).all() as ListRow[]
}

export function createList(name: string, description = ''): number {
  const db = getDatabase()
  const r = db.prepare('INSERT INTO lists (name, description) VALUES (?, ?)').run(name, description)
  return r.lastInsertRowid as number
}

export function updateList(id: number, name: string, description: string): boolean {
  const db = getDatabase()
  db.prepare('UPDATE lists SET name = ?, description = ? WHERE id = ?').run(name, description, id)
  return true
}

export function deleteList(id: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM lists WHERE id = ?').run(id)
  return true
}

export function getMediaInList(listId: number): MediaRow[] {
  const db = getDatabase()
  const rows = db.prepare(`
    SELECT m.* FROM media m
    JOIN media_lists_link ml ON ml.media_id = m.id
    WHERE ml.list_id = ?
    ORDER BY m.title
  `).all(listId) as MediaRow[]
  return rows.map(row => ({
    ...row,
    genres:   getGenresForMedia(row.id),
    tags:     getTagsForMedia(row.id),
    cast:     getCastForMedia(row.id),
    director: getDirectorForMedia(row.id),
  }))
}

export function addMediaToList(mediaId: number, listId: number): boolean {
  const db = getDatabase()
  db.prepare('INSERT OR IGNORE INTO media_lists_link (media_id, list_id) VALUES (?, ?)').run(mediaId, listId)
  return true
}

export function removeMediaFromList(mediaId: number, listId: number): boolean {
  const db = getDatabase()
  db.prepare('DELETE FROM media_lists_link WHERE media_id = ? AND list_id = ?').run(mediaId, listId)
  return true
}

// -- ESTATÍSTICAS ------------------------------------------------------------

export function getStats() {
  const db = getDatabase()

  const total         = (db.prepare('SELECT COUNT(*) as n FROM media').get() as { n: number }).n
  const filmes        = (db.prepare("SELECT COUNT(*) as n FROM media WHERE tipo = 'filme'").get() as { n: number }).n
  const series        = (db.prepare("SELECT COUNT(*) as n FROM media WHERE tipo = 'serie'").get() as { n: number }).n
const assistidos    = (db.prepare("SELECT COUNT(*) as n FROM media WHERE watched_status = 'assistido'").get() as { n: number }).n
  const naoAssistidos = (db.prepare("SELECT COUNT(*) as n FROM media WHERE watched_status = 'nao_assistido'").get() as { n: number }).n
  const avgRow        = db.prepare('SELECT AVG(rating) as avg FROM media WHERE rating IS NOT NULL').get() as { avg: number | null }

  let proximos = 0
  try {
    proximos = (db.prepare('SELECT COUNT(*) as n FROM watchlist').get() as { n: number }).n
  } catch { /* tabela pode não existir em bancos antigos */ }

  return {
    total,
    filmes,
    series,
    assistidos,
    naoAssistidos,
    mediaRating: avgRow.avg ? Math.round(avgRow.avg * 10) / 10 : 0,
    proximos,
  }
}
