import { TextareaHTMLAttributes, useState } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  rows?:  number
}

export function Textarea({ label, error, value, rows = 4, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...(style as React.CSSProperties) }}>
      {label && (
        <label style={{
          fontSize: '10px',
          color: focused ? theme.colors.primary : theme.colors.textMuted,
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          transition: `color ${theme.transitions.fast}`,
          paddingLeft: '2px',
        }}>
          {label}
        </label>
      )}
      <textarea
        {...rest}
        value={value ?? ''}
        rows={rows}
        onFocus={e => { setFocused(true); onFocus?.(e) }}
        onBlur={e => { setFocused(false); onBlur?.(e) }}
        className="focus-ring"
        style={{
          background: theme.colors.surface,
          border: `1px solid ${error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.surfaceElevated}`,
          borderRadius: theme.radius.md,
          color: theme.colors.textPrimary,
          fontSize: theme.fontSizes.body,
          fontWeight: theme.fontWeights.medium,
          fontFamily: theme.fonts.sans,
          padding: theme.spacing.md,
          outline: 'none',
          resize: 'vertical',
          minHeight: '100px',
          transition: `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
          boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryGlow}` : 'none',
        }}
      />
      {error && (
        <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.danger, paddingLeft: '2px' }}>
          {error}
        </span>
      )}
    </div>
  )
}
