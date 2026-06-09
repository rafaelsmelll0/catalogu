import { memo, useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { WatchlistItem } from '../types/index.ts'
import { Badge, Button } from './ui/index.ts'

interface Props {
  item:      WatchlistItem
  onWatched: (item: WatchlistItem) => void
  onRemove:  (item: WatchlistItem) => void
  index?:    number
}

const POSTER_GRADIENTS = [
  'linear-gradient(135deg, #1c0a2e, #2d1b4e)',
  'linear-gradient(135deg, #0a1c14, #1b4e38)',
  'linear-gradient(135deg, #1c1a0a, #4e491b)',
  'linear-gradient(135deg, #1c0a0a, #4e1b1b)',
  'linear-gradient(135deg, #0a101c, #1b284e)',
  'linear-gradient(135deg, #0d0814, #2a1a4e)',
  'linear-gradient(135deg, #0a1a14, #1b4e38)',
  'linear-gradient(135deg, #1a0a14, #4e1b38)',
]

function WatchlistCardInner({ item, onWatched, onRemove, index = 0 }: Props) {
  const [hovered, setHovered] = useState(false)
  const gradient = POSTER_GRADIENTS[item.id % POSTER_GRADIENTS.length]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: theme.spacing.md,
        background: hovered ? theme.colors.surfaceElevated : theme.colors.surface,
        border: `1px solid ${hovered ? theme.colors.surfaceHover : theme.colors.surfaceElevated}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        transition: `background ${theme.transitions.fast}, border-color ${theme.transitions.fast}, transform ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? theme.shadows.card : 'none',
        animation: `cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index * 0.04, 0.6)}s backwards`,
      }}
    >
      {/* Poster 2x */}
      <div style={{
        width: '160px',
        height: '240px',
        flexShrink: 0,
        background: item.cover_path
          ? `url(${item.cover_path}) center/cover no-repeat`
          : gradient,
      }} />

      {/* Conteúdo */}
      <div style={{
        flex: 1, minWidth: 0,
        padding: theme.spacing.md,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>

        {/* Linha 1: Título · Ano · Duração · Badge tipo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: theme.fontSizes.body,
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.textPrimary,
          }}>
            {item.title}
          </span>
          {item.release_year && (
            <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
              {item.release_year}
            </span>
          )}
          {item.duration && (
            <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
              · {item.tipo === 'filme'
                ? `${Math.floor(item.duration / 60)}h ${item.duration % 60}min`
                : `${item.duration} ep.`}
            </span>
          )}
          <Badge size="sm" customColor={theme.colors.typeColors[item.tipo]}>
            {item.tipo}
          </Badge>
        </div>

        {/* Diretor */}
        {item.director && (
          <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textMuted }}>
            Dir. {item.director}
          </div>
        )}

        {/* Gêneros */}
        {item.genres && item.genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {item.genres.slice(0, 5).map(g => (
              <Badge key={g} variant="muted" size="sm">{g}</Badge>
            ))}
          </div>
        )}

        {/* Sinopse */}
        {item.synopsis && (
          <p style={{
            fontSize: theme.fontSizes.ui,
            color: theme.colors.textSecondary,
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            margin: 0,
          }}>
            {item.synopsis}
          </p>
        )}
      </div>

      {/* Ações */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.md} 0`,
        flexShrink: 0,
      }}>
        <Button
          size="sm"
          onClick={e => { e.stopPropagation(); onWatched(item) }}
        >
          ✓ Assistido
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={e => { e.stopPropagation(); onRemove(item) }}
        >
          × Remover
        </Button>
      </div>
    </div>
  )
}

export const WatchlistCard = memo(WatchlistCardInner, (prev, next) =>
  prev.item.id         === next.item.id &&
  prev.item.cover_path === next.item.cover_path &&
  prev.index           === next.index
)
