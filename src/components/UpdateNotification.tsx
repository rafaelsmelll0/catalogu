import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'
import { Button } from './ui/index.ts'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready'

export function UpdateNotification() {
  const [state, setState]     = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const unsubAvailable = window.electronAPI.on('update:available', (...args) => {
      const { version } = args[0] as { version: string }
      setVersion(version)
      setState('available')
    })

    const unsubProgress = window.electronAPI.on('update:progress', (...args) => {
      const { percent } = args[0] as { percent: number }
      setPercent(percent)
      setState('downloading')
    })

    const unsubDownloaded = window.electronAPI.on('update:downloaded', () => {
      setState('ready')
    })

    return () => {
      unsubAvailable()
      unsubProgress()
      unsubDownloaded()
    }
  }, [])

  if (state === 'idle') return null

  return (
    <div style={{
      position: 'fixed',
      bottom: theme.spacing.lg,
      right: theme.spacing.lg,
      zIndex: 9999,
      background: theme.colors.surfaceElevated,
      border: `1px solid ${theme.colors.primary}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      boxShadow: theme.shadows.modal,
      maxWidth: '320px',
      animation: 'cardIn 0.3s ease-out',
    }}>
      {state === 'available' && (
        <>
          <div style={{
            fontSize: theme.fontSizes.ui,
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.textPrimary,
            marginBottom: theme.spacing.xs,
          }}>
            Atualização disponível
          </div>
          <div style={{
            fontSize: theme.fontSizes.small,
            color: theme.colors.textMuted,
            marginBottom: theme.spacing.sm,
          }}>
            Versão {version} está sendo baixada...
          </div>
        </>
      )}

      {state === 'downloading' && (
        <>
          <div style={{
            fontSize: theme.fontSizes.ui,
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.textPrimary,
            marginBottom: theme.spacing.xs,
          }}>
            Baixando atualização...
          </div>
          <div style={{
            height: '6px',
            background: theme.colors.surface,
            borderRadius: theme.radius.full,
            overflow: 'hidden',
            marginBottom: theme.spacing.xs,
          }}>
            <div style={{
              height: '100%',
              background: theme.colors.primary,
              width: `${percent}%`,
              borderRadius: theme.radius.full,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
            {percent}%
          </div>
        </>
      )}

      {state === 'ready' && (
        <>
          <div style={{
            fontSize: theme.fontSizes.ui,
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.textPrimary,
            marginBottom: theme.spacing.xs,
          }}>
            Pronto para atualizar
          </div>
          <div style={{
            fontSize: theme.fontSizes.small,
            color: theme.colors.textMuted,
            marginBottom: theme.spacing.md,
          }}>
            Versão {version} baixada. Reinicie para aplicar.
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.xs }}>
            <Button
              size="sm"
              onClick={() => window.electronAPI.invoke('update:install')}
            >
              Reiniciar e atualizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setState('idle')}
            >
              Depois
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
