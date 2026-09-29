import { describe, it, expect, vi } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { freshDb, sampleMovie, sampleWatchlist } from './_setup.js'
import { cleanCollectionName } from '../collections.js'

describe('migração das listas (v2)', () => {
  it('"Franquia | X" vira lista X do tipo franquia; as demais viram tema; nome curto em uso fica como estava', async () => {
    const file = path.join(os.tmpdir(), `catalogu-lists-${Date.now()}.db`)
    const old = new Database(file)
    old.exec(`
      CREATE TABLE lists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT);
      CREATE TABLE media_lists_link (media_id INTEGER, list_id INTEGER, PRIMARY KEY (media_id, list_id));
      CREATE TABLE watchlist_lists_link (watchlist_id INTEGER NOT NULL, list_id INTEGER NOT NULL, PRIMARY KEY (watchlist_id, list_id));
      INSERT INTO lists (name) VALUES ('Franquia | Alien'), ('Franquia | Predador'), ('Predador'), ('Zumbis');
    `)
    old.close()

    vi.resetModules()
    const database = await import('../database.js')
    database.setDbPath(file)
    const queries = await import('../queries.js')
    const lists = queries.getAllLists()
    database.closeDatabase()
    fs.rmSync(file, { force: true })

    const byName = Object.fromEntries(lists.map(l => [l.name, l.kind]))
    expect(byName).toEqual({
      'Alien':               'franquia',
      'Franquia | Predador': 'franquia', // "Predador" já existia
      'Predador':            'tema',
      'Zumbis':              'tema',
    })
  })
})

describe('listas v2', () => {
  it('ordena por lançamento, título, nota e ordem manual', async () => {
    const { queries } = await freshDb()
    const list = queries.createList('Alien', '', 'franquia')
    const a = queries.addMedia({ ...sampleMovie, title: 'Aliens', release_year: '1986', rating: 9, tmdb_id: 1 })
    const b = queries.addMedia({ ...sampleMovie, title: 'Alien', release_year: '1979', rating: 10, tmdb_id: 2 })
    const c = queries.addMedia({ ...sampleMovie, title: 'Alien³', release_year: '1992', rating: 5, tmdb_id: 3 })
    queries.addManyToList(list, [{ kind: 'media', id: a }, { kind: 'media', id: b }, { kind: 'media', id: c }])

    const titles = () => queries.getMediaInList(list).map(m => m.title)
    expect(titles()).toEqual(['Alien', 'Aliens', 'Alien³'])

    queries.updateList(list, { sort_mode: 'nota' })
    expect(titles()).toEqual(['Alien', 'Aliens', 'Alien³'])

    queries.updateList(list, { sort_mode: 'titulo' })
    expect(titles()[0]).toBe('Alien')

    queries.reorderList(list, [{ kind: 'media', id: c }, { kind: 'media', id: b }, { kind: 'media', id: a }])
    expect(queries.getAllLists().find(l => l.id === list)!.sort_mode).toBe('manual')
    expect(titles()).toEqual(['Alien³', 'Alien', 'Aliens'])
  })

  it('ordem manual inclui itens de Próximos e novos itens entram no fim', async () => {
    const { queries, watchlist } = await freshDb()
    const list = queries.createList('Saga')
    const m1 = queries.addMedia({ ...sampleMovie, title: 'Parte 2', release_year: '2002', tmdb_id: 1 })
    const w1 = watchlist.addToWatchlist({ ...sampleWatchlist, title: 'Parte 1', release_year: '2001', tmdb_id: 2 })
    queries.addManyToList(list, [{ kind: 'media', id: m1 }, { kind: 'watchlist', id: w1 }])
    queries.reorderList(list, [{ kind: 'watchlist', id: w1 }, { kind: 'media', id: m1 }])

    const m2 = queries.addMedia({ ...sampleMovie, title: 'Parte 0', release_year: '1990', tmdb_id: 3 })
    queries.addMediaToList(m2, list)

    const items = queries.getMediaInList(list)
    expect(items.map(i => i.title)).toEqual(['Parte 1', 'Parte 2', 'Parte 0'])
    expect(items[0].isProximo).toBe(true)
  })

  it('addManyToList ignora repetidos e conta só os novos', async () => {
    const { queries } = await freshDb()
    const list = queries.createList('X')
    const id = queries.addMedia(sampleMovie)
    expect(queries.addManyToList(list, [{ kind: 'media', id }])).toBe(1)
    expect(queries.addManyToList(list, [{ kind: 'media', id }])).toBe(0)
    expect(queries.getListIdsFor({ kind: 'media', id })).toEqual([list])
  })

  it('getAllLists traz tipo e resumo (assistidos, nota média, minutos)', async () => {
    const { queries } = await freshDb()
    const list = queries.createList('Resumo', 'desc', 'tema')
    const a = queries.addMedia({ ...sampleMovie, title: 'A', tmdb_id: 1, rating: 8, duration: 100 })
    const b = queries.addMedia({ ...sampleMovie, title: 'B', tmdb_id: 2, rating: 6, duration: 90, watched_status: 'nao_assistido' })
    queries.addManyToList(list, [{ kind: 'media', id: a }, { kind: 'media', id: b }])

    const row = queries.getAllLists().find(l => l.id === list)!
    expect(row).toMatchObject({ kind: 'tema', description: 'desc', media_count: 2, watched_count: 1, avg_rating: 7, watched_minutes: 100 })
  })

  it('tipo inválido cai para "livre"', async () => {
    const { queries } = await freshDb()
    const id = queries.createList('Y', '', 'qualquer' as never)
    expect(queries.getAllLists().find(l => l.id === id)!.kind).toBe('livre')
  })
})

describe('franquias', () => {
  it('limpa o sufixo de coleção do TMDB', () => {
    expect(cleanCollectionName('Alien - Coleção')).toBe('Alien')
    expect(cleanCollectionName('Missão: Impossível - Coleção')).toBe('Missão: Impossível')
    expect(cleanCollectionName('The Matrix Collection')).toBe('The Matrix')
    expect(cleanCollectionName('Coleção')).toBe('Coleção')
  })
})
