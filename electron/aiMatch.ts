/**
 * Conferência das sugestões da IA contra o TMDB. Puro (sem rede), para testes.
 */

export interface MatchCandidate {
  id:            number
  title:         string
  originalTitle: string
  year:          string
  voteCount:     number
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Títulos "batem" se iguais normalizados ou se um contém o outro (subtítulos nacionais). */
export function titlesMatch(a: string, b: string): boolean {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length >= 4 && (long.startsWith(short + ' ') || long.endsWith(' ' + short) || long.includes(' ' + short + ' '))
}

export function pickCandidate<T extends MatchCandidate>(cands: T[], query: string, year?: number): T | null {
  const ok = cands.filter(c =>
    (titlesMatch(query, c.title) || titlesMatch(query, c.originalTitle)) &&
    (!year || !c.year || Math.abs(Number(c.year) - year) <= 1),
  )
  ok.sort((a, b) => b.voteCount - a.voteCount)
  return ok[0] ?? null
}
