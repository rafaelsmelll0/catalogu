import { create } from 'zustand'
import type { WatchlistItem } from '../types/index.ts'
import { showToast } from '../components/Toast.tsx'

interface WatchlistStore {
  items:      WatchlistItem[]
  loading:    boolean
  fetchAll:   () => Promise<void>
  addItem:    (input: Omit<WatchlistItem, 'id' | 'created_at'>) => Promise<void>
  removeItem: (id: number) => Promise<void>
}

export const useWatchlistStore = create<WatchlistStore>((set, get) => ({
  items:   [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true })
    try {
      const items = await window.electronAPI.invoke('watchlist:getAll') as WatchlistItem[]
      set({ items, loading: false })
    } catch (err) {
      console.error('[watchlistStore.fetchAll]', err)
      set({ loading: false })
    }
  },

  addItem: async (input) => {
    const res = await window.electronAPI.invoke('watchlist:add', input) as { success: boolean; error?: string; id?: number }
    if (!res.success) {
      if (res.error === 'duplicate') showToast(`"${input.title}" já está na lista Próximos.`, 'info')
      return
    }
    showToast(`"${input.title}" adicionado em Próximos!`)
    await get().fetchAll()
  },

  removeItem: async (id) => {
    const item = get().items.find(i => i.id === id)
    await window.electronAPI.invoke('watchlist:remove', id)
    showToast(`"${item?.title ?? 'Item'}" removido de Próximos.`, 'info')
    await get().fetchAll()
  },
}))
