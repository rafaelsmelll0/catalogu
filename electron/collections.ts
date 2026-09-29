import { getDatabase } from './database.js'
import { getMovieDetails, getCollection, getPosterUrl, type TmdbCollection } from './tmdb.js'
import { updateList, createList, addManyToList, type ListEntryRef } from './queries.js'

/**
 * Franquias a partir das coleções do TMDB ("belongs_to_collection" dos filmes).
 *
 * 1. scanCollections: descobre a coleção de cada filme (catálogo e Próximos) que
 *    ainda não foi consultado. Roda uma vez para o acervo e depois só para os novos.
 * 2. getFranchises: agrupa por coleção o que o usuário tem, compara com as partes
 *    da coleção (cacheadas por 7 dias) e aponta o que falta, o que está em Próximos
 *    e qual lista corresponde — vinculando automaticamente quando não há dúvida.
 */

export interface ScanProgress { current: number; total: number }

export async function scanCollections(onProgress?: (p: ScanProgress) => void): Promise<{ scanned: number }> {
  const db = getDatabase()
  const pending = (['media', 'watchlist'] as const).flatMap(table =>
    (db.prepare(`
      SELECT id, tmdb_id FROM ${table}
      WHERE tipo = 'filme' AND tmdb_id IS NOT NULL AND collection_checked = 0
    `).all() as { id: number; tmdb_id: number }[]).map(r => ({ ...r, table })),
  )

  let done = 0
  const total = pending.length
  const worker = async () => {
    while (pending.length) {
      const item = pending.shift()!
      try {
        const d = await getMovieDetails(item.tmdb_id)
        db.prepare(`UPDATE ${item.table} SET tmdb_collection_id = ?, collection_checked = 1 WHERE id = ?`)
          .run(d.belongs_to_collection?.id ?? null, item.id)
      } catch {
        // Falha de rede: fica pendente para a próxima análise.
      }
      done++
      onProgress?.({ current: done, total })
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, total) }, worker))
  return { scanned: total }
}

export function countPendingScan(): number {
  const db = getDatabase()
  return (['media', 'watchlist'] as const).reduce((n, t) => n + (db.prepare(`
    SELECT COUNT(*) AS n FROM ${t} WHERE tipo = 'filme' AND tmdb_id IS NOT NULL AND collection_checked = 0
  `).get() as { n: number }).n, 0)
}

const WEEK_MS = 7 * 24 * 3600 * 1000

async function getCollectionCached(id: number): Promise<TmdbCollection | null> {
  const db  = getDatabase()
  const key = `tmdb.collection.${id}`
  const row = db.prepare('SELECT value, updated_at FROM app_kv WHERE key = ?').get(key) as { value: string; updated_at: string } | undefined
  if (row && Date.now() - new Date(row.updated_at.replace(' ', 'T') + 'Z').getTime() < WEEK_MS) {
    return JSON.parse(row.value) as TmdbCollection
  }
  try {
    const c = await getCollection(id)
    db.prepare(`
      INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, JSON.stringify(c))
    return c
  } catch {
    return row ? JSON.parse(row.value) as TmdbCollection : null
  }
}

export interface FranchisePart {
  tmdbId:      number
  title:       string
  year:        string
  releaseDate: string
  posterUrl:   string | null
  /** onde está: no catálogo (e se já viu), em Próximos, ou em lugar nenhum */
  where:       'catalogo' | 'proximos' | 'faltando'
  watched:     boolean
  upcoming:    boolean
  mediaId?:    number
  watchlistId?: number
}

export interface Franchise {
  collectionId: number
  name:         string
  parts:        FranchisePart[]
  owned:        number
  watched:      number
  inProximos:   number
  missing:      number
  upcoming:     number
  listId:       number | null
  listName:     string | null
}

/** Nome da coleção sem o sufixo que o TMDB acrescenta ("Alien - Coleção" → "Alien"). */
export function cleanCollectionName(name: string): string {
  return name.replace(/\s*[-–:]?\s*(cole[çc][ãa]o|collection|saga|trilogia)\s*$/i, '').trim() || name
}

function today(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export async function getFranchises(): Promise<Franchise[]> {
  const db = getDatabase()

  const catalog = db.prepare(`
    SELECT id, tmdb_id, tmdb_collection_id AS cid, watched_status FROM media
    WHERE tmdb_collection_id IS NOT NULL
  `).all() as { id: number; tmdb_id: number; cid: number; watched_status: string }[]
  const proximos = db.prepare(`
    SELECT id, tmdb_id, tmdb_collection_id AS cid FROM watchlist WHERE tmdb_collection_id IS NOT NULL
  `).all() as { id: number; tmdb_id: number; cid: number }[]

  // Só interessa coleção em que o usuário tem pelo menos 2 filmes (catálogo + Próximos)
  const counts = new Map<number, number>()
  for (const r of [...catalog, ...proximos]) counts.set(r.cid, (counts.get(r.cid) ?? 0) + 1)
  const ids = [...counts].filter(([, n]) => n >= 2).map(([cid]) => cid)

  const lists = db.prepare('SELECT id, name, kind, tmdb_collection_id FROM lists').all() as
    { id: number; name: string; kind: string; tmdb_collection_id: number | null }[]
  const listMembers = db.prepare(`
    SELECT ml.list_id AS listId, m.tmdb_collection_id AS cid FROM media_lists_link ml JOIN media m ON m.id = ml.media_id
    UNION ALL
    SELECT wl.list_id AS listId, w.tmdb_collection_id AS cid FROM watchlist_lists_link wl JOIN watchlist w ON w.id = wl.watchlist_id
  `).all() as { listId: number; cid: number | null }[]

  // Coleção predominante de cada lista (estritamente a mais frequente, com ≥ 2 filmes)
  const topCollection = new Map<number, { cid: number; hits: number }>()
  for (const l of lists) {
    const counts = new Map<number, number>()
    for (const m of listMembers) if (m.listId === l.id && m.cid != null) counts.set(m.cid, (counts.get(m.cid) ?? 0) + 1)
    const ranked = [...counts].sort((a, b) => b[1] - a[1])
    if (ranked[0] && ranked[0][1] >= 2 && (!ranked[1] || ranked[0][1] > ranked[1][1])) {
      topCollection.set(l.id, { cid: ranked[0][0], hits: ranked[0][1] })
    }
  }

  const now = today()
  const result: Franchise[] = []

  for (const cid of ids) {
    const col = await getCollectionCached(cid)
    if (!col || col.parts.length < 2) continue

    const parts: FranchisePart[] = col.parts
      .map(p => {
        const inCat = catalog.find(c => c.tmdb_id === p.id)
        const inPx  = proximos.find(w => w.tmdb_id === p.id)
        return {
          tmdbId:      p.id,
          title:       p.title,
          year:        p.release_date.slice(0, 4),
          releaseDate: p.release_date,
          posterUrl:   getPosterUrl(p.poster_path, 'w185'),
          where:       inCat ? 'catalogo' as const : inPx ? 'proximos' as const : 'faltando' as const,
          watched:     inCat?.watched_status === 'assistido',
          upcoming:    !p.release_date || p.release_date > now,
          mediaId:     inCat?.id,
          watchlistId: inPx?.id,
        }
      })
      .sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'))

    // Lista correspondente: a já vinculada; senão, a lista de franquia/saga em que
    // esta coleção é a mais frequente (≥ 2 filmes, sem empate) — assim "Alien" com
    // os crossovers de AvP ainda casa com a coleção Alien. Vincula na hora.
    let list = lists.find(l => l.tmdb_collection_id === cid) ?? null
    if (!list) {
      const candidates = lists
        .filter(l => (l.kind === 'franquia' || l.kind === 'saga') && l.tmdb_collection_id == null && topCollection.get(l.id)?.cid === cid)
        .sort((a, b) => topCollection.get(b.id)!.hits - topCollection.get(a.id)!.hits)
      const [first, second] = candidates
      if (first && (!second || topCollection.get(first.id)!.hits > topCollection.get(second.id)!.hits)) {
        list = first
        updateList(list.id, { tmdb_collection_id: cid })
        list.tmdb_collection_id = cid
      }
    }

    result.push({
      collectionId: cid,
      name:         cleanCollectionName(col.name),
      parts,
      owned:        parts.filter(p => p.where === 'catalogo').length,
      watched:      parts.filter(p => p.watched).length,
      inProximos:   parts.filter(p => p.where === 'proximos').length,
      missing:      parts.filter(p => p.where === 'faltando' && !p.upcoming).length,
      upcoming:     parts.filter(p => p.where === 'faltando' && p.upcoming).length,
      listId:       list?.id ?? null,
      listName:     list?.name ?? null,
    })
  }

  // Mais incompletas primeiro; depois por nome
  return result.sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name, 'pt-BR'))
}

export async function getFranchiseForList(listId: number): Promise<Franchise | null> {
  const row = getDatabase().prepare('SELECT tmdb_collection_id AS cid FROM lists WHERE id = ?').get(listId) as { cid: number | null } | undefined
  if (!row?.cid) return null
  return (await getFranchises()).find(f => f.collectionId === row.cid) ?? null
}

/**
 * Cria (ou completa) a lista de uma franquia: lista do tipo franquia com o nome da
 * coleção, vinculada a ela, com tudo que o usuário já tem (catálogo e Próximos).
 */
export async function createListForFranchise(collectionId: number): Promise<{ listId: number }> {
  const db = getDatabase()
  const f  = (await getFranchises()).find(x => x.collectionId === collectionId)
  if (!f) throw new Error('Franquia não encontrada.')

  let listId = f.listId
  if (!listId) {
    const taken = new Set((db.prepare('SELECT name FROM lists').all() as { name: string }[]).map(l => l.name.toLowerCase()))
    let name = f.name
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${f.name} (${i})`
    listId = createList(name, '', 'franquia')
    updateList(listId, { tmdb_collection_id: collectionId })
  }

  const entries = f.parts.flatMap<ListEntryRef>(p =>
    p.mediaId ? [{ kind: 'media', id: p.mediaId }]
    : p.watchlistId ? [{ kind: 'watchlist', id: p.watchlistId }]
    : [])
  addManyToList(listId, entries)
  return { listId }
}
