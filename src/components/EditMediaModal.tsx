import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { todayLocal } from '../lib/date.ts'
import type { Media } from '../types/index.ts'
import {
  Modal, Button, Input, Textarea, Select, RatingSlider,
  type SelectOption,
} from './ui/index.ts'

type TipoMidia = 'filme' | 'serie'
type Status = 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'

const STATUS_OPTIONS: SelectOption<Status>[] = [
  { value: 'assistido',     label: 'Assistido',      color: '#46D369' },
  { value: 'assistindo',    label: 'Assistindo',     color: '#8055d0' },
  { value: 'nao_assistido', label: 'Não assistido',  color: '#808080' },
  { value: 'nao_lembro',   label: 'Não lembro',     color: '#F5A623' },
]

const TIPO_OPTIONS: SelectOption<TipoMidia>[] = [
  { value: 'filme', label: 'Filme', color: '#8055d0' },
  { value: 'serie', label: 'Série', color: '#54B9C5' },
]

interface Props {
  media:   Media
  onClose: () => void
  onSaved: () => void
}

export function EditMediaModal({ media, onClose, onSaved }: Props) {
  const { updateMedia } = useMediaStore()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    title:          media.title,
    release_year:   media.release_year  ?? '',
    synopsis:       media.synopsis      ?? '',
    observations:   media.observations  ?? '',
    rating:         media.rating        ?? 0,
    duration:       String(media.duration ?? ''),
    watched:        String(media.watched  ?? ''),
    cover_path:     media.cover_path    ?? '',
    watched_date:   media.watched_date  ?? '',
    tipo:           media.tipo          as TipoMidia,
    watched_status: media.watched_status as Status,
    genres:         (media.genres  ?? []).join(', '),
    director:       media.director  ?? '',
    cast:           (media.cast    ?? []).join(', '),
  })

  async function handleSave() {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return }
    setSaving(true)
    setError(null)
    try {
      await updateMedia(media.id, {
        title:          form.title,
        release_year:   form.release_year || undefined,
        synopsis:       form.synopsis || undefined,
        observations:   form.observations || undefined,
        rating:         form.rating > 0 ? form.rating : undefined,
        duration:       form.duration ? Number(form.duration) : undefined,
        watched:        form.watched ? Number(form.watched) : undefined,
        cover_path:     form.cover_path || undefined,
        tipo:           form.tipo,
        watched_status: form.watched_status,
        watched_date:   form.watched_status === 'assistido' ? (form.watched_date || undefined) : undefined,
        genres:         form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
        director:       form.director || undefined,
        cast:           form.cast ? form.cast.split(',').map(c => c.trim()).filter(Boolean) : [],
      })
      onSaved()
    } catch {
      setError('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar: ${media.title}`} width="600px">
      <div style={{ padding: theme.spacing.lg }}>

        {error && (
          <div style={{
            background: 'rgba(229,9,14,0.12)',
            border: `1px solid ${theme.colors.danger}`,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm,
            marginBottom: theme.spacing.md,
            fontSize: theme.fontSizes.ui,
            color: theme.colors.danger,
          }}>
            {error}
          </div>
        )}

        {form.cover_path && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.spacing.lg }}>
            <img src={form.cover_path} alt={form.title}
              style={{
                height: '180px',
                borderRadius: theme.radius.md,
                objectFit: 'cover',
                boxShadow: theme.shadows.card,
              }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>

          <Input
            label="Título *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
            <Select<TipoMidia>
              label="Tipo"
              options={TIPO_OPTIONS}
              value={form.tipo}
              onChange={v => setForm(f => ({ ...f, tipo: v }))}
              fullWidth
            />
            <Select<Status>
              label="Status"
              options={STATUS_OPTIONS}
              value={form.watched_status}
              onChange={v => setForm(f => ({ ...f, watched_status: v }))}
              fullWidth
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
            <Input
              label="Ano"
              value={form.release_year}
              onChange={e => setForm(f => ({ ...f, release_year: e.target.value }))}
            />
            <Input
              label={form.tipo === 'filme' ? 'Duração (min)' : 'Episódios'}
              type="number"
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
            />
          </div>

          <RatingSlider
            value={form.rating}
            onChange={v => setForm(f => ({ ...f, rating: v }))}
          />

          {form.watched_status === 'assistido' && (
            <Input
              label="Data em que assistiu"
              type="date"
              value={form.watched_date}
              max={todayLocal()}
              onChange={e => setForm(f => ({ ...f, watched_date: e.target.value }))}
            />
          )}

          <Input
            label="Gêneros (vírgula)"
            value={form.genres}
            onChange={e => setForm(f => ({ ...f, genres: e.target.value }))}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
            <Input
              label="Diretor"
              value={form.director}
              onChange={e => setForm(f => ({ ...f, director: e.target.value }))}
            />
            <Input
              label="Elenco (vírgula)"
              value={form.cast}
              onChange={e => setForm(f => ({ ...f, cast: e.target.value }))}
            />
          </div>

          <Textarea
            label="Sinopse"
            value={form.synopsis}
            onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))}
            rows={3}
          />

          <Textarea
            label="Observações pessoais"
            value={form.observations}
            onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
            rows={2}
          />

          <Input
            label="URL do poster"
            value={form.cover_path}
            onChange={e => setForm(f => ({ ...f, cover_path: e.target.value }))}
          />
        </div>

        <div style={{
          display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end',
          marginTop: theme.spacing.lg,
          paddingTop: theme.spacing.md,
          borderTop: `1px solid ${theme.colors.surface}`,
        }}>
          <Button variant="ghost" size="lg" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} size="lg">
            Salvar alterações
          </Button>
        </div>
      </div>
    </Modal>
  )
}
