import { InputHTMLAttributes, useState, ReactNode } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?:  ReactNode
  error?: string
  hint?:  string
}

export function Input({ label, icon, error, hint, value, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false)
  const hasValue = value !== undefined && value !== ''
  const floating = focused || hasValue

  const TEXT_LEFT = icon ? 52 : 16

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...(style as React.CSSProperties) }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: theme.colors.surface,
        border: `1px solid ${error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.surfaceElevated}`,
        borderRadius: theme.radius.md,
        height: '54px',
        transition: `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}, background ${theme.transitions.fast}`,
        boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryGlow}` : 'none',
      }}>
        {icon && (
          <div style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: focused ? theme.colors.primary : theme.colors.textMuted,
            fontSize: '20px',
            width: '20px',
            height: '20px',
            transition: `color ${theme.transitions.fast}`,
            pointerEvents: 'none',
          }}>
            {icon}
          </div>
        )}

        {label && (
          <label style={{
            position: 'absolute',
            left: `${TEXT_LEFT}px`,
            top: floating ? '9px' : '50%',
            transform: floating ? 'none' : 'translateY(-50%)',
            fontSize: floating ? '10px' : theme.fontSizes.ui,
            color: focused ? theme.colors.primary : theme.colors.textMuted,
            fontWeight: floating ? theme.fontWeights.bold : theme.fontWeights.regular,
            letterSpacing: floating ? '0.08em' : '0',
            textTransform: floating ? 'uppercase' : 'none',
            transition: `all ${theme.transitions.fast}`,
            pointerEvents: 'none',
            userSelect: 'none',
            background: 'transparent',
          }}>
            {label}
          </label>
        )}

        <input
          {...rest}
          value={value ?? ''}
          onFocus={e => { setFocused(true); onFocus?.(e) }}
          onBlur={e => { setFocused(false); onBlur?.(e) }}
          className="focus-ring"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.colors.textPrimary,
            fontSize: theme.fontSizes.body,
            fontFamily: theme.fonts.sans,
            fontWeight: theme.fontWeights.medium,
            paddingTop:    label ? (floating ? '22px' : '0') : '0',
            paddingBottom: label ? (floating ? '6px'  : '0') : '0',
            paddingLeft:  `${TEXT_LEFT}px`,
            paddingRight: '16px',
            height: '100%',
            width: '100%',
          }}
        />
      </div>

      {error && (
        <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.danger, paddingLeft: '2px' }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, paddingLeft: '2px' }}>
          {hint}
        </span>
      )}
    </div>
  )
}
