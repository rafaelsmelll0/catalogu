import { getDatabase } from './database.js'
import { getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'

export interface ImageUpdateProgress {
  current: number
  total:   number
  title:   string
  status:  'updating' | 'updated' | 'no_image' | 'no_tmdb' | 'error'
}

export interface ImageUpdateResult {
  updated: number
  skipped: number
  failed:  number
}

interface MediaToUpdate {
  id:            number
  title:         string
  tipo:          'filme' | 'serie'
  tmdb_id:       number | null
  cover_path:    string | null
  backdrop_path: string | null
}

export async function updateAllImages(
  onProgress: (p: ImageUpdateProgress) => void
): Promise<ImageUpdateResult> {
  const db = getDatabase()

  const items = db.prepare(`
    SELECT id, title, tipo, tmdb_id, cover_path, backdrop_path FROM media
    WHERE tmdb_id IS NOT NULL
      AND (
        cover_path    IS NULL OR cover_path    = '' OR
        backdrop_path IS NULL OR backdrop_path = ''
      )
    ORDER BY title
  `).all() as MediaToUpdate[]

  const result: ImageUpdateResult = { updated: 0, skipped: 0, failed: 0 }
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
      const details = item.tipo === 'filme'
        ? await getMovieDetails(item.tmdb_id)
        : await getTvDetails(item.tmdb_id)

      const newCover = (!item.cover_path && details.poster_path)
        ? getPosterUrl(details.poster_path, 'w500')
        : null

      const newBackdrop = (!item.backdrop_path && details.backdrop_path)
        ? getBackdropUrl(details.backdrop_path, 'w1280')
        : null

      if (!newCover && !newBackdrop) {
        onProgress({ current: i + 1, total, title: item.title, status: 'no_image' })
        result.skipped++
        continue
      }

      if (newCover && newBackdrop) {
        db.prepare('UPDATE media SET cover_path = ?, backdrop_path = ? WHERE id = ?')
          .run(newCover, newBackdrop, item.id)
      } else if (newCover) {
        db.prepare('UPDATE media SET cover_path = ? WHERE id = ?').run(newCover, item.id)
      } else if (newBackdrop) {
        db.prepare('UPDATE media SET backdrop_path = ? WHERE id = ?').run(newBackdrop, item.id)
      }

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
