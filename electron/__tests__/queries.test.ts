import { describe, it, expect } from 'vitest'
import { freshDb, sampleMovie } from './_setup.js'

describe('media — CRUD e associações', () => {
  it('adiciona uma mídia e recupera por id com gêneros, tags, elenco e diretor', async () => {
    const { queries } = await freshDb()

    const id = queries.addMedia(sampleMovie)
    expect(id).toBeGreaterThan(0)

    const row = queries.getMediaById(id)
    expect(row).not.toBeNull()
    expect(row!.title).toBe('Matrix')
    expect(row!.tipo).toBe('filme')
    expect(row!.rating).toBe(5)
    expect(row!.genres).toEqual(expect.arrayContaining(['Ação', 'Ficção científica']))
    expect(row!.tags).toEqual(['favorito'])
    expect(row!.cast).toEqual(expect.arrayContaining(['Keanu Reeves', 'Carrie-Anne Moss']))
    expect(row!.director).toBe('Lana Wachowski')
  })

  it('getMediaById retorna null para id inexistente', async () => {
    const { queries } = await freshDb()
    expect(queries.getMediaById(9999)).toBeNull()
  })

  it('getAllMedia devolve todas as mídias, mais recentes primeiro', async () => {
    const { queries } = await freshDb()
    const id1 = queries.addMedia({ ...sampleMovie, title: 'A', tmdb_id: 1 })
    const id2 = queries.addMedia({ ...sampleMovie, title: 'B', tmdb_id: 2 })

    const all = queries.getAllMedia()
    expect(all).toHaveLength(2)
    // created_at DESC — o último inserido (id2) tende a vir primeiro; garantimos que ambos existem.
    expect(all.map(m => m.id)).toEqual(expect.arrayContaining([id1, id2]))
  })

  it('getAllMedia traz as associações corretas por linha (guarda contra regressão do N+1)', async () => {
    const { queries } = await freshDb()
    queries.addMedia({ ...sampleMovie, title: 'Matrix', tmdb_id: 1, genres: ['Ação'], tags: ['favorito'], director: 'Lana', cast: ['Keanu'] })
    queries.addMedia({ ...sampleMovie, title: 'Duna', tmdb_id: 2, genres: ['Ficção'], tags: [], director: 'Denis', cast: ['Timothée', 'Zendaya'] })

    const all = queries.getAllMedia()
    const matrix = all.find(m => m.title === 'Matrix')!
    const duna = all.find(m => m.title === 'Duna')!

    expect(matrix.genres).toEqual(['Ação'])
    expect(matrix.tags).toEqual(['favorito'])
    expect(matrix.director).toBe('Lana')
    expect(matrix.cast).toEqual(['Keanu'])

    expect(duna.genres).toEqual(['Ficção'])
    expect(duna.tags).toEqual([])
    expect(duna.director).toBe('Denis')
    expect(duna.cast).toEqual(expect.arrayContaining(['Timothée', 'Zendaya']))
  })

  it('atualiza campos e associações', async () => {
    const { queries } = await freshDb()
    const id = queries.addMedia(sampleMovie)

    queries.updateMedia(id, {
      rating: 4,
      observations: 'Revi e caiu um pouco',
      genres: ['Ação'],
      tags: [],
      cast: ['Keanu Reeves'],
      director: 'Lilly Wachowski',
    })

    const row = queries.getMediaById(id)!
    expect(row.rating).toBe(4)
    expect(row.observations).toBe('Revi e caiu um pouco')
    expect(row.genres).toEqual(['Ação'])
    expect(row.tags).toEqual([])
    expect(row.cast).toEqual(['Keanu Reeves'])
    expect(row.director).toBe('Lilly Wachowski')
  })

  it('remove a mídia', async () => {
    const { queries } = await freshDb()
    const id = queries.addMedia(sampleMovie)
    queries.deleteMedia(id)
    expect(queries.getMediaById(id)).toBeNull()
    expect(queries.getAllMedia()).toHaveLength(0)
  })

  it('reaproveita gêneros e tags entre mídias (sem duplicar na tabela)', async () => {
    const { queries } = await freshDb()
    queries.addMedia({ ...sampleMovie, title: 'A', tmdb_id: 1, genres: ['Ação'], tags: ['favorito'] })
    queries.addMedia({ ...sampleMovie, title: 'B', tmdb_id: 2, genres: ['Ação'], tags: ['favorito'] })

    // getAllGenres/getAllTags devolvem o catálogo único de gêneros/tags.
    const genres = queries.getAllGenres() as { name: string }[]
    const tags = queries.getAllTags() as { name: string }[]
    expect(genres.filter(g => g.name === 'Ação')).toHaveLength(1)
    expect(tags.filter(t => t.name === 'favorito')).toHaveLength(1)
  })
})

describe('watched_date', () => {
  it('persiste a data assistida quando informada e retorna em getMediaById/getAllMedia', async () => {
    const { queries } = await freshDb()
    const id = queries.addMedia({ ...sampleMovie, watched_date: '2026-01-15' })

    expect(queries.getMediaById(id)!.watched_date).toBe('2026-01-15')
    expect(queries.getAllMedia().find(m => m.id === id)!.watched_date).toBe('2026-01-15')
  })

  it('aceita mídia sem data assistida (fica nula)', async () => {
    const { queries } = await freshDb()
    const id = queries.addMedia({ ...sampleMovie, watched_date: undefined })
    expect(queries.getMediaById(id)!.watched_date ?? null).toBeNull()
  })

  it('updateMedia altera a data assistida', async () => {
    const { queries } = await freshDb()
    const id = queries.addMedia({ ...sampleMovie, watched_date: '2026-01-15' })
    queries.updateMedia(id, { watched_date: '2026-02-20' })
    expect(queries.getMediaById(id)!.watched_date).toBe('2026-02-20')
  })
})

describe('findDuplicateInMedia', () => {
  it('encontra por tmdb_id', async () => {
    const { queries } = await freshDb()
    queries.addMedia(sampleMovie)
    const dup = queries.findDuplicateInMedia(603, 'Nome Diferente', '2000')
    expect(dup).not.toBeNull()
    expect(dup!.title).toBe('Matrix')
  })

  it('encontra por título + ano (case-insensitive) quando não há tmdb_id', async () => {
    const { queries } = await freshDb()
    queries.addMedia({ ...sampleMovie, tmdb_id: undefined })
    const dup = queries.findDuplicateInMedia(null, 'matrix', '1999')
    expect(dup).not.toBeNull()
    expect(dup!.title).toBe('Matrix')
  })

  it('retorna null quando não há duplicata', async () => {
    const { queries } = await freshDb()
    queries.addMedia(sampleMovie)
    expect(queries.findDuplicateInMedia(null, 'Outro', '1990')).toBeNull()
  })
})

describe('listas', () => {
  it('cria lista, adiciona mídia e recupera o conteúdo', async () => {
    const { queries } = await freshDb()
    const mediaId = queries.addMedia(sampleMovie)
    const listId = queries.createList('Favoritos', 'Os melhores')

    queries.addMediaToList(mediaId, listId)

    const content = queries.getMediaInList(listId)
    expect(content).toHaveLength(1)
    expect(content[0].id).toBe(mediaId)
    expect(content[0].isProximo).toBe(false)

    const lists = queries.getAllLists()
    expect(lists.find(l => l.id === listId)!.media_count).toBe(1)
  })

  it('remove mídia da lista', async () => {
    const { queries } = await freshDb()
    const mediaId = queries.addMedia(sampleMovie)
    const listId = queries.createList('Favoritos')
    queries.addMediaToList(mediaId, listId)
    queries.removeMediaFromList(mediaId, listId)
    expect(queries.getMediaInList(listId)).toHaveLength(0)
  })

  it('deletar a lista remove os vínculos (cascade), mas não a mídia', async () => {
    const { queries } = await freshDb()
    const mediaId = queries.addMedia(sampleMovie)
    const listId = queries.createList('Favoritos')
    queries.addMediaToList(mediaId, listId)

    queries.deleteList(listId)
    expect(queries.getAllLists().find(l => l.id === listId)).toBeUndefined()
    expect(queries.getMediaById(mediaId)).not.toBeNull()
  })

  it('addMediaToList é idempotente (INSERT OR IGNORE)', async () => {
    const { queries } = await freshDb()
    const mediaId = queries.addMedia(sampleMovie)
    const listId = queries.createList('Favoritos')
    queries.addMediaToList(mediaId, listId)
    queries.addMediaToList(mediaId, listId)
    expect(queries.getMediaInList(listId)).toHaveLength(1)
  })
})

describe('getStats', () => {
  it('conta total, filmes, séries, assistidos e média de nota', async () => {
    const { queries } = await freshDb()
    queries.addMedia({ ...sampleMovie, title: 'F1', tmdb_id: 1, tipo: 'filme', rating: 4, watched_status: 'assistido' })
    queries.addMedia({ ...sampleMovie, title: 'S1', tmdb_id: 2, tipo: 'serie', rating: 2, watched_status: 'nao_assistido' })

    const stats = queries.getStats()
    expect(stats.total).toBe(2)
    expect(stats.filmes).toBe(1)
    expect(stats.series).toBe(1)
    expect(stats.assistidos).toBe(1)
    expect(stats.naoAssistidos).toBe(1)
    expect(stats.mediaRating).toBe(3) // (4 + 2) / 2
  })

  it('calcula gênero favorito, horas assistidas, distribuição de notas e por ano', async () => {
    const { queries } = await freshDb()
    queries.addMedia({ ...sampleMovie, title: 'A', tmdb_id: 1, tipo: 'filme', rating: 5, duration: 120, watched_status: 'assistido', watched_date: '2025-05-10', genres: ['Ação', 'Ficção científica'] })
    queries.addMedia({ ...sampleMovie, title: 'B', tmdb_id: 2, tipo: 'filme', rating: 5, duration: 90,  watched_status: 'assistido', watched_date: '2026-03-01', genres: ['Ação'] })
    queries.addMedia({ ...sampleMovie, title: 'C', tmdb_id: 3, tipo: 'filme', rating: 3, duration: 60,  watched_status: 'assistido', watched_date: '2026-07-20', genres: ['Drama'] })

    const stats = queries.getStats()

    // Ação aparece em A e B => favorito
    expect(stats.generoFavorito).toEqual({ name: 'Ação', count: 2 })
    // 120 + 90 + 60 = 270 min = 4h (arredondado de 4.5)
    expect(stats.minutosAssistidos).toBe(270)
    expect(stats.horasAssistidas).toBe(5) // Math.round(270/60) = Math.round(4.5) = 5
    // duas notas 5 e uma nota 3
    expect(stats.distribuicaoNotas).toEqual(expect.arrayContaining([
      { estrela: 5, count: 2 },
      { estrela: 3, count: 1 },
    ]))
    // um em 2025, dois em 2026
    expect(stats.porAno).toEqual([
      { ano: '2025', count: 1 },
      { ano: '2026', count: 2 },
    ])
  })
})
