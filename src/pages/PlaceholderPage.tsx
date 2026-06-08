import { theme } from '../styles/theme'

interface Props { title: string }

export function PlaceholderPage({ title }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '80vh',
      flexDirection: 'column',
      gap: theme.spacing.sm,
    }}>
      <h1 style={{ fontSize: theme.fontSizes.h1, fontWeight: theme.fontWeights.bold }}>{title}</h1>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>Em breve — Fase 2</p>
    </div>
  )
}
