import { ReactNode, useEffect } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props {
  open:             boolean
  onClose:          () => void
  title?:           string
  children:         ReactNode
  width?:           string | number
  closeOnBackdrop?: boolean
  hideHeader?:      boolean
}

export function Modal({
  open, onClose, title, children, width = '520px', closeOnBackdrop = true, hideHeader = false,
}: Props) {
  useEffect(() => {
    if (!open) return
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={() => closeOnBackdrop && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: theme.spacing.md,
        animation: 'backdropIn 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: theme.colors.surfaceElevated,
          borderRadius: theme.radius.lg,
          width: '100%',
          maxWidth: width,
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: theme.shadows.modal,
          border: `1px solid ${theme.colors.surfaceHover}`,
          animation: 'modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {!hideHeader && title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            borderBottom: `1px solid ${theme.colors.surface}`,
            flexShrink: 0,
          }}>
            <h2 style={{
              fontSize: theme.fontSizes.h3,
              fontWeight: theme.fontWeights.bold,
              color: theme.colors.textPrimary,
            }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="focus-ring"
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textMuted,
                width: '32px', height: '32px',
                borderRadius: theme.radius.full,
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `background ${theme.transitions.fast}, color ${theme.transitions.fast}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = theme.colors.textPrimary
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = theme.colors.textMuted
              }}
            >
              ×
            </button>
          </div>
        )}

        <div style={{ overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
