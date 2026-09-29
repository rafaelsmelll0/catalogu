import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

const API_KEY  = process.env.TMDB_API_KEY ?? ''
const BASE_URL = 'https://api.themoviedb.org/3'
const IMG_URL  = 'https://image.tmdb.org/t/p/'

export interface TmdbSearchResult {
  id:           number
  title:        string
  overview:     string
  release_date: string
  poster_path:  string | null
  media_type:   'movie' | 'tv'
}

export interface TmdbDetails {
  id:            number
  title:         string
  overview:      string
  release_date:  string
  runtime:       number
  genres:        { id: number; name: string }[]
  poster_path:   string | null
  backdrop_path: string | null
  credits: {
    cast: { name: string; order: number }[]
    crew: { name: string; job: string }[]
  }
  name?:               string
  first_air_date?:     string
  number_of_episodes?: number
  vote_average?:       number
  belongs_to_collection?: { id: number; name: string; poster_path: string | null } | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`)
  return res.json() as Promise<T>
}

export async function searchMovies(query: string): Promise<TmdbSearchResult[]> {
  if (!API_KEY) return []
  const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
  const data = await fetchJson<{ results: TmdbSearchResult[] }>(url)
  return (data.results ?? []).slice(0, 10).map(r => ({ ...r, media_type: 'movie' as const }))
}

export async function searchSeries(query: string): Promise<TmdbSearchResult[]> {
  if (!API_KEY) return []
  const url = `${BASE_URL}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
  const data = await fetchJson<{ results: (TmdbSearchResult & { name: string; first_air_date: string })[] }>(url)
  return (data.results ?? []).slice(0, 10).map(r => ({
    id:           r.id,
    title:        r.name,
    overview:     r.overview,
    release_date: r.first_air_date,
    poster_path:  r.poster_path,
    media_type:   'tv' as const,
  }))
}

export async function getMovieDetails(id: number): Promise<TmdbDetails> {
  const url = `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=pt-BR&append_to_response=credits`
  return fetchJson<TmdbDetails>(url)
}

export async function getTvDetails(id: number): Promise<TmdbDetails> {
  const url = `${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=pt-BR&append_to_response=credits`
  return fetchJson<TmdbDetails>(url)
}

export function getPosterUrl(path: string | null, size = 'w500'): string | null {
  if (!path) return null
  return `${IMG_URL}${size}${path}`
}

export function getBackdropUrl(backdropPath: string, size: 'w780' | 'w1280' | 'original' = 'w1280'): string {
  if (!backdropPath) return ''
  return `${IMG_URL}${size}${backdropPath}`
}

export interface TmdbMatchCandidate {
  id:            number
  title:         string
  originalTitle: string
  year:          string
  voteCount:     number
}

/**
 * Busca crua para conferir títulos sugeridos pela IA: traz título original,
 * ano e popularidade para escolher o candidato certo (e descartar invenções).
 */
export async function searchForMatch(
  query: string,
  tipo: 'filme' | 'serie',
  year?: number,
): Promise<TmdbMatchCandidate[]> {
  if (!API_KEY || !query.trim()) return []
  const kind    = tipo === 'filme' ? 'movie' : 'tv'
  const yearKey = tipo === 'filme' ? 'year' : 'first_air_date_year'
  const url = `${BASE_URL}/search/${kind}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`
    + (year ? `&${yearKey}=${year}` : '')
  const data = await fetchJson<{ results: {
    id: number; title?: string; name?: string; original_title?: string; original_name?: string
    release_date?: string; first_air_date?: string; vote_count?: number
  }[] }>(url)
  return (data.results ?? []).slice(0, 8).map(r => ({
    id:            r.id,
    title:         r.title ?? r.name ?? '',
    originalTitle: r.original_title ?? r.original_name ?? '',
    year:          (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
    voteCount:     r.vote_count ?? 0,
  }))
}

export interface TmdbCollection {
  id:    number
  name:  string
  parts: { id: number; title: string; release_date: string; poster_path: string | null }[]
}

/** Coleção (franquia) do TMDB com os filmes que a compõem. */
export async function getCollection(id: number): Promise<TmdbCollection> {
  const url = `${BASE_URL}/collection/${id}?api_key=${API_KEY}&language=pt-BR`
  const data = await fetchJson<{ id: number; name: string; parts?: { id: number; title: string; release_date?: string; poster_path: string | null }[] }>(url)
  return {
    id:    data.id,
    name:  data.name,
    parts: (data.parts ?? []).map(p => ({ id: p.id, title: p.title, release_date: p.release_date ?? '', poster_path: p.poster_path })),
  }
}

export interface TmdbMultiResult {
  id:        number
  tipo:      'filme' | 'serie'
  title:     string
  originalTitle: string
  year:      string
  posterUrl: string | null
  overview:  string
  popularity: number
}

/** Busca filmes e séries juntos (sem pessoas), para o "O que você assistiu?". */
export async function searchMulti(query: string): Promise<TmdbMultiResult[]> {
  if (!API_KEY || !query.trim()) return []
  const url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR&include_adult=false`
  const data = await fetchJson<{ results: {
    id: number; media_type: string; title?: string; name?: string; original_title?: string; original_name?: string
    release_date?: string; first_air_date?: string; poster_path?: string | null; overview?: string; popularity?: number
  }[] }>(url)
  return (data.results ?? [])
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 10)
    .map(r => ({
      id:            r.id,
      tipo:          r.media_type === 'movie' ? 'filme' as const : 'serie' as const,
      title:         r.title ?? r.name ?? '',
      originalTitle: r.original_title ?? r.original_name ?? '',
      year:          (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
      posterUrl:     getPosterUrl(r.poster_path ?? null, 'w185'),
      overview:      r.overview ?? '',
      popularity:    r.popularity ?? 0,
    }))
}
