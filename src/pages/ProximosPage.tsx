import { useEffect, useState, useMemo } from 'react'
import { theme } from '../styles/theme.ts'
import type { WatchlistItem } from '../types/index.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { WatchlistCard } from '../components/WatchlistCard.tsx'
import { MarkAsWatchedModal } from '../components/MarkAsWatchedModal.tsx'
import { AddMediaModal } from '../components/AddMediaModal.tsx'
import { Modal, Button } from '../components/ui/index.ts'
import {
  WatchlistFilterBar,
  DEFAULT_WATCHLIST_FILTERS,
  applyWatchlistFilters,
  type WatchlistFilters,
} from '../components/WatchlistFilterBar.tsx'
import Roll from '../assets/roll.svg?react'

export function ProximosPage() {
  const { items, loading, fetchAll, removeItem } = useWatchlistStore()
  const [showAdd, setShowAdd]       = useState(false)
  const [toWatch, setToWatch]       = useState<WatchlistItem | null>(null)
  const [toRemove, setToRemove]     = useState<WatchlistItem | null>(null)
  const [filters, setFiltersState]  = useState<WatchlistFilters>(DEFAULT_WATCHLIST_FILTERS)

  useEffect(() => { fetchAll() }, [])

  function setFilters(f: Partial<WatchlistFilters>) {
    setFiltersState(prev => ({ ...prev, ...f }))
  }

  function resetFilters() {
    setFiltersState(DEFAULT_WATCHLIST_FILTERS)
  }

  const filtered = useMemo(
    () => applyWatchlistFilters(items, filters),
    [items, filters]
  )

  return (
    <div style={{ background: theme.colors.bg, minHeight: '100vh', padding: `${theme.spacing.xl} ${theme.layout.pagePadding}` }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.lg,
        flexWrap: 'wrap', gap: theme.spacing.md,
      }}>
        <div>
          <h1 style={{
            fontSize: theme.fontSizes.h1,
            fontWeight: theme.fontWeights.black,
            fontFamily: theme.fonts.display,
            marginBottom: theme.spacing.xs,
          }}>
            PRÓXIMOS
          </h1>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
            {items.length} {items.length === 1 ? 'título' : 'títulos'} na fila
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Adicionar</Button>
      </div>

      {/* Filtros — só aparece se tiver itens */}
      {items.length > 0 && (
        <WatchlistFilterBar
          filters={filters}
          setFilters={setFilters}
          resetFilters={resetFilters}
          allItems={items}
          filtered={filtered}
        />
      )}

      {/* Conteúdo */}
      {loading ? (
        <div style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '50vh', gap: theme.spacing.md,
          animation: 'pageIn 0.4s ease-out',
        }}>
          <div style={{ width: '100px', height: '100px', animation: 'float 3s ease-in-out infinite' }}>
            <Roll style={{ width: '100%', height: '100%', opacity: 0.25 }} />
          </div>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
            Nenhum título na fila ainda
          </p>
          <Button onClick={() => setShowAdd(true)}>+ Adicionar o primeiro</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '30vh', gap: theme.spacing.md,
          animation: 'pageIn 0.4s ease-out',
        }}>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
            Nenhum resultado para os filtros aplicados
          </p>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            × Limpar filtros
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          {filtered.map((item, i) => (
            <WatchlistCard
              key={item.id}
              item={item}
              index={i}
              onWatched={setToWatch}
              onRemove={setToRemove}
            />
          ))}
        </div>
      )}

      {/* Modal: Adicionar */}
      {showAdd && (
        <AddMediaModal
          mode="watchlist"
          onClose={() => { setShowAdd(false); fetchAll() }}
        />
      )}

      {/* Modal: Marcar como assistido */}
      {toWatch && (
        <MarkAsWatchedModal
          item={toWatch}
          onClose={() => setToWatch(null)}
          onDone={() => { setToWatch(null); fetchAll() }}
        />
      )}

      {/* Modal: Confirmar remoção */}
      <Modal
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        title="Remover da fila"
        width="400px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes.ui,
            lineHeight: 1.6,
            marginBottom: theme.spacing.lg,
          }}>
            Remover <strong style={{ color: theme.colors.textPrimary }}>"{toRemove?.title}"</strong> da fila de Próximos?
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setToRemove(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              if (toRemove) await removeItem(toRemove.id)
              setToRemove(null)
            }}>
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
