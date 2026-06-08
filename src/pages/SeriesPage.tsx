import { useEffect, useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { FilterBar } from '../components/FilterBar.tsx'
import { MediaGrid } from '../components/MediaGrid.tsx'
import { MediaGridSkeleton } from '../components/MediaGridSkeleton.tsx'
import { DetailsModal } from '../components/DetailsModal.tsx'

export function SeriesPage() {
  const { fetchAll, setFilters, resetFilters, getFiltered, loading } = useMediaStore()
  const [selected, setSelected] = useState<Media | null>(null)

  useEffect(() => {
    fetchAll()
    setFilters({ tipo: 'serie' })
    return () => resetFilters()
  }, [])

  const items = getFiltered()

  return (
    <div style={{ background: theme.colors.bg, minHeight: '100vh', paddingTop: theme.spacing.xl }}>
      <div style={{ padding: `0 ${theme.layout.pagePadding}`, marginBottom: theme.spacing.lg }}>
        <h1 style={{
          fontSize: theme.fontSizes.h1,
          fontWeight: theme.fontWeights.black,
          fontFamily: theme.fonts.display,
        }}>SÉRIES</h1>
      </div>

      <FilterBar lockedFilters={{ tipo: 'serie' }} />

      {loading ? (
        <MediaGridSkeleton count={12} />
      ) : (
        <MediaGrid
          items={items}
          onCardClick={setSelected}
          emptyMessage="Nenhuma série encontrada"
          emptyIcon="cat"
        />
      )}

      {selected && <DetailsModal media={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
