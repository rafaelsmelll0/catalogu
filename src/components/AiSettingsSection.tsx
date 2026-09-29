import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'
import { ipc } from '../lib/ipc.ts'
import type { AiProvider, AiResult, AiSettings } from '../types/index.ts'
import { Button, Input, Select, type SelectOption } from './ui/index.ts'
import { showToast } from './Toast.tsx'
import { AnimatedRoll } from './AnimatedCat.tsx'

const PROVIDER_NOTES: Record<AiProvider, string> = {
  deepseek: 'Recomendado. Lê o catálogo inteiro com todas as suas observações; cada sugestão custa frações de centavo.',
  groq:     'Grátis, mas com limite de tokens por minuto: só cabe um resumo do catálogo, então as sugestões ficam menos precisas.',
}

type TestState = { kind: 'idle' } | { kind: 'testing' } | { kind: 'ok'; models: string[] } | { kind: 'error'; message: string }

export function AiSettingsSection({ sectionStyle }: { sectionStyle: React.CSSProperties }) {
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [editingKey, setEditingKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })

  useEffect(() => {
    ipc<AiSettings>('ai:getSettings').then(s => {
      setSettings(s)
      if (s.hasKey) runTest()
    })
  }, [])

  async function save(input: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await ipc<AiResult<AiSettings>>('ai:saveSettings', input)
      if (!res.ok) { showToast(res.error, 'error'); return null }
      setSettings(res.data)
      return res.data
    } finally {
      setSaving(false)
    }
  }

  async function runTest() {
    setTest({ kind: 'testing' })
    const res = await ipc<AiResult<string[]>>('ai:listModels')
    setTest(res.ok ? { kind: 'ok', models: res.data } : { kind: 'error', message: res.error })
  }

  async function handleSaveKey() {
    if (!keyInput.trim()) return
    const s = await save({ apiKey: keyInput.trim() })
    if (!s) return
    setKeyInput('')
    setEditingKey(false)
    showToast('Chave salva com criptografia neste computador.')
    runTest()
  }

  async function handleRemoveKey() {
    await save({ apiKey: null })
    setTest({ kind: 'idle' })
    showToast('Chave removida.', 'info')
  }

  async function handleProvider(p: AiProvider) {
    if (!settings || p === settings.provider) return
    if (settings.hasKey && !confirm(`Trocar para ${settings.providers[p].label}? A chave atual será apagada.`)) return
    await save({ provider: p })
    setTest({ kind: 'idle' })
    setEditingKey(true)
  }

  if (!settings) return null

  const info       = settings.providers[settings.provider]
  const showKeyBox = !settings.hasKey || editingKey
  const models     = test.kind === 'ok' ? test.models : []
  const modelOptions: SelectOption<string>[] = [...new Set([settings.model, ...models])]
    .map(m => ({ value: m, label: m === info.defaultModel ? `${m} (padrão)` : m }))

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold, marginBottom: theme.spacing.xs }}>
        Inteligência Artificial
      </h2>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
        Usada em <strong style={{ color: theme.colors.textSecondary }}>Para Você</strong>: a IA lê suas notas e
        observações, monta seu perfil de gosto e sugere o que ver. A chave fica criptografada neste computador
        e não vai no backup.
      </p>

      {/* Provedor */}
      <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.sm, flexWrap: 'wrap' }}>
        {(Object.keys(settings.providers) as AiProvider[]).map(p => {
          const active = p === settings.provider
          return (
            <button
              key={p}
              onClick={() => handleProvider(p)}
              className="focus-ring"
              style={{
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                borderRadius: theme.radius.full,
                border: `1px solid ${active ? theme.colors.primary : theme.colors.surfaceHover}`,
                background: active ? theme.colors.primaryGlow : 'transparent',
                color: active ? theme.colors.textPrimary : theme.colors.textSecondary,
                fontSize: theme.fontSizes.ui,
                fontWeight: active ? theme.fontWeights.bold : theme.fontWeights.regular,
                cursor: 'pointer',
              }}
            >
              {settings.providers[p].label}{p === 'deepseek' ? ' · recomendado' : ' · grátis'}
            </button>
          )
        })}
      </div>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small, marginBottom: theme.spacing.lg }}>
        {PROVIDER_NOTES[settings.provider]}
      </p>

      {/* Chave */}
      {showKeyBox ? (
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap', maxWidth: '640px' }}>
          <Input
            label={`Chave de API do ${info.label}`}
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
            autoComplete="off"
            spellCheck={false}
            style={{ flex: 1, minWidth: '260px' }}
          />
          <Button onClick={handleSaveKey} loading={saving} disabled={!keyInput.trim()} size="lg">Salvar</Button>
          {settings.hasKey && (
            <Button variant="ghost" onClick={() => { setEditingKey(false); setKeyInput('') }}>Cancelar</Button>
          )}
          <a
            href={info.keysUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small, width: '100%' }}
          >
            Onde pego a chave? Abrir {info.label} ↗
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
            🔒 Chave salva <code style={{ fontFamily: theme.fonts.mono, color: theme.colors.textPrimary }}>••••{settings.keyLast4}</code>
          </span>
          <TestBadge test={test} />
          <Button size="sm" variant="ghost" onClick={runTest} disabled={test.kind === 'testing'}>Testar</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingKey(true)}>Trocar chave</Button>
          <Button size="sm" variant="ghost" onClick={handleRemoveKey}>Remover</Button>
        </div>
      )}

      {/* Modelo e raciocínio */}
      {settings.hasKey && !editingKey && (
        <div style={{ display: 'flex', gap: theme.spacing.lg, alignItems: 'flex-end', marginTop: theme.spacing.lg, flexWrap: 'wrap' }}>
          <div style={{ minWidth: '280px' }}>
            <Select<string>
              label="Modelo"
              options={modelOptions}
              value={settings.model}
              onChange={m => save({ model: m })}
              fullWidth
            />
          </div>
          {settings.provider === 'deepseek' && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer',
              fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary, paddingBottom: '12px',
            }}>
              <input
                type="checkbox"
                checked={settings.thinking}
                onChange={e => save({ thinking: e.target.checked })}
                style={{ accentColor: theme.colors.primary, width: '16px', height: '16px' }}
              />
              Raciocínio profundo
              <span style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small }}>
                (sugestões melhores, resposta mais lenta)
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function TestBadge({ test }: { test: TestState }) {
  const base: React.CSSProperties = { fontSize: theme.fontSizes.small, padding: '2px 10px', borderRadius: theme.radius.full }
  switch (test.kind) {
    case 'testing':
      return <span style={{ ...base, color: theme.colors.textMuted, display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AnimatedRoll size={14} mode="spin" /> testando…</span>
    case 'ok':
      return <span style={{ ...base, color: theme.colors.success, background: `${theme.colors.success}18` }}>✓ conectado</span>
    case 'error':
      return <span title={test.message} style={{ ...base, color: theme.colors.danger, background: `${theme.colors.danger}18` }}>✗ {test.message}</span>
    default:
      return null
  }
}
