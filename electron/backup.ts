import Database from 'better-sqlite3'

/**
 * Backup / restauração do banco do Catalogu.
 *
 * Funções puras (sem Electron/IPC) para poderem ser testadas com Vitest.
 * O main.ts cuida dos diálogos e chama estas funções.
 */

export interface MergeResult {
  imported: number
  skipped: number
  watchlistImported: number
  watchlistSkipped: number
  listsCreated: number
}

/**
 * Exporta o banco usando a API de backup online do SQLite (via better-sqlite3).
 * Diferente de copiar o arquivo .db, isso inclui o conteúdo ainda no WAL.
 */
export async function exportBackup(db: Database.Database, destPath: string): Promise<void> {
  await db.backup(destPath)
}

// ─── Helpers de introspecção (backups antigos podem não ter tabelas/colunas) ───

function hasTable(db: Database.Database, name: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
}

function columnsOf(db: Database.Database, table: string): Set<string> {
  if (!hasTable(db, table)) return new Set()
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return new Set(rows.map(r => r.name))
}

function dateOnly(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v).slice(0, 10)
}

/** Monta um INSERT só com as colunas que existem no destino. */
function buildInsert(
  db: Database.Database,
  table: string,
  wanted: string[],
): { stmt: Database.Statement; cols: string[] } {
  const destCols = columnsOf(db, table)
  const cols = wanted.filter(c => destCols.has(c))
  const quoted = cols.map(c => `"${c}"`).join(', ')
  const params = cols.map(c => `@${c}`).join(', ')
  return { stmt: db.prepare(`INSERT INTO ${table} (${quoted}) VALUES (${params})`), cols }
}

function pick(row: Record<string, unknown>, cols: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of cols) out[c] = row[c] ?? null
  return out
}

const MEDIA_COLS = [
  'title', 'release_year', 'synopsis', 'observations', 'rating', 'duration', 'watched',
  'cover_path', 'cover_path_thumb', 'backdrop_path', 'tipo', 'watched_status', 'tmdb_id',
  'watched_date', 'created_at',
]

const WATCHLIST_COLS = [
  'title', 'tipo', 'release_year', 'synopsis', 'cover_path', 'backdrop_path', 'duration',
  'director', 'genres', 'cast', 'tmdb_id', 'created_at',
]

/**
 * Mescla um backup (.db) no banco atual, numa única transação.
 *
 * - media: pula duplicatas (tmdb_id+tipo, ou título+ano+tipo); gêneros/tags/pessoas
 *   são copiados só para os títulos importados.
 * - listas: casadas por nome (case-insensitive), criadas se faltarem; os vínculos
 *   são mesclados também para títulos que já existiam no destino.
 * - watchlist: pula se já está na watchlist ou se já está no catálogo (já assistido).
 *
 * cover_path/backdrop_path (inclusive refs locais catimg://) são copiados como estão.
 */
export function mergeBackup(destDb: Database.Database, srcPath: string): MergeResult {
  const srcDb = new Database(srcPath, { readonly: true, fileMustExist: true })
  try {
    if (!hasTable(srcDb, 'media')) {
      throw new Error('Arquivo não parece ser um backup do Catalogu (tabela media ausente).')
    }

    const result: MergeResult = {
      imported: 0, skipped: 0, watchlistImported: 0, watchlistSkipped: 0, listsCreated: 0,
    }

    const run = destDb.transaction(() => {
      // ── Statements do destino ──
      const findMediaByTmdb = destDb.prepare('SELECT id FROM media WHERE tmdb_id = ? AND tipo = ?')
      const findMediaByTitle = destDb.prepare(`
        SELECT id FROM media
        WHERE LOWER(title) = LOWER(?) AND COALESCE(release_year, '') = COALESCE(?, '') AND tipo = ?
      `)
      const findMedia = (m: any): number | undefined => {
        const row = (m.tmdb_id != null
          ? findMediaByTmdb.get(m.tmdb_id, m.tipo)
          : findMediaByTitle.get(m.title, m.release_year ?? null, m.tipo)) as { id: number } | undefined
        return row?.id
      }
      const mediaInsert = buildInsert(destDb, 'media', MEDIA_COLS)

      // ── media ──
      const mediaMap = new Map<number, number>()   // srcId → destId (importados + pulados)
      const importedSrcIds: number[] = []

      const srcMedia = srcDb.prepare('SELECT * FROM media').all() as any[]
      for (const m of srcMedia) {
        const existing = findMedia(m)
        if (existing !== undefined) {
          mediaMap.set(m.id, existing)
          result.skipped++
          continue
        }
        const row = {
          ...m,
          watched_status: m.watched_status ?? 'assistido',
          // Backups antigos não têm watched_date; usa a data de cadastro.
          watched_date: m.watched_date ?? dateOnly(m.created_at),
          created_at: m.created_at ?? new Date().toISOString(),
        }
        const info = mediaInsert.stmt.run(pick(row, mediaInsert.cols))
        mediaMap.set(m.id, Number(info.lastInsertRowid))
        importedSrcIds.push(m.id)
        result.imported++
      }

      // ── gêneros / tags / pessoas (só para os importados) ──
      const copyNamedLinks = (
        entityTable: string, linkTable: string, fkCol: string, extraCols: string[] = [],
      ) => {
        if (!hasTable(srcDb, entityTable) || !hasTable(srcDb, linkTable)) return
        if (importedSrcIds.length === 0) return
        const srcLinkCols = columnsOf(srcDb, linkTable)
        const extras = extraCols.filter(c => srcLinkCols.has(c))
        const upsert = destDb.prepare(`INSERT OR IGNORE INTO ${entityTable} (name) VALUES (?)`)
        const getId = destDb.prepare(`SELECT id FROM ${entityTable} WHERE name = ?`)
        const selectLinks = srcDb.prepare(`
          SELECT e.name AS name${extras.map(c => `, l."${c}" AS "${c}"`).join('')}
          FROM ${linkTable} l JOIN ${entityTable} e ON e.id = l.${fkCol}
          WHERE l.media_id = ?
        `)
        const insertCols = ['media_id', fkCol, ...extraCols]
        const insertLink = destDb.prepare(`
          INSERT OR IGNORE INTO ${linkTable} (${insertCols.join(', ')})
          VALUES (${insertCols.map(() => '?').join(', ')})
        `)
        const idCache = new Map<string, number>()
        for (const srcId of importedSrcIds) {
          const destMediaId = mediaMap.get(srcId)!
          for (const l of selectLinks.all(srcId) as any[]) {
            if (l.name == null) continue
            let entId = idCache.get(l.name)
            if (entId === undefined) {
              upsert.run(l.name)
              entId = (getId.get(l.name) as { id: number }).id
              idCache.set(l.name, entId)
            }
            // role é NOT NULL no destino; backups sem a coluna caem em 'actor'.
            const extraVals = extraCols.map(c => l[c] ?? (c === 'role' ? 'actor' : null))
            insertLink.run(destMediaId, entId, ...extraVals)
          }
        }
      }
      copyNamedLinks('genres', 'media_genres_link', 'genre_id')
      copyNamedLinks('tags', 'media_tags_link', 'tag_id')
      copyNamedLinks('people', 'media_people_link', 'person_id', ['role'])

      // ── listas ──
      const listMap = new Map<number, number>()   // srcListId → destListId
      if (hasTable(srcDb, 'lists')) {
        const srcListCols = columnsOf(srcDb, 'lists')
        const findList = destDb.prepare('SELECT id FROM lists WHERE LOWER(name) = LOWER(?)')
        const insertList = destDb.prepare('INSERT INTO lists (name, description) VALUES (?, ?)')
        for (const l of srcDb.prepare('SELECT * FROM lists').all() as any[]) {
          if (l.name == null) continue
          const found = findList.get(l.name) as { id: number } | undefined
          if (found) {
            listMap.set(l.id, found.id)
          } else {
            const desc = srcListCols.has('description') ? (l.description ?? null) : null
            const info = insertList.run(l.name, desc)
            listMap.set(l.id, Number(info.lastInsertRowid))
            result.listsCreated++
          }
        }

        if (hasTable(srcDb, 'media_lists_link')) {
          const insertMl = destDb.prepare(
            'INSERT OR IGNORE INTO media_lists_link (media_id, list_id) VALUES (?, ?)',
          )
          for (const link of srcDb.prepare('SELECT media_id, list_id FROM media_lists_link').all() as any[]) {
            const mId = mediaMap.get(link.media_id)
            const lId = listMap.get(link.list_id)
            if (mId !== undefined && lId !== undefined) insertMl.run(mId, lId)
          }
        }
      }

      // ── watchlist ──
      if (hasTable(srcDb, 'watchlist') && hasTable(destDb, 'watchlist')) {
        const findWlByTmdb = destDb.prepare('SELECT id FROM watchlist WHERE tmdb_id = ? AND tipo = ?')
        const findWlByTitle = destDb.prepare(`
          SELECT id FROM watchlist
          WHERE LOWER(title) = LOWER(?) AND COALESCE(release_year, '') = COALESCE(?, '') AND tipo = ?
        `)
        const wlInsert = buildInsert(destDb, 'watchlist', WATCHLIST_COLS)
        const wlMap = new Map<number, number>()

        for (const w of srcDb.prepare('SELECT * FROM watchlist').all() as any[]) {
          const dupWl = (w.tmdb_id != null
            ? findWlByTmdb.get(w.tmdb_id, w.tipo)
            : findWlByTitle.get(w.title, w.release_year ?? null, w.tipo)) as { id: number } | undefined
          if (dupWl) {
            // Já está em Próximos: mapeia para mesclar os vínculos de listas.
            wlMap.set(w.id, dupWl.id)
            result.watchlistSkipped++
            continue
          }
          if (findMedia(w) !== undefined) {
            // Já está no catálogo (já assistido): não volta para Próximos.
            result.watchlistSkipped++
            continue
          }
          const row = {
            ...w,
            genres: w.genres ?? '[]',
            cast: w.cast ?? '[]',
            created_at: w.created_at ?? new Date().toISOString(),
          }
          const info = wlInsert.stmt.run(pick(row, wlInsert.cols))
          wlMap.set(w.id, Number(info.lastInsertRowid))
          result.watchlistImported++
        }

        if (hasTable(srcDb, 'watchlist_lists_link') && hasTable(destDb, 'watchlist_lists_link')) {
          const insertWll = destDb.prepare(
            'INSERT OR IGNORE INTO watchlist_lists_link (watchlist_id, list_id) VALUES (?, ?)',
          )
          for (const link of srcDb.prepare('SELECT watchlist_id, list_id FROM watchlist_lists_link').all() as any[]) {
            const wId = wlMap.get(link.watchlist_id)
            const lId = listMap.get(link.list_id)
            if (wId !== undefined && lId !== undefined) insertWll.run(wId, lId)
          }
        }
      }
    })

    run()
    return result
  } finally {
    srcDb.close()
  }
}
