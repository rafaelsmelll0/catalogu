import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../../styles/theme.ts'
import type { Media } from '../../types/index.ts'
import { useMediaStore } from '../../store/mediaStore.ts'
import { DetailsModal } from '../DetailsModal.tsx'
import { Panel, PanelLink } from './Panel.tsx'

const SHOWN = 8

function ratingColor(r: number) {
  return r >= 8 ? theme.colors.success : r >= 6 ? theme.colors.warning : theme.colors.danger
}

function shortDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  const thisYear = String(new Date().getFullYear())
  return y === thisYear ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`
}

/** "Seu diário": os últimos assistidos, com data, nota e o começo da sua observação. */
export function DiaryCard() {
  const navigate = useNavigate()
  const items    = useMediaStore(s => s.items)
  const [open, setOpen] = useState<Media | null>(null)

  const recent = useMemo(() => items
    .filter(m => m.watched_status === 'assistido')
    .sort((a, b) =>
      (b.watched_date ?? '').localeCompare(a.watched_date ?? '') ||
      (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, SHOWN), [items])

  // Abre sempre a versão atual do store (edição feita no modal aparece na hora)
  const current = open ? items.find(m => m.id === open.id) ?? open : null

  return (
    <Panel title="Seu diário" action={<PanelLink onClick={() => navigate('/filmes')}>Ver catálogo →</PanelLink>}>
      {recent.length === 0 ? (
        <p style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textMuted }}>Nada assistido ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recent.map(m => (
            <button
              key={m.id}
              onClick={() => setOpen(m)}
              className="focus-ring"
              style={{
                display: 'grid', gridTemplateColumns: '58px 40px 28px 1fr', alignItems: 'center', gap: theme.spacing.sm,
                padding: `7px ${theme.spacing.xs}`, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                borderBottom: `1px solid ${theme.colors.surfaceElevated}`, borderRadius: 0, color: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, fontFamily: theme.fonts.mono }}>
                {shortDate(m.watched_date)}
              </span>
              <span style={{
                fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.black, fontFamily: theme.fonts.display,
                color: m.rating ? ratingColor(m.rating) : theme.colors.textMuted,
              }}>
                {m.rating ? m.rating.toFixed(1).replace('.0', '').replace('.', ',') : '–'}
              </span>
              <div style={{
                width: '28px', height: '42px', borderRadius: '3px',
                background: m.cover_path ? `url(${m.cover_path}) center/cover` : theme.colors.surfaceHover,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary, fontWeight: theme.fontWeights.medium,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {m.title} <span style={{ color: theme.colors.textMuted, fontWeight: theme.fontWeights.regular }}>{m.release_year && `(${m.release_year})`}</span>
                </div>
                {m.observations && (
                  <div style={{
                    fontSize: theme.fontSizes.small, color: theme.colors.textMuted, fontStyle: 'italic',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    "{m.observations.trim().replace(/\s*\n+\s*/g, ' · ')}"
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {current && <DetailsModal media={current} onClose={() => setOpen(null)} />}
    </Panel>
  )
}
