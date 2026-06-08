import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { MovieCard } from './MovieCard.tsx'
import CatSit from '../assets/cat-sit.svg?react'
import Roll from '../assets/roll.svg?react'

interface Props {
  items:         Media[]
  onCardClick:   (media: Media) => void
  emptyMessage?: string
  emptyIcon?:    'cat' | 'roll'
}

export function MediaGrid({ items, onCardClick, emptyMessage, emptyIcon = 'cat' }: Props) {
  if (items.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '50vh', gap: theme.spacing.md,
        animation: 'pageIn 0.4s ease-out',
      }}>
        <div style={{ width: '100px', height: '100px', animation: 'float 3s ease-in-out infinite' }}>
          {emptyIcon === 'roll'
            ? <Roll style={{ width: '100%', height: '100%' }} />
            : <CatSit style={{ width: '100%', height: '100%' }} />
          }
        </div>
        <p style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes.body,
          fontWeight: theme.fontWeights.medium,
          textAlign: 'center',
        }}>
          {emptyMessage ?? 'Nenhum resultado encontrado'}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${theme.layout.cardWidth}, 1fr))`,
      gap: theme.spacing.lg,
      padding: `0 ${theme.layout.pagePadding} ${theme.spacing.xxxl}`,
    }}>
      {items.map((media, i) => (
        <MovieCard key={media.id} media={media} onClick={onCardClick} index={i} />
      ))}
    </div>
  )
}
