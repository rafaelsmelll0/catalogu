import { theme } from '../styles/theme.ts'
import { CardSkeleton } from './ui/index.ts'

interface Props {
  count?:  number
  layout?: 'grid' | 'row'
}

export function MediaGridSkeleton({ count = 12, layout = 'grid' }: Props) {
  if (layout === 'row') {
    return (
      <div style={{
        display: 'flex',
        gap: theme.layout.cardGap,
        padding: `0 ${theme.layout.pagePadding}`,
        paddingBottom: theme.spacing.sm,
      }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} style={{
            opacity: 0,
            animation: `cardIn 0.4s ease-out ${i * 0.04}s forwards`,
          }}>
            <CardSkeleton />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${theme.layout.cardWidth}, 1fr))`,
      gap: theme.spacing.lg,
      padding: `0 ${theme.layout.pagePadding} ${theme.spacing.xl}`,
    }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          opacity: 0,
          animation: `cardIn 0.4s ease-out ${Math.min(i * 0.03, 0.6)}s forwards`,
        }}>
          <CardSkeleton />
        </div>
      ))}
    </div>
  )
}
