import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'
import { Button } from './ui/index.ts'
import { AnimatedCat } from './AnimatedCat.tsx'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'error'

type MainUpdateStatus =
  | { state: 'idle' }
  | { state: 'available';   version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready';       version: string }
  | { state: 'error';       message: string }

export function UpdateNotification() {
  const [state, setState]     = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    // Eventos podem ter chegado antes deste componente montar (ex.: download já
    // concluído): sincroniza com o estado guardado no processo principal.
    window.electronAPI.invoke('update:getState').then(raw => {
      const st = raw as MainUpdateStatus
      if (st.state === 'idle') return
      if ('version' in st) setVersion(st.version)
      if (st.state === 'downloading') setPercent(st.percent)
      setState(st.state)
    }).catch(() => { /* sem updater em dev */ })

    const unsubError = window.electronAPI.on('update:error', () => setState('error'))

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
      unsubError()
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
      <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'flex-start' }}>
      <AnimatedCat size={46} mode={state === 'available' || state === 'downloading' ? 'loading' : 'idle'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
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

      {state === 'error' && (
        <>
          <div style={{
            fontSize: theme.fontSizes.ui,
            fontWeight: theme.fontWeights.bold,
            color: theme.colors.textPrimary,
            marginBottom: theme.spacing.xs,
          }}>
            Falha ao baixar a atualização
          </div>
          <div style={{
            fontSize: theme.fontSizes.small,
            color: theme.colors.textMuted,
            marginBottom: theme.spacing.md,
          }}>
            Verifique sua conexão. O app tenta de novo na próxima abertura.
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.xs }}>
            <Button
              size="sm"
              onClick={() => { setState('idle'); window.electronAPI.invoke('update:retry') }}
            >
              Tentar de novo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState('idle')}>
              Fechar
            </Button>
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
      </div>
    </div>
  )
}
