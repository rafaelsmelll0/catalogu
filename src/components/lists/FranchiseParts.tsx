import { useState } from 'react'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import { formatDateBR } from '../../lib/date.ts'
import type { AiResult, FranchisePart } from '../../types/index.ts'
import { showToast } from '../Toast.tsx'

interface Props {
  parts:    FranchisePart[]
  /** lista onde os faltantes entram junto com Próximos (se houver) */
  listId?:  number | null
  /** chaves "media:ID"/"watchlist:ID" já na lista, para oferecer "pôr na lista" */
  inList?:  Set<string>
  size?:    'sm' | 'md'
  onChanged: () => void
}

/**
 * Faixa com todos os filmes de uma franquia do TMDB e a situação de cada um:
 * visto, no catálogo, em Próximos, faltando (com "+ Próximos") ou em breve.
 */
export function FranchiseParts({ parts, listId, inList, size = 'md', onChanged }: Props) {
  const [busy, setBusy] = useState<number | null>(null)
  const w = size === 'sm' ? 62 : 76
  const h = Math.round(w * 1.5)

  async function addToProximos(p: FranchisePart) {
    setBusy(p.tmdbId)
    const res = await ipc<AiResult<{ title: string }>>('tmdb:addToWatchlist', p.tmdbId, 'filme', listId ?? undefined)
    setBusy(null)
    if (!res.ok) { showToast(res.error, 'error'); return }
    showToast(`"${res.data.title}" em Próximos${listId ? ' e na lista' : ''}.`)
    onChanged()
  }

  async function addToList(p: FranchisePart) {
    if (!listId) return
    setBusy(p.tmdbId)
    try {
      if (p.mediaId) await ipc('lists:addMedia', p.mediaId, listId)
      else if (p.watchlistId) await ipc('lists:addWatchlistItem', p.watchlistId, listId)
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: theme.spacing.sm, overflowX: 'auto', paddingBottom: theme.spacing.xs }}>
      {parts.map(p => {
        const key = p.mediaId ? `media:${p.mediaId}` : p.watchlistId ? `watchlist:${p.watchlistId}` : ''
        const missingFromList = !!listId && !!key && !!inList && !inList.has(key)
        const status =
          p.where === 'catalogo' ? (p.watched ? { txt: '✓ visto', color: theme.colors.success } : { txt: 'no catálogo', color: theme.colors.textMuted })
          : p.where === 'proximos' ? { txt: 'em Próximos', color: theme.colors.warning }
          : p.upcoming ? { txt: p.releaseDate ? `estreia ${formatDateBR(p.releaseDate)}` : 'em breve', color: theme.colors.info }
          : { txt: 'faltando', color: theme.colors.danger }
        const dim = p.where === 'faltando'
        return (
          <div key={p.tmdbId} style={{ width: `${w}px`, flexShrink: 0, opacity: busy === p.tmdbId ? 0.5 : 1 }}>
            <div
              title={`${p.title} (${p.year || '?'})`}
              style={{
                width: `${w}px`, height: `${h}px`, borderRadius: theme.radius.sm,
                background: p.posterUrl ? `url(${p.posterUrl}) center/cover` : theme.colors.surfaceHover,
                filter: dim ? 'grayscale(100%) brightness(0.5)' : 'none',
                border: `2px solid ${p.where === 'faltando' && !p.upcoming ? `${theme.colors.danger}80` : 'transparent'}`,
              }}
            />
            <div style={{
              fontSize: '10px', color: theme.colors.textSecondary, marginTop: '4px', lineHeight: 1.3,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {p.title}
            </div>
            <div style={{ fontSize: '10px', color: status.color, fontWeight: theme.fontWeights.bold }}>{status.txt}</div>
            {p.where === 'faltando' && (
              <button onClick={() => addToProximos(p)} disabled={busy !== null} style={linkBtn}>+ Próximos</button>
            )}
            {missingFromList && (
              <button onClick={() => addToList(p)} disabled={busy !== null} style={linkBtn}>+ nesta lista</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  display: 'block', whiteSpace: 'nowrap',
  background: 'none', border: 'none', padding: 0, marginTop: '2px', cursor: 'pointer',
  fontSize: '10px', fontWeight: theme.fontWeights.bold, color: theme.colors.primaryMuted,
}
