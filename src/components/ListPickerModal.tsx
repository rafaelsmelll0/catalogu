import { useEffect, useMemo, useState } from 'react'
import { theme } from '../styles/theme.ts'
import { ipc } from '../lib/ipc.ts'
import { normalize } from '../lib/normalize.ts'
import { LIST_KIND_LABEL, type ListEntryRef, type ListInfo, type ListKind } from '../types/index.ts'
import { Modal, Button, Input } from './ui/index.ts'
import { showToast } from './Toast.tsx'

interface Props {
  target:     ListEntryRef & { title: string }
  onClose:    () => void
  /** chamado depois de cada mudança (para quem mostra as listas do título se atualizar) */
  onChanged?: (listIds: number[]) => void
}

const KIND_ORDER: ListKind[] = ['franquia', 'saga', 'tema', 'livre']

/** Evento global: a página de Listas escuta para se atualizar (o seletor abre de vários lugares). */
export const LISTS_CHANGED_EVENT = 'catalogu:lists-changed'
const notifyListsChanged = () => window.dispatchEvent(new Event(LISTS_CHANGED_EVENT))

/**
 * Coloca/tira um título de listas com um clique, e cria lista nova na hora.
 * Serve para itens do catálogo e de Próximos.
 */
export function ListPickerModal({ target, onClose, onChanged }: Props) {
  const [lists, setLists]     = useState<ListInfo[]>([])
  const [member, setMember]   = useState<Set<number>>(new Set())
  const [query, setQuery]     = useState('')
  const [busy, setBusy]       = useState<number | null>(null)
  const [newKind, setNewKind] = useState<ListKind>('tema')

  async function load() {
    const [all, ids] = await Promise.all([
      ipc<ListInfo[]>('lists:getAll'),
      ipc<number[]>('lists:idsFor', { kind: target.kind, id: target.id }),
    ])
    setLists(all)
    setMember(new Set(ids))
  }

  useEffect(() => { load() }, [target.kind, target.id])

  async function toggle(list: ListInfo) {
    setBusy(list.id)
    const inside = member.has(list.id)
    try {
      if (target.kind === 'media') {
        await ipc(inside ? 'lists:removeMedia' : 'lists:addMedia', target.id, list.id)
      } else {
        await ipc(inside ? 'lists:removeWatchlistItem' : 'lists:addWatchlistItem', target.id, list.id)
      }
      const next = new Set(member)
      if (inside) next.delete(list.id)
      else next.add(list.id)
      setMember(next)
      onChanged?.([...next])
      notifyListsChanged()
    } catch (err) {
      console.error('[ListPicker.toggle]', err)
      showToast('Não foi possível alterar a lista.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const q = normalize(query.trim())
  const exact = lists.find(l => normalize(l.name) === q)

  async function createAndAdd() {
    const name = query.trim()
    if (!name || exact) return
    try {
      const listId = await ipc<number>('lists:create', name, '', newKind)
      if (target.kind === 'media') await ipc('lists:addMedia', target.id, listId)
      else await ipc('lists:addWatchlistItem', target.id, listId)
      setQuery('')
      await load()
      onChanged?.([...member, listId])
      notifyListsChanged()
      showToast(`Lista "${name}" criada com "${target.title}".`)
    } catch (err) {
      console.error('[ListPicker.create]', err)
      showToast('Não foi possível criar a lista.', 'error')
    }
  }

  const grouped = useMemo(() => {
    const filtered = q ? lists.filter(l => normalize(l.name).includes(q)) : lists
    return KIND_ORDER
      .map(kind => ({ kind, items: filtered.filter(l => l.kind === kind) }))
      .filter(g => g.items.length > 0)
  }, [lists, q])

  return (
    <Modal open onClose={onClose} title={`Listas de "${target.title}"`} width="460px">
      <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderBottom: `1px solid ${theme.colors.surface}` }}>
          <Input
            icon="⌕"
            placeholder="Buscar ou criar lista…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createAndAdd()}
            autoFocus
          />
          {query.trim() && !exact && (
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: 'wrap' }}>
              <Button size="sm" onClick={createAndAdd}>+ Criar "{query.trim()}"</Button>
              <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>como</span>
              {KIND_ORDER.map(k => (
                <button
                  key={k}
                  onClick={() => setNewKind(k)}
                  className="focus-ring"
                  style={{
                    padding: '3px 10px', borderRadius: theme.radius.full, cursor: 'pointer',
                    fontSize: theme.fontSizes.tiny,
                    border: `1px solid ${k === newKind ? theme.colors.primary : theme.colors.surfaceHover}`,
                    background: k === newKind ? theme.colors.primaryGlow : 'transparent',
                    color: k === newKind ? theme.colors.textPrimary : theme.colors.textMuted,
                  }}
                >
                  {LIST_KIND_LABEL[k].one}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: `${theme.spacing.xs} ${theme.spacing.lg} ${theme.spacing.md}` }}>
          {grouped.length === 0 && (
            <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, padding: `${theme.spacing.lg} 0`, textAlign: 'center' }}>
              {lists.length === 0 ? 'Você ainda não tem listas. Digite um nome acima para criar.' : 'Nenhuma lista com esse nome.'}
            </p>
          )}
          {grouped.map(g => (
            <div key={g.kind} style={{ marginTop: theme.spacing.md }}>
              <div style={{
                fontSize: '10px', fontWeight: theme.fontWeights.bold, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: theme.colors.textMuted, marginBottom: theme.spacing.xs,
              }}>
                {LIST_KIND_LABEL[g.kind].many}
              </div>
              {g.items.map(l => {
                const on = member.has(l.id)
                return (
                  <label
                    key={l.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
                      padding: `${theme.spacing.sm} ${theme.spacing.xs}`, cursor: 'pointer',
                      borderRadius: theme.radius.sm, opacity: busy === l.id ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy !== null}
                      onChange={() => toggle(l)}
                      style={{ accentColor: theme.colors.primary, width: '16px', height: '16px' }}
                    />
                    <span style={{ flex: 1, fontSize: theme.fontSizes.ui, color: on ? theme.colors.textPrimary : theme.colors.textSecondary }}>
                      {l.name}
                    </span>
                    <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>{l.media_count}</span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderTop: `1px solid ${theme.colors.surface}`,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Button onClick={onClose}>Pronto</Button>
        </div>
      </div>
    </Modal>
  )
}
