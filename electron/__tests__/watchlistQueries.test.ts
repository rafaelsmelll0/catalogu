import { describe, it, expect } from 'vitest'
import { freshDb, sampleWatchlist } from './_setup.js'

describe('watchlist — básico', () => {
  it('adiciona e lista itens de Próximos', async () => {
    const { watchlist } = await freshDb()
    const id = watchlist.addToWatchlist(sampleWatchlist)
    expect(id).toBeGreaterThan(0)

    const all = watchlist.getAllWatchlist()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Duna')
    expect(all[0].genres).toEqual(['Ficção científica'])
    expect(all[0].cast).toEqual(['Timothée Chalamet'])
  })

  it('rejeita duplicata por tmdb_id', async () => {
    const { watchlist } = await freshDb()
    watchlist.addToWatchlist(sampleWatchlist)
    expect(() => watchlist.addToWatchlist(sampleWatchlist)).toThrow('DUPLICATE')
  })

  it('findDuplicateInWatchlist acha por tmdb_id e por título+ano', async () => {
    const { watchlist } = await freshDb()
    watchlist.addToWatchlist(sampleWatchlist)
    expect(watchlist.findDuplicateInWatchlist(438631, 'x', 'y')).not.toBeNull()
    expect(watchlist.findDuplicateInWatchlist(null, 'duna', '2021')).not.toBeNull()
    expect(watchlist.findDuplicateInWatchlist(null, 'nada', '1900')).toBeNull()
  })

  it('remove item e conta corretamente', async () => {
    const { watchlist } = await freshDb()
    const id = watchlist.addToWatchlist(sampleWatchlist)
    expect(watchlist.getWatchlistCount()).toBe(1)
    watchlist.removeFromWatchlist(id)
    expect(watchlist.getWatchlistCount()).toBe(0)
  })
})

describe('promoteToMedia — promoção de Próximos para o catálogo', () => {
  it('cria a mídia no catálogo com os dados informados e remove o item de Próximos', async () => {
    const { queries, watchlist } = await freshDb()
    const wId = watchlist.addToWatchlist(sampleWatchlist)

    const mediaId = watchlist.promoteToMedia(wId, {
      title: sampleWatchlist.title,
      tipo: sampleWatchlist.tipo,
      release_year: sampleWatchlist.release_year,
      genres: sampleWatchlist.genres,
      cast: sampleWatchlist.cast,
      director: sampleWatchlist.director,
      watched_status: 'assistido',
      rating: 5,
      observations: 'Épico',
    })

    expect(mediaId).toBeGreaterThan(0)
    // saiu de Próximos
    expect(watchlist.getWatchlistCount()).toBe(0)
    // entrou no catálogo com os dados
    const media = queries.getMediaById(mediaId)!
    expect(media.title).toBe('Duna')
    expect(media.rating).toBe(5)
    expect(media.observations).toBe('Épico')
    expect(media.watched_status).toBe('assistido')
    expect(media.director).toBe('Denis Villeneuve')
  })

  it('REGRESSÃO: preserva os vínculos com listas ao promover', async () => {
    const { queries, watchlist } = await freshDb()

    // Item em Próximos vinculado a DUAS listas
    const wId = watchlist.addToWatchlist(sampleWatchlist)
    const listA = queries.createList('Quero ver')
    const listB = queries.createList('Ficção')
    queries.addWatchlistItemToList(wId, listA)
    queries.addWatchlistItemToList(wId, listB)

    // Antes de promover: aparece nas duas listas como "isProximo"
    expect(queries.getMediaInList(listA).some(m => m.isProximo && m.title === 'Duna')).toBe(true)
    expect(queries.getMediaInList(listB).some(m => m.isProximo && m.title === 'Duna')).toBe(true)

    const mediaId = watchlist.promoteToMedia(wId, {
      title: sampleWatchlist.title,
      tipo: sampleWatchlist.tipo,
      release_year: sampleWatchlist.release_year,
      watched_status: 'assistido',
      rating: 5,
    })

    // Depois de promover: continua nas DUAS listas, agora como item do catálogo
    const inA = queries.getMediaInList(listA)
    const inB = queries.getMediaInList(listB)
    expect(inA).toHaveLength(1)
    expect(inB).toHaveLength(1)
    expect(inA[0].id).toBe(mediaId)
    expect(inA[0].isProximo).toBe(false)
    expect(inB[0].id).toBe(mediaId)
    expect(inB[0].isProximo).toBe(false)

    // E o item de Próximos sumiu
    expect(watchlist.getWatchlistCount()).toBe(0)
  })

  it('promover item SEM listas não cria vínculos nem quebra', async () => {
    const { queries, watchlist } = await freshDb()
    const wId = watchlist.addToWatchlist(sampleWatchlist)
    const listId = queries.createList('Vazia')

    const mediaId = watchlist.promoteToMedia(wId, {
      title: sampleWatchlist.title,
      tipo: sampleWatchlist.tipo,
      watched_status: 'assistido',
    })

    expect(queries.getMediaById(mediaId)).not.toBeNull()
    expect(queries.getMediaInList(listId)).toHaveLength(0)
  })
})

describe('getMediaInList — mistura catálogo + Próximos', () => {
  it('lista itens do catálogo e de Próximos juntos, marcando isProximo', async () => {
    const { queries, watchlist } = await freshDb()
    const listId = queries.createList('Mista')

    const mediaId = queries.addMedia({
      title: 'Matrix', tipo: 'filme', release_year: '1999', tmdb_id: 603, watched_status: 'assistido',
    })
    queries.addMediaToList(mediaId, listId)

    const wId = watchlist.addToWatchlist(sampleWatchlist)
    queries.addWatchlistItemToList(wId, listId)

    const content = queries.getMediaInList(listId)
    expect(content).toHaveLength(2)
    const catalogo = content.find(m => !m.isProximo)!
    const proximo = content.find(m => m.isProximo)!
    expect(catalogo.title).toBe('Matrix')
    expect(proximo.title).toBe('Duna')
    // itens de Próximos usam id negativo para não colidir com o catálogo
    expect(proximo.id).toBeLessThan(0)
    expect(proximo.watchlistId).toBe(wId)
  })
})
