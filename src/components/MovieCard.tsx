import { memo, useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { Badge } from './ui/index.ts'

interface Props {
  media:   Media
  onClick: (media: Media) => void
  index?:  number
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

function MovieCardInner({ media, onClick, index = 0 }: Props) {
  const [hovered, setHovered] = useState(false)

  const isUnseen   = (media.watched_status === 'nao_assistido' || media.watched_status === 'nao_lembro') && !(media as any).isProximo
  const isWatching = media.watched_status === 'assistindo'
  const gradient   = POSTER_GRADIENTS[media.id % POSTER_GRADIENTS.length]

  const ratingColor = !media.rating     ? theme.colors.textMuted
    : media.rating >= 8                 ? theme.colors.success
    : media.rating >= 6                 ? theme.colors.warning
    :                                     theme.colors.danger

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(media)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        width: theme.layout.cardWidth,
        animation: `cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index * 0.04, 0.6)}s backwards`,
      }}
    >
      <div style={{
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        transition: `transform ${theme.transitions.normal}, box-shadow ${theme.transitions.normal}`,
        transform: hovered ? 'scale(1.04) translateY(-3px)' : 'scale(1)',
        boxShadow: hovered ? theme.shadows.card : 'none',
      }}>

        {/* Poster */}
        <div style={{
          position: 'relative',
          width: theme.layout.cardWidth,
          height: theme.layout.cardHeight,
          background: media.cover_path
            ? `url(${media.cover_path}) center/cover no-repeat`
            : gradient,
          filter: isUnseen ? 'grayscale(100%) brightness(0.45)' : 'none',
          transition: `filter ${theme.transitions.normal}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Fallback sem poster */}
          {!media.cover_path && (
            <span style={{
              color: 'rgba(255,255,255,0.25)',
              fontSize: theme.fontSizes.tiny,
              fontWeight: theme.fontWeights.bold,
              textAlign: 'center',
              padding: theme.spacing.sm,
              letterSpacing: '0.1em',
              fontFamily: theme.fonts.display,
            }}>
              {media.title.toUpperCase()}
            </span>
          )}

          {/* Badge nota */}
          {media.rating != null && media.rating > 0 && (
            <div style={{
              position: 'absolute',
              top: theme.spacing.xs,
              left: theme.spacing.xs,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(4px)',
              color: ratingColor,
              fontSize: theme.fontSizes.tiny,
              fontWeight: theme.fontWeights.bold,
              padding: '3px 7px',
              borderRadius: theme.radius.sm,
              display: 'flex', alignItems: 'center', gap: '3px',
              zIndex: 2,
            }}>
              ★ {media.rating.toFixed(1)}
            </div>
          )}

          {/* Badge tipo */}
          <div style={{
            position: 'absolute',
            top: theme.spacing.xs,
            right: theme.spacing.xs,
            zIndex: 2,
            display: 'flex', flexDirection: 'row', gap: '3px', alignItems: 'center',
          }}>
            {(media as any).isProximo && (
              <Badge size="sm" variant="warning">PRÓXIMO</Badge>
            )}
            <Badge size="sm" customColor={theme.colors.typeColors[media.tipo]}>
              {media.tipo}
            </Badge>
          </div>

          {/* Barra assistindo */}
          {isWatching && (
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: '3px',
              background: theme.colors.primary,
              boxShadow: `0 0 8px ${theme.colors.primary}`,
              zIndex: 2,
            }} />
          )}

          {/* Overlay de hover — aparece sobre o poster, na parte inferior */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 60%, transparent 100%)',
            padding: `${theme.spacing.xl} ${theme.spacing.sm} ${theme.spacing.sm}`,
            transform: hovered ? 'translateY(0)' : 'translateY(100%)',
            transition: `transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)`,
            zIndex: 3,
          }}>
            {/* Gêneros */}
            {media.genres && media.genres.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '3px',
                marginBottom: '6px',
              }}>
                {media.genres.slice(0, 3).map(g => (
                  <span key={g} style={{
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: theme.fontWeights.medium,
                    padding: '1px 5px',
                    background: 'rgba(255,255,255,0.12)',
                    borderRadius: theme.radius.sm,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Duração */}
            {media.duration && (
              <div style={{
                fontSize: theme.fontSizes.tiny,
                color: 'rgba(255,255,255,0.55)',
                marginBottom: '4px',
              }}>
                {media.tipo === 'filme'
                  ? `${Math.floor(media.duration / 60)}h ${media.duration % 60}min`
                  : `${media.duration} ep.`}
              </div>
            )}

            {/* Sinopse curta */}
            {media.synopsis && (
              <div style={{
                fontSize: '10px',
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {media.synopsis}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: theme.colors.surface,
          padding: theme.spacing.sm,
        }}>
          <div style={{
            fontSize: theme.fontSizes.small,
            fontWeight: theme.fontWeights.bold,
            color: isUnseen ? theme.colors.textMuted : theme.colors.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {media.title}
          </div>
          <div style={{
            fontSize: theme.fontSizes.tiny,
            color: theme.colors.textMuted,
            marginTop: '2px',
          }}>
            {media.release_year}
          </div>
        </div>
      </div>
    </div>
  )
}

export const MovieCard = memo(MovieCardInner, (prev, next) =>
  prev.media.id             === next.media.id &&
  prev.media.watched_status === next.media.watched_status &&
  prev.media.rating         === next.media.rating &&
  prev.media.cover_path     === next.media.cover_path &&
  prev.index                === next.index
)
