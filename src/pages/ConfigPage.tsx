import { useState, useEffect, useRef } from 'react'
import { theme } from '../styles/theme.ts'
import { Button } from '../components/ui/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { showToast } from '../components/Toast.tsx'

interface BackdropProgress {
  current: number
  total:   number
  title:   string
  status:  'updating' | 'updated' | 'no_backdrop' | 'no_tmdb' | 'error'
}

interface BackdropResult {
  updated: number
  skipped: number
  failed:  number
}

const BACKDROP_STATUS_LABEL: Record<BackdropProgress['status'], string> = {
  updating:    '🔍 Buscando...',
  updated:     '✓ Atualizado',
  no_backdrop: '⚠ Sem backdrop',
  no_tmdb:     '→ Sem TMDB ID',
  error:       '✗ Erro',
}

const BACKDROP_STATUS_COLOR: Record<BackdropProgress['status'], string> = {
  updating:    theme.colors.textMuted,
  updated:     theme.colors.success,
  no_backdrop: theme.colors.warning,
  no_tmdb:     theme.colors.textMuted,
  error:       theme.colors.danger,
}

interface Progress {
  current: number
  total:   number
  title:   string
  status:  'searching' | 'found' | 'not_found' | 'skipped' | 'error'
}

interface ImportResult {
  imported: number
  skipped:  number
  failed:   number
  errors:   string[]
}

const STATUS_LABEL: Record<Progress['status'], string> = {
  searching: '🔍 Buscando...',
  found:     '✓ Encontrado',
  not_found: '⚠ Sem poster',
  skipped:   '→ Já existe',
  error:     '✗ Erro',
}

const STATUS_COLOR: Record<Progress['status'], string> = {
  searching: theme.colors.textMuted,
  found:     theme.colors.success,
  not_found: theme.colors.warning,
  skipped:   theme.colors.textMuted,
  error:     theme.colors.danger,
}

export function ConfigPage() {
  const { fetchAll } = useMediaStore()
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState<Progress | null>(null)
  const [log, setLog]             = useState<{ title: string; status: Progress['status'] }[]>([])
  const [result, setResult]       = useState<ImportResult | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const [updatingBackdrops, setUpdatingBackdrops] = useState(false)
  const [backdropProgress, setBackdropProgress]   = useState<BackdropProgress | null>(null)
  const [backdropLog, setBackdropLog]             = useState<{ title: string; status: BackdropProgress['status'] }[]>([])
  const [backdropResult, setBackdropResult]       = useState<BackdropResult | null>(null)
  const backdropLogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.electronAPI.on('backup:progress', (...args) => {
      const p = args[0] as Progress
      setProgress(p)
      setLog(prev => {
        const last = prev[prev.length - 1]
        if (last && last.title === p.title) {
          return [...prev.slice(0, -1), { title: p.title, status: p.status }]
        }
        return [...prev, { title: p.title, status: p.status }]
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  useEffect(() => {
    const unsub = window.electronAPI.on('backdrop:progress', (...args) => {
      const p = args[0] as BackdropProgress
      setBackdropProgress(p)
      setBackdropLog(prev => {
        const last = prev[prev.length - 1]
        if (last && last.title === p.title) {
          return [...prev.slice(0, -1), { title: p.title, status: p.status }]
        }
        return [...prev, { title: p.title, status: p.status }]
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    if (backdropLogRef.current) backdropLogRef.current.scrollTop = backdropLogRef.current.scrollHeight
  }, [backdropLog])

  async function handleImport() {
    setResult(null)
    setLog([])
    setProgress(null)

    const dbPath = await window.electronAPI.invoke('backup:selectDb') as string | null
    if (!dbPath) return

    setImporting(true)
    try {
      const res = await window.electronAPI.invoke('backup:import', dbPath) as ImportResult
      setResult(res)
      await fetchAll()
      showToast(`Importação concluída! ${res.imported} filmes importados.`)
    } catch {
      showToast('Erro na importação.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0

  async function handleUpdateBackdrops() {
    setBackdropResult(null)
    setBackdropLog([])
    setBackdropProgress(null)
    setUpdatingBackdrops(true)
    try {
      const res = await window.electronAPI.invoke('backdrop:updateAll') as BackdropResult
      setBackdropResult(res)
      await fetchAll()
      showToast(`${res.updated} imagens de fundo atualizadas!`)
    } catch {
      showToast('Erro ao atualizar backdrops.', 'error')
    } finally {
      setUpdatingBackdrops(false)
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.surfaceElevated}`,
    marginBottom: theme.spacing.lg,
  }

  return (
    <div style={{
      background: theme.colors.bg, minHeight: '100vh',
      padding: `${theme.spacing.xl} ${theme.layout.pagePadding}`,
    }}>
      <h1 style={{
        fontSize: theme.fontSizes.h1, fontWeight: theme.fontWeights.black,
        fontFamily: theme.fonts.display, marginBottom: theme.spacing.xl,
      }}>
        CONFIGURAÇÕES
      </h1>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold, marginBottom: theme.spacing.xs }}>
          Importar do CineUp v2
        </h2>
        <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
          Selecione o arquivo{' '}
          <code style={{ background: theme.colors.surfaceElevated, padding: '2px 6px', borderRadius: theme.radius.sm }}>
            catalog.db
          </code>{' '}
          do seu backup do CineUp v2. Apenas filmes serão importados — séries e animes são ignorados.
          O app buscará automaticamente os posters e detalhes no TMDB.
        </p>

        {!importing && !result && (
          <Button onClick={handleImport} icon="⬇">
            Selecionar arquivo .db
          </Button>
        )}

        {importing && progress && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
              <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
                {progress.current} de {progress.total} — {progress.title}
              </span>
              <span style={{ fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.bold, color: theme.colors.primary }}>
                {pct}%
              </span>
            </div>

            <div style={{ height: '8px', background: theme.colors.surfaceElevated, borderRadius: theme.radius.full, overflow: 'hidden', marginBottom: theme.spacing.md }}>
              <div style={{
                height: '100%', background: theme.colors.primary,
                width: `${pct}%`, borderRadius: theme.radius.full,
                transition: 'width 0.3s ease',
              }} />
            </div>

            <div
              ref={logRef}
              style={{
                background: theme.colors.bg,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.surfaceElevated}`,
                height: '260px',
                overflowY: 'auto',
                padding: theme.spacing.sm,
                fontFamily: theme.fonts.mono,
                fontSize: '12px',
              }}
            >
              {log.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '2px 0',
                  borderBottom: `1px solid ${theme.colors.surfaceElevated}22`,
                }}>
                  <span style={{ color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {entry.title}
                  </span>
                  <span style={{ color: STATUS_COLOR[entry.status], flexShrink: 0, marginLeft: theme.spacing.sm }}>
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>
              ))}
              {importing && (
                <div style={{ color: theme.colors.primary, marginTop: theme.spacing.xs, animation: 'pulse 1.5s ease-in-out infinite' }}>
                  Processando...
                </div>
              )}
            </div>
          </div>
        )}

        {result && !importing && (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: theme.spacing.md, marginBottom: theme.spacing.lg,
            }}>
              <div style={{
                background: `${theme.colors.success}15`, borderRadius: theme.radius.sm,
                padding: theme.spacing.md, textAlign: 'center',
                border: `1px solid ${theme.colors.success}30`,
              }}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.success }}>{result.imported}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Importados</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: theme.radius.sm,
                padding: theme.spacing.md, textAlign: 'center',
                border: `1px solid ${theme.colors.surfaceHover}`,
              }}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.textMuted }}>{result.skipped}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Já existiam</div>
              </div>
              <div style={{
                background: result.failed > 0 ? `${theme.colors.danger}15` : 'rgba(255,255,255,0.04)',
                borderRadius: theme.radius.sm, padding: theme.spacing.md, textAlign: 'center',
                border: `1px solid ${result.failed > 0 ? theme.colors.danger + '30' : theme.colors.surfaceHover}`,
              }}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: result.failed > 0 ? theme.colors.danger : theme.colors.textMuted }}>{result.failed}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Erros</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={{
                background: theme.colors.bg, borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.danger}30`,
                padding: theme.spacing.sm, maxHeight: '160px', overflowY: 'auto',
                marginBottom: theme.spacing.md,
              }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: '12px', color: theme.colors.danger, padding: '2px 0' }}>{e}</div>
                ))}
              </div>
            )}

            <Button onClick={() => { setResult(null); setLog([]) }}>
              Importar outro arquivo
            </Button>
          </div>
        )}
      </div>
      {/* Atualizar imagens de fundo */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold, marginBottom: theme.spacing.xs }}>
          Atualizar imagens de fundo
        </h2>
        <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
          Busca no TMDB a imagem widescreen (backdrop) dos filmes que ainda não têm.
          Usado no hero da página inicial. Filmes sem TMDB ID são ignorados.
        </p>

        {!updatingBackdrops && !backdropResult && (
          <Button onClick={handleUpdateBackdrops} icon="↻">
            Buscar imagens de fundo
          </Button>
        )}

        {updatingBackdrops && backdropProgress && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
              <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
                {backdropProgress.current} de {backdropProgress.total} — {backdropProgress.title}
              </span>
              <span style={{ fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.bold, color: theme.colors.primary }}>
                {Math.round((backdropProgress.current / backdropProgress.total) * 100)}%
              </span>
            </div>

            <div style={{ height: '8px', background: theme.colors.surfaceElevated, borderRadius: theme.radius.full, overflow: 'hidden', marginBottom: theme.spacing.md }}>
              <div style={{
                height: '100%', background: theme.colors.primary,
                width: `${(backdropProgress.current / backdropProgress.total) * 100}%`,
                borderRadius: theme.radius.full, transition: 'width 0.3s ease',
              }} />
            </div>

            <div
              ref={backdropLogRef}
              style={{
                background: theme.colors.bg,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.surfaceElevated}`,
                height: '220px', overflowY: 'auto',
                padding: theme.spacing.sm,
                fontFamily: theme.fonts.mono, fontSize: '12px',
              }}
            >
              {backdropLog.map((entry, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {entry.title}
                  </span>
                  <span style={{ color: BACKDROP_STATUS_COLOR[entry.status], flexShrink: 0, marginLeft: theme.spacing.sm }}>
                    {BACKDROP_STATUS_LABEL[entry.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {backdropResult && !updatingBackdrops && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <div style={{ background: `${theme.colors.success}15`, borderRadius: theme.radius.sm, padding: theme.spacing.md, textAlign: 'center', border: `1px solid ${theme.colors.success}30` }}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.success }}>{backdropResult.updated}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Atualizados</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: theme.radius.sm, padding: theme.spacing.md, textAlign: 'center', border: `1px solid ${theme.colors.surfaceHover}` }}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.textMuted }}>{backdropResult.skipped}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pulados</div>
              </div>
              <div style={{ background: backdropResult.failed > 0 ? `${theme.colors.danger}15` : 'rgba(255,255,255,0.04)', borderRadius: theme.radius.sm, padding: theme.spacing.md, textAlign: 'center', border: `1px solid ${backdropResult.failed > 0 ? theme.colors.danger + '30' : theme.colors.surfaceHover}` }}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: backdropResult.failed > 0 ? theme.colors.danger : theme.colors.textMuted }}>{backdropResult.failed}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Erros</div>
              </div>
            </div>

            <Button onClick={() => { setBackdropResult(null); setBackdropLog([]) }}>
              Buscar novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
