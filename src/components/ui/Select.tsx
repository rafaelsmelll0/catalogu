import { useState, useRef, useEffect, ReactNode } from 'react'
import { theme } from '../../styles/theme.ts'

export interface SelectOption<T = string> {
  value: T
  label: string
  icon?:  ReactNode
  color?: string
}

interface Props<T = string> {
  options:      SelectOption<T>[]
  value:        T
  onChange:     (v: T) => void
  label?:       string
  placeholder?: string
  fullWidth?:   boolean
  style?:       React.CSSProperties
}

export function Select<T extends string | number>({
  options, value, onChange, label, placeholder, fullWidth, style,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px', width: fullWidth ? '100%' : 'auto', ...style }}>
      {label && (
        <label style={{
          fontSize: '10px',
          color: open ? theme.colors.primary : theme.colors.textMuted,
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          transition: `color ${theme.transitions.fast}`,
          paddingLeft: '2px',
        }}>
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="focus-ring"
        style={{
          background: theme.colors.surface,
          border: `1px solid ${open ? theme.colors.primary : theme.colors.surfaceElevated}`,
          borderRadius: theme.radius.md,
          color: current ? theme.colors.textPrimary : theme.colors.textMuted,
          fontSize: theme.fontSizes.body,
          fontWeight: theme.fontWeights.medium,
          fontFamily: theme.fonts.sans,
          padding: `0 ${theme.spacing.md}`,
          height: '52px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          width: '100%',
          textAlign: 'left',
          transition: `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
          boxShadow: open ? `0 0 0 3px ${theme.colors.primaryGlow}` : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, minWidth: 0, flex: 1 }}>
          {current?.color && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: current.color, flexShrink: 0 }} />
          )}
          {current?.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.label ?? placeholder ?? 'Selecione...'}
          </span>
        </span>
        <span style={{
          color: theme.colors.textMuted,
          fontSize: '10px',
          transition: `transform ${theme.transitions.fast}`,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0, right: 0,
          background: theme.colors.surfaceElevated,
          border: `1px solid ${theme.colors.surfaceHover}`,
          borderRadius: theme.radius.sm,
          boxShadow: theme.shadows.modal,
          zIndex: 1000,
          animation: 'dropdownIn 0.15s ease-out',
          maxHeight: '280px',
          overflowY: 'auto',
        }}>
          {options.map(opt => {
            const isSelected = opt.value === value
            return (
              <div
                key={String(opt.value)}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  padding: `10px ${theme.spacing.sm}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  background: isSelected ? theme.colors.primaryGlow : 'transparent',
                  color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                  fontSize: theme.fontSizes.ui,
                  fontWeight: isSelected ? theme.fontWeights.bold : theme.fontWeights.regular,
                  transition: `background ${theme.transitions.fast}`,
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {opt.color && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                )}
                {opt.icon}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {isSelected && <span style={{ fontSize: '12px' }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
