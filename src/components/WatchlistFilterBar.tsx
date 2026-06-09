import { theme } from '../styles/theme.ts'
import { normalize } from '../lib/normalize.ts'
import { Input, Select, Button, GenreMultiSelect, type SelectOption } from './ui/index.ts'
import type { WatchlistItem } from '../types/index.ts'

export type WatchlistSortBy =
  | 'created_desc'
  | 'title_asc'
  | 'title_desc'
  | 'year_desc'
  | 'year_asc'

export interface WatchlistFilters {
  search: string
  tipo:   'todos' | 'filme' | 'serie'
  genres: string[]
  sortBy: WatchlistSortBy
}

export const DEFAULT_WATCHLIST_FILTERS: WatchlistFilters = {
  search: '',
  tipo:   'todos',
  genres: [],
  sortBy: 'created_desc',
}

const TIPO_OPTIONS: SelectOption<WatchlistFilters['tipo']>[] = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'filme', label: 'Filmes', color: '#8055d0' },
  { value: 'serie', label: 'Séries', color: '#54B9C5' },
]

const SORT_OPTIONS: SelectOption<WatchlistSortBy>[] = [
  { value: 'created_desc', label: 'Últimos adicionados' },
  { value: 'title_asc',    label: 'Título (A → Z)' },
  { value: 'title_desc',   label: 'Título (Z → A)' },
  { value: 'year_desc',    label: 'Mais novos' },
  { value: 'year_asc',     label: 'Mais antigos' },
]

interface Props {
  filters:      WatchlistFilters
  setFilters:   (f: Partial<WatchlistFilters>) => void
  resetFilters: () => void
  allItems:     WatchlistItem[]
  filtered:     WatchlistItem[]
}

export function WatchlistFilterBar({ filters, setFilters, resetFilters, allItems, filtered }: Props) {
  const allGenres = Array.from(
    new Set(allItems.flatMap(m => m.genres ?? []))
  ).sort()

  const hasActiveFilters =
    !!filters.search ||
    filters.tipo !== 'todos' ||
    filters.genres.length > 0 ||
    filters.sortBy !== 'created_desc'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
      flexWrap: 'wrap',
      marginBottom: theme.spacing.lg,
    }}>
      <Input
        icon="⌕"
        placeholder="Buscar..."
        value={filters.search}
        onChange={e => setFilters({ search: e.target.value })}
        style={{ width: '220px' }}
      />

      <div style={{ minWidth: '150px' }}>
        <Select
          options={TIPO_OPTIONS}
          value={filters.tipo}
          onChange={v => setFilters({ tipo: v })}
          fullWidth
        />
      </div>

      <div style={{ minWidth: '200px' }}>
        <GenreMultiSelect
          allGenres={allGenres}
          selected={filters.genres}
          onChange={genres => setFilters({ genres })}
          fullWidth
        />
      </div>

      <div style={{ minWidth: '190px' }}>
        <Select
          options={SORT_OPTIONS}
          value={filters.sortBy}
          onChange={v => setFilters({ sortBy: v })}
          fullWidth
        />
      </div>

      <span style={{
        fontSize: theme.fontSizes.small,
        color: theme.colors.textMuted,
        marginLeft: 'auto',
        fontWeight: theme.fontWeights.medium,
        whiteSpace: 'nowrap',
      }}>
        {filtered.length} de {allItems.length}
      </span>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          × Limpar
        </Button>
      )}
    </div>
  )
}

// -- Helper: aplica filtros e ordenação ----------------------------------------

export function applyWatchlistFilters(
  items: WatchlistItem[],
  filters: WatchlistFilters
): WatchlistItem[] {
  let result = items.filter(m => {
    if (filters.tipo !== 'todos' && m.tipo !== filters.tipo) return false

    if (filters.genres.length > 0) {
      const lower = (m.genres ?? []).map(g => g.toLowerCase())
      const match = filters.genres.every(fg =>
        lower.some(g => g.includes(fg.toLowerCase()))
      )
      if (!match) return false
    }

    if (filters.search.trim()) {
      const q = normalize(filters.search)
      const inTitle    = normalize(m.title).includes(q)
      const inDirector = normalize(m.director ?? '').includes(q)
      const inYear     = (m.release_year ?? '').includes(q)
      if (!inTitle && !inDirector && !inYear) return false
    }

    return true
  })

  result = [...result].sort((a, b) => {
    switch (filters.sortBy) {
      case 'title_asc':  return a.title.localeCompare(b.title, 'pt-BR')
      case 'title_desc': return b.title.localeCompare(a.title, 'pt-BR')
      case 'year_desc':  return (b.release_year ?? '').localeCompare(a.release_year ?? '')
      case 'year_asc':   return (a.release_year ?? '').localeCompare(b.release_year ?? '')
      case 'created_desc':
      default:           return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    }
  })

  return result
}
