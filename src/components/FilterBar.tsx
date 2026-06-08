import { theme } from '../styles/theme.ts'
import { useMediaStore, type Filters, type SortBy } from '../store/mediaStore.ts'
import { Input, Select, Button, GenreMultiSelect, type SelectOption } from './ui/index.ts'

interface Props {
  showTipoFilter?: boolean
  lockedFilters?:  Partial<Filters>
}

const STATUS_OPTIONS: SelectOption<Filters['status']>[] = [
  { value: 'todos',         label: 'Todos os status' },
  { value: 'assistido',     label: 'Assistido',     color: '#46D369' },
  { value: 'assistindo',    label: 'Assistindo',    color: '#8055d0' },
  { value: 'nao_assistido', label: 'Não assistido', color: '#808080' },
  { value: 'nao_lembro',    label: 'Não lembro',    color: '#F5A623' },
]

const TIPO_OPTIONS: SelectOption<Filters['tipo']>[] = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'filme', label: 'Filmes', color: '#8055d0' },
  { value: 'serie', label: 'Séries', color: '#54B9C5' },
]

const RATING_OPTIONS: SelectOption<number>[] = [
  { value: 0, label: 'Qualquer nota' },
  { value: 5, label: '★ 5+' },
  { value: 6, label: '★ 6+' },
  { value: 7, label: '★ 7+' },
  { value: 8, label: '★ 8+' },
  { value: 9, label: '★ 9+' },
]

const SORT_OPTIONS: SelectOption<SortBy>[] = [
  { value: 'created_desc', label: 'Últimos adicionados' },
  { value: 'title_asc',    label: 'Título (A → Z)' },
  { value: 'title_desc',   label: 'Título (Z → A)' },
  { value: 'rating_desc',  label: 'Maior nota' },
  { value: 'rating_asc',   label: 'Menor nota' },
  { value: 'year_desc',    label: 'Mais novos' },
  { value: 'year_asc',     label: 'Mais antigos' },
]

export function FilterBar({ showTipoFilter = false, lockedFilters }: Props) {
  const { filters, setFilters, resetFilters, getFiltered, items, getAllGenres } = useMediaStore()
  const filtered  = getFiltered()
  const allGenres = getAllGenres()

  const hasActiveFilters =
    !!filters.search ||
    filters.status !== 'todos' ||
    filters.genres.length > 0 ||
    filters.minRating > 0 ||
    filters.sortBy !== 'created_desc' ||
    (showTipoFilter && filters.tipo !== 'todos')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
      flexWrap: 'wrap',
      padding: `${theme.spacing.sm} ${theme.layout.pagePadding}`,
      marginBottom: theme.spacing.md,
    }}>
      <Input
        icon="⌕"
        placeholder="Buscar..."
        value={filters.search}
        onChange={e => setFilters({ search: e.target.value })}
        style={{ width: '220px' }}
      />

      {showTipoFilter && (
        <div style={{ minWidth: '150px' }}>
          <Select options={TIPO_OPTIONS} value={filters.tipo}
            onChange={v => setFilters({ tipo: v })} fullWidth />
        </div>
      )}

      <div style={{ minWidth: '170px' }}>
        <Select options={STATUS_OPTIONS} value={filters.status}
          onChange={v => setFilters({ status: v })} fullWidth />
      </div>

      <div style={{ minWidth: '130px' }}>
        <Select options={RATING_OPTIONS} value={filters.minRating}
          onChange={v => setFilters({ minRating: v })} fullWidth />
      </div>

      {/* Gêneros — multi-select */}
      <div style={{ minWidth: '200px' }}>
        <GenreMultiSelect
          allGenres={allGenres}
          selected={filters.genres}
          onChange={genres => setFilters({ genres })}
          fullWidth
        />
      </div>

      <div style={{ minWidth: '190px' }}>
        <Select options={SORT_OPTIONS} value={filters.sortBy}
          onChange={v => setFilters({ sortBy: v })} fullWidth />
      </div>

      <span style={{
        fontSize: theme.fontSizes.small,
        color: theme.colors.textMuted,
        marginLeft: 'auto',
        fontWeight: theme.fontWeights.medium,
        whiteSpace: 'nowrap',
      }}>
        {filtered.length} de {items.length}
      </span>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={() => {
          resetFilters()
          if (lockedFilters) setFilters(lockedFilters)
        }}>× Limpar</Button>
      )}
    </div>
  )
}
