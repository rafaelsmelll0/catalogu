import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { WatchlistItem } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { ipc } from '../lib/ipc.ts'
import { todayLocal } from '../lib/date.ts'
import { Modal, Button, RatingSlider, Textarea, Select, Input, type SelectOption } from './ui/index.ts'
import { showToast } from './Toast.tsx'

type Status = 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'

const STATUS_OPTIONS: SelectOption<Status>[] = [
  { value: 'assistido',     label: 'Assistido',      color: '#46D369' },
  { value: 'assistindo',    label: 'Assistindo',      color: '#8055d0' },
  { value: 'nao_assistido', label: 'Não assistido',   color: '#808080' },
  { value: 'nao_lembro',    label: 'Não lembro',      color: '#F5A623' },
]

interface Props {
  item:    WatchlistItem
  onClose: () => void
  onDone:  () => void
}

export function MarkAsWatchedModal({ item, onClose, onDone }: Props) {
  const fetchMedia     = useMediaStore(s => s.fetchAll)
  const fetchWatchlist = useWatchlistStore(s => s.fetchAll)
  const [rating, setRating]             = useState(0)
  const [observations, setObservations] = useState('')
  const [status, setStatus]             = useState<Status>('assistido')
  const [watchedDate, setWatchedDate]   = useState(todayLocal())
  const [saving, setSaving]             = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      // Promoção atômica no backend: cria a mídia, preserva os vínculos com listas
      // e remove o item de Próximos numa única transação.
      await ipc<number>('watchlist:promote', item.id, {
        title:          item.title,
        tipo:           item.tipo,
        release_year:   item.release_year,
        synopsis:       item.synopsis,
        cover_path:     item.cover_path,
        backdrop_path:  item.backdrop_path,
        duration:       item.duration,
        director:       item.director,
        genres:         item.genres,
        cast:           item.cast,
        tmdb_id:        item.tmdb_id,
        watched_status: status,
        rating:         rating > 0 ? rating : undefined,
        observations:   observations.trim() || undefined,
        watched_date:   status === 'assistido' && watchedDate ? watchedDate : undefined,
      })
      await Promise.all([fetchMedia(), fetchWatchlist()])
      showToast(`"${item.title}" adicionado ao catálogo!`)
      onDone()
    } catch {
      showToast('Erro ao salvar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Marcar como assistido" width="520px">
      <div style={{ padding: theme.spacing.lg }}>

        <div style={{
          display: 'flex', gap: theme.spacing.md, alignItems: 'center',
          marginBottom: theme.spacing.lg,
          padding: theme.spacing.md,
          background: theme.colors.surface,
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.colors.surfaceElevated}`,
        }}>
          {item.cover_path && (
            <img
              src={item.cover_path}
              alt={item.title}
              style={{
                width: '48px', height: '72px',
                objectFit: 'cover',
                borderRadius: theme.radius.sm,
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <div style={{
              fontWeight: theme.fontWeights.bold,
              fontSize: theme.fontSizes.body,
              color: theme.colors.textPrimary,
            }}>
              {item.title}
            </div>
            <div style={{
              fontSize: theme.fontSizes.small,
              color: theme.colors.textMuted,
              marginTop: '2px',
            }}>
              {item.tipo} · {item.release_year}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          <Select<Status>
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
            fullWidth
          />
          {status === 'assistido' && (
            <Input
              label="Data em que assistiu"
              type="date"
              value={watchedDate}
              max={todayLocal()}
              onChange={e => setWatchedDate(e.target.value)}
            />
          )}
          <RatingSlider
            value={rating}
            onChange={setRating}
            label="Sua nota (opcional)"
          />
          <Textarea
            label="Observações pessoais (opcional)"
            value={observations}
            onChange={e => setObservations(e.target.value)}
            rows={3}
          />
        </div>

        <div style={{
          display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end',
          marginTop: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          borderTop: `1px solid ${theme.colors.surface}`,
        }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} size="lg">
            Salvar no catálogo
          </Button>
        </div>
      </div>
    </Modal>
  )
}
