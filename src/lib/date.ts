/** Data de hoje no formato YYYY-MM-DD respeitando o fuso local (não UTC). */
export function todayLocal(): string {
  const d = new Date()
  const offsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10)
}

/** Formata uma data YYYY-MM-DD para exibição em pt-BR (DD/MM/AAAA). Vazio se nulo. */
export function formatDateBR(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}
