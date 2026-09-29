import { getDatabase } from './database.js'
import { getAllMedia, addMedia, type AddMediaInput } from './queries.js'
import { getAllWatchlist, findDuplicateInWatchlist, promoteToMedia } from './watchlistQueries.js'
import { loadDetails, addTmdbToWatchlist } from './tmdbImport.js'
import { findDuplicateInMedia } from './queries.js'
import { searchForMatch, type TmdbMatchCandidate } from './tmdb.js'
import { titlesMatch, pickCandidate } from './aiMatch.js'
import { localizeMediaImages } from './imageStore.js'
import { getActiveConfig } from './aiSettings.js'
import { chatJson, AiError, type AiUsage } from './aiClient.js'
import { getAllLists, getMediaInList, createList, addManyToList, type ListKind, type ListEntryRef } from './queries.js'
import {
  buildProfileMessages, buildRecommendMessages, buildCompleteListMessages, buildSuggestListsMessages,
  type RawCompletion, type RawListSuggestion, type RawListMember,
  type CatalogEntry, type FeedbackEntry, type RawSuggestion, type RecommendRequest, type SimpleTitle,
} from './aiPrompts.js'

// ─── Persistência (app_kv / ai_feedback) ────────────────────────────────────

function kvGet<T>(key: string): T | null {
  const row = getDatabase().prepare('SELECT value FROM app_kv WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return null
  try { return JSON.parse(row.value) as T } catch { return null }
}

function kvSet(key: string, value: unknown) {
  getDatabase().prepare(`
    INSERT INTO app_kv (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value))
}

const KV_PROFILE   = 'ai.profile'
const KV_LAST_RECS = 'ai.lastRecs'

export type Verdict = 'added' | 'seen' | 'dismissed'
/** Estado do card: além das respostas, 'cataloged' = entrou no catálogo pelo "Já vi". */
export type SuggestionStatus = Verdict | 'cataloged'

function loadFeedback(): (FeedbackEntry & { tmdb_id: number })[] {
  return getDatabase().prepare('SELECT tmdb_id, tipo, title, year, verdict FROM ai_feedback ORDER BY created_at').all() as
    (FeedbackEntry & { tmdb_id: number })[]
}

export function setFeedback(tmdbId: number, tipo: 'filme' | 'serie', title: string, year: string | null, verdict: Verdict | null) {
  const db = getDatabase()
  if (verdict === null) {
    db.prepare('DELETE FROM ai_feedback WHERE tmdb_id = ? AND tipo = ?').run(tmdbId, tipo)
  } else {
    db.prepare(`
      INSERT INTO ai_feedback (tmdb_id, tipo, title, year, verdict) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(tmdb_id, tipo) DO UPDATE SET verdict = excluded.verdict, created_at = CURRENT_TIMESTAMP
    `).run(tmdbId, tipo, title, year, verdict)
  }
  updateStoredStatus(tmdbId, tipo, verdict ?? undefined)
}

// ─── Contexto do catálogo ───────────────────────────────────────────────────

function loadCatalog(): CatalogEntry[] {
  return loadCatalogRows().map(r => r.entry)
}

/** Catálogo no formato do prompt, junto com o id e a capa de cada título. */
function loadCatalogRows(): { id: number; cover_path: string | null; entry: CatalogEntry }[] {
  const db = getDatabase()
  const listRows = db.prepare(`
    SELECT ml.media_id AS id, l.name AS name
    FROM media_lists_link ml JOIN lists l ON l.id = ml.list_id
  `).all() as { id: number; name: string }[]
  const listsBy = new Map<number, string[]>()
  for (const r of listRows) listsBy.set(r.id, [...(listsBy.get(r.id) ?? []), r.name])

  // Mais antigos primeiro: ordem estável ajuda o cache de prefixo do provedor.
  return getAllMedia()
    .sort((a, b) => a.id - b.id)
    .map(m => ({ id: m.id, cover_path: m.cover_path ?? null, entry: {
      title:          m.title,
      year:           m.release_year ?? null,
      tipo:           m.tipo,
      rating:         m.rating ?? null,
      watched_status: m.watched_status,
      genres:         m.genres ?? [],
      tags:           m.tags ?? [],
      lists:          listsBy.get(m.id) ?? [],
      director:       m.director ?? null,
      observations:   m.observations ?? null,
      watched_date:   m.watched_date ?? null,
    } }))
}

function requireConfig() {
  const cfg = getActiveConfig()
  if (!cfg) throw new AiError('Configure sua chave de IA em Configurações › Inteligência Artificial.')
  return cfg
}

// ─── Perfil de gosto ────────────────────────────────────────────────────────

export interface TasteProfile {
  text:        string
  summary:     string
  generatedAt: string
  basedOn:     number
  edited:      boolean
}

export function getProfile(): (TasteProfile & { catalogCount: number }) | null {
  const p = kvGet<TasteProfile>(KV_PROFILE)
  if (!p) return null
  const catalogCount = (getDatabase().prepare('SELECT COUNT(*) AS n FROM media').get() as { n: number }).n
  return { ...p, catalogCount }
}

export async function generateProfile(): Promise<TasteProfile & { catalogCount: number; usage: AiUsage }> {
  const cfg     = requireConfig()
  const catalog = loadCatalog()
  if (catalog.length < 5) throw new AiError('Cadastre pelo menos 5 títulos com nota para a IA entender seu gosto.')

  const { data, usage } = await chatJson<{ perfil?: string; resumo?: string }>(
    cfg,
    buildProfileMessages(catalog, cfg.info.contextChars),
    { temperature: 0.4, maxTokens: cfg.provider === 'groq' ? 2500 : 6000 },
  )
  if (!data.perfil?.trim()) throw new AiError('A IA não conseguiu montar o perfil. Tente de novo.')

  const profile: TasteProfile = {
    text:        data.perfil.trim(),
    summary:     (data.resumo ?? '').trim(),
    generatedAt: new Date().toISOString(),
    basedOn:     catalog.length,
    edited:      false,
  }
  kvSet(KV_PROFILE, profile)
  return { ...profile, catalogCount: catalog.length, usage }
}

export function saveProfileText(text: string): TasteProfile | null {
  const p = kvGet<TasteProfile>(KV_PROFILE)
  if (!p) return null
  const next = { ...p, text: text.trim(), edited: true }
  kvSet(KV_PROFILE, next)
  return next
}

// ─── Recomendações ──────────────────────────────────────────────────────────

export interface Suggestion {
  tmdbId:        number
  tipo:          'filme' | 'serie'
  title:         string
  originalTitle: string
  year:          string
  posterUrl:     string | null
  backdropUrl:   string | null
  overview:      string
  genres:        string[]
  duration:      number | null
  director:      string | null
  voteAverage:   number | null
  why:           string
  similarTo:     string[]
  warning:       string | null
  status?:       SuggestionStatus
}

export interface RecommendResult {
  generatedAt: string
  request:     RecommendRequest
  items:       Suggestion[]
  /** quantas a IA sugeriu mas foram descartadas (não existem no TMDB ou já estão no catálogo) */
  discarded:   number
  usage?:      AiUsage
}

export function getLastRecommendations(): RecommendResult | null {
  return kvGet<RecommendResult>(KV_LAST_RECS)
}

function updateStoredStatus(tmdbId: number, tipo: 'filme' | 'serie', status: SuggestionStatus | undefined) {
  const last = kvGet<RecommendResult>(KV_LAST_RECS)
  if (!last) return
  const item = last.items.find(i => i.tmdbId === tmdbId && i.tipo === tipo)
  if (!item) return
  item.status = status
  kvSet(KV_LAST_RECS, last)
}

async function resolveOnTmdb(s: RawSuggestion): Promise<TmdbMatchCandidate | null> {
  const year = Number(s.ano) || undefined
  const queries = [...new Set([s.titulo_original, s.titulo].filter((q): q is string => !!q?.trim()))]
  for (const q of queries) {
    const withYear = pickCandidate(await searchForMatch(q, s.tipo, year), q, year)
    if (withYear) return withYear
    // O ano da IA às vezes erra por um (estreia em festival vs. circuito).
    const anyYear = pickCandidate(await searchForMatch(q, s.tipo), q, year)
    if (anyYear) return anyYear
  }
  return null
}

/** Executa tarefas com concorrência limitada (respeita o rate limit do TMDB). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

export async function recommend(request: RecommendRequest): Promise<RecommendResult> {
  const cfg = requireConfig()

  // Sem perfil ainda: gera um antes (é a base das sugestões).
  const profile = getProfile() ?? await generateProfile()

  const catalog   = loadCatalog()
  const watchlist = getAllWatchlist()
  const feedback  = loadFeedback()

  const count = Math.min(Math.max(request.count, 3), 15)
  // Pede algumas a mais: parte cai na checagem (inexistente ou já cadastrado).
  const { data, usage } = await chatJson<{ sugestoes?: RawSuggestion[] }>(
    cfg,
    buildRecommendMessages({
      profile:   profile.text,
      catalog,
      watchlist: watchlist.map<SimpleTitle>(w => ({ title: w.title, year: w.release_year, tipo: w.tipo })),
      feedback,
      request:   { ...request, count: count + 4 },
      budgetChars: cfg.info.contextChars,
    }),
    { temperature: 0.9, maxTokens: cfg.provider === 'groq' ? 3000 : 8000 },
  )

  const raw = (data.sugestoes ?? []).filter(s =>
    s && s.titulo && (s.tipo === 'filme' || s.tipo === 'serie') &&
    (request.tipo === 'ambos' || s.tipo === request.tipo),
  )
  if (raw.length === 0) throw new AiError('A IA não trouxe sugestões desta vez. Tente de novo.')

  const resolved = await resolveSuggestionsRaw(raw, catalog, feedback)
  const items = resolved.filter((x): x is Suggestion => !!x).slice(0, count)
  const result: RecommendResult = {
    generatedAt: new Date().toISOString(),
    request:     { ...request, count },
    items,
    discarded:   raw.length - resolved.filter(Boolean).length,
    usage,
  }
  // Rodada vazia não apaga as sugestões anteriores (que podem ter itens ainda não respondidos).
  if (items.length > 0) kvSet(KV_LAST_RECS, result)
  return result
}

async function resolveSuggestions(
  raw: RawSuggestion[], catalog: CatalogEntry[], feedback: (FeedbackEntry & { tmdb_id: number })[],
): Promise<Suggestion[]> {
  const valid = raw.filter(s => s && s.titulo && (s.tipo === 'filme' || s.tipo === 'serie'))
  return (await resolveSuggestionsRaw(valid, catalog, feedback)).filter((x): x is Suggestion => !!x)
}

/** Confere cada sugestão no TMDB e descarta inexistentes, repetidas e o que já está no catálogo/Próximos. */
async function resolveSuggestionsRaw(
  raw: RawSuggestion[], catalog: CatalogEntry[], feedback: (FeedbackEntry & { tmdb_id: number })[],
): Promise<(Suggestion | null)[]> {
  const blocked = new Set(feedback.map(f => `${f.tipo}:${f.tmdb_id}`))
  const seenIds = new Set<string>()

  return mapLimit(raw, 4, async s => {
    try {
      const match = await resolveOnTmdb(s)
      if (!match) return null
      const key = `${s.tipo}:${match.id}`
      if (blocked.has(key) || seenIds.has(key)) return null
      if (findDuplicateInMedia(match.id, match.title, match.year || undefined, s.tipo)) return null
      if (findDuplicateInWatchlist(match.id, match.title, match.year || undefined, s.tipo)) return null
      seenIds.add(key)

      const d = await loadDetails(match.id, s.tipo)
      const item: Suggestion = {
        tmdbId:        match.id,
        tipo:          s.tipo,
        title:         d.title || match.title,
        originalTitle: match.originalTitle,
        year:          d.year || match.year,
        posterUrl:     d.posterUrl,
        backdropUrl:   d.backdropUrl,
        overview:      d.overview,
        genres:        d.genres,
        duration:      d.duration,
        director:      d.director,
        voteAverage:   d.voteAverage,
        why:           (s.por_que ?? '').trim(),
        similarTo:     (s.parecido_com ?? []).filter(t => catalog.some(c => titlesMatch(c.title, t))).slice(0, 3),
        warning:       s.alerta?.trim() || null,
      }
      return item
    } catch {
      return null
    }
  })
}

/** "+ Próximos" numa sugestão: busca os detalhes completos e salva na fila. */
export async function addSuggestionToWatchlist(tmdbId: number, tipo: 'filme' | 'serie'): Promise<{ success: boolean }> {
  const { title, year } = await addTmdbToWatchlist(tmdbId, tipo)
  setFeedback(tmdbId, tipo, title, year || null, 'added')
  return { success: true }
}

export interface WatchedFields {
  watched_status: NonNullable<AddMediaInput['watched_status']>
  rating?:        number
  observations?:  string
  watched_date?:  string
}

/**
 * "Já vi" numa sugestão: cadastra no catálogo com a nota/opinião do usuário e os
 * dados completos do TMDB. Se o título estiver em Próximos, promove (mantém os
 * vínculos com listas e as imagens já salvas).
 */
export async function addSuggestionToCatalog(tmdbId: number, tipo: 'filme' | 'serie', fields: WatchedFields): Promise<{ mediaId: number }> {
  const d = await loadDetails(tmdbId, tipo)
  if (findDuplicateInMedia(tmdbId, d.title, d.year || undefined, tipo)) {
    updateStoredStatus(tmdbId, tipo, 'cataloged')
    throw new AiError(`"${d.title}" já está no seu catálogo.`)
  }

  const inWatchlist = findDuplicateInWatchlist(tmdbId, d.title, d.year || undefined, tipo)
  const images = inWatchlist
    ? { cover_path: inWatchlist.cover_path, backdrop_path: inWatchlist.backdrop_path }
    : await localizeMediaImages({ cover_path: d.posterUrl ?? undefined, backdrop_path: d.backdropUrl ?? undefined })

  const media: AddMediaInput = {
    title:          d.title,
    tipo,
    release_year:   d.year || undefined,
    synopsis:       d.overview || undefined,
    cover_path:     images.cover_path ?? undefined,
    backdrop_path:  images.backdrop_path ?? undefined,
    duration:       d.duration ?? undefined,
    director:       d.director ?? undefined,
    genres:         d.genres,
    cast:           d.cast,
    tmdb_id:        tmdbId,
    watched_status: fields.watched_status,
    rating:         fields.rating && fields.rating > 0 ? fields.rating : undefined,
    observations:   fields.observations?.trim() || undefined,
    watched_date:   fields.watched_status === 'assistido' ? fields.watched_date : undefined,
  }
  const mediaId = inWatchlist ? promoteToMedia(inWatchlist.id, media) : addMedia(media)

  // Agora está no catálogo (que já entra no prompt): a resposta antiga, se houver, sobra.
  getDatabase().prepare('DELETE FROM ai_feedback WHERE tmdb_id = ? AND tipo = ?').run(tmdbId, tipo)
  updateStoredStatus(tmdbId, tipo, 'cataloged')
  return { mediaId }
}

// ─── IA nas listas ──────────────────────────────────────────────────────────

export interface ListCandidateRef {
  kind:       'media' | 'watchlist'
  id:         number
  title:      string
  year:       string | null
  cover_path: string | null
  rating:     number | null
}

/** Casa um título citado pela IA com o catálogo/Próximos (título + ano ±1). */
function matchOwned(
  m: RawListMember,
  owned: ListCandidateRef[],
): ListCandidateRef | null {
  const year = Number(m.ano) || undefined
  return owned.find(o =>
    titlesMatch(o.title, m.titulo) && (!year || !o.year || Math.abs(Number(o.year) - year) <= 1),
  ) ?? null
}

function ownedRefs(): ListCandidateRef[] {
  const media = loadCatalogRows().map<ListCandidateRef>(r => ({
    kind: 'media', id: r.id, title: r.entry.title, year: r.entry.year ?? null,
    cover_path: r.cover_path, rating: r.entry.rating ?? null,
  }))
  const px = getAllWatchlist().map<ListCandidateRef>(w => ({
    kind: 'watchlist', id: w.id, title: w.title, year: w.release_year ?? null,
    cover_path: w.cover_path ?? null, rating: null,
  }))
  return [...media, ...px]
}

export interface ListCompletion {
  fromCatalog: ListCandidateRef[]
  discover:    Suggestion[]
}

export async function completeList(listId: number): Promise<ListCompletion> {
  const cfg  = requireConfig()
  const list = getAllLists().find(l => l.id === listId)
  if (!list) throw new AiError('Lista não encontrada.')

  const members   = getMediaInList(listId)
  const catalog   = loadCatalog()
  const watchlist = getAllWatchlist()
  const feedback  = loadFeedback()

  const { data } = await chatJson<RawCompletion>(cfg, buildCompleteListMessages({
    catalog,
    watchlist: watchlist.map<SimpleTitle>(w => ({ title: w.title, year: w.release_year, tipo: w.tipo })),
    feedback,
    list: {
      name: list.name, kind: list.kind, description: list.description,
      members: members.map<SimpleTitle>(m => ({ title: m.title, year: m.release_year, tipo: m.tipo })),
    },
    budgetChars: cfg.info.contextChars,
  }), { temperature: 0.5, maxTokens: cfg.provider === 'groq' ? 2500 : 6000 })

  const inList = new Set(members.map(m => m.isProximo ? `watchlist:${m.watchlistId}` : `media:${m.id}`))
  const owned  = ownedRefs()
  const fromCatalog: ListCandidateRef[] = []
  for (const m of data.do_catalogo ?? []) {
    const hit = m?.titulo ? matchOwned(m, owned) : null
    if (hit && !inList.has(`${hit.kind}:${hit.id}`) && !fromCatalog.includes(hit)) fromCatalog.push(hit)
  }

  const discover = await resolveSuggestions(data.novos ?? [], catalog, feedback)
  return { fromCatalog, discover: discover.slice(0, 8) }
}

export interface ListProposal {
  name:        string
  kind:        ListKind
  description: string
  items:       ListCandidateRef[]
}

export async function suggestLists(): Promise<ListProposal[]> {
  const cfg      = requireConfig()
  const existing = getAllLists()
  const { data } = await chatJson<{ listas?: RawListSuggestion[] }>(cfg, buildSuggestListsMessages({
    catalog:       loadCatalog(),
    existingLists: existing.map(l => ({ name: l.name, kind: l.kind })),
    budgetChars:   cfg.info.contextChars,
  }), { temperature: 0.8, maxTokens: cfg.provider === 'groq' ? 2500 : 6000 })

  const taken = new Set(existing.map(l => l.name.toLowerCase()))
  const owned = ownedRefs().filter(o => o.kind === 'media')
  const kinds: ListKind[] = ['franquia', 'saga', 'tema', 'livre']

  const proposals: ListProposal[] = []
  for (const l of data.listas ?? []) {
    const name = l?.nome?.trim()
    if (!name || taken.has(name.toLowerCase())) continue
    const items: ListCandidateRef[] = []
    for (const m of l.titulos ?? []) {
      const hit = m?.titulo ? matchOwned(m, owned) : null
      if (hit && !items.includes(hit)) items.push(hit)
    }
    if (items.length < 3) continue
    proposals.push({
      name,
      kind:        kinds.includes(l.tipo as ListKind) ? l.tipo as ListKind : 'tema',
      description: l.descricao?.trim() ?? '',
      items,
    })
    taken.add(name.toLowerCase())
  }
  if (proposals.length === 0) throw new AiError('A IA não conseguiu montar listas novas desta vez. Tente de novo.')
  return proposals
}

export function createListFromProposal(p: { name: string; kind: ListKind; description: string; items: ListEntryRef[] }): { listId: number } {
  const listId = createList(p.name.trim(), p.description.trim(), p.kind)
  addManyToList(listId, p.items)
  return { listId }
}
