import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { EditMediaModal } from './EditMediaModal.tsx'
import { Modal, Button, Badge } from './ui/index.ts'

interface Props {
  media:   Media
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  assistido:     '✓ Assistido',
  assistindo:    '▶ Assistindo',
  nao_assistido: '○ Não assistido',
  nao_lembro:    '? Não lembro',
}

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'muted' | 'warning'> = {
  assistido:     'success',
  assistindo:    'primary',
  nao_assistido: 'muted',
  nao_lembro:    'warning',
}

function RatingDisplay({ rating }: { rating: number }) {
  const color = rating >= 8 ? theme.colors.success
              : rating >= 6 ? theme.colors.warning
              :               theme.colors.danger
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'baseline', gap: theme.spacing.xs,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      background: `${color}20`,
      border: `1px solid ${color}50`,
      borderRadius: theme.radius.md,
    }}>
      <span style={{
        fontSize: '32px', fontWeight: theme.fontWeights.black,
        fontFamily: theme.fonts.display, color, lineHeight: 1,
      }}>
        {rating.toFixed(1)}
      </span>
      <span style={{
        fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted,
        fontWeight: theme.fontWeights.bold, letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        / 10
      </span>
    </div>
  )
}

export function DetailsModal({ media, onClose }: Props) {
  const { deleteMedia } = useMediaStore()
  const [showEdit, setShowEdit]                   = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]                   = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await deleteMedia(media.id)
    onClose()
  }

  if (showEdit) {
    return <EditMediaModal media={media} onClose={() => setShowEdit(false)} onSaved={onClose} />
  }

  const heroBg = media.backdrop_path
    ? `url(${media.backdrop_path}) center/cover no-repeat`
    : media.cover_path
      ? `url(${media.cover_path}) center/cover no-repeat`
      : theme.gradients.primary

  const hasOnlyPoster = !media.backdrop_path && !!media.cover_path

  return (
    <>
      <Modal open onClose={onClose} hideHeader width="920px">
        {/* Hero */}
        <div style={{
          position: 'relative',
          height: '300px',
          flexShrink: 0,
          overflow: 'hidden',
          background: hasOnlyPoster ? undefined : heroBg,
        }}>
          {/* Fundo com blur quando só tem poster */}
          {hasOnlyPoster && (
            <div style={{
              position: 'absolute', inset: '-20px',
              background: heroBg,
              filter: 'blur(24px) brightness(0.6)',
              transform: 'scale(1.1)',
            }} />
          )}

          {/* Overlay gradiente usando cor do tema */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to top,
              ${theme.colors.surfaceElevated} 0%,
              ${theme.colors.surfaceElevated}88 40%,
              transparent 100%)`,
          }} />

          {/* Botão fechar */}
          <button
            onClick={onClose}
            className="focus-ring"
            style={{
              position: 'absolute', top: theme.spacing.md, right: theme.spacing.md,
              background: 'rgba(0,0,0,0.55)', border: 'none',
              color: theme.colors.textPrimary, fontSize: '20px',
              width: '36px', height: '36px', borderRadius: theme.radius.full,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2, backdropFilter: 'blur(8px)',
              transition: `background ${theme.transitions.fast}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
          >×</button>

          {/* Badges tipo + status */}
          <div style={{
            position: 'absolute', top: theme.spacing.md, left: theme.spacing.md,
            display: 'flex', gap: theme.spacing.xs, zIndex: 2,
          }}>
            <Badge customColor={theme.colors.typeColors[media.tipo]}>
              {media.tipo}
            </Badge>
            <Badge variant={STATUS_VARIANT[media.watched_status]}>
              {STATUS_LABELS[media.watched_status]}
            </Badge>
          </div>
        </div>

        {/* Corpo */}
        <div style={{ padding: theme.spacing.lg, display: 'flex', gap: theme.spacing.xl }}>

          {/* Coluna esquerda — poster + nota */}
          <div style={{ flexShrink: 0, width: '160px' }}>
            {media.cover_path && (
              <img
                src={media.cover_path}
                alt={media.title}
                style={{
                  width: '160px',
                  height: '240px',
                  objectFit: 'cover',
                  borderRadius: theme.radius.md,
                  marginTop: '-100px',
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: theme.shadows.card,
                  border: `2px solid ${theme.colors.surfaceHover}`,
                }}
              />
            )}
            {media.rating != null && media.rating > 0 && (
              <div style={{ marginTop: theme.spacing.md, display: 'flex', justifyContent: 'center' }}>
                <RatingDisplay rating={media.rating} />
              </div>
            )}
          </div>

          {/* Coluna direita — informações */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Título */}
            <h1 style={{
              fontSize: theme.fontSizes.h1,
              fontWeight: theme.fontWeights.black,
              fontFamily: theme.fonts.display,
              lineHeight: 1.05,
              marginBottom: theme.spacing.xs,
              textTransform: 'uppercase',
            }}>
              {media.title}
            </h1>

            {/* Metadados: ano · duração · diretor */}
            <div style={{
              display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap',
              color: theme.colors.textMuted, fontSize: theme.fontSizes.ui,
              marginBottom: theme.spacing.md, alignItems: 'center',
            }}>
              {media.release_year && <span>{media.release_year}</span>}
              {media.duration && (
                <>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span>
                    {media.tipo === 'filme'
                      ? `${Math.floor(media.duration / 60)}h ${media.duration % 60}min`
                      : `${media.duration} ep.`}
                  </span>
                </>
              )}
              {media.director && (
                <>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span>Dir. {media.director}</span>
                </>
              )}
            </div>

            {/* Gêneros */}
            {media.genres && media.genres.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                gap: theme.spacing.xs, marginBottom: theme.spacing.md,
              }}>
                {media.genres.map(g => <Badge key={g} variant="muted">{g}</Badge>)}
              </div>
            )}

            {/* Sinopse */}
            {media.synopsis && (
              <p style={{
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes.ui,
                lineHeight: 1.7,
                marginBottom: theme.spacing.md,
              }}>
                {media.synopsis}
              </p>
            )}

            {/* Elenco */}
            {media.cast && media.cast.length > 0 && (
              <div style={{ marginBottom: theme.spacing.md }}>
                <div style={{
                  fontSize: '10px', color: theme.colors.textMuted,
                  marginBottom: '6px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', fontWeight: theme.fontWeights.bold,
                }}>
                  Elenco
                </div>
                <div style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui }}>
                  {media.cast.join(', ')}
                </div>
              </div>
            )}

            {/* Tags */}
            {media.tags && media.tags.length > 0 && (
              <div style={{ marginBottom: theme.spacing.md }}>
                <div style={{
                  fontSize: '10px', color: theme.colors.textMuted,
                  marginBottom: '6px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', fontWeight: theme.fontWeights.bold,
                }}>
                  Tags
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                  {media.tags.map(t => <Badge key={t} variant="primary">{t}</Badge>)}
                </div>
              </div>
            )}

            {/* Observações pessoais */}
            {media.observations && (
              <div style={{
                marginBottom: theme.spacing.md,
                padding: theme.spacing.md,
                background: theme.colors.surface,
                borderLeft: `3px solid ${theme.colors.primary}`,
                borderRadius: theme.radius.sm,
              }}>
                <div style={{
                  fontSize: '10px', color: theme.colors.primary,
                  marginBottom: '6px', textTransform: 'uppercase',
                  letterSpacing: '0.08em', fontWeight: theme.fontWeights.bold,
                }}>
                  Observações pessoais
                </div>
                <p style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes.ui,
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}>
                  {media.observations}
                </p>
              </div>
            )}

            {/* Ações */}
            <div style={{
              display: 'flex', gap: theme.spacing.sm,
              marginTop: theme.spacing.lg,
              paddingTop: theme.spacing.md,
              borderTop: `1px solid ${theme.colors.surface}`,
            }}>
              <Button onClick={() => setShowEdit(true)}>
                ✎ Editar
              </Button>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Excluir título"
        width="420px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes.ui,
            lineHeight: 1.6,
            marginBottom: theme.spacing.lg,
          }}>
            Tem certeza que deseja excluir{' '}
            <strong style={{ color: theme.colors.textPrimary }}>"{media.title}"</strong>{' '}
            do seu catálogo? Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
