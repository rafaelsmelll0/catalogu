import { useEffect, useState } from 'react'
import { theme } from '../../styles/theme.ts'
import type { Media } from '../../types/index.ts'
import { MovieCard } from '../MovieCard.tsx'
import Roll from '../../assets/roll.svg?react'

interface Props {
  items:       Media[]
  /** mostra #1, #2… (franquias e sagas) */
  numbered:    boolean
  onCardClick: (m: Media) => void
  /** nova ordem depois de arrastar e soltar */
  onReorder:   (ordered: Media[]) => void
}

/**
 * Grade de uma lista com arrastar e soltar. Soltar um card grava a ordem manual
 * (a lista passa para "Ordem manual" — é assim que se monta a cronologia da história).
 */
export function SortableListGrid({ items, numbered, onCardClick, onReorder }: Props) {
  const [order, setOrder]       = useState(items)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver]         = useState<number | null>(null)

  useEffect(() => { setOrder(items) }, [items])

  function drop(target: number) {
    if (dragging === null || dragging === target) { reset(); return }
    const next = [...order]
    const [moved] = next.splice(dragging, 1)
    next.splice(target, 0, moved)
    setOrder(next)
    reset()
    onReorder(next)
  }

  function reset() {
    setDragging(null)
    setOver(null)
  }

  if (order.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '40vh', gap: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.fontSizes.body,
      }}>
        <Roll style={{ width: '90px', height: '90px', opacity: 0.4, animation: 'float 3s ease-in-out infinite' }} />
        Esta lista está vazia. Clique em + Adicionar.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${theme.layout.cardWidth}, 1fr))`,
      gap: theme.spacing.lg,
      padding: `0 ${theme.layout.pagePadding} ${theme.spacing.xxxl}`,
    }}>
      {order.map((m, i) => (
        <div
          key={m.id}
          draggable
          onDragStart={e => { setDragging(i); e.dataTransfer.effectAllowed = 'move' }}
          onDragOver={e => { e.preventDefault(); if (over !== i) setOver(i) }}
          onDragLeave={() => { if (over === i) setOver(null) }}
          onDrop={e => { e.preventDefault(); drop(i) }}
          onDragEnd={reset}
          style={{
            position: 'relative',
            opacity: dragging === i ? 0.35 : 1,
            outline: over === i && dragging !== null && dragging !== i ? `2px dashed ${theme.colors.primary}` : 'none',
            outlineOffset: '4px',
            borderRadius: theme.radius.md,
            cursor: 'grab',
          }}
        >
          {numbered && (
            <div style={{
              position: 'absolute', top: '-8px', left: '-8px', zIndex: 2,
              minWidth: '28px', height: '28px', padding: '0 6px',
              borderRadius: theme.radius.full,
              background: theme.colors.primary, color: '#fff',
              fontSize: theme.fontSizes.small, fontWeight: theme.fontWeights.black,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: theme.shadows.card, pointerEvents: 'none',
            }}>
              #{i + 1}
            </div>
          )}
          <MovieCard media={m} onClick={onCardClick} index={i} />
        </div>
      ))}
    </div>
  )
}
