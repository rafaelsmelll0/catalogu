import { describe, it, expect } from 'vitest'
import { formatCatalog, buildRecommendMessages, buildProfileMessages, type CatalogEntry } from '../aiPrompts.js'
import { titlesMatch, pickCandidate, type MatchCandidate } from '../aiMatch.js'
import { parseJsonLoose } from '../aiClient.js'

function entry(over: Partial<CatalogEntry>): CatalogEntry {
  return {
    title: 'Filme', year: '2000', tipo: 'filme', rating: 6, watched_status: 'assistido',
    genres: [], tags: [], lists: [], director: null, observations: null, watched_date: null,
    ...over,
  }
}

describe('formatCatalog', () => {
  it('uma linha por título com nota, ano, gêneros, diretor, tags, listas e observação', () => {
    const txt = formatCatalog([entry({
      title: 'Alien', year: '1979', rating: 9, genres: ['Terror', 'Ficção científica'],
      director: 'Ridley Scott', tags: ['Clássico'], lists: ['Franquia | Alien'], observations: 'Obra-prima  do terror.\nTensão pura.',
    })], 10_000)

    expect(txt).toBe('[9] · Alien (1979) · Terror/Ficção científica · dir. Ridley Scott · tags: Clássico · listas: Franquia | Alien — "Obra-prima do terror. Tensão pura."')
  })

  it('marca série, status diferente de assistido e ausência de nota', () => {
    const txt = formatCatalog([entry({ title: 'Dark', tipo: 'serie', rating: 0, watched_status: 'nao_assistido' })], 10_000)
    expect(txt).toContain('[sem nota]')
    expect(txt).toContain('série')
    expect(txt).toContain('não assistido')
  })

  it('com orçamento curto, preserva as observações dos títulos de nota mais extrema', () => {
    const long = 'x'.repeat(300)
    const entries = [
      entry({ title: 'Mediano', rating: 6, observations: 'obs do mediano ' + long }),
      entry({ title: 'Amei', rating: 10, observations: 'obs do amei ' + long }),
      entry({ title: 'Odiei', rating: 1, observations: 'obs do odiei ' + long }),
    ]
    const txt = formatCatalog(entries, 900)
    const line = (t: string) => txt.split('\n').find(l => l.includes(`· ${t} (`))!
    // extremos inteiros; o mediano leva só a sobra do orçamento, cortada com "…"
    expect(line('Amei')).toContain('obs do amei ' + long + '"')
    expect(line('Odiei')).toContain('obs do odiei ' + long + '"')
    expect(line('Mediano')).toContain('…"')
    expect(txt.length).toBeLessThanOrEqual(900)
    // mantém a ordem original das linhas
    expect(txt.indexOf('Mediano')).toBeLessThan(txt.indexOf('Amei'))
  })
})

describe('prompts', () => {
  it('perfil pede JSON e inclui o catálogo', () => {
    const msgs = buildProfileMessages([entry({ title: 'Alien' })], 10_000)
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toContain('"perfil"')
    expect(msgs[1].content).toContain('Alien (2000)')
  })

  it('recomendação lista o que não pode ser sugerido e o pedido fica no fim (cache de prefixo)', () => {
    const msgs = buildRecommendMessages({
      profile:   'Gosta de terror.',
      catalog:   [entry({ title: 'Alien' })],
      watchlist: [{ title: 'Duna', year: '2021', tipo: 'filme' }],
      feedback:  [
        { title: 'Crepúsculo', year: '2008', tipo: 'filme', verdict: 'dismissed' },
        { title: 'Tubarão', year: '1975', tipo: 'filme', verdict: 'seen' },
      ],
      request:   { count: 8, tipo: 'filme', pedido: 'algo curto' },
      budgetChars: 10_000,
    })
    const user = msgs[1].content
    expect(user).toContain('EM PRÓXIMOS (já pretende ver — não recomende): Duna (2021)')
    expect(user).toContain('JÁ VIU MAS NÃO CATALOGOU (não recomende): Tubarão (1975)')
    expect(user).toContain('Crepúsculo (2008)')
    expect(user.indexOf('CATÁLOGO')).toBeLessThan(user.indexOf('PEDIDO AGORA'))
    expect(user.trimEnd().endsWith('"algo curto"')).toBe(true)
    expect(user).toContain('8 sugestões, apenas FILMES')
  })
})

describe('conferência no TMDB', () => {
  it('titlesMatch aceita acentos, pontuação e subtítulo nacional', () => {
    expect(titlesMatch('Extermínio', 'exterminio')).toBe(true)
    expect(titlesMatch('Alien', 'Alien: O Oitavo Passageiro')).toBe(true)
    expect(titlesMatch('The Thing', 'The Thing')).toBe(true)
    expect(titlesMatch('It', 'It: A Coisa')).toBe(false) // curto demais para casar por "contém"
    expect(titlesMatch('Alien', 'Aliens: O Resgate')).toBe(false)
  })

  it('pickCandidate respeita o ano (±1) e prefere o mais votado', () => {
    const cands: MatchCandidate[] = [
      { id: 1, title: 'O Enigma de Outro Mundo', originalTitle: 'The Thing', year: '2011', voteCount: 2000 },
      { id: 2, title: 'O Enigma de Outro Mundo', originalTitle: 'The Thing', year: '1982', voteCount: 7000 },
      { id: 3, title: 'The Thing (curta)',       originalTitle: 'The Thing', year: '1982', voteCount: 3 },
    ]
    expect(pickCandidate(cands, 'The Thing', 1982)!.id).toBe(2)
    expect(pickCandidate(cands, 'The Thing', 2012)!.id).toBe(1)
    expect(pickCandidate(cands, 'Filme Inventado', 1982)).toBeNull()
  })
})

describe('parseJsonLoose', () => {
  it('aceita cercas de código e texto em volta', () => {
    expect(parseJsonLoose<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(parseJsonLoose<{ a: number }>('Aqui está: {"a": 2} espero ter ajudado')).toEqual({ a: 2 })
  })

  it('erro amigável quando não há JSON', () => {
    expect(() => parseJsonLoose('sem json')).toThrow(/formato inesperado/)
  })
})

describe('formatCatalog — orçamento apertado (Groq)', () => {
  it('cai para o formato compacto quando as linhas completas não cabem', () => {
    const entries = Array.from({ length: 100 }, (_, i) => entry({
      title: `Filme ${i}`, genres: ['Terror', 'Ficção científica'], director: 'Diretor Com Nome Longo',
      lists: ['Franquia | Alguma Coisa'], observations: 'obs',
    }))
    const txt = formatCatalog(entries, 5_000)
    expect(txt.length).toBeLessThanOrEqual(5_000)
    expect(txt).not.toContain('Diretor Com Nome Longo')
    expect(txt).toContain('[6] Filme 99 (2000)')
  })
})

describe('chatJson (servidor local)', () => {
  it('tenta de novo sem response_format quando a API recusa (400) e manda thinking + max_tokens folgado', async () => {
    const http = await import('http')
    const { chatJson } = await import('../aiClient.js')
    const bodies: Record<string, unknown>[] = []
    const server = http.createServer((req, res) => {
      let b = ''
      req.on('data', c => { b += c })
      req.on('end', () => {
        const body = JSON.parse(b)
        bodies.push(body)
        if (body.response_format) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'response_format not supported with thinking' } }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: '```json\n{"ok": true}\n```' } }], usage: { prompt_tokens: 10 } }))
      })
    })
    await new Promise<void>(r => server.listen(0, r))
    const port = (server.address() as { port: number }).port
    try {
      const { data } = await chatJson<{ ok: boolean }>({
        provider: 'deepseek',
        info: { label: 'x', baseUrl: `http://127.0.0.1:${port}`, defaultModel: 'm', contextChars: 1000, keysUrl: '' },
        model: 'deepseek-v4-pro', thinking: true, apiKey: 'k',
      }, [{ role: 'user', content: 'oi' }])
      expect(data).toEqual({ ok: true })
      expect(bodies).toHaveLength(2)
      expect(bodies[0].thinking).toEqual({ type: 'enabled' })
      expect(bodies[0].max_tokens).toBe(32000)
      expect(bodies[1].response_format).toBeUndefined()
    } finally {
      server.close()
    }
  })

  it('401 vira mensagem amigável sobre a chave', async () => {
    const http = await import('http')
    const { chatJson } = await import('../aiClient.js')
    const server = http.createServer((_req, res) => { res.writeHead(401); res.end('{}') })
    await new Promise<void>(r => server.listen(0, r))
    const port = (server.address() as { port: number }).port
    try {
      await expect(chatJson({
        provider: 'groq',
        info: { label: 'x', baseUrl: `http://127.0.0.1:${port}`, defaultModel: 'm', contextChars: 1000, keysUrl: '' },
        model: 'm', thinking: false, apiKey: 'k',
      }, [{ role: 'user', content: 'oi' }])).rejects.toThrow(/Chave de API inválida/)
    } finally {
      server.close()
    }
  })
})
