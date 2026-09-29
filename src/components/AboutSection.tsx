import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'
import { ipc } from '../lib/ipc.ts'
import { Button } from './ui/index.ts'

type CheckResult =
  | { ok: true; current: string; latest: string; available: boolean }
  | { ok: false; error: string }

/** Versão instalada e "Verificar atualizações" (o download segue no card de atualização). */
export function AboutSection({ sectionStyle }: { sectionStyle: React.CSSProperties }) {
  const [version, setVersion]   = useState('')
  const [checking, setChecking] = useState(false)
  const [status, setStatus]     = useState<{ text: string; color: string } | null>(null)

  useEffect(() => { ipc<string>('app:version').then(setVersion).catch(() => {}) }, [])

  async function check() {
    setChecking(true)
    setStatus(null)
    const r = await ipc<CheckResult>('update:check')
    setChecking(false)
    if (!r.ok) { setStatus({ text: r.error, color: theme.colors.danger }); return }
    setStatus(r.available
      ? { text: `Versão ${r.latest} encontrada. O download aparece no canto da tela.`, color: theme.colors.success }
      : { text: 'Você já está na versão mais recente.', color: theme.colors.textSecondary })
  }

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold, marginBottom: theme.spacing.xs }}>
        Sobre o Catalogu
      </h2>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.md }}>
        Versão instalada: <strong style={{ color: theme.colors.textPrimary }}>{version || '—'}</strong>.
        O app procura atualizações ao abrir e a cada 30 minutos.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={check} loading={checking}>↻ Verificar atualizações</Button>
        {status && <span style={{ fontSize: theme.fontSizes.ui, color: status.color }}>{status.text}</span>}
      </div>
    </div>
  )
}
