import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { MovieCard } from './MovieCard.tsx'

interface Props {
  title:       string
  items:       Media[]
  onCardClick: (media: Media) => void
}

export function MediaRow({ title, items, onCardClick }: Props) {
  if (items.length === 0) return null

  return (
    <div style={{ marginBottom: theme.spacing.xl }}>
      <h2 style={{
        fontSize: theme.fontSizes.h3,
        fontWeight: theme.fontWeights.bold,
        color: theme.colors.textPrimary,
        padding: `0 ${theme.layout.pagePadding}`,
        marginBottom: theme.spacing.md,
        letterSpacing: '0.01em',
      }}>
        {title}
      </h2>
      <div style={{
        display: 'flex',
        gap: theme.layout.cardGap,
        padding: `${theme.spacing.sm} ${theme.layout.pagePadding} ${theme.spacing.lg}`,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: `${theme.colors.surfaceHover} transparent`,
      }}>
        {items.map((media, i) => (
          <MovieCard key={media.id} media={media} onClick={onCardClick} index={i} />
        ))}
      </div>
    </div>
  )
}
