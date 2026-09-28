import log from 'electron-log'
import type { AiProvider, ProviderInfo } from './aiSettings.js'

/**
 * Cliente mínimo para APIs compatíveis com a da OpenAI (DeepSeek e Groq falam o
 * mesmo formato), sem SDK: um POST em /chat/completions pedindo JSON.
 */

export interface AiConfig {
  provider: AiProvider
  info:     ProviderInfo
  model:    string
  thinking: boolean
  apiKey:   string
}

export interface ChatMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

export interface AiUsage {
  promptTokens:     number
  completionTokens: number
  cachedTokens:     number
}

/** Erro com mensagem já pronta para mostrar ao usuário (pt-BR). */
export class AiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'AiError'
  }
}

function friendlyHttpError(status: number, body: string): string {
  switch (status) {
    case 400: return `A IA recusou o pedido (400). ${shortDetail(body)}`
    case 401: return 'Chave de API inválida ou revogada. Confira em Configurações › Inteligência Artificial.'
    case 402: return 'Sem saldo na conta da IA. Recarregue os créditos no site do provedor.'
    case 404: return 'Modelo não encontrado. Escolha outro modelo em Configurações.'
    case 413: return 'O pedido ficou grande demais para este provedor. No Groq grátis, use o DeepSeek para catálogos grandes.'
    case 429: return 'Limite de uso atingido. Espere um pouco e tente de novo.'
    default:
      return status >= 500
        ? `O servidor da IA está com problemas (${status}). Tente de novo em instantes.`
        : `Erro ${status} da IA. ${shortDetail(body)}`
  }
}

function shortDetail(body: string): string {
  try {
    const j = JSON.parse(body)
    const msg = j?.error?.message ?? j?.message
    if (msg) return String(msg).slice(0, 200)
  } catch { /* corpo não-JSON */ }
  return body.slice(0, 200)
}

async function request(cfg: AiConfig, pathname: string, init: RequestInit, timeoutMs: number) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${cfg.info.baseUrl}${pathname}`, {
      ...init,
      signal:  ctrl.signal,
      headers: {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type':  'application/json',
        ...(init.headers ?? {}),
      },
    })
    const text = await res.text()
    if (!res.ok) {
      log.warn(`[ai] HTTP ${res.status} em ${pathname}:`, text.slice(0, 500))
      throw new AiError(friendlyHttpError(res.status, text), res.status)
    }
    return text
  } catch (err) {
    if (err instanceof AiError) throw err
    if ((err as Error)?.name === 'AbortError') {
      throw new AiError('A IA demorou demais para responder. Tente de novo (ou desligue o "raciocínio profundo").')
    }
    throw new AiError('Não foi possível falar com a IA. Verifique sua conexão com a internet.')
  } finally {
    clearTimeout(timer)
  }
}

/** Extrai o objeto JSON da resposta, tolerando cercas ```json e texto em volta. */
export function parseJsonLoose<T>(content: string): T {
  const cleaned = content.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const start = cleaned.indexOf('{')
    const end   = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T
    throw new AiError('A IA respondeu num formato inesperado. Tente de novo.')
  }
}

export async function chatJson<T>(
  cfg: AiConfig,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<{ data: T; usage: AiUsage }> {
  const thinking = cfg.provider === 'deepseek' && cfg.thinking
  const body: Record<string, unknown> = {
    model:           cfg.model,
    messages,
    response_format: { type: 'json_object' },
    temperature:     opts.temperature ?? 0.7,
    // No modo raciocínio o limite inclui a cadeia de pensamento: folga grande
    // para a resposta não sair cortada (paga-se só o que for usado).
    max_tokens:      thinking ? 32_000 : (opts.maxTokens ?? 8000),
    stream:          false,
  }
  if (cfg.provider === 'deepseek') {
    body.thinking = { type: thinking ? 'enabled' : 'disabled' }
  }

  // Com raciocínio ligado a resposta pode levar alguns minutos.
  const timeout = thinking ? 300_000 : 120_000
  let text: string
  try {
    text = await request(cfg, '/chat/completions', { method: 'POST', body: JSON.stringify(body) }, timeout)
  } catch (err) {
    // Alguns modelos/modos recusam response_format; o prompt já pede JSON, então tenta sem.
    if (!(err instanceof AiError) || err.status !== 400) throw err
    delete body.response_format
    text = await request(cfg, '/chat/completions', { method: 'POST', body: JSON.stringify(body) }, timeout)
  }

  const json = JSON.parse(text) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[]
    usage?: {
      prompt_tokens?: number; completion_tokens?: number
      prompt_cache_hit_tokens?: number
      prompt_tokens_details?: { cached_tokens?: number }
    }
  }
  const choice  = json.choices?.[0]
  const content = choice?.message?.content ?? ''
  if (!content.trim()) {
    throw new AiError(choice?.finish_reason === 'length'
      ? 'A resposta da IA foi cortada por tamanho. Tente de novo.'
      : 'A IA não devolveu conteúdo. Tente de novo.')
  }

  const usage: AiUsage = {
    promptTokens:     json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
    cachedTokens:     json.usage?.prompt_cache_hit_tokens ?? json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  }
  log.info(`[ai] ${cfg.provider}/${cfg.model} tokens: in=${usage.promptTokens} (cache ${usage.cachedTokens}) out=${usage.completionTokens}`)

  return { data: parseJsonLoose<T>(content), usage }
}

/** Lista os modelos da conta; serve também de teste da chave. */
export async function listModels(cfg: AiConfig): Promise<string[]> {
  const text = await request(cfg, '/models', { method: 'GET' }, 20_000)
  const json = JSON.parse(text) as { data?: { id: string }[] }
  return (json.data ?? []).map(m => m.id).sort()
}
