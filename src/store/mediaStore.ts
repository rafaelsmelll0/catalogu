import { create } from 'zustand'
import type { Media, MediaType, WatchedStatus } from '../types/index.ts'
import { showToast } from '../components/Toast.tsx'
import { normalize } from '../lib/normalize.ts'

export type SortBy =
  | 'title_asc'
  | 'title_desc'
  | 'rating_desc'
  | 'rating_asc'
  | 'year_desc'
  | 'year_asc'
  | 'created_desc'

export interface Filters {
  search:    string
  tipo:      MediaType | 'todos'
  status:    WatchedStatus | 'todos'
  genres:    string[]
  minRating: number
  sortBy:    SortBy
}

const DEFAULT_FILTERS: Filters = {
  search:    '',
  tipo:      'todos',
  status:    'todos',
  genres:    [],
  minRating: 0,
  sortBy:    'created_desc',
}

interface MediaStore {
  items:        Media[]
  loading:      boolean
  error:        string | null
  filters:      Filters
  fetchAll:     () => Promise<void>
  addMedia:     (input: Omit<Media, 'id' | 'created_at'>) => Promise<number>
  deleteMedia:  (id: number) => Promise<void>
  updateMedia:  (id: number, input: Partial<Media>) => Promise<void>
  setFilters:   (f: Partial<Filters>) => void
  resetFilters: () => void
  getFiltered:  () => Media[]
  getAllGenres:  () => string[]
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  items: [], loading: false, error: null, filters: DEFAULT_FILTERS,

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const items = await window.electronAPI.invoke('media:getAll') as Media[]
      set({ items, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  addMedia: async (input) => {
    try {
      const id = await window.electronAPI.invoke('media:add', input) as number
      await get().fetchAll()
      showToast(`"${input.title}" adicionado com sucesso!`)
      return id
    } catch {
      showToast('Erro ao adicionar mídia.', 'error')
      throw new Error('Erro ao adicionar')
    }
  },

  deleteMedia: async (id) => {
    try {
      const item = get().items.find(m => m.id === id)
      await window.electronAPI.invoke('media:delete', id)
      await get().fetchAll()
      showToast(`"${item?.title ?? 'Item'}" removido.`, 'info')
    } catch {
      showToast('Erro ao remover.', 'error')
    }
  },

  updateMedia: async (id, input) => {
    try {
      await window.electronAPI.invoke('media:update', id, input)
      await get().fetchAll()
      showToast('Alterações salvas!')
    } catch {
      showToast('Erro ao salvar alterações.', 'error')
      throw new Error('Erro ao atualizar')
    }
  },

  setFilters:   (f) => set(s => ({ filters: { ...s.filters, ...f } })),
  resetFilters: ()  => set({ filters: DEFAULT_FILTERS }),

  getAllGenres: () => {
    const { items } = get()
    const seen = new Set<string>()
    items.forEach(m => (m.genres ?? []).forEach(g => seen.add(g)))
    return Array.from(seen).sort()
  },

  getFiltered: () => {
    const { items, filters } = get()

    let result = items.filter(m => {
      if (filters.tipo   !== 'todos' && m.tipo           !== filters.tipo)   return false
      if (filters.status !== 'todos' && m.watched_status !== filters.status) return false

      if (filters.genres.length > 0) {
        const mediaGenres = (m.genres ?? []).map(g => g.toLowerCase())
        const allMatch = filters.genres.every(fg =>
          mediaGenres.some(mg => mg.includes(fg.toLowerCase()))
        )
        if (!allMatch) return false
      }

      if (filters.minRating > 0 && (m.rating ?? 0) < filters.minRating) return false

      if (filters.search) {
        const q = normalize(filters.search)
        if (!normalize(m.title).includes(q)) return false
      }

      return true
    })

    result = [...result].sort((a, b) => {
      switch (filters.sortBy) {
        case 'title_asc':    return a.title.localeCompare(b.title, 'pt-BR')
        case 'title_desc':   return b.title.localeCompare(a.title, 'pt-BR')
        case 'rating_desc':  return (b.rating ?? 0) - (a.rating ?? 0)
        case 'rating_asc':   return (a.rating ?? 0) - (b.rating ?? 0)
        case 'year_desc':    return (b.release_year ?? '').localeCompare(a.release_year ?? '')
        case 'year_asc':     return (a.release_year ?? '').localeCompare(b.release_year ?? '')
        case 'created_desc':
        default:             return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      }
    })

    return result
  },
}))
