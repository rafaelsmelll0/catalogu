import { useMemo, useState } from 'react'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import { normalize } from '../../lib/normalize.ts'
import type { ListEntryRef, Media, WatchlistItem } from '../../types/index.ts'
import { Modal, Button, Input, Badge } from '../ui/index.ts'
import { showToast } from '../Toast.tsx'

interface Candidate extends ListEntryRef {
  key:   string
  title: string
  year?: string
  tipo:  'filme' | 'serie'
  cover?: string
  proximo: boolean
}

interface Props {
  listId:    number
  listName:  string
  catalog:   Media[]
  watchlist: WatchlistItem[]
  /** chaves "media:ID" / "watchlist:ID" que já estão na lista */
  inList:    Set<string>
  onClose:   () => void
  onAdded:   () => void
}

/** Adicionar à lista com seleção múltipla (catálogo + Próximos). */
export function AddToListModal({ listId, listName, catalog, watchlist, inList, onClose, onAdded }: Props) {
  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving]     = useState(false)

  const candidates = useMemo<Candidate[]>(() => [
    ...catalog.map(m => ({
      kind: 'media' as const, id: m.id, key: `media:${m.id}`, title: m.title, year: m.release_year,
      tipo: m.tipo, cover: m.cover_path, proximo: false,
    })),
    ...watchlist.map(w => ({
      kind: 'watchlist' as const, id: w.id, key: `watchlist:${w.id}`, title: w.title, year: w.release_year,
      tipo: w.tipo, cover: w.cover_path, proximo: true,
    })),
  ].filter(c => !inList.has(c.key)).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [catalog, watchlist, inList])

  const q = normalize(query.trim())
  const shown = q
    ? candidates.filter(c => normalize(c.title).includes(q) || (c.year ?? '').includes(q))
    : candidates

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  async function save() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const entries: ListEntryRef[] = candidates.filter(c => selected.has(c.key)).map(c => ({ kind: c.kind, id: c.id }))
      const added = await ipc<number>('lists:addMany', listId, entries)
      showToast(`${added} ${added === 1 ? 'título adicionado' : 'títulos adicionados'} a "${listName}".`)
      onAdded()
      onClose()
    } catch (err) {
      console.error('[AddToListModal.save]', err)
      showToast('Não foi possível adicionar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Adicionar a "${listName}"`} width="540px">
      <div style={{ display: 'flex', flexDirection: 'column', height: '64vh' }}>
        <div style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderBottom: `1px solid ${theme.colors.surface}`,
          display: 'flex', flexDirection: 'column', gap: theme.spacing.xs,
        }}>
          <Input icon="⌕" placeholder="Buscar título ou ano…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
            {shown.length} de {candidates.length} disponíveis · clique para marcar vários
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: `${theme.spacing.xs} ${theme.spacing.lg}` }}>
          {shown.map(c => {
            const on = selected.has(c.key)
            return (
              <label
                key={c.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer',
                  padding: `${theme.spacing.xs} ${theme.spacing.xs}`, borderRadius: theme.radius.sm,
                  background: on ? theme.colors.primaryGlow : 'transparent',
                }}
              >
                <input
                  type="checkbox" checked={on} onChange={() => toggle(c.key)}
                  style={{ accentColor: theme.colors.primary, width: '16px', height: '16px', flexShrink: 0 }}
                />
                <div style={{
                  width: '28px', height: '42px', flexShrink: 0, borderRadius: '3px',
                  background: c.cover ? `url(${c.cover}) center/cover` : theme.colors.surfaceHover,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
                    {c.tipo} · {c.year ?? '—'}
                  </div>
                </div>
                {c.proximo && <Badge variant="warning" size="sm">PRÓXIMO</Badge>}
              </label>
            )
          })}
          {shown.length === 0 && (
            <p style={{ textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, padding: theme.spacing.xl }}>
              {candidates.length === 0 ? 'Tudo do catálogo já está nesta lista.' : 'Nada encontrado.'}
            </p>
          )}
        </div>

        <div style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderTop: `1px solid ${theme.colors.surface}`,
          display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
        }}>
          {selected.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving} disabled={selected.size === 0}>
            Adicionar {selected.size > 0 ? selected.size : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
