import { getDatabase } from './database.js'
import { getMovieDetails, getBackdropUrl } from './tmdb.js'

export interface BackdropUpdateProgress {
  current: number
  total:   number
  title:   string
  status:  'updating' | 'updated' | 'no_backdrop' | 'no_tmdb' | 'error'
}

export interface BackdropUpdateResult {
  updated: number
  skipped: number
  failed:  number
}

interface MediaToUpdate {
  id:      number
  title:   string
  tmdb_id: number | null
}

export async function updateAllBackdrops(
  onProgress: (p: BackdropUpdateProgress) => void
): Promise<BackdropUpdateResult> {
  const db = getDatabase()

  const items = db.prepare(`
    SELECT id, title, tmdb_id FROM media
    WHERE tipo = 'filme' AND (backdrop_path IS NULL OR backdrop_path = '')
    ORDER BY title
  `).all() as MediaToUpdate[]

  const result: BackdropUpdateResult = { updated: 0, skipped: 0, failed: 0 }
  const total = items.length

  for (let i = 0; i < total; i++) {
    const item = items[i]

    if (!item.tmdb_id) {
      onProgress({ current: i + 1, total, title: item.title, status: 'no_tmdb' })
      result.skipped++
      continue
    }

    onProgress({ current: i + 1, total, title: item.title, status: 'updating' })

    try {
      const details = await getMovieDetails(item.tmdb_id)
      const backdropUrl = details.backdrop_path
        ? getBackdropUrl(details.backdrop_path, 'w1280')
        : null

      if (!backdropUrl) {
        onProgress({ current: i + 1, total, title: item.title, status: 'no_backdrop' })
        result.skipped++
        continue
      }

      db.prepare('UPDATE media SET backdrop_path = ? WHERE id = ?').run(backdropUrl, item.id)
      onProgress({ current: i + 1, total, title: item.title, status: 'updated' })
      result.updated++

      await new Promise(r => setTimeout(r, 200))
    } catch {
      result.failed++
      onProgress({ current: i + 1, total, title: item.title, status: 'error' })
    }
  }

  return result
}
