import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../styles/theme.ts'
import { ipc } from '../lib/ipc.ts'
import type { ListEntryRef, ListInfo } from '../types/index.ts'
import { ListPickerModal } from './ListPickerModal.tsx'

interface Props {
  target:   ListEntryRef & { title: string }
  /** fecha o modal de detalhes antes de navegar para a lista */
  onNavigate?: () => void
}

/** "Nas listas: Alien · Terror no espaço  [+ Lista]" dentro dos detalhes de um título. */
export function TitleListsRow({ target, onNavigate }: Props) {
  const navigate = useNavigate()
  const [lists, setLists]   = useState<ListInfo[]>([])
  const [ids, setIds]       = useState<number[]>([])
  const [picker, setPicker] = useState(false)

  useEffect(() => {
    Promise.all([
      ipc<ListInfo[]>('lists:getAll'),
      ipc<number[]>('lists:idsFor', { kind: target.kind, id: target.id }),
    ]).then(([all, mine]) => { setLists(all); setIds(mine) })
  }, [target.kind, target.id])

  const mine = lists.filter(l => ids.includes(l.id))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: '10px', color: theme.colors.textMuted, fontWeight: theme.fontWeights.bold,
        letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: '2px',
      }}>
        Listas
      </span>
      {mine.length === 0 && (
        <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>nenhuma</span>
      )}
      {mine.map(l => (
        <button
          key={l.id}
          onClick={() => { onNavigate?.(); navigate(`/listas?lista=${l.id}`) }}
          title="Abrir lista"
          className="focus-ring"
          style={{
            padding: '3px 10px', borderRadius: theme.radius.full, cursor: 'pointer',
            fontSize: theme.fontSizes.small, border: `1px solid ${theme.colors.surfaceHover}`,
            background: theme.colors.surface, color: theme.colors.textSecondary,
          }}
        >
          {l.name}
        </button>
      ))}
      <button
        onClick={() => setPicker(true)}
        className="focus-ring"
        style={{
          padding: '3px 10px', borderRadius: theme.radius.full, cursor: 'pointer',
          fontSize: theme.fontSizes.small, border: `1px dashed ${theme.colors.primary}`,
          background: 'transparent', color: theme.colors.primaryMuted,
        }}
      >
        + Lista
      </button>

      {picker && (
        <ListPickerModal
          target={target}
          onClose={() => setPicker(false)}
          onChanged={next => {
            setIds(next)
            ipc<ListInfo[]>('lists:getAll').then(setLists)
          }}
        />
      )}
    </div>
  )
}
