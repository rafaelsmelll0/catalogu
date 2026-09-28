/**
 * Montagem do contexto e dos prompts da IA. Funções puras (sem banco, sem rede)
 * para poderem ser testadas.
 *
 * Ordem das mensagens pensada para o cache de prefixo do DeepSeek: o que muda
 * pouco (instruções + catálogo) vem primeiro; o pedido do momento vem por último.
 */

import type { ChatMessage } from './aiClient.js'

export interface CatalogEntry {
  title:          string
  year?:          string | null
  tipo:           'filme' | 'serie'
  rating?:        number | null
  watched_status: string
  genres:         string[]
  tags:           string[]
  lists:          string[]
  director?:      string | null
  observations?:  string | null
  watched_date?:  string | null
}

export interface SimpleTitle {
  title: string
  year?: string | null
  tipo:  'filme' | 'serie'
}

export interface FeedbackEntry extends SimpleTitle {
  verdict: 'added' | 'seen' | 'dismissed'
}

const STATUS_LABEL: Record<string, string> = {
  assistido:     'assistido',
  assistindo:    'assistindo',
  nao_assistido: 'não assistido',
  nao_lembro:    'não lembra',
}

function yearOf(t: SimpleTitle) {
  return t.year ? ` (${t.year})` : ''
}

function oneLine(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * Catálogo em texto compacto, uma linha por título. Quando o orçamento de
 * caracteres aperta (Groq grátis), as observações dos títulos com notas mais
 * extremas (os mais reveladores do gosto) ficam inteiras; as demais são cortadas.
 */
export function formatCatalog(entries: CatalogEntry[], budgetChars: number): string {
  const rated = entries.filter(e => (e.rating ?? 0) > 0)
  const avg   = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : 6

  const full = entries.map(e => {
    const parts = [
      e.rating && e.rating > 0 ? `[${e.rating}]` : '[sem nota]',
      `${e.title}${yearOf(e)}`,
      e.tipo === 'serie' ? 'série' : null,
      e.watched_status !== 'assistido' ? STATUS_LABEL[e.watched_status] ?? e.watched_status : null,
      e.genres.length ? e.genres.join('/') : null,
      e.director ? `dir. ${e.director}` : null,
      e.tags.length ? `tags: ${e.tags.join(', ')}` : null,
      e.lists.length ? `listas: ${e.lists.join(', ')}` : null,
    ].filter(Boolean)
    return parts.join(' · ')
  })

  // Se nem as linhas completas cabem (Groq grátis com catálogo grande), cai para
  // o essencial: nota, título e ano. As observações disputam o que sobrar.
  const size = (lines: string[]) => lines.reduce((s, l) => s + l.length + 1, 0)
  const base = size(full) <= budgetChars * 0.6
    ? full
    : entries.map(e => `${e.rating && e.rating > 0 ? `[${e.rating}]` : '[sem nota]'} ${e.title}${yearOf(e)}`)

  const baseSize = size(base)
  let remaining  = Math.max(0, budgetChars - baseSize)

  // Prioridade das observações: distância da média (amor e ódio dizem mais).
  const order = entries
    .map((e, i) => ({ i, weight: e.rating && e.rating > 0 ? Math.abs(e.rating - avg) : 0 }))
    .sort((a, b) => b.weight - a.weight)

  const obsFor = new Map<number, string>()
  for (const { i } of order) {
    const obs = entries[i].observations ? oneLine(entries[i].observations!) : ''
    if (!obs || remaining <= 40) continue
    const text = obs.length + 6 <= remaining ? obs : obs.slice(0, Math.max(0, remaining - 10)) + '…'
    obsFor.set(i, text)
    remaining -= text.length + 6
  }

  return base.map((line, i) => obsFor.has(i) ? `${line} — "${obsFor.get(i)}"` : line).join('\n')
}

function ratingScale(entries: CatalogEntry[]): string {
  const r = entries.map(e => e.rating ?? 0).filter(v => v > 0)
  if (r.length === 0) return 'Ainda não há notas.'
  const avg = r.reduce((s, v) => s + v, 0) / r.length
  const high = r.filter(v => v >= 8).length
  const low  = r.filter(v => v <= 4).length
  return `Escala 0–10. Média ${avg.toFixed(1)} em ${r.length} notas; ${high} com 8+ e ${low} com 4 ou menos.`
}

const PERSONA = `Você é o curador de cinema pessoal do usuário do Catalogu, um catálogo de filmes e séries.
Fale em português do Brasil, de forma direta e calorosa, tratando o usuário por "você".
As notas e observações são dele, escritas por ele. Leve a sério o que ele valoriza e o que o irrita.`

// ─── Perfil de gosto ────────────────────────────────────────────────────────

export function buildProfileMessages(entries: CatalogEntry[], budgetChars: number): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `${PERSONA}

Tarefa: ler o catálogo inteiro (notas e observações pessoais) e escrever o PERFIL DE GOSTO do usuário.
O perfil será lido e corrigido por ele, e depois usado para recomendar filmes e séries.

Regras:
- Baseie cada afirmação em padrões que aparecem em vários títulos, não em um só.
- Cite exemplos concretos do catálogo entre parênteses, e quando ajudar, trechos curtos das observações dele entre aspas.
- Inclua o que ele ama, o que o incomoda (defeitos que derrubam a nota), gêneros/temas/épocas preferidos, diretores recorrentes,
  e como ele usa a escala de notas (o que é nota alta PARA ELE).
- Não invente fatos sobre títulos. Sem elogios genéricos.
- Use o formato: linhas com "## " para seções e "- " para itens. 350 a 600 palavras.

Responda APENAS com JSON: {"perfil": "<texto>", "resumo": "<uma frase que capture o gosto dele>"}`,
    },
    {
      role: 'user',
      content: `${ratingScale(entries)}

CATÁLOGO (nota · título (ano) · gêneros · diretor · tags · listas — "observações"):
${formatCatalog(entries, budgetChars)}

Escreva o perfil de gosto.`,
    },
  ]
}

// ─── Recomendações ──────────────────────────────────────────────────────────

export interface RecommendRequest {
  count:  number
  tipo:   'filme' | 'serie' | 'ambos'
  pedido: string
}

export interface RawSuggestion {
  titulo:           string
  titulo_original?: string
  ano?:             number | string
  tipo:             'filme' | 'serie'
  por_que:          string
  parecido_com?:    string[]
  alerta?:          string
}

export function buildRecommendMessages(input: {
  profile:   string
  catalog:   CatalogEntry[]
  watchlist: SimpleTitle[]
  feedback:  FeedbackEntry[]
  request:   RecommendRequest
  budgetChars: number
}): ChatMessage[] {
  const { profile, catalog, watchlist, feedback, request } = input

  const tipoTxt = request.tipo === 'filme' ? 'apenas FILMES'
    : request.tipo === 'serie' ? 'apenas SÉRIES'
    : 'filmes e séries (maioria filmes, que é o que ele mais vê)'

  const dismissed = feedback.filter(f => f.verdict === 'dismissed')
  const seen      = feedback.filter(f => f.verdict === 'seen')
  const fmt = (xs: SimpleTitle[]) => xs.length ? xs.map(t => `${t.title}${yearOf(t)}`).join('; ') : '(nenhum)'

  return [
    {
      role: 'system',
      content: `${PERSONA}

Tarefa: recomendar títulos que ele AINDA NÃO VIU e provavelmente vai gostar, com base no perfil e no catálogo dele.

Regras:
- Só recomende títulos que existem de verdade, com o ano correto de lançamento. Na dúvida, não recomende.
- NUNCA recomende algo que já está no catálogo, em Próximos, ou nas listas de recusados/já vistos abaixo.
- "por_que": 2 a 3 frases conectando o título ao gosto DELE, citando títulos do catálogo e, quando couber,
  um trecho curto das observações dele entre aspas. Nada de sinopse genérica.
- "parecido_com": 1 a 3 títulos EXATAMENTE como aparecem no catálogo dele.
- "alerta": se houver algo que costuma incomodá-lo (segundo o perfil), avise com honestidade; senão, omita.
- Varie: misture épocas, países e níveis de fama; inclua pérolas menos óbvias, não só blockbusters.
- "titulo" em português do Brasil (título nacional, se houver); "titulo_original" no idioma original.

Responda APENAS com JSON:
{"sugestoes": [{"titulo": "", "titulo_original": "", "ano": 2000, "tipo": "filme", "por_que": "", "parecido_com": [""], "alerta": ""}]}`,
    },
    {
      role: 'user',
      content: `CATÁLOGO DELE (nota · título (ano) · gêneros · diretor · tags · listas — "observações"):
${formatCatalog(catalog, input.budgetChars)}

EM PRÓXIMOS (já pretende ver — não recomende): ${fmt(watchlist)}
JÁ VIU MAS NÃO CATALOGOU (não recomende): ${fmt(seen)}
RECUSOU SUGESTÕES ANTERIORES (não recomende, e evite parecidos demais): ${fmt(dismissed)}

PERFIL DE GOSTO (escrito a partir do catálogo e revisado por ele):
${profile}

PEDIDO AGORA: ${request.count} sugestões, ${tipoTxt}.${request.pedido.trim() ? `\nO que ele quer hoje: "${request.pedido.trim()}"` : ''}`,
    },
  ]
}
