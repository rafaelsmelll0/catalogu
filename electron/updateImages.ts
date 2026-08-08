import { getDatabase } from './database.js'
import { getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'
import { localizeRemoteImage, isLocalImage } from './imageStore.js'

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

  // Pega todo mundo que ou tem imagem faltando, ou tem imagem que ainda não é
  // local (URL do TMDB) — esses são os candidatos a preencher e/ou converter em webp local.
  const items = db.prepare(`
    SELECT id, title, tipo, tmdb_id, cover_path, backdrop_path FROM media
    ORDER BY title
  `).all() as MediaToUpdate[]

  const result: ImageUpdateResult = { updated: 0, skipped: 0, failed: 0 }
  const candidates = items.filter(it =>
    !isLocalImage(it.cover_path)    ||
    !isLocalImage(it.backdrop_path)
  )
  const total = candidates.length

  for (let i = 0; i < total; i++) {
    const item = candidates[i]
    onProgress({ current: i + 1, total, title: item.title, status: 'updating' })

    try {
      // 1) Descobre as melhores URLs (mantém a local se já for; busca no TMDB se faltar).
      let coverUrl    = item.cover_path
      let backdropUrl = item.backdrop_path

      const needsCover    = !isLocalImage(coverUrl)    && (!coverUrl    || coverUrl.startsWith('http') === false)
      const needsBackdrop = !isLocalImage(backdropUrl) && (!backdropUrl || backdropUrl.startsWith('http') === false)

      if ((needsCover || needsBackdrop) && item.tmdb_id) {
        const details = item.tipo === 'filme'
          ? await getMovieDetails(item.tmdb_id)
          : await getTvDetails(item.tmdb_id)
        if (needsCover && details.poster_path) {
          coverUrl = getPosterUrl(details.poster_path, 'w500')
        }
        if (needsBackdrop && details.backdrop_path) {
          backdropUrl = getBackdropUrl(details.backdrop_path, 'w1280')
        }
      }

      // 2) Converte para webp local o que for URL remota.
      const newCover    = isLocalImage(coverUrl)    ? null : await localizeRemoteImage(coverUrl, 'poster')
      const newBackdrop = isLocalImage(backdropUrl) ? null : await localizeRemoteImage(backdropUrl, 'backdrop')

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

      await new Promise(r => setTimeout(r, 150))
    } catch {
      result.failed++
      onProgress({ current: i + 1, total, title: item.title, status: 'error' })
    }
  }

  return result
}
