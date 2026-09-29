import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { theme } from '../styles/theme.ts'
import type { Media, MediaType, WatchedStatus, WatchlistItem } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { normalize } from '../lib/normalize.ts'
import { Modal, Badge } from './ui/index.ts'

/**
 * Busca global (Ctrl+K): procura no catálogo e em Próximos por título, diretor,
 * elenco, tags, gêneros, ano, observações e sinopse — sem acento e sem caixa.
 * Com várias palavras, todas precisam aparecer em algum campo do item.
 */

export type PaletteSelection =
  | { kind: 'media';   media: Media }
  | { kind: 'proximo'; item: WatchlistItem }

interface Props {
  open:     boolean
  onClose:  () => void
  onSelect: (sel: PaletteSelection) => void
}

// ─── Índice normalizado ──────────────────────────────────────────────────────

interface Field { raw: string; norm: string }

interface Entry {
  key:          string
  sel:          PaletteSelection
  title:        string
  titleNorm:    string
  year:         string
  tipo:         MediaType
  cover?:       string
  rating:       number
  status?:      WatchedStatus
  director:     Field | null
  cast:         Field[]
  tags:         Field[]
  genres:       Field[]
  observations: Field | null
  synopsis:     Field | null
}

function field(raw?: string | null): Field | null {
  const r = raw?.trim()
  return r ? { raw: r, norm: normalize(r) } : null
}

function fields(list?: string[] | null): Field[] {
  return (list ?? []).map(s => field(s)).filter((f): f is Field => f !== null)
}

function mediaEntry(m: Media): Entry {
  return {
    key: `m${m.id}`, sel: { kind: 'media', media: m },
    title: m.title, titleNorm: normalize(m.title), year: m.release_year ?? '',
    tipo: m.tipo, cover: m.cover_path, rating: m.rating ?? 0, status: m.watched_status,
    director: field(m.director), cast: fields(m.cast), tags: fields(m.tags), genres: fields(m.genres),
    observations: field(m.observations), synopsis: field(m.synopsis),
  }
}

function proximoEntry(w: WatchlistItem): Entry {
  return {
    key: `p${w.id}`, sel: { kind: 'proximo', item: w },
    title: w.title, titleNorm: normalize(w.title), year: w.release_year ?? '',
    tipo: w.tipo, cover: w.cover_path, rating: 0,
    director: field(w.director), cast: fields(w.cast), tags: [], genres: fields(w.genres),
    observations: null, synopsis: field(w.synopsis),
  }
}

// ─── Casamento e ranking ─────────────────────────────────────────────────────

type ReasonField = 'director' | 'cast' | 'tags' | 'genres' | 'year' | 'observations' | 'synopsis'

const WEIGHTS: Record<ReasonField, number> = {
  director: 60, cast: 50, tags: 45, genres: 40, year: 35, observations: 20, synopsis: 10,
}
const REASON_ORDER: ReasonField[] = ['director', 'cast', 'tags', 'genres', 'year', 'observations', 'synopsis']

interface Reason { field: ReasonField; words: string[] }

interface Hit {
  entry:   Entry
  score:   number
  reasons: Reason[]
}

function titleScore(titleNorm: string, w: string): number {
  if (titleNorm.startsWith(w)) return 120
  const i = titleNorm.indexOf(w)
  if (i < 0) return 0
  return /[^a-z0-9]/.test(titleNorm[i - 1]) ? 100 : 80
}

function fieldHas(e: Entry, f: ReasonField, w: string): boolean {
  switch (f) {
    case 'director':     return !!e.director?.norm.includes(w)
    case 'cast':         return e.cast.some(c => c.norm.includes(w))
    case 'tags':         return e.tags.some(t => t.norm.includes(w))
    case 'genres':       return e.genres.some(g => g.norm.includes(w))
    case 'year':         return !!e.year && e.year.includes(w)
    case 'observations': return !!e.observations?.norm.includes(w)
    case 'synopsis':     return !!e.synopsis?.norm.includes(w)
  }
}

function matchEntry(e: Entry, q: string, words: string[]): Hit | null {
  let score = 0
  const reasonWords = new Map<ReasonField, string[]>()

  for (const w of words) {
    // O título vale mais que qualquer outro campo; senão vale o campo mais forte.
    const ts = titleScore(e.titleNorm, w)
    if (ts > 0) { score += ts; continue }
    const f = REASON_ORDER.find(f => fieldHas(e, f, w))
    if (!f) return null
    score += WEIGHTS[f]
    reasonWords.set(f, [...(reasonWords.get(f) ?? []), w])
  }

  if (e.titleNorm === q)              score += 500
  else if (e.titleNorm.startsWith(q)) score += 300
  else if (e.titleNorm.includes(q))   score += 100

  const reasons = REASON_ORDER
    .filter(f => reasonWords.has(f))
    .slice(0, 2)
    .map(f => ({ field: f, words: reasonWords.get(f)! }))

  return { entry: e, score, reasons }
}

const MAX_RESULTS = 40
const RECENT_COUNT = 8

// ─── Destaque do termo (mapeando o texto normalizado de volta ao original) ────

function normWithMap(raw: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let i = 0
  for (const ch of raw) {
    const n = normalize(ch)
    for (let k = 0; k < n.length; k++) { norm += n[k]; map.push(i) }
    i += ch.length
  }
  map.push(raw.length)
  return { norm, map }
}

function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>
  const { norm, map } = normWithMap(text)

  const ranges: [number, number][] = []
  for (const w of words) {
    let from = 0
    while (w && from <= norm.length) {
      const idx = norm.indexOf(w, from)
      if (idx < 0) break
      const end = idx + w.length
      ranges.push([map[idx], Math.max(map[end], map[end - 1] + 1)])
      from = end
    }
  }
  if (ranges.length === 0) return <>{text}</>

  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }

  const parts: ReactNode[] = []
  let pos = 0
  merged.forEach(([s, e], i) => {
    if (s > pos) parts.push(text.slice(pos, s))
    parts.push(
      <span key={i} style={{ color: theme.colors.primaryMuted, fontWeight: theme.fontWeights.bold }}>
        {text.slice(s, e)}
      </span>,
    )
    pos = e
  })
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts}</>
}

/** Trecho de ~80 caracteres em volta da primeira ocorrência de uma das palavras. */
function snippet(f: Field, words: string[]): string {
  const { norm, map } = normWithMap(f.raw)
  let hit = -1
  for (const w of words) {
    const i = norm.indexOf(w)
    if (i >= 0 && (hit < 0 || i < hit)) hit = i
  }
  const raw = f.raw
  const at = hit >= 0 ? map[hit] : 0
  let start = Math.max(0, at - 30)
  let end = Math.min(raw.length, start + 80)
  if (end - start < 80) start = Math.max(0, end - 80)
  if (start > 0) {
    const sp = raw.indexOf(' ', start)
    if (sp >= 0 && sp < at) start = sp + 1
  }
  if (end < raw.length) {
    const sp = raw.lastIndexOf(' ', end)
    if (sp > at + 10) end = sp
  }
  const body = raw.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${body}${end < raw.length ? '…' : ''}`
}

function ReasonLine({ entry, reason }: { entry: Entry; reason: Reason }) {
  const { field: f, words } = reason
  const pick = (list: Field[]) => list.filter(x => words.some(w => x.norm.includes(w)))

  let label: string
  let text: string
  switch (f) {
    case 'director':
      label = 'Diretor'; text = entry.director!.raw; break
    case 'cast': {
      const hits = pick(entry.cast).slice(0, 3)
      label = 'Elenco'; text = hits.map(h => h.raw).join(', '); break
    }
    case 'tags': {
      const hits = pick(entry.tags)
      label = hits.length > 1 ? 'Tags' : 'Tag'; text = hits.map(h => h.raw).join(', '); break
    }
    case 'genres': {
      const hits = pick(entry.genres)
      label = hits.length > 1 ? 'Gêneros' : 'Gênero'; text = hits.map(h => h.raw).join(', '); break
    }
    case 'year':
      label = 'Ano'; text = entry.year; break
    case 'observations':
      label = 'Sua observação'; text = snippet(entry.observations!, words); break
    case 'synopsis':
      label = 'Sinopse'; text = snippet(entry.synopsis!, words); break
  }

  return (
    <div style={{
      fontSize: theme.fontSizes.small, color: theme.colors.textMuted,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: theme.colors.textSecondary }}>{label}:</span>{' '}
      <Highlight text={text} words={words} />
    </div>
  )
}

// ─── Linha de resultado ──────────────────────────────────────────────────────

const STATUS_HINT: Partial<Record<WatchedStatus, string>> = {
  assistindo:    'Assistindo',
  nao_assistido: 'Não assistido',
  nao_lembro:    'Não lembro',
}

function Poster({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div style={{
      width: '32px', height: '48px', flexShrink: 0,
      borderRadius: theme.radius.sm, overflow: 'hidden',
      background: theme.gradients.primary,
    }}>
      {src && !failed && (
        <img
          src={src} alt="" loading="lazy" onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
    </div>
  )
}

interface RowProps {
  hit:      Hit
  words:    string[]
  selected: boolean
  onHover:  () => void
  onOpen:   () => void
  rowRef:   (el: HTMLDivElement | null) => void
}

function ResultRow({ hit, words, selected, onHover, onOpen, rowRef }: RowProps) {
  const e = hit.entry
  const status = e.status ? STATUS_HINT[e.status] : undefined
  return (
    <div
      ref={rowRef}
      onMouseMove={() => { if (!selected) onHover() }}
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: theme.spacing.md,
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        cursor: 'pointer',
        background: selected ? theme.colors.surfaceHover : 'transparent',
        borderLeft: `3px solid ${selected ? theme.colors.primary : 'transparent'}`,
      }}
    >
      <Poster src={e.cover} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{
          fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary,
          fontWeight: theme.fontWeights.medium,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <Highlight text={e.title} words={words} />
          {e.year && <span style={{ color: theme.colors.textMuted, fontWeight: theme.fontWeights.regular }}> ({e.year})</span>}
        </div>
        {hit.reasons.map(r => <ReasonLine key={r.field} entry={e} reason={r} />)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0 }}>
        {status && (
          <span style={{
            fontSize: theme.fontSizes.tiny,
            color: e.status ? theme.colors.statusColors[e.status] : theme.colors.textMuted,
          }}>
            {status}
          </span>
        )}
        {e.rating > 0 && (
          <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.warning, fontWeight: theme.fontWeights.bold }}>
            ★ {e.rating.toFixed(1)}
          </span>
        )}
        {e.sel.kind === 'proximo' && <Badge size="sm" variant="muted">Próximo</Badge>}
        <Badge size="sm" customColor={theme.colors.typeColors[e.tipo]}>
          {e.tipo === 'filme' ? 'Filme' : 'Série'}
        </Badge>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: `${theme.spacing.sm} ${theme.spacing.lg} ${theme.spacing.xs}`,
      fontSize: theme.fontSizes.tiny, fontWeight: theme.fontWeights.bold,
      color: theme.colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>
      {children}
    </div>
  )
}

// ─── Paleta ──────────────────────────────────────────────────────────────────

export function SearchPalette({ open, onClose, onSelect }: Props) {
  const mediaItems   = useMediaStore(s => s.items)
  const mediaLoading = useMediaStore(s => s.loading)
  const fetchMedia   = useMediaStore(s => s.fetchAll)
  const watchItems   = useWatchlistStore(s => s.items)
  const fetchWatch   = useWatchlistStore(s => s.fetchAll)

  const [query, setQuery]       = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs  = useRef<(HTMLDivElement | null)[]>([])

  // Garante os dados ao abrir (a paleta pode ser aberta de qualquer tela).
  useEffect(() => {
    if (!open) return
    if (useMediaStore.getState().items.length === 0) void fetchMedia()
    if (useWatchlistStore.getState().items.length === 0) void fetchWatch()
    // Mantém a última busca, mas selecionada: digitar substitui.
    requestAnimationFrame(() => inputRef.current?.select())
  }, [open, fetchMedia, fetchWatch])

  const mediaIndex = useMemo(() => mediaItems.map(mediaEntry), [mediaItems])
  const watchIndex = useMemo(() => watchItems.map(proximoEntry), [watchItems])

  const q = normalize(query.trim()).replace(/\s+/g, ' ')
  const words = useMemo(() => (q ? q.split(' ') : []), [q])

  const result = useMemo(() => {
    if (!q) {
      return {
        sections: [{ title: 'Adicionados recentemente', count: -1, hits: mediaIndex.slice(0, RECENT_COUNT).map(entry => ({ entry, score: 0, reasons: [] })) }],
        total: 0,
      }
    }
    const all: Hit[] = []
    for (const e of mediaIndex) { const h = matchEntry(e, q, words); if (h) all.push(h) }
    for (const e of watchIndex) { const h = matchEntry(e, q, words); if (h) all.push(h) }
    all.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'pt-BR'))

    const top = all.slice(0, MAX_RESULTS)
    const catalog  = top.filter(h => h.entry.sel.kind === 'media')
    const proximos = top.filter(h => h.entry.sel.kind === 'proximo')
    const sections = [
      { title: 'Catálogo', count: all.filter(h => h.entry.sel.kind === 'media').length, hits: catalog },
      { title: 'Próximos', count: all.filter(h => h.entry.sel.kind === 'proximo').length, hits: proximos },
    ].filter(s => s.hits.length > 0)
    return { sections, total: all.length }
  }, [q, words, mediaIndex, watchIndex])

  const flat = useMemo(() => result.sections.flatMap(s => s.hits), [result])

  useEffect(() => { setSelected(0) }, [q])

  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  function openHit(h: Hit | undefined) {
    if (!h) return
    onClose()
    onSelect(h.entry.sel)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length) setSelected(s => (s + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length) setSelected(s => (s - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      openHit(flat[selected])
    }
  }

  const loadingEmpty = mediaLoading && mediaItems.length === 0
  let offset = 0

  return (
    <Modal open={open} onClose={onClose} hideHeader width="720px">
      <div style={{ display: 'flex', flexDirection: 'column', height: 'min(600px, 78vh)' }}>
        {/* Campo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: theme.spacing.md,
          padding: `${theme.spacing.md} ${theme.spacing.lg}`,
          borderBottom: `1px solid ${theme.colors.surfaceHover}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '24px', color: theme.colors.textMuted, lineHeight: 1 }}>⌕</span>
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar filmes, séries, pessoas, tags, observações…"
            spellCheck={false}
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              color: theme.colors.textPrimary,
              fontSize: theme.fontSizes.h3, fontFamily: theme.fonts.sans,
              padding: `${theme.spacing.xs} 0`,
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: theme.colors.textMuted, fontSize: theme.fontSizes.small,
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {/* Resultados */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `${theme.spacing.sm} 0` }}>
          {!q && (
            <div style={{
              padding: `${theme.spacing.xs} ${theme.spacing.lg} ${theme.spacing.sm}`,
              fontSize: theme.fontSizes.small, color: theme.colors.textMuted,
            }}>
              Dica: busque por título, diretor, ator, tag ou por algo que você escreveu nas observações.
            </div>
          )}

          {loadingEmpty && flat.length === 0 && (
            <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              Carregando catálogo…
            </div>
          )}

          {!loadingEmpty && q && flat.length === 0 && (
            <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              Nada encontrado para “{query.trim()}”.
            </div>
          )}

          {result.sections.map(section => {
            const start = offset
            offset += section.hits.length
            return (
              <div key={section.title} style={{ marginBottom: theme.spacing.sm }}>
                <SectionHeader>
                  {section.title}{section.count >= 0 && ` · ${section.count}`}
                </SectionHeader>
                {section.hits.map((hit, i) => {
                  const idx = start + i
                  return (
                    <ResultRow
                      key={hit.entry.key}
                      hit={hit}
                      words={words}
                      selected={idx === selected}
                      onHover={() => setSelected(idx)}
                      onOpen={() => openHit(hit)}
                      rowRef={el => { rowRefs.current[idx] = el }}
                    />
                  )
                })}
              </div>
            )
          })}

          {result.total > MAX_RESULTS && (
            <div style={{ padding: `${theme.spacing.xs} ${theme.spacing.lg}`, fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
              Mostrando os {MAX_RESULTS} mais relevantes de {result.total}. Refine a busca para ver outros.
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          display: 'flex', gap: theme.spacing.lg,
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          borderTop: `1px solid ${theme.colors.surfaceHover}`,
          fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted,
          flexShrink: 0,
        }}>
          <span>↑ ↓ navegar</span>
          <span>Enter abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </Modal>
  )
}
