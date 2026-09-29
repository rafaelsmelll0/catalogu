import { useEffect } from 'react'
import { theme } from '../styles/theme.ts'
import { AnimatedCat } from '../components/AnimatedCat.tsx'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { QuickAdd } from '../components/home/QuickAdd.tsx'
import { QueueCard } from '../components/home/QueueCard.tsx'
import { DiaryCard } from '../components/home/DiaryCard.tsx'
import { YearCard, ForYouCard, FranchisesCard, PendingCard } from '../components/home/SideCards.tsx'
import { Skeleton } from '../components/ui/index.ts'

/**
 * Início como painel: registrar o que acabou de ver, escolher o próximo e bater o
 * olho no catálogo — tudo sem rolar a tela.
 */
export function HomePage() {
  const { items, loading, fetchAll }  = useMediaStore()
  const fetchWatchlist                = useWatchlistStore(s => s.fetchAll)

  useEffect(() => { fetchAll(); fetchWatchlist() }, [])

  if (loading && items.length === 0) {
    return (
      <div style={{ padding: `${theme.spacing.xl} ${theme.layout.pagePadding}`, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
        <Skeleton height="64px" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: theme.spacing.lg }}>
          <Skeleton height="320px" />
          <Skeleton height="320px" />
        </div>
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <div style={{ padding: `${theme.spacing.xl} ${theme.layout.pagePadding}` }}>
        <QuickAdd />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '60vh', gap: theme.spacing.md,
        }}>
          <AnimatedCat size={110} />
          <h2 style={{ fontSize: theme.fontSizes.h2, fontWeight: theme.fontWeights.bold }}>Catálogo vazio</h2>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
            Digite acima o último filme ou série que você viu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      padding: `${theme.spacing.lg} ${theme.layout.pagePadding} ${theme.spacing.xl}`,
      display: 'flex', flexDirection: 'column', gap: theme.spacing.lg,
      maxWidth: '1600px', margin: '0 auto',
    }}>
      <QuickAdd />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: theme.spacing.lg, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg, minWidth: 0 }}>
          <QueueCard />
          <DiaryCard />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
          <YearCard />
          <PendingCard />
          <ForYouCard />
          <FranchisesCard />
        </div>
      </div>
    </div>
  )
}
