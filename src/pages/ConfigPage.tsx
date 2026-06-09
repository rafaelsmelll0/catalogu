import { useState, useEffect, useRef } from 'react'
import { theme } from '../styles/theme.ts'
import { Button, Modal } from '../components/ui/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { showToast } from '../components/Toast.tsx'

interface ImageProgress {
  current: number
  total:   number
  title:   string
  status:  'updating' | 'updated' | 'no_image' | 'no_tmdb' | 'error'
}

interface ImageResult {
  updated: number
  skipped: number
  failed:  number
}

const IMAGE_STATUS_LABEL: Record<ImageProgress['status'], string> = {
  updating: '🔍 Buscando...',
  updated:  '✓ Atualizado',
  no_image: '⚠ Sem imagem',
  no_tmdb:  '→ Sem TMDB ID',
  error:    '✗ Erro',
}

const IMAGE_STATUS_COLOR: Record<ImageProgress['status'], string> = {
  updating: theme.colors.textMuted,
  updated:  theme.colors.success,
  no_image: theme.colors.warning,
  no_tmdb:  theme.colors.textMuted,
  error:    theme.colors.danger,
}

interface ImportV3Result {
  success:   boolean
  imported?: number
  skipped?:  number
  mode?:     'merge' | 'replace'
  error?:    string
}

export function ConfigPage() {
  const { fetchAll } = useMediaStore()

  const [updatingImages, setUpdatingImages] = useState(false)
  const [imageProgress, setImageProgress]   = useState<ImageProgress | null>(null)
  const [imageLog, setImageLog]             = useState<{ title: string; status: ImageProgress['status'] }[]>([])
  const [imageResult, setImageResult]       = useState<ImageResult | null>(null)
  const imageLogRef = useRef<HTMLDivElement>(null)

  const [pendingDbPath, setPendingDbPath] = useState<string | null>(null)
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState<ImportV3Result | null>(null)

  useEffect(() => {
    const unsub = window.electronAPI.on('images:progress', (...args) => {
      const p = args[0] as ImageProgress
      setImageProgress(p)
      setImageLog(prev => {
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
    if (imageLogRef.current) imageLogRef.current.scrollTop = imageLogRef.current.scrollHeight
  }, [imageLog])

  async function handleUpdateImages() {
    setImageResult(null)
    setImageLog([])
    setImageProgress(null)
    setUpdatingImages(true)
    try {
      const res = await window.electronAPI.invoke('images:updateAll') as ImageResult
      setImageResult(res)
      await fetchAll()
      showToast(`${res.updated} imagens atualizadas!`)
    } catch {
      showToast('Erro ao atualizar imagens.', 'error')
    } finally {
      setUpdatingImages(false)
    }
  }

  async function handleExport() {
    const res = await window.electronAPI.invoke('backup:export') as { success: boolean; path?: string }
    if (res.success) {
      showToast('Backup exportado com sucesso!')
    } else {
      showToast('Exportação cancelada ou falhou.', 'info')
    }
  }

  async function handleSelectImport() {
    const dbPath = await window.electronAPI.invoke('backup:selectDbV3') as string | null
    if (!dbPath) return
    setPendingDbPath(dbPath)
  }

  async function handleImport(mode: 'merge' | 'replace') {
    if (!pendingDbPath) return
    setImporting(true)
    try {
      const res = await window.electronAPI.invoke('backup:importV3', pendingDbPath, mode) as ImportV3Result
      setImportResult(res)
      if (res.success) {
        await fetchAll()
        if (mode === 'replace') {
          showToast('Banco substituído com sucesso!')
        } else {
          showToast(`${res.imported} títulos importados, ${res.skipped} já existiam.`)
        }
      } else {
        showToast(`Erro: ${res.error}`, 'error')
      }
    } catch {
      showToast('Erro na importação.', 'error')
    } finally {
      setImporting(false)
      setPendingDbPath(null)
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.surfaceElevated}`,
    marginBottom: theme.spacing.lg,
  }

  const resultCardStyle = (color: string, hasValue: boolean): React.CSSProperties => ({
    background: hasValue ? `${color}15` : 'rgba(255,255,255,0.04)',
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    textAlign: 'center',
    border: `1px solid ${hasValue ? color + '30' : theme.colors.surfaceHover}`,
  })

  const pct = imageProgress
    ? Math.round((imageProgress.current / imageProgress.total) * 100)
    : 0

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

      {/* Backup */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold, marginBottom: theme.spacing.xs }}>
          Backup do Catálogo
        </h2>
        <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
          Exporte o banco de dados para guardar uma cópia, ou importe um backup anterior.
        </p>

        <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <Button onClick={handleExport}>
            ↓ Exportar backup
          </Button>
          <Button variant="secondary" onClick={handleSelectImport} disabled={importing}>
            ↑ Importar backup
          </Button>
        </div>

        {importResult && !importing && (
          <div style={{ marginTop: theme.spacing.lg }}>
            {importResult.success ? (
              importResult.mode === 'replace' ? (
                <p style={{ color: theme.colors.success, fontSize: theme.fontSizes.ui }}>
                  ✓ Banco substituído com sucesso.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, maxWidth: '360px' }}>
                  <div style={resultCardStyle(theme.colors.success, (importResult.imported ?? 0) > 0)}>
                    <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.success }}>
                      {importResult.imported}
                    </div>
                    <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Importados
                    </div>
                  </div>
                  <div style={resultCardStyle(theme.colors.textMuted, false)}>
                    <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.textMuted }}>
                      {importResult.skipped}
                    </div>
                    <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Já existiam
                    </div>
                  </div>
                </div>
              )
            ) : (
              <p style={{ color: theme.colors.danger, fontSize: theme.fontSizes.ui }}>
                ✗ {importResult.error}
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={() => setImportResult(null)} style={{ marginTop: theme.spacing.sm }}>
              Fechar
            </Button>
          </div>
        )}
      </div>

      {/* Atualizar imagens */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: theme.fontSizes.h3, fontWeight: theme.fontWeights.bold, marginBottom: theme.spacing.xs }}>
          Atualizar imagens
        </h2>
        <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
          Busca no TMDB a capa e a imagem de fundo (backdrop) dos títulos que ainda não têm.
          Títulos sem TMDB ID são ignorados.
        </p>

        {!updatingImages && !imageResult && (
          <Button onClick={handleUpdateImages}>
            ↻ Buscar imagens
          </Button>
        )}

        {updatingImages && imageProgress && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
              <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
                {imageProgress.current} de {imageProgress.total} — {imageProgress.title}
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
              ref={imageLogRef}
              style={{
                background: theme.colors.bg,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.surfaceElevated}`,
                height: '220px', overflowY: 'auto',
                padding: theme.spacing.sm,
                fontFamily: theme.fonts.mono, fontSize: '12px',
              }}
            >
              {imageLog.map((entry, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {entry.title}
                  </span>
                  <span style={{ color: IMAGE_STATUS_COLOR[entry.status], flexShrink: 0, marginLeft: theme.spacing.sm }}>
                    {IMAGE_STATUS_LABEL[entry.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {imageResult && !updatingImages && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              <div style={resultCardStyle(theme.colors.success, imageResult.updated > 0)}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: imageResult.updated > 0 ? theme.colors.success : theme.colors.textMuted }}>
                  {imageResult.updated}
                </div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Atualizados</div>
              </div>
              <div style={resultCardStyle(theme.colors.textMuted, false)}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: theme.colors.textMuted }}>{imageResult.skipped}</div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pulados</div>
              </div>
              <div style={resultCardStyle(theme.colors.danger, imageResult.failed > 0)}>
                <div style={{ fontSize: '28px', fontWeight: theme.fontWeights.black, color: imageResult.failed > 0 ? theme.colors.danger : theme.colors.textMuted }}>
                  {imageResult.failed}
                </div>
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Erros</div>
              </div>
            </div>
            <Button onClick={() => { setImageResult(null); setImageLog([]) }}>
              Buscar novamente
            </Button>
          </div>
        )}
      </div>

      {/* Modal: Mesclar ou Substituir */}
      <Modal
        open={!!pendingDbPath && !importing}
        onClose={() => setPendingDbPath(null)}
        title="Importar backup"
        width="460px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, lineHeight: 1.6, marginBottom: theme.spacing.lg }}>
            Como deseja importar o backup?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <button
              onClick={() => handleImport('merge')}
              className="focus-ring"
              style={{
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.surfaceHover}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                cursor: 'pointer', textAlign: 'left',
                transition: `all ${theme.transitions.fast}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = theme.colors.primary
                e.currentTarget.style.background  = theme.colors.primaryGlow
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = theme.colors.surfaceHover
                e.currentTarget.style.background  = theme.colors.surface
              }}
            >
              <div style={{ fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary, marginBottom: '4px' }}>
                Mesclar
              </div>
              <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                Adiciona os títulos do backup ao catálogo atual. Títulos duplicados (mesmo TMDB ID ou título+ano) são ignorados.
              </div>
            </button>

            <button
              onClick={() => handleImport('replace')}
              className="focus-ring"
              style={{
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.surfaceHover}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                cursor: 'pointer', textAlign: 'left',
                transition: `all ${theme.transitions.fast}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = theme.colors.danger
                e.currentTarget.style.background  = `${theme.colors.danger}10`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = theme.colors.surfaceHover
                e.currentTarget.style.background  = theme.colors.surface
              }}
            >
              <div style={{ fontWeight: theme.fontWeights.bold, color: theme.colors.danger, marginBottom: '4px' }}>
                Substituir
              </div>
              <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                Apaga o catálogo atual e substitui pelo backup. Esta ação não pode ser desfeita.
              </div>
            </button>
          </div>

          <Button variant="ghost" onClick={() => setPendingDbPath(null)}>Cancelar</Button>
        </div>
      </Modal>
    </div>
  )
}
