import { ReactNode } from 'react'
import { theme } from '../../styles/theme.ts'

type Variant = 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'muted'
type Size    = 'sm' | 'md'

interface Props {
  children:     ReactNode
  variant?:     Variant
  size?:        Size
  pill?:        boolean
  customColor?: string
}

function getContrastText(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#0a0a0a' : '#ffffff'
}

export function Badge({ children, variant = 'muted', size = 'md', pill = true, customColor }: Props) {
  const variants: Record<Variant, { bg: string; text: string }> = {
    primary: { bg: theme.colors.primary,      text: '#ffffff' },
    success: { bg: theme.colors.success,      text: '#0a0a0a' },
    info:    { bg: theme.colors.info,         text: '#0a0a0a' },
    warning: { bg: theme.colors.warning,      text: '#0a0a0a' },
    danger:  { bg: theme.colors.danger,       text: '#ffffff' },
    muted:   { bg: theme.colors.surfaceHover, text: theme.colors.textPrimary },
  }

  const sizes: Record<Size, { padding: string; fontSize: string }> = {
    sm: { padding: '3px 8px',  fontSize: '10px' },
    md: { padding: '4px 11px', fontSize: '11px' },
  }

  const c = customColor
    ? { bg: customColor, text: getContrastText(customColor) }
    : variants[variant]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      ...sizes[size],
      background: c.bg,
      color: c.text,
      fontWeight: theme.fontWeights.bold,
      borderRadius: pill ? theme.radius.full : theme.radius.sm,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
