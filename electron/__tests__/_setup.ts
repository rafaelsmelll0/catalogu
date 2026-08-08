import { vi } from 'vitest'

/**
 * Cria um banco SQLite em memória isolado e devolve os módulos de query
 * reimportados do zero, para que cada teste tenha estado limpo.
 *
 * getDatabase() cacheia a conexão em escopo de módulo; vi.resetModules()
 * descarta esse cache, então cada chamada gera um banco novo com o schema
 * recém-criado (initSchema roda na primeira query).
 */
export async function freshDb() {
  vi.resetModules()

  const database = await import('../database.js')
  database.setDbPath(':memory:')

  const queries = await import('../queries.js')
  const watchlist = await import('../watchlistQueries.js')

  // Força a criação do schema.
  queries.getAllMedia()

  return { database, queries, watchlist }
}

export const sampleMovie = {
  title: 'Matrix',
  tipo: 'filme' as const,
  release_year: '1999',
  synopsis: 'Um hacker descobre a verdade.',
  rating: 5,
  duration: 136,
  tmdb_id: 603,
  watched_status: 'assistido' as const,
  genres: ['Ação', 'Ficção científica'],
  tags: ['favorito'],
  director: 'Lana Wachowski',
  cast: ['Keanu Reeves', 'Carrie-Anne Moss'],
}

export const sampleWatchlist = {
  title: 'Duna',
  tipo: 'filme' as const,
  release_year: '2021',
  synopsis: 'Paul Atreides em Arrakis.',
  duration: 155,
  tmdb_id: 438631,
  genres: ['Ficção científica'],
  cast: ['Timothée Chalamet'],
  director: 'Denis Villeneuve',
}
