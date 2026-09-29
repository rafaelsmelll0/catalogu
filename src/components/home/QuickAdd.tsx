import { useEffect, useMemo, useRef, useState } from 'react'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import type { AiResult, Media, TmdbMultiResult, WatchlistItem } from '../../types/index.ts'
import { useMediaStore } from '../../store/mediaStore.ts'
import { useWatchlistStore } from '../../store/watchlistStore.ts'
import { useEscapeLayer } from '../../hooks/useEscapeLayer.ts'
import { Badge, Button } from '../ui/index.ts'
import { showToast } from '../Toast.tsx'
import { MarkAsWatchedModal, type WatchedFields } from '../MarkAsWatchedModal.tsx'
import { DetailsModal } from '../DetailsModal.tsx'

type Owned =
  | { kind: 'catalog'; media: Media }
  | { kind: 'proximo'; item: WatchlistItem }
  | null

/**
 * "O que você assistiu?" — busca no TMDB (filmes e séries juntos) direto na Início
 * e registra no catálogo com nota e opinião em dois passos.
 */
export function QuickAdd() {
  const catalog   = useMediaStore(s => s.items)
  const watchlist = useWatchlistStore(s => s.items)
  const fetchWatchlist = useWatchlistStore(s => s.fetchAll)

  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<TmdbMultiResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen]         = useState(false)
  const [active, setActive]     = useState(0)
  const [busy, setBusy]         = useState<number | null>(null)

  const [registering, setRegistering] = useState<TmdbMultiResult | null>(null)
  const [promoting, setPromoting]     = useState<WatchlistItem | null>(null)
  const [viewing, setViewing]         = useState<Media | null>(null)

  const boxRef = useRef<HTMLDivElement>(null)
  const reqId  = useRef(0)

  // Busca com espera curta; respostas antigas são ignoradas (digitar rápido não embaralha)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }
    const id = ++reqId.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await ipc<TmdbMultiResult[]>('tmdb:searchMulti', q)
        if (id !== reqId.current) return
        setResults(r)
        setActive(0)
        setOpen(true)
      } catch {
        if (id === reqId.current) setResults([])
      } finally {
        if (id === reqId.current) setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  // Fecha a lista ao clicar fora
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEscapeLayer(open && results.length > 0, () => setOpen(false))

  const ownedBy = useMemo(() => {
    const map = new Map<string, Owned>()
    for (const m of catalog)   if (m.tmdb_id) map.set(`${m.tipo}:${m.tmdb_id}`, { kind: 'catalog', media: m })
    for (const w of watchlist) if (w.tmdb_id && !map.has(`${w.tipo}:${w.tmdb_id}`)) map.set(`${w.tipo}:${w.tmdb_id}`, { kind: 'proximo', item: w })
    return map
  }, [catalog, watchlist])

  const ownedOf = (r: TmdbMultiResult): Owned => ownedBy.get(`${r.tipo}:${r.id}`) ?? null

  function primary(r: TmdbMultiResult) {
    const owned = ownedOf(r)
    setOpen(false)
    if (owned?.kind === 'catalog') setViewing(owned.media)
    else if (owned?.kind === 'proximo') setPromoting(owned.item)
    else setRegistering(r)
  }

  async function addToQueue(r: TmdbMultiResult) {
    setBusy(r.id)
    const res = await ipc<AiResult<{ title: string }>>('tmdb:addToWatchlist', r.id, r.tipo)
    setBusy(null)
    if (!res.ok) { showToast(res.error, 'error'); return }
    showToast(`"${res.data.title}" adicionado em Próximos!`)
    fetchWatchlist()
  }

  async function saveNew(fields: WatchedFields): Promise<string | null> {
    if (!registering) return null
    const res = await ipc<AiResult<{ mediaId: number }>>('catalog:addFromTmdb', registering.id, registering.tipo, fields)
    if (!res.ok) return res.error
    setQuery('')
    setResults([])
    return null
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => (a + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + results.length) % results.length) }
    else if (e.key === 'Enter' && open) { e.preventDefault(); primary(results[active]) }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: theme.spacing.md,
        background: theme.colors.surface, border: `1px solid ${open ? theme.colors.primary : theme.colors.surfaceElevated}`,
        borderRadius: theme.radius.lg, padding: `0 ${theme.spacing.lg}`, height: '64px',
        boxShadow: open ? `0 0 0 3px ${theme.colors.primaryGlow}` : 'none',
        transition: `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
      }}>
        <span style={{ fontSize: '22px', color: theme.colors.primaryMuted }}>⌕</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="O que você assistiu? Digite um filme ou série…"
          spellCheck={false}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: theme.colors.textPrimary, fontSize: theme.fontSizes.h3, fontFamily: theme.fonts.sans,
          }}
        />
        {searching && <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>buscando…</span>}
        {query && !searching && (
          <button onClick={() => { setQuery(''); setResults([]) }} style={{
            background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer', fontSize: '18px',
          }}>×</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '70px', left: 0, right: 0, zIndex: 50,
          background: theme.colors.surfaceElevated, border: `1px solid ${theme.colors.surfaceHover}`,
          borderRadius: theme.radius.lg, boxShadow: theme.shadows.modal, overflow: 'hidden',
          maxHeight: '60vh', overflowY: 'auto', animation: 'dropdownIn 0.15s ease-out',
        }}>
          {results.map((r, i) => {
            const owned = ownedOf(r)
            return (
              <div
                key={`${r.tipo}:${r.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => primary(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: theme.spacing.md, cursor: 'pointer',
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  background: i === active ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderLeft: `3px solid ${i === active ? theme.colors.primary : 'transparent'}`,
                  opacity: busy === r.id ? 0.5 : 1,
                }}
              >
                <div style={{
                  width: '36px', height: '54px', flexShrink: 0, borderRadius: '3px',
                  background: r.posterUrl ? `url(${r.posterUrl}) center/cover` : theme.colors.surfaceHover,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                    <span style={{ fontSize: theme.fontSizes.body, color: theme.colors.textPrimary, fontWeight: theme.fontWeights.medium }}>
                      {r.title}
                    </span>
                    <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>{r.year && `(${r.year})`}</span>
                    <Badge customColor={theme.colors.typeColors[r.tipo]} size="sm">{r.tipo}</Badge>
                  </div>
                  <div style={{
                    fontSize: theme.fontSizes.small, color: theme.colors.textMuted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.originalTitle && r.originalTitle !== r.title ? `${r.originalTitle} · ` : ''}{r.overview}
                  </div>
                </div>
                {owned?.kind === 'catalog' ? (
                  <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.success, fontWeight: theme.fontWeights.bold, whiteSpace: 'nowrap' }}>
                    ✓ No catálogo{owned.media.rating ? ` · ★ ${owned.media.rating}` : ''}
                  </span>
                ) : owned?.kind === 'proximo' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.warning, whiteSpace: 'nowrap' }}>Em Próximos</span>
                    <Button size="sm" onClick={e => { e.stopPropagation(); primary(r) }}>✓ Já vi</Button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: theme.spacing.xs }} onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => addToQueue(r)} disabled={busy !== null}>+ Próximos</Button>
                    <Button size="sm" onClick={() => primary(r)}>Registrar</Button>
                  </div>
                )}
              </div>
            )
          })}
          <div style={{
            padding: `${theme.spacing.xs} ${theme.spacing.md}`, fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted,
            borderTop: `1px solid ${theme.colors.surfaceHover}`,
          }}>
            ↑↓ navegar · Enter registrar · Esc fechar · não achou? Ctrl+N para cadastrar manualmente
          </div>
        </div>
      )}

      {registering && (
        <MarkAsWatchedModal
          item={{ title: registering.title, tipo: registering.tipo, release_year: registering.year, cover_path: registering.posterUrl ?? undefined }}
          onSave={saveNew}
          onClose={() => setRegistering(null)}
          onDone={() => setRegistering(null)}
        />
      )}
      {promoting && (
        <MarkAsWatchedModal item={promoting} onClose={() => setPromoting(null)} onDone={() => { setPromoting(null); setQuery(''); setResults([]) }} />
      )}
      {viewing && <DetailsModal media={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
