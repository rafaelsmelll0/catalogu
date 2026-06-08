import { theme } from '../../styles/theme.ts'

interface Props {
  width?:  string | number
  height?: string | number
  radius?: string
}

export function Skeleton({ width = '100%', height = '16px', radius = theme.radius.sm }: Props) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s linear infinite',
    }} />
  )
}

export function CardSkeleton() {
  return (
    <div style={{ width: theme.layout.cardWidth, flexShrink: 0 }}>
      <Skeleton height={theme.layout.cardHeight} radius={`${theme.radius.sm} ${theme.radius.sm} 0 0`} />
      <div style={{
        background: theme.colors.surface,
        padding: theme.spacing.sm,
        display: 'flex', flexDirection: 'column', gap: '6px',
        borderRadius: `0 0 ${theme.radius.sm} ${theme.radius.sm}`,
      }}>
        <Skeleton width="80%" height="12px" />
        <Skeleton width="40%" height="10px" />
      </div>
    </div>
  )
}
