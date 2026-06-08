import { theme } from '../styles/theme.ts'
import CatHead from '../assets/cat-head.svg?react'

export function TitleBar() {
  return (
    <div
      style={{
        // @ts-expect-error - app-region é específico do Electron
        WebkitAppRegion: 'drag',
        height: '32px',
        background: theme.colors.bg,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: theme.spacing.md,
        paddingRight: '140px',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CatHead style={{ width: '18px', height: '18px' }} />
        <span style={{
          fontFamily: theme.fonts.display,
          fontSize: '11px',
          fontWeight: theme.fontWeights.bold,
          color: theme.colors.textMuted,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Catalogu
        </span>
      </div>
    </div>
  )
}
