import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id:      number
  message: string
  type:    ToastType
}

let toastId = 0
const listeners: ((t: ToastMessage) => void)[] = []

export function showToast(message: string, type: ToastType = 'success') {
  const toast: ToastMessage = { id: ++toastId, message, type }
  listeners.forEach(fn => fn(toast))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handler = (t: ToastMessage) => {
      setToasts(prev => [...prev, t])
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id))
      }, 3000)
    }
    listeners.push(handler)
    return () => {
      const i = listeners.indexOf(handler)
      if (i > -1) listeners.splice(i, 1)
    }
  }, [])

  if (toasts.length === 0) return null

  const BG: Record<ToastType, string> = {
    success: theme.colors.success,
    error:   theme.colors.danger,
    info:    theme.colors.info,
  }

  return (
    <div style={{
      position: 'fixed', bottom: theme.spacing.xl, right: theme.spacing.xl,
      zIndex: 999, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: BG[t.type],
          color: '#fff',
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          borderRadius: theme.radius.sm,
          fontSize: theme.fontSizes.ui,
          fontWeight: theme.fontWeights.medium,
          boxShadow: theme.shadows.card,
          animation: 'slideIn 0.2s ease',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
