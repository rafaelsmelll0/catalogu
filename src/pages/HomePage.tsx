import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { theme } from '../styles/theme.ts'
import CatSit from '../assets/cat-sit.svg?react'
import type { Media } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { HeroBanner } from '../components/HeroBanner.tsx'
import { LazyMediaRow } from '../components/LazyMediaRow.tsx'
import { MediaGridSkeleton } from '../components/MediaGridSkeleton.tsx'
import { DetailsModal } from '../components/DetailsModal.tsx'
import { Skeleton } from '../components/ui/index.ts'

function hasAnyGenre(media: Media, genres: string[]): boolean {
  if (!media.genres) return false
  const lower = media.genres.map(g => g.toLowerCase())
  return genres.some(target => lower.some(g => g.includes(target.toLowerCase())))
}

function olderThanMonths(media: Media, months: number): boolean {
  if (!media.created_at) return false
  const created = new Date(media.created_at)
  const cutoff  = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  return created < cutoff
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandomSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr
  return shuffle(arr).slice(0, n)
}

interface RowDef { title: string; items: Media[] }

const ROW_LIMIT = 12

export function HomePage() {
  const { items, loading, fetchAll } = useMediaStore()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Media | null>(null)

  useEffect(() => { fetchAll() }, [])

  const rows: RowDef[] = useMemo(() => {
    if (items.length === 0) return []

    const recentes = items.slice(0, 20)

    const melhores = items
      .filter(m => (m.rating ?? 0) >= 8)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    const terror   = items.filter(m => hasAnyGenre(m, ['terror', 'horror']))
    const suspense = items.filter(m => hasAnyGenre(m, ['suspense', 'thriller', 'mistério', 'mystery']))
    const acao     = items.filter(m => hasAnyGenre(m, ['ação', 'action', 'aventura', 'adventure']))
    const drama    = items.filter(m => hasAnyGenre(m, ['drama']))
    const comedia  = items.filter(m => hasAnyGenre(m, ['comédia', 'comedy']))

    const joias = shuffle(items.filter(m =>
      (m.rating ?? 0) >= 7 && olderThanMonths(m, 6)
    ))

    const anos2010 = items
      .filter(m => { const y = parseInt(m.release_year ?? '0', 10); return y >= 2010 && y <= 2019 })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    const classicos = items
      .filter(m => { const y = parseInt(m.release_year ?? '0', 10); return y > 0 && y < 2000 })
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    const curtos = items
      .filter(m => m.tipo === 'filme' && (m.duration ?? 999) <= 90 && (m.duration ?? 0) > 0)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    const maratona = items
      .filter(m => m.tipo === 'filme' && (m.duration ?? 0) >= 150)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

    const naoAssistidos = items.filter(m => m.watched_status === 'nao_assistido')

    return [
      { title: 'Adicionados Recentemente',          items: recentes.slice(0, ROW_LIMIT)               },
      { title: '⭐ Os Melhores',                     items: melhores.slice(0, ROW_LIMIT)               },
      { title: '🎃 Terror',                          items: pickRandomSample(terror, ROW_LIMIT)        },
      { title: '🔪 Suspense',                        items: pickRandomSample(suspense, ROW_LIMIT)      },
      { title: '💥 Ação & Aventura',                 items: pickRandomSample(acao, ROW_LIMIT)          },
      { title: '🎭 Drama',                           items: pickRandomSample(drama, ROW_LIMIT)         },
      { title: '😂 Comédia',                         items: pickRandomSample(comedia, ROW_LIMIT)       },
      { title: '💎 Joias Escondidas',                items: joias.slice(0, ROW_LIMIT)                  },
      { title: '📼 Anos 2010',                       items: anos2010.slice(0, ROW_LIMIT)               },
      { title: '🎞️ Clássicos (antes de 2000)',       items: classicos.slice(0, ROW_LIMIT)              },
      { title: '⏱️ Curtos (até 90min)',               items: curtos.slice(0, ROW_LIMIT)                 },
      { title: '🍿 Maratona (2h30+)',                items: maratona.slice(0, ROW_LIMIT)               },
      { title: '🔍 Não Assistidos',                  items: pickRandomSample(naoAssistidos, ROW_LIMIT) },
    ].filter(row => row.items.length > 0)
  }, [items])

  if (loading) {
    return (
      <div style={{ background: theme.colors.bg, minHeight: '100vh' }}>
        <div style={{ height: '520px', position: 'relative' }}>
          <Skeleton height="100%" radius="0" />
          <div style={{
            position: 'absolute',
            bottom: theme.spacing.xxl,
            left: theme.layout.pagePadding,
            maxWidth: '500px',
            display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
          }}>
            <Skeleton width="80px" height="14px" />
            <Skeleton width="300px" height="48px" />
            <Skeleton width="100%" height="14px" />
            <Skeleton width="80%" height="14px" />
          </div>
        </div>
        <div style={{ paddingTop: theme.spacing.xl }}>
          <div style={{ padding: `0 ${theme.layout.pagePadding}`, marginBottom: theme.spacing.md }}>
            <Skeleton width="180px" height="20px" />
          </div>
          <MediaGridSkeleton count={6} layout="row" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '80vh', gap: theme.spacing.md,
        animation: 'pageIn 0.4s ease-out',
      }}>
        <div style={{ width: '140px', height: '140px', animation: 'float 3s ease-in-out infinite' }}>
          <CatSit style={{ width: '100%', height: '100%' }} />
        </div>
        <h2 style={{ fontSize: theme.fontSizes.h2, fontWeight: theme.fontWeights.bold }}>
          Catálogo vazio
        </h2>
        <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
          Clique em "+ Adicionar" para começar
        </p>
      </div>
    )
  }

  return (
    <div style={{ background: theme.colors.bg, minHeight: '100vh' }}>
      <HeroBanner
        items={items}
        onDetailsClick={setSelected}
        onAddToList={() => navigate('/listas')}
      />

      <div style={{ paddingTop: theme.spacing.xl }}>
        {rows.map(row => (
          <LazyMediaRow
            key={row.title}
            title={row.title}
            items={row.items}
            onCardClick={setSelected}
          />
        ))}
      </div>

      {selected && <DetailsModal media={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
