import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../../styles/theme.ts'
import type { WatchlistItem } from '../../types/index.ts'
import { useWatchlistStore } from '../../store/watchlistStore.ts'
import { Button } from '../ui/index.ts'
import { WatchlistDetailsModal } from '../WatchlistDetailsModal.tsx'
import { MarkAsWatchedModal } from '../MarkAsWatchedModal.tsx'
import { Panel, PanelLink } from './Panel.tsx'

const SHOWN = 7

type TimeLimit = 100 | 120 | null

const LIMITS: { value: TimeLimit; label: string }[] = [
  { value: 100,  label: 'Até 1h40' },
  { value: 120,  label: 'Até 2h' },
  { value: null, label: 'Tanto faz' },
]

function fmtDuration(w: WatchlistItem) {
  if (!w.duration || w.duration <= 0) return null
  return w.tipo === 'filme' ? `${Math.floor(w.duration / 60)}h ${w.duration % 60}min` : `${w.duration} ep.`
}

/** "Na fila": os primeiros de Próximos, com "Já vi" e um sorteio por tempo disponível. */
export function QueueCard() {
  const navigate = useNavigate()
  const items    = useWatchlistStore(s => s.items)

  const [details, setDetails]   = useState<WatchlistItem | null>(null)
  const [watched, setWatched]   = useState<WatchlistItem | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [limit, setLimit]       = useState<TimeLimit>(null)
  const [drawn, setDrawn]       = useState<WatchlistItem | null>(null)
  const [hover, setHover]       = useState<number | null>(null)

  function draw(l: TimeLimit = limit) {
    const pool = items.filter(w => l === null || (w.tipo === 'filme' && (w.duration ?? 0) > 0 && w.duration! <= l))
    if (pool.length === 0) { setDrawn(null); return }
    // Evita repetir o mesmo sorteado duas vezes seguidas
    const candidates = pool.length > 1 && drawn ? pool.filter(w => w.id !== drawn.id) : pool
    setDrawn(candidates[Math.floor(Math.random() * candidates.length)])
  }

  return (
    <Panel
      title={`Na fila · ${items.length}`}
      action={items.length > 0 && (
        <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
          <PanelLink onClick={() => { setDrawOpen(o => !o); if (!drawOpen) draw() }}>🎲 Sortear</PanelLink>
          <PanelLink onClick={() => navigate('/proximos')}>Ver todos →</PanelLink>
        </div>
      )}
    >
      {items.length === 0 ? (
        <p style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textMuted, padding: `${theme.spacing.md} 0` }}>
          Sua fila está vazia. Use "+ Próximos" na busca acima ou nas sugestões do Para Você.
        </p>
      ) : (
        <>
          {drawOpen && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap',
              background: theme.colors.bg, border: `1px solid ${theme.colors.surfaceElevated}`,
              borderRadius: theme.radius.md, padding: theme.spacing.sm, marginBottom: theme.spacing.sm,
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {LIMITS.map(l => (
                  <button
                    key={String(l.value)}
                    onClick={() => { setLimit(l.value); draw(l.value) }}
                    className="focus-ring"
                    style={{
                      padding: '4px 12px', borderRadius: theme.radius.full, cursor: 'pointer', fontSize: theme.fontSizes.small,
                      border: `1px solid ${limit === l.value ? theme.colors.primary : theme.colors.surfaceHover}`,
                      background: limit === l.value ? theme.colors.primaryGlow : 'transparent',
                      color: limit === l.value ? theme.colors.textPrimary : theme.colors.textMuted,
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              {drawn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: '260px' }}>
                  <div style={{
                    width: '30px', height: '45px', borderRadius: '3px', flexShrink: 0,
                    background: drawn.cover_path ? `url(${drawn.cover_path}) center/cover` : theme.colors.surfaceHover,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>
                      {drawn.title}
                    </div>
                    <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
                      {[drawn.release_year, fmtDuration(drawn), drawn.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => draw()}>↻</Button>
                  <Button size="sm" onClick={() => setDetails(drawn)}>Ver</Button>
                </div>
              ) : (
                <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                  Nada na fila cabe nesse tempo.
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SHOWN}, 1fr)`, gap: theme.spacing.sm }}>
            {items.slice(0, SHOWN).map(w => (
              <div
                key={w.id}
                onMouseEnter={() => setHover(w.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setDetails(w)}
                title={w.title}
                style={{ cursor: 'pointer', minWidth: 0 }}
              >
                <div style={{
                  position: 'relative', aspectRatio: '2 / 3', borderRadius: theme.radius.md, overflow: 'hidden',
                  background: w.cover_path ? `url(${w.cover_path}) center/cover` : theme.colors.surfaceHover,
                  transform: hover === w.id ? 'translateY(-2px)' : 'none',
                  boxShadow: hover === w.id ? theme.shadows.card : 'none',
                  transition: `transform ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
                }}>
                  {hover === w.id && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 55%)',
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: theme.spacing.sm,
                    }}>
                      <Button size="sm" onClick={e => { e.stopPropagation(); setWatched(w) }}>✓ Já vi</Button>
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, marginTop: '6px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {w.title}
                </div>
                <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
                  {[w.release_year, fmtDuration(w)].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {details && <WatchlistDetailsModal item={details} onClose={() => setDetails(null)} />}
      {watched && <MarkAsWatchedModal item={watched} onClose={() => setWatched(null)} onDone={() => { setWatched(null); setDrawn(null) }} />}
    </Panel>
  )
}
