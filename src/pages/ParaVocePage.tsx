import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../styles/theme.ts'
import { ipc } from '../lib/ipc.ts'
import { formatDateBR } from '../lib/date.ts'
import type {
  AiResult, AiSettings, RecommendRequest, RecommendResult, Suggestion, SuggestionVerdict, TasteProfile,
} from '../types/index.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { Button, Input, Textarea, Badge } from '../components/ui/index.ts'
import { showToast } from '../components/Toast.tsx'
import CatSit from '../assets/cat-sit.svg?react'

const MOODS = [
  'Algo curto (até 1h45)',
  'Tenso do começo ao fim',
  'Desligar o cérebro',
  'Clássico (antes de 2000)',
  'Fora de Hollywood',
  'Pérola pouco conhecida',
  'Terror de verdade',
  'Nacional',
]

type LoadingKind = 'first' | 'profile' | 'recs'

// O perfil é lido do catálogo uma vez e guardado; nas rodadas seguintes o
// catálogo vai no pedido, mas o provedor reaproveita do cache.
const RECS_STEPS    = ['Usando seu perfil e catálogo (em cache)…', 'Escolhendo títulos que você ainda não viu…', 'Conferindo no TMDB se cada um existe mesmo…']
const PROFILE_STEPS = ['Lendo o catálogo inteiro…', 'Procurando padrões nas suas notas…', 'Escrevendo seu perfil de gosto…']
const LOADING_STEPS: Record<LoadingKind, string[]> = {
  recs:    RECS_STEPS,
  profile: PROFILE_STEPS,
  first:   [...PROFILE_STEPS, ...RECS_STEPS.slice(1)],
}

type Tipo = RecommendRequest['tipo']

export function ParaVocePage() {
  const navigate       = useNavigate()
  const fetchWatchlist = useWatchlistStore(s => s.fetchAll)

  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [profile, setProfile]   = useState<TasteProfile | null>(null)
  const [result, setResult]     = useState<RecommendResult | null>(null)

  const [tipo, setTipo]     = useState<Tipo>('filme')
  const [pedido, setPedido] = useState('')
  const [moods, setMoods]   = useState<string[]>([])

  const [loading, setLoading]             = useState<LoadingKind | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [elapsed, setElapsed]             = useState(0)

  useEffect(() => {
    ipc<AiSettings>('ai:getSettings').then(setSettings)
    ipc<TasteProfile | null>('ai:getProfile').then(setProfile)
    ipc<RecommendResult | null>('ai:lastRecommendations').then(r => {
      if (!r) return
      setResult(r)
      setTipo(r.request.tipo)
    })
  }, [])

  // Cronômetro durante a espera (com raciocínio profundo pode passar de um minuto)
  useEffect(() => {
    if (!loading) { setElapsed(0); return }
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [loading])

  async function handleGenerate() {
    if (loading) return
    setError(null)
    setLoading(profile ? 'recs' : 'first')
    const fullPedido = [pedido.trim(), ...moods].filter(Boolean).join('; ')
    const res = await ipc<AiResult<RecommendResult>>('ai:recommend', { count: 10, tipo, pedido: fullPedido })
    setLoading(null)
    if (!res.ok) { setError(res.error); return }
    if (!profile) ipc<TasteProfile | null>('ai:getProfile').then(setProfile)
    if (res.data.items.length === 0) {
      // Mantém a rodada anterior na tela; só avisa.
      setError('Todas as sugestões desta rodada já estavam no seu catálogo ou não existem. Tente de novo.')
      return
    }
    setResult(res.data)
  }

  async function handleRegenerateProfile() {
    if (loading) return
    setError(null)
    setLoading('profile')
    const res = await ipc<AiResult<TasteProfile>>('ai:generateProfile')
    setLoading(null)
    if (!res.ok) { setError(res.error); return }
    setProfile(res.data)
    showToast('Perfil de gosto atualizado!')
  }

  function updateItem(tmdbId: number, patch: Partial<Suggestion>) {
    setResult(prev => prev && ({
      ...prev,
      items: prev.items.map(i => i.tmdbId === tmdbId ? { ...i, ...patch } : i),
    }))
  }

  async function handleAddToWatchlist(s: Suggestion) {
    updateItem(s.tmdbId, { status: 'added' })
    const res = await ipc<AiResult<{ success: boolean }>>('ai:addToWatchlist', s.tmdbId, s.tipo)
    if (!res.ok) {
      updateItem(s.tmdbId, { status: undefined })
      showToast(res.error, 'error')
      return
    }
    showToast(`"${s.title}" adicionado em Próximos!`)
    fetchWatchlist()
  }

  async function handleVerdict(s: Suggestion, verdict: SuggestionVerdict | null) {
    updateItem(s.tmdbId, { status: verdict ?? undefined })
    const res = await ipc<AiResult<void>>('ai:feedback', s.tmdbId, s.tipo, s.title, s.year || null, verdict)
    if (!res.ok) showToast(res.error, 'error')
  }

  if (!settings) return null

  return (
    <div style={{ background: theme.colors.bg, minHeight: '100vh', padding: `${theme.spacing.xl} ${theme.layout.pagePadding}` }}>
      <h1 style={{
        fontSize: theme.fontSizes.h1, fontWeight: theme.fontWeights.black,
        fontFamily: theme.fonts.display, marginBottom: theme.spacing.xs,
      }}>
        PARA VOCÊ
      </h1>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.xl }}>
        Sugestões da IA a partir das suas notas e das suas observações.
      </p>

      {!settings.hasKey ? (
        <NoKeyState onConfigure={() => navigate('/config')} />
      ) : (
        <>
          <ProfilePanel
            profile={profile}
            busy={!!loading}
            onRegenerate={handleRegenerateProfile}
            onSaved={setProfile}
          />

          <RequestBar
            tipo={tipo} setTipo={setTipo}
            pedido={pedido} setPedido={setPedido}
            moods={moods} setMoods={setMoods}
            loading={!!loading}
            onGenerate={handleGenerate}
          />

          {error && (
            <div style={{
              background: 'rgba(229,9,14,0.12)', border: `1px solid ${theme.colors.danger}`,
              borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.lg,
              color: theme.colors.danger, fontSize: theme.fontSizes.ui,
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <LoadingState kind={loading} elapsed={elapsed} thinking={settings.thinking && settings.provider === 'deepseek'} />
          ) : result && result.items.length > 0 ? (
            <Results
              result={result}
              onAdd={handleAddToWatchlist}
              onVerdict={handleVerdict}
              onOpenProximos={() => navigate('/proximos')}
            />
          ) : !error && (
            <div style={{ textAlign: 'center', padding: `${theme.spacing.xxl} 0`, color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              {profile
                ? 'Escolha o clima (opcional) e clique em Gerar sugestões.'
                : 'Na primeira vez, a IA lê o catálogo inteiro para montar seu perfil de gosto. Pode levar um minuto.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sem chave ──────────────────────────────────────────────────────────────

function NoKeyState({ onConfigure }: { onConfigure: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.md,
      padding: `${theme.spacing.xxl} 0`, textAlign: 'center',
    }}>
      <CatSit style={{ width: '120px', height: '120px', animation: 'float 3s ease-in-out infinite' }} />
      <h2 style={{ fontSize: theme.fontSizes.h2, fontWeight: theme.fontWeights.bold }}>Falta só a chave da IA</h2>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, maxWidth: '460px', lineHeight: 1.6 }}>
        Cole sua chave do DeepSeek (ou do Groq) em Configurações. Ela fica criptografada neste computador.
      </p>
      <Button onClick={onConfigure} size="lg">Abrir Configurações</Button>
    </div>
  )
}

// ─── Perfil de gosto ────────────────────────────────────────────────────────

function ProfilePanel({ profile, busy, onRegenerate, onSaved }: {
  profile: TasteProfile | null
  busy: boolean
  onRegenerate: () => void
  onSaved: (p: TasteProfile) => void
}) {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)

  if (!profile) return null

  const newSince = profile.catalogCount - profile.basedOn

  async function save() {
    setSaving(true)
    const res = await ipc<AiResult<TasteProfile | null>>('ai:saveProfile', draft)
    setSaving(false)
    if (!res.ok || !res.data) { showToast(res.ok ? 'Perfil não encontrado.' : res.error, 'error'); return }
    onSaved({ ...res.data, catalogCount: profile!.catalogCount })
    setEditing(false)
    showToast('Perfil salvo. As próximas sugestões usam a sua versão.')
  }

  return (
    <div style={{
      background: theme.colors.surface, border: `1px solid ${theme.colors.surfaceElevated}`,
      borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.lg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{
            fontSize: '10px', color: theme.colors.primaryMuted, fontWeight: theme.fontWeights.bold,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px',
          }}>
            Seu gosto, segundo a IA{profile.edited ? ' · editado por você' : ''}
          </div>
          <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
            {profile.summary || 'Perfil montado a partir das suas notas e observações.'}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(o => !o)}>
          {open ? 'Esconder perfil ▴' : 'Ver perfil completo ▾'}
        </Button>
      </div>

      {open && (
        <div style={{ marginTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.surfaceElevated}`, paddingTop: theme.spacing.md }}>
          {editing ? (
            <>
              <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={18} />
              <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <Button size="sm" onClick={save} loading={saving}>Salvar perfil</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <>
              <ProfileText text={profile.text} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap',
                marginTop: theme.spacing.md, fontSize: theme.fontSizes.small, color: theme.colors.textMuted,
              }}>
                <span style={{ flex: 1 }}>
                  Baseado em {profile.basedOn} títulos · gerado em {formatDateBR(profile.generatedAt)}
                  {newSince >= 10 && ` · você cadastrou ${newSince} títulos desde então, vale regerar`}
                </span>
                <Button size="sm" variant="ghost" onClick={() => { setDraft(profile.text); setEditing(true) }}>✎ Corrigir</Button>
                <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={busy}>↻ Regerar</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Markdown mínimo do perfil: "## " seção, "- " item, **negrito**. */
function ProfileText({ text }: { text: string }) {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: theme.colors.textPrimary }}>{part.slice(2, -2)}</strong>
      : part,
  )
  return (
    <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary, lineHeight: 1.65, maxWidth: '860px' }}>
      {text.split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return null
        if (t.startsWith('#')) {
          return (
            <h3 key={i} style={{
              fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary,
              margin: `${theme.spacing.md} 0 ${theme.spacing.xs}`,
            }}>
              {t.replace(/^#+\s*/, '')}
            </h3>
          )
        }
        if (/^[-*•]\s/.test(t)) {
          return (
            <div key={i} style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: '4px' }}>
              <span style={{ color: theme.colors.primary }}>•</span>
              <span>{bold(t.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          )
        }
        return <p key={i} style={{ marginBottom: theme.spacing.sm }}>{bold(t)}</p>
      })}
    </div>
  )
}

// ─── Pedido ─────────────────────────────────────────────────────────────────

function RequestBar(props: {
  tipo: Tipo; setTipo: (t: Tipo) => void
  pedido: string; setPedido: (s: string) => void
  moods: string[]; setMoods: (m: string[]) => void
  loading: boolean
  onGenerate: () => void
}) {
  const { tipo, setTipo, pedido, setPedido, moods, setMoods, loading, onGenerate } = props

  function toggleMood(m: string) {
    setMoods(moods.includes(m) ? moods.filter(x => x !== m) : [...moods, m])
  }

  return (
    <div style={{ marginBottom: theme.spacing.xl }}>
      <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap', marginBottom: theme.spacing.md }}>
        <Input
          icon="✦"
          label="O que você quer ver hoje? (opcional)"
          value={pedido}
          onChange={e => setPedido(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onGenerate()}
          style={{ flex: 1, minWidth: '280px' }}
        />
        <Segmented value={tipo} onChange={setTipo} options={[
          { value: 'filme', label: 'Filmes' },
          { value: 'serie', label: 'Séries' },
          { value: 'ambos', label: 'Ambos' },
        ]} />
        <Button onClick={onGenerate} loading={loading} size="lg">✦ Gerar sugestões</Button>
      </div>

      <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        {MOODS.map(m => {
          const on = moods.includes(m)
          return (
            <button
              key={m}
              onClick={() => toggleMood(m)}
              className="focus-ring"
              style={{
                padding: '6px 14px', borderRadius: theme.radius.full, cursor: 'pointer',
                fontSize: theme.fontSizes.small,
                border: `1px solid ${on ? theme.colors.primary : theme.colors.surfaceHover}`,
                background: on ? theme.colors.primaryGlow : 'transparent',
                color: on ? theme.colors.textPrimary : theme.colors.textSecondary,
                transition: `all ${theme.transitions.fast}`,
              }}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <div style={{
      display: 'flex', background: theme.colors.surface, border: `1px solid ${theme.colors.surfaceElevated}`,
      borderRadius: theme.radius.md, padding: '3px', height: '54px', alignItems: 'stretch',
    }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="focus-ring"
            style={{
              padding: `0 ${theme.spacing.md}`, border: 'none', cursor: 'pointer',
              borderRadius: theme.radius.sm, fontSize: theme.fontSizes.ui,
              fontWeight: on ? theme.fontWeights.bold : theme.fontWeights.regular,
              background: on ? theme.colors.surfaceHover : 'transparent',
              color: on ? theme.colors.textPrimary : theme.colors.textMuted,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Carregando ─────────────────────────────────────────────────────────────

function LoadingState({ kind, elapsed, thinking }: { kind: LoadingKind; elapsed: number; thinking: boolean }) {
  const steps = LOADING_STEPS[kind]
  const step = steps[Math.min(Math.floor(elapsed / 8), steps.length - 1)]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.md,
      padding: `${theme.spacing.xxl} 0`,
    }}>
      <CatSit style={{ width: '110px', height: '110px', animation: 'float 2s ease-in-out infinite' }} />
      <div style={{ fontSize: theme.fontSizes.body, color: theme.colors.textPrimary, fontWeight: theme.fontWeights.medium }}>
        {step}
      </div>
      <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
        {elapsed}s{thinking ? ' · com raciocínio profundo, pode levar 1 a 2 minutos' : ''}
      </div>
    </div>
  )
}

// ─── Resultados ─────────────────────────────────────────────────────────────

function Results({ result, onAdd, onVerdict, onOpenProximos }: {
  result: RecommendResult
  onAdd: (s: Suggestion) => void
  onVerdict: (s: Suggestion, v: SuggestionVerdict | null) => void
  onOpenProximos: () => void
}) {
  const when = new Date(result.generatedAt)
  const time = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.sm, marginBottom: theme.spacing.md, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold }}>
          {result.items.length} sugestões
        </h2>
        <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
          geradas em {formatDateBR(result.generatedAt)} às {time}
          {result.request.pedido && ` · "${result.request.pedido}"`}
          {result.discarded > 0 && ` · ${result.discarded} descartadas (já no catálogo ou não encontradas)`}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))', gap: theme.spacing.md }}>
        {result.items.map((s, i) => (
          <SuggestionCard
            key={`${s.tipo}:${s.tmdbId}`}
            s={s}
            index={i}
            onAdd={() => onAdd(s)}
            onVerdict={v => onVerdict(s, v)}
            onOpenProximos={onOpenProximos}
          />
        ))}
      </div>
    </div>
  )
}

const VERDICT_LABEL: Record<SuggestionVerdict, string> = {
  added:     '✓ Em Próximos',
  seen:      '👁 Você já viu',
  dismissed: '✕ Descartada',
}

function SuggestionCard({ s, index, onAdd, onVerdict, onOpenProximos }: {
  s: Suggestion
  index: number
  onAdd: () => void
  onVerdict: (v: SuggestionVerdict | null) => void
  onOpenProximos: () => void
}) {
  const [showSynopsis, setShowSynopsis] = useState(false)
  const done = !!s.status

  const duration = s.duration && s.duration > 0
    ? s.tipo === 'filme' ? `${Math.floor(s.duration / 60)}h ${s.duration % 60}min` : `${s.duration} ep.`
    : null

  return (
    <div
      style={{
        display: 'flex', gap: theme.spacing.md,
        background: theme.colors.surface, border: `1px solid ${theme.colors.surfaceElevated}`,
        borderRadius: theme.radius.md, overflow: 'hidden',
        opacity: s.status === 'dismissed' || s.status === 'seen' ? 0.45 : 1,
        transition: `opacity ${theme.transitions.normal}`,
        animation: `cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index * 0.05, 0.6)}s backwards`,
      }}
    >
      <div style={{
        width: '140px', minHeight: '210px', flexShrink: 0,
        background: s.posterUrl ? `url(${s.posterUrl}) center/cover no-repeat` : theme.colors.surfaceElevated,
      }} />

      <div style={{ flex: 1, minWidth: 0, padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.md} 0`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <span style={{ fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>
              {s.title}
            </span>
            <Badge customColor={theme.colors.typeColors[s.tipo]} size="sm">{s.tipo}</Badge>
          </div>
          <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, marginTop: '2px' }}>
            {[
              s.year,
              duration,
              s.director && `dir. ${s.director}`,
              s.voteAverage ? `TMDB ${s.voteAverage.toFixed(1)}` : null,
              s.originalTitle && s.originalTitle !== s.title ? s.originalTitle : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>

        {s.genres.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {s.genres.slice(0, 4).map(g => <Badge key={g} variant="muted" size="sm">{g}</Badge>)}
          </div>
        )}

        <div style={{ borderLeft: `3px solid ${theme.colors.primary}`, paddingLeft: theme.spacing.sm }}>
          <div style={{
            fontSize: '10px', color: theme.colors.primaryMuted, fontWeight: theme.fontWeights.bold,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px',
          }}>
            Por que você vai gostar
          </div>
          <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, lineHeight: 1.6 }}>{s.why}</p>
        </div>

        {s.warning && (
          <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.warning, lineHeight: 1.5 }}>⚠ {s.warning}</p>
        )}

        {s.similarTo.length > 0 && (
          <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
            Na linha de: {s.similarTo.join(', ')}
          </div>
        )}

        {s.overview && (
          <button
            onClick={() => setShowSynopsis(v => !v)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              fontSize: theme.fontSizes.small, color: theme.colors.textMuted,
            }}
          >
            {showSynopsis ? s.overview : 'Ver sinopse ▾'}
          </button>
        )}

        <div style={{ display: 'flex', gap: theme.spacing.xs, marginTop: 'auto', paddingTop: theme.spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
          {done ? (
            <>
              <span style={{
                fontSize: theme.fontSizes.small, fontWeight: theme.fontWeights.bold,
                color: s.status === 'added' ? theme.colors.success : theme.colors.textMuted,
              }}>
                {VERDICT_LABEL[s.status!]}
              </span>
              {s.status === 'added'
                ? <Button size="sm" variant="ghost" onClick={onOpenProximos}>Ver em Próximos</Button>
                : <Button size="sm" variant="ghost" onClick={() => onVerdict(null)}>Desfazer</Button>}
            </>
          ) : (
            <>
              <Button size="sm" onClick={onAdd}>+ Próximos</Button>
              <Button size="sm" variant="ghost" onClick={() => onVerdict('seen')}>Já vi</Button>
              <Button size="sm" variant="ghost" onClick={() => onVerdict('dismissed')}>Não curti</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
