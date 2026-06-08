import { ButtonHTMLAttributes, ReactNode } from 'react'
import { theme } from '../../styles/theme.ts'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size    = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  icon?:     ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}: Props) {

  const sizes: Record<Size, { padding: string; fontSize: string; height: string }> = {
    sm: { padding: '0 14px', fontSize: theme.fontSizes.small, height: '34px' },
    md: { padding: '0 20px', fontSize: theme.fontSizes.ui,    height: '40px' },
    lg: { padding: '0 24px', fontSize: theme.fontSizes.body,  height: '54px' },
  }

  const variants: Record<Variant, React.CSSProperties> = {
    primary:   { background: theme.colors.primary,               color: '#fff',                       border: 'none' },
    secondary: { background: 'rgba(255,255,255,0.08)',            color: theme.colors.textPrimary,     border: `1px solid ${theme.colors.surfaceHover}` },
    ghost:     { background: 'transparent',                      color: theme.colors.textSecondary,   border: 'none' },
    danger:    { background: theme.colors.danger,                 color: '#fff',                       border: 'none' },
    success:   { background: theme.colors.success,               color: '#fff',                       border: 'none' },
  }

  const hoverBg: Record<Variant, string> = {
    primary:   theme.colors.primaryDark,
    secondary: 'rgba(255,255,255,0.14)',
    ghost:     'rgba(255,255,255,0.06)',
    danger:    '#b30810',
    success:   '#3ab85a',
  }

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className="focus-ring"
      style={{
        ...sizes[size],
        ...variants[variant],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: theme.fontWeights.bold,
        fontFamily: theme.fonts.sans,
        borderRadius: theme.radius.sm,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background ${theme.transitions.fast}, transform ${theme.transitions.fast}`,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={e => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = hoverBg[variant]
        rest.onMouseEnter?.(e)
      }}
      onMouseLeave={e => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = variants[variant].background as string
        rest.onMouseLeave?.(e)
      }}
      onMouseDown={e => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'
        rest.onMouseDown?.(e)
      }}
      onMouseUp={e => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
        rest.onMouseUp?.(e)
      }}
    >
      {loading ? (
        <span style={{
          width: '14px', height: '14px',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
          display: 'inline-block',
        }} />
      ) : icon}
      {children}
    </button>
  )
}
