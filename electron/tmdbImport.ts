import { getDatabase } from './database.js'
import { getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'
import { addToWatchlist, findDuplicateInWatchlist } from './watchlistQueries.js'
import { addWatchlistItemToList } from './queries.js'
import { localizeMediaImages } from './imageStore.js'

/** Detalhes do TMDB já no formato que o Catalogu grava. */
export async function loadDetails(tmdbId: number, tipo: 'filme' | 'serie') {
  const d = tipo === 'filme' ? await getMovieDetails(tmdbId) : await getTvDetails(tmdbId)
  return {
    title:        d.title ?? d.name ?? '',
    year:         (d.release_date ?? d.first_air_date ?? '').slice(0, 4),
    overview:     d.overview ?? '',
    genres:       (d.genres ?? []).map(g => g.name),
    duration:     (tipo === 'filme' ? d.runtime : d.number_of_episodes) || null,
    director:     d.credits?.crew?.find(c => c.job === 'Director')?.name ?? null,
    cast:         (d.credits?.cast ?? []).slice(0, 5).map(c => c.name),
    posterUrl:    getPosterUrl(d.poster_path),
    backdropUrl:  d.backdrop_path ? getBackdropUrl(d.backdrop_path) : null,
    voteAverage:  d.vote_average ?? null,
    collectionId: d.belongs_to_collection?.id ?? null,
  }
}

/**
 * Coloca um título do TMDB em Próximos com os dados completos (imagens em webp
 * local e coleção já preenchida). Opcionalmente também o põe numa lista.
 * Se já estava em Próximos, só garante o vínculo com a lista.
 */
export async function addTmdbToWatchlist(
  tmdbId: number,
  tipo: 'filme' | 'serie',
  listId?: number,
): Promise<{ title: string; year: string; watchlistId: number }> {
  const d = await loadDetails(tmdbId, tipo)

  let watchlistId: number
  const existing = findDuplicateInWatchlist(tmdbId, d.title, d.year || undefined, tipo)
  if (existing) {
    watchlistId = existing.id
  } else {
    watchlistId = addToWatchlist(await localizeMediaImages({
      title:         d.title,
      tipo,
      release_year:  d.year || undefined,
      synopsis:      d.overview || undefined,
      cover_path:    d.posterUrl ?? undefined,
      backdrop_path: d.backdropUrl ?? undefined,
      duration:      d.duration ?? undefined,
      director:      d.director ?? undefined,
      genres:        d.genres,
      cast:          d.cast,
      tmdb_id:       tmdbId,
    }))
    getDatabase()
      .prepare('UPDATE watchlist SET tmdb_collection_id = ?, collection_checked = 1 WHERE id = ?')
      .run(d.collectionId, watchlistId)
  }

  if (listId) addWatchlistItemToList(watchlistId, listId)
  return { title: d.title, year: d.year, watchlistId }
}
