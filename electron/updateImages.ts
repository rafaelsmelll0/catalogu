import { getDatabase } from './database.js'
import { getMovieDetails, getTvDetails, getPosterUrl, getBackdropUrl } from './tmdb.js'
import { localizeRemoteImage, localImageExists } from './imageStore.js'

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

interface ItemToUpdate {
  table:         'media' | 'watchlist'
  id:            number
  title:         string
  tipo:          'filme' | 'serie'
  tmdb_id:       number | null
  cover_path:    string | null
  backdrop_path: string | null
}

/**
 * Garante que capa e fundo de cada título (catálogo e Próximos) sejam webp locais
 * que existem em disco. Preenche o que falta pelo TMDB, converte URLs remotas e
 * rebaixa imagens locais cujo arquivo sumiu (ex.: backup restaurado em outro PC).
 */
export async function updateAllImages(
  onProgress: (p: ImageUpdateProgress) => void
): Promise<ImageUpdateResult> {
  const db = getDatabase()

  const items: ItemToUpdate[] = (['media', 'watchlist'] as const).flatMap(table =>
    (db.prepare(`
      SELECT id, title, tipo, tmdb_id, cover_path, backdrop_path FROM ${table}
      ORDER BY title
    `).all() as Omit<ItemToUpdate, 'table'>[]).map(row => ({ ...row, table })),
  )

  const result: ImageUpdateResult = { updated: 0, skipped: 0, failed: 0 }
  const candidates = items.filter(it =>
    !localImageExists(it.cover_path) || !localImageExists(it.backdrop_path),
  )
  const total = candidates.length

  for (let i = 0; i < total; i++) {
    const item = candidates[i]
    onProgress({ current: i + 1, total, title: item.title, status: 'updating' })

    try {
      // 1) Descobre as URLs: local válida fica; remota é convertida; vazia ou
      //    local quebrada é buscada de novo no TMDB.
      const coverOk    = localImageExists(item.cover_path)
      const backdropOk = localImageExists(item.backdrop_path)
      let coverUrl     = coverOk    ? null : remoteOrNull(item.cover_path)
      let backdropUrl  = backdropOk ? null : remoteOrNull(item.backdrop_path)

      const needsCover    = !coverOk    && !coverUrl
      const needsBackdrop = !backdropOk && !backdropUrl

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
      const newCover    = coverUrl    ? await localizeRemoteImage(coverUrl, 'poster')      : null
      const newBackdrop = backdropUrl ? await localizeRemoteImage(backdropUrl, 'backdrop') : null

      if (!newCover && !newBackdrop) {
        onProgress({ current: i + 1, total, title: item.title, status: item.tmdb_id ? 'no_image' : 'no_tmdb' })
        result.skipped++
        continue
      }

      if (newCover) {
        db.prepare(`UPDATE ${item.table} SET cover_path = ? WHERE id = ?`).run(newCover, item.id)
      }
      if (newBackdrop) {
        db.prepare(`UPDATE ${item.table} SET backdrop_path = ? WHERE id = ?`).run(newBackdrop, item.id)
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

function remoteOrNull(p: string | null): string | null {
  return p && p.startsWith('http') ? p : null
}
