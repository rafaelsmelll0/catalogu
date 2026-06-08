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
