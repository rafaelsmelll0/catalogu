import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { WatchlistItem } from '../types/index.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { MarkAsWatchedModal } from './MarkAsWatchedModal.tsx'
import { Modal, Button, Badge } from './ui/index.ts'
import { TitleListsRow } from './TitleListsRow.tsx'

interface Props {
  item:    WatchlistItem
  onClose: () => void
  /** Aberto de dentro de uma lista: mostra "Remover desta lista". */
  listContext?: { name: string; onRemove: () => void }
  /** chamado depois de marcar como assistido (ex.: a lista recarregar) */
  onWatched?: () => void
}

/**
 * Detalhes de um item de Próximos. Existe separado do DetailsModal porque as ações
 * são outras (marcar como assistido / tirar da fila) e porque o id do item é da
 * tabela watchlist — passar isso ao DetailsModal editaria/apagaria outra mídia.
 */
export function WatchlistDetailsModal({ item, onClose, listContext, onWatched }: Props) {
  const removeItem = useWatchlistStore(s => s.removeItem)
  const [markWatched, setMarkWatched]     = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving]           = useState(false)

  if (markWatched) {
    return <MarkAsWatchedModal item={item} onClose={() => setMarkWatched(false)} onDone={() => { onWatched?.(); onClose() }} />
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeItem(item.id)
      onClose()
    } finally {
      setRemoving(false)
    }
  }

  const duration = item.duration && item.duration > 0
    ? item.tipo === 'filme'
      ? `${Math.floor(item.duration / 60)}h ${item.duration % 60}min`
      : `${item.duration} ep.`
    : null

  return (
    <>
      <Modal open onClose={onClose} title={item.title} width="520px">
        <div style={{ padding: theme.spacing.lg }}>
          <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
            {item.cover_path && (
              <img
                src={item.cover_path}
                alt={item.title}
                style={{
                  width: '96px', height: '144px', objectFit: 'cover',
                  borderRadius: theme.radius.sm, flexShrink: 0, boxShadow: theme.shadows.card,
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
              <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                <Badge customColor={theme.colors.typeColors[item.tipo]} size="sm">{item.tipo}</Badge>
                <Badge variant="warning" size="sm">PRÓXIMO</Badge>
              </div>
              <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                {[item.release_year, duration].filter(Boolean).join(' · ')}
              </div>
              {item.director && (
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                  Dir. {item.director}
                </div>
              )}
              {item.cast.length > 0 && (
                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                  {item.cast.slice(0, 4).join(', ')}
                </div>
              )}
              {item.genres.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                  {item.genres.map(g => <Badge key={g} variant="muted" size="sm">{g}</Badge>)}
                </div>
              )}
            </div>
          </div>

          {item.synopsis && (
            <p style={{
              color: theme.colors.textSecondary, fontSize: theme.fontSizes.small,
              lineHeight: 1.6, marginBottom: theme.spacing.lg,
            }}>
              {item.synopsis}
            </p>
          )}

          <div style={{ marginBottom: theme.spacing.lg }}>
            <TitleListsRow target={{ kind: 'watchlist', id: item.id, title: item.title }} onNavigate={onClose} />
          </div>

          <div style={{
            display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap',
            paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.surface}`,
          }}>
            {listContext && (
              <Button variant="ghost" onClick={listContext.onRemove} style={{ marginRight: 'auto' }}>
                Remover de "{listContext.name}"
              </Button>
            )}
            <Button variant="ghost" onClick={() => setConfirmRemove(true)}>Remover de Próximos</Button>
            <Button onClick={() => setMarkWatched(true)}>✓ Já assisti</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remover de Próximos" width="400px">
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
            Remover <strong style={{ color: theme.colors.textPrimary }}>"{item.title}"</strong> da sua fila?
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleRemove} loading={removing}>Remover</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
