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
