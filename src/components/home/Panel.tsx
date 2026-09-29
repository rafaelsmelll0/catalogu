import type { ReactNode } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props {
  title:     string
  /** texto/ação à direita do título (ex.: "Ver todos →") */
  action?:   ReactNode
  children:  ReactNode
  style?:    React.CSSProperties
}

/** Cartão padrão dos blocos da Início. */
export function Panel({ title, action, children, style }: Props) {
  return (
    <section style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.surfaceElevated}`,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      display: 'flex', flexDirection: 'column', minHeight: 0,
      ...style,
    }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        <h2 style={{
          fontSize: '11px', fontWeight: theme.fontWeights.bold, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: theme.colors.textMuted, flex: 1,
        }}>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Botão-link discreto usado no canto dos painéis. */
export function PanelLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focus-ring"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        fontSize: theme.fontSizes.small, color: theme.colors.primaryMuted, fontWeight: theme.fontWeights.bold,
      }}
    >
      {children}
    </button>
  )
}
