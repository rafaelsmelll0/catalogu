import { app, safeStorage } from 'electron'
import log from 'electron-log'
import fs from 'fs'
import path from 'path'

/**
 * Configuração da IA (provedor, modelo e chave de API).
 *
 * Fica num JSON no userData — fora do banco de propósito: o backup do catálogo
 * pode ir para outro PC/pessoa, a chave não. A chave é criptografada com o
 * safeStorage (DPAPI no Windows: só este usuário, neste computador, abre) e
 * nunca volta para o renderer — ele só sabe se existe e os 4 últimos dígitos.
 */

export type AiProvider = 'deepseek' | 'groq'

export interface ProviderInfo {
  label:        string
  baseUrl:      string
  defaultModel: string
  /** Orçamento de caracteres de contexto: o Groq grátis limita tokens por minuto. */
  contextChars: number
  keysUrl:      string
}

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  deepseek: {
    label:        'DeepSeek',
    baseUrl:      'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-pro',
    contextChars: 400_000,
    keysUrl:      'https://platform.deepseek.com/api_keys',
  },
  groq: {
    label:        'Groq',
    baseUrl:      'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    // ~8k tokens/min no plano grátis: entrada + saída precisam caber nisso.
    contextChars: 14_000,
    keysUrl:      'https://console.groq.com/keys',
  },
}

interface StoredSettings {
  provider:  AiProvider
  model:     string
  thinking:  boolean
  /** base64 do buffer criptografado pelo safeStorage */
  keyCipher?: string
  keyLast4?:  string
}

/** O que o renderer pode ver (sem a chave). */
export interface PublicAiSettings {
  provider:  AiProvider
  model:     string
  thinking:  boolean
  hasKey:    boolean
  keyLast4?: string
  providers: Record<AiProvider, Pick<ProviderInfo, 'label' | 'defaultModel' | 'keysUrl'>>
}

const DEFAULTS: StoredSettings = {
  provider: 'deepseek',
  model:    PROVIDERS.deepseek.defaultModel,
  thinking: true,
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'ai-settings.json')
}

function readStored(): StoredSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as Partial<StoredSettings>
    const provider = raw.provider && raw.provider in PROVIDERS ? raw.provider : DEFAULTS.provider
    return { ...DEFAULTS, ...raw, provider }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeStored(s: StoredSettings) {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2), 'utf8')
}

export function getPublicSettings(): PublicAiSettings {
  const s = readStored()
  return {
    provider:  s.provider,
    model:     s.model,
    thinking:  s.thinking,
    hasKey:    !!s.keyCipher,
    keyLast4:  s.keyLast4,
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([k, p]) => [k, { label: p.label, defaultModel: p.defaultModel, keysUrl: p.keysUrl }]),
    ) as PublicAiSettings['providers'],
  }
}

export interface SaveSettingsInput {
  provider?: AiProvider
  model?:    string
  thinking?: boolean
  /** string = nova chave; null = remover; undefined = manter */
  apiKey?:   string | null
}

export function saveSettings(input: SaveSettingsInput): PublicAiSettings {
  const s = readStored()

  if (input.provider && input.provider !== s.provider) {
    // Trocar de provedor invalida a chave e o modelo (são de outra conta/catálogo).
    s.provider  = input.provider
    s.model     = PROVIDERS[input.provider].defaultModel
    s.keyCipher = undefined
    s.keyLast4  = undefined
  }
  if (input.model?.trim())          s.model    = input.model.trim()
  if (input.thinking !== undefined) s.thinking = input.thinking

  if (input.apiKey === null) {
    s.keyCipher = undefined
    s.keyLast4  = undefined
  } else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    const key = input.apiKey.trim()
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Criptografia do sistema indisponível; a chave não foi salva.')
    }
    s.keyCipher = safeStorage.encryptString(key).toString('base64')
    s.keyLast4  = key.slice(-4)
  }

  writeStored(s)
  return getPublicSettings()
}

/** Configuração completa para uso interno do processo principal (inclui a chave). */
export function getActiveConfig(): { provider: AiProvider; info: ProviderInfo; model: string; thinking: boolean; apiKey: string } | null {
  const s = readStored()
  if (!s.keyCipher) return null
  try {
    const apiKey = safeStorage.decryptString(Buffer.from(s.keyCipher, 'base64'))
    // Dev/testes: aponta para um servidor compatível local em vez do provedor real.
    const info = process.env.CATALOGU_AI_BASE_URL
      ? { ...PROVIDERS[s.provider], baseUrl: process.env.CATALOGU_AI_BASE_URL }
      : PROVIDERS[s.provider]
    return { provider: s.provider, info, model: s.model, thinking: s.thinking, apiKey }
  } catch (err) {
    log.error('Falha ao descriptografar a chave da IA:', err)
    return null
  }
}
