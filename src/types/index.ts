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
  created_at: string
  genres?: string[]
  tags?: string[]
  cast?: string[]
  director?: string
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
  total: number
  filmes: number
  series: number
  assistidos: number
  naoAssistidos: number
  mediaRating: number
}
