import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import type {
  AiResult, AiSettings, Franchise, FranchisePart, Media, RecommendResult, Suggestion, YearSummary,
} from '../../types/index.ts'
import { useMediaStore } from '../../store/mediaStore.ts'
import { useWatchlistStore } from '../../store/watchlistStore.ts'
import { Button } from '../ui/index.ts'
import { showToast } from '../Toast.tsx'
import { DetailsModal } from '../DetailsModal.tsx'
import { Panel, PanelLink } from './Panel.tsx'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function todayParts() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
  return { year: local.slice(0, 4), monthDay: local.slice(5, 10), month: Number(local.slice(5, 7)) }
}

function Poster({ url, w = 32 }: { url: string | null | undefined; w?: number }) {
  return <div style={{
    width: `${w}px`, height: `${Math.round(w * 1.5)}px`, flexShrink: 0, borderRadius: '3px',
    background: url ? `url(${url}) center/cover` : theme.colors.surfaceHover,
  }} />
}

// ─── Ano em números ─────────────────────────────────────────────────────────

export function YearCard() {
  const navigate = useNavigate()
  const catalogVersion = useMediaStore(s => s.items)
  const [data, setData] = useState<YearSummary | null>(null)
  const { year, monthDay, month } = todayParts()

  // Recalcula quando o catálogo muda (registrar algo na busca acima atualiza o número)
  useEffect(() => {
    ipc<YearSummary>('stats:year', year, monthDay).then(setData).catch(() => {})
  }, [catalogVersion])

  if (!data) return null
  const max  = Math.max(1, ...data.byMonth)
  const diff = data.count - data.prevSamePeriod
  const hours = Math.round(data.minutes / 60)

  return (
    <Panel title={`${year} em números`} action={<PanelLink onClick={() => navigate('/stats')}>Estatísticas →</PanelLink>}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.sm }}>
        <span style={{ fontSize: '40px', fontWeight: theme.fontWeights.black, fontFamily: theme.fonts.display, lineHeight: 1 }}>
          {data.count}
        </span>
        <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
          {data.count === 1 ? 'título assistido' : 'títulos assistidos'}
        </span>
      </div>
      <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, marginTop: '4px' }}>
        {hours > 0 && `${hours}h em filmes · `}
        {data.avgRating != null && `nota média ${String(data.avgRating).replace('.', ',')} · `}
        {diff === 0 ? `igual a ${Number(year) - 1} até hoje`
          : <span style={{ color: diff > 0 ? theme.colors.success : theme.colors.warning }}>
              {diff > 0 ? '+' : ''}{diff} que {Number(year) - 1} até hoje
            </span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '44px', marginTop: theme.spacing.md }}>
        {data.byMonth.map((n, i) => (
          <div key={i} title={`${n} em ${MONTHS[i]}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', borderRadius: '2px',
              height: `${Math.max(n ? 12 : 3, (n / max) * 100)}%`,
              background: i + 1 === month ? theme.colors.primary : i + 1 > month ? theme.colors.surfaceHover : `${theme.colors.primary}70`,
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
        {MONTHS.map((m, i) => (
          <span key={i} style={{
            flex: 1, textAlign: 'center', fontSize: '9px',
            color: i + 1 === month ? theme.colors.textPrimary : theme.colors.textMuted,
          }}>{m}</span>
        ))}
      </div>
    </Panel>
  )
}

// ─── Para Você (sugestões pendentes) ────────────────────────────────────────

export function ForYouCard() {
  const navigate = useNavigate()
  const fetchWatchlist = useWatchlistStore(s => s.fetchAll)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [items, setItems]     = useState<Suggestion[]>([])

  useEffect(() => {
    ipc<AiSettings>('ai:getSettings').then(s => {
      setEnabled(s.hasKey)
      if (!s.hasKey) return
      ipc<RecommendResult | null>('ai:lastRecommendations').then(r => setItems((r?.items ?? []).filter(i => !i.status)))
    }).catch(() => setEnabled(false))
  }, [])

  if (!enabled) return null

  async function add(s: Suggestion) {
    setItems(xs => xs.filter(x => x.tmdbId !== s.tmdbId))
    const res = await ipc<AiResult<unknown>>('ai:addToWatchlist', s.tmdbId, s.tipo)
    if (!res.ok) { showToast(res.error, 'error'); return }
    showToast(`"${s.title}" adicionado em Próximos!`)
    fetchWatchlist()
  }

  async function dismiss(s: Suggestion) {
    setItems(xs => xs.filter(x => x.tmdbId !== s.tmdbId))
    await ipc('ai:feedback', s.tmdbId, s.tipo, s.title, s.year || null, 'dismissed')
  }

  return (
    <Panel title="Para você ✦" action={<PanelLink onClick={() => navigate('/para-voce')}>{items.length ? 'Ver todas →' : 'Gerar →'}</PanelLink>}>
      {items.length === 0 ? (
        <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
          Nenhuma sugestão esperando resposta. Peça novas no Para Você.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          {items.slice(0, 3).map(s => (
            <div key={`${s.tipo}:${s.tmdbId}`} style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
              <Poster url={s.posterUrl} w={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary, fontWeight: theme.fontWeights.medium }}>
                  {s.title} <span style={{ color: theme.colors.textMuted, fontWeight: theme.fontWeights.regular }}>({s.year})</span>
                </div>
                <div style={{
                  fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {s.why}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Button size="sm" onClick={() => add(s)} title="Adicionar em Próximos">+</Button>
                <Button size="sm" variant="ghost" onClick={() => dismiss(s)} title="Não curti">✕</Button>
              </div>
            </div>
          ))}
          {items.length > 3 && (
            <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>+ {items.length - 3} no Para Você</span>
          )}
        </div>
      )}
    </Panel>
  )
}

// ─── Franquias incompletas ──────────────────────────────────────────────────

export function FranchisesCard() {
  const navigate = useNavigate()
  const fetchWatchlist = useWatchlistStore(s => s.fetchAll)
  const [pending, setPending]       = useState<number | null>(null)
  const [scan, setScan]             = useState<{ current: number; total: number } | null>(null)
  const [franchises, setFranchises] = useState<Franchise[] | null>(null)
  const [busy, setBusy]             = useState<number | null>(null)

  async function load() {
    setFranchises(await ipc<Franchise[]>('franchises:getAll'))
  }

  async function runScan() {
    setScan({ current: 0, total: pending ?? 0 })
    await ipc('franchises:scan')
    setScan(null)
    setPending(0)
    await load()
  }

  useEffect(() => {
    const unsub = window.electronAPI.on('franchises:progress', (...a) => setScan(a[0] as { current: number; total: number }))
    ipc<number>('franchises:pendingScan').then(async n => {
      setPending(n)
      // Poucos títulos novos: analisa sozinho em segundo plano. Muitos (primeira vez): pede.
      if (n > 0 && n <= 20) { await ipc('franchises:scan'); setPending(0) }
      if (n <= 20) await load()
    }).catch(() => setFranchises([]))
    return unsub
  }, [])

  async function addPart(p: FranchisePart, f: Franchise) {
    setBusy(p.tmdbId)
    const res = await ipc<AiResult<{ title: string }>>('tmdb:addToWatchlist', p.tmdbId, 'filme', f.listId ?? undefined)
    setBusy(null)
    if (!res.ok) { showToast(res.error, 'error'); return }
    showToast(`"${res.data.title}" em Próximos${f.listId ? ` e na lista "${f.listName}"` : ''}.`)
    fetchWatchlist()
    load()
  }

  const incomplete = (franchises ?? []).filter(f => f.missing > 0).slice(0, 3)
  const totalIncomplete = (franchises ?? []).filter(f => f.missing > 0).length

  if (pending === null) return null

  return (
    <Panel title="Franquias" action={<PanelLink onClick={() => navigate('/listas?franquias=1')}>Ver todas →</PanelLink>}>
      {scan ? (
        <div>
          <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, marginBottom: '6px' }}>
            Descobrindo franquias no TMDB… {scan.current}/{scan.total}
          </div>
          <div style={{ height: '4px', background: theme.colors.surfaceHover, borderRadius: theme.radius.full, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${scan.total ? (scan.current / scan.total) * 100 : 0}%`, background: theme.colors.primary, transition: 'width 0.3s' }} />
          </div>
        </div>
      ) : pending > 20 ? (
        <div>
          <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
            Descubra de quais franquias são seus filmes e o que falta ver em cada uma. Leva menos de um minuto, só na primeira vez.
          </p>
          <Button size="sm" onClick={runScan}>🎞 Descobrir franquias</Button>
        </div>
      ) : franchises === null ? (
        <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>Carregando…</p>
      ) : incomplete.length === 0 ? (
        <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>Nenhuma franquia com filmes faltando. 🎉</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {incomplete.map(f => {
            const missing = f.parts.filter(p => p.where === 'faltando' && !p.upcoming)
            return (
              <div key={f.collectionId}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.sm, marginBottom: '6px' }}>
                  <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary, fontWeight: theme.fontWeights.medium, flex: 1 }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
                    {f.owned}/{f.parts.length} · <span style={{ color: theme.colors.danger }}>faltam {f.missing}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {missing.slice(0, 5).map(p => (
                    <div key={p.tmdbId} title={`${p.title} (${p.year}) — adicionar em Próximos`} style={{ position: 'relative', opacity: busy === p.tmdbId ? 0.4 : 1 }}>
                      <Poster url={p.posterUrl} w={38} />
                      <button
                        onClick={() => addPart(p, f)}
                        disabled={busy !== null}
                        style={{
                          position: 'absolute', right: '-5px', bottom: '-5px', width: '20px', height: '20px',
                          borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: theme.colors.primary, color: '#fff', fontSize: '14px', lineHeight: '20px', padding: 0,
                        }}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {totalIncomplete > 3 && (
            <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>+ {totalIncomplete - 3} franquias com filmes faltando</span>
          )}
        </div>
      )}
    </Panel>
  )
}

// ─── Pendências ─────────────────────────────────────────────────────────────

export function PendingCard() {
  const items          = useMediaStore(s => s.items)
  const fetchMedia     = useMediaStore(s => s.fetchAll)
  const fetchWatchlist = useWatchlistStore(s => s.fetchAll)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<Media | null>(null)

  const notWatched = items.filter(m => m.watched_status === 'nao_assistido')
  if (notWatched.length === 0) return null

  async function move(ids: number[]) {
    setBusy(true)
    try {
      for (const id of ids) await ipc('media:moveToWatchlist', id)
      await Promise.all([fetchMedia(), fetchWatchlist()])
      showToast(ids.length === 1 ? 'Movido para Próximos.' : `${ids.length} títulos movidos para Próximos.`)
    } catch (err) {
      console.error('[PendingCard.move]', err)
      showToast('Não foi possível mover.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const current = open ? items.find(m => m.id === open.id) ?? null : null

  return (
    <Panel title="Pendências" style={{ borderColor: `${theme.colors.warning}40` }}>
      <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm, lineHeight: 1.5 }}>
        {notWatched.length} {notWatched.length === 1 ? 'título está' : 'títulos estão'} no catálogo como <strong>não assistido</strong>.
        Se ainda vai ver, o lugar deles é Próximos.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: theme.spacing.sm }}>
        {notWatched.slice(0, 8).map(m => (
          <button
            key={m.id}
            onClick={() => setOpen(m)}
            title="Abrir (para marcar como assistido ou mover)"
            style={{
              padding: '3px 10px', borderRadius: theme.radius.full, cursor: 'pointer', fontSize: theme.fontSizes.tiny,
              border: `1px solid ${theme.colors.surfaceHover}`, background: 'transparent', color: theme.colors.textSecondary,
            }}
          >
            {m.title}
          </button>
        ))}
        {notWatched.length > 8 && <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>+{notWatched.length - 8}</span>}
      </div>
      <Button size="sm" onClick={() => move(notWatched.map(m => m.id))} loading={busy}>
        Mover {notWatched.length === 1 ? 'para' : `os ${notWatched.length} para`} Próximos
      </Button>
      {current && <DetailsModal media={current} onClose={() => setOpen(null)} />}
    </Panel>
  )
}
