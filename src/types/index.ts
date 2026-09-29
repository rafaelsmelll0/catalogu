export type MediaType = 'filme' | 'serie'

export type WatchedStatus = 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'

export interface Media {
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
  tipo: MediaType
  watched_status: WatchedStatus
  tmdb_id?: number
  watched_date?: string
  created_at: string
  genres?: string[]
  tags?: string[]
  cast?: string[]
  director?: string
  isProximo?:   boolean
  watchlistId?: number
}

export interface Genre {
  id: number
  name: string
}

export interface Tag {
  id: number
  name: string
}

export interface MediaList {
  id: number
  name: string
  description?: string
}

export interface AppStats {
  total:            number
  filmes:           number
  series:           number
  assistidos:       number
  naoAssistidos:    number
  mediaRating:      number
  proximos:         number
  generoFavorito:   { name: string; count: number } | null
  minutosAssistidos: number
  horasAssistidas:  number
  distribuicaoNotas: { estrela: number; count: number }[]
  porAno:           { ano: string; count: number }[]
}

export interface WatchlistItem {
  id:             number
  title:          string
  tipo:           'filme' | 'serie'
  release_year?:  string
  synopsis?:      string
  cover_path?:    string
  backdrop_path?: string
  duration?:      number
  director?:      string
  genres:         string[]
  cast:           string[]
  tmdb_id?:       number
  created_at:     string
}

export interface ListCandidate {
  id:              number
  title:           string
  tipo:            'filme' | 'serie'
  release_year?:   string
  synopsis?:       string
  cover_path?:     string
  duration?:       number
  director?:       string
  genres?:         string[]
  rating?:         number
  observations?:   string
  tmdb_id?:        number
  isProximo:       boolean
  sourceId:        number
  watched_status?: string
}

// ─── IA ─────────────────────────────────────────────────────────────────────

export type AiProvider = 'deepseek' | 'groq'

export interface AiSettings {
  provider:  AiProvider
  model:     string
  thinking:  boolean
  hasKey:    boolean
  keyLast4?: string
  providers: Record<AiProvider, { label: string; defaultModel: string; keysUrl: string }>
}

/** Resposta padrão dos canais ai:* (erros já vêm com mensagem para o usuário). */
export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface TasteProfile {
  text:         string
  summary:      string
  generatedAt:  string
  basedOn:      number
  edited:       boolean
  catalogCount: number
}

export type SuggestionVerdict = 'added' | 'seen' | 'dismissed'
/** Estado do card; 'cataloged' = entrou no catálogo pelo "Já vi". */
export type SuggestionStatus = SuggestionVerdict | 'cataloged'

export interface Suggestion {
  tmdbId:        number
  tipo:          MediaType
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

export interface RecommendRequest {
  count:  number
  tipo:   'filme' | 'serie' | 'ambos'
  pedido: string
}

export interface RecommendResult {
  generatedAt: string
  request:     RecommendRequest
  items:       Suggestion[]
  discarded:   number
}

// ─── Listas v2 ──────────────────────────────────────────────────────────────

export type ListKind     = 'franquia' | 'saga' | 'tema' | 'livre'
export type ListSortMode = 'lancamento' | 'manual' | 'titulo' | 'nota'

export const LIST_KIND_LABEL: Record<ListKind, { one: string; many: string }> = {
  franquia: { one: 'Franquia', many: 'Franquias' },
  saga:     { one: 'Saga',     many: 'Sagas e trilogias' },
  tema:     { one: 'Tema',     many: 'Temas' },
  livre:    { one: 'Livre',    many: 'Livres' },
}

export interface ListInfo {
  id:                 number
  name:               string
  description:        string
  kind:               ListKind
  sort_mode:          ListSortMode
  tmdb_collection_id: number | null
  media_count:        number
  watched_count:      number
  avg_rating:         number | null
  watched_minutes:    number
}

/** Item de lista: título do catálogo ou item de Próximos. */
export interface ListEntryRef {
  kind: 'media' | 'watchlist'
  id:   number
}

export interface FranchisePart {
  tmdbId:       number
  title:        string
  year:         string
  releaseDate:  string
  posterUrl:    string | null
  where:        'catalogo' | 'proximos' | 'faltando'
  watched:      boolean
  upcoming:     boolean
  mediaId?:     number
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

export interface ListCandidateRef extends ListEntryRef {
  title:      string
  year:       string | null
  cover_path: string | null
  rating:     number | null
}

export interface ListCompletion {
  fromCatalog: ListCandidateRef[]
  discover:    Suggestion[]
}

export interface ListProposal {
  name:        string
  kind:        ListKind
  description: string
  items:       ListCandidateRef[]
}

// ─── Início (painel) ────────────────────────────────────────────────────────

export interface TmdbMultiResult {
  id:            number
  tipo:          MediaType
  title:         string
  originalTitle: string
  year:          string
  posterUrl:     string | null
  overview:      string
  popularity:    number
}

export interface YearSummary {
  year:           string
  count:          number
  minutes:        number
  avgRating:      number | null
  byMonth:        number[]
  prevSamePeriod: number
}
