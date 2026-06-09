import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { WatchlistItem } from '../types/index.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { WatchlistCard } from '../components/WatchlistCard.tsx'
import { MarkAsWatchedModal } from '../components/MarkAsWatchedModal.tsx'
import { AddMediaModal } from '../components/AddMediaModal.tsx'
import { Modal, Button, Input } from '../components/ui/index.ts'
import Roll from '../assets/roll.svg?react'

export function ProximosPage() {
  const { items, loading, fetchAll, removeItem } = useWatchlistStore()
  const [showAdd, setShowAdd]     = useState(false)
  const [toWatch, setToWatch]     = useState<WatchlistItem | null>(null)
  const [toRemove, setToRemove]   = useState<WatchlistItem | null>(null)
  const [search, setSearch]       = useState('')

  useEffect(() => { fetchAll() }, [])

  const filtered = search.trim()
    ? items.filter(m =>
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.release_year ?? '').includes(search) ||
        (m.director ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : items

  return (
    <div style={{ background: theme.colors.bg, minHeight: '100vh', padding: `${theme.spacing.xl} ${theme.layout.pagePadding}` }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.xl,
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

      {/* Busca */}
      {items.length > 0 && (
        <div style={{ marginBottom: theme.spacing.lg, maxWidth: '400px' }}>
          <Input
            icon="⌕"
            placeholder="Buscar na fila..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          {filtered.length === 0 ? (
            <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              Nenhum resultado para "{search}"
            </p>
          ) : filtered.map((item, i) => (
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

      {/* Modal: Adicionar à watchlist */}
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
