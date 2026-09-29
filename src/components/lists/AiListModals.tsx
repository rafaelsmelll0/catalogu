import { useEffect, useState } from 'react'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import {
  LIST_KIND_LABEL,
  type AiResult, type ListCandidateRef, type ListCompletion, type ListKind, type ListProposal, type Suggestion,
} from '../../types/index.ts'
import { Modal, Button, Input } from '../ui/index.ts'
import { showToast } from '../Toast.tsx'
import { AnimatedCat } from '../AnimatedCat.tsx'

function Thinking({ text }: { text: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.xxl} 0` }}>
      <AnimatedCat size={80} mode="loading" />
      <div style={{ color: theme.colors.textPrimary, fontSize: theme.fontSizes.body }}>{text}</div>
      <div style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small }}>{elapsed}s</div>
    </div>
  )
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: theme.spacing.lg, textAlign: 'center' }}>
      <p style={{ color: theme.colors.danger, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.md }}>{message}</p>
      <Button onClick={onRetry}>Tentar de novo</Button>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: theme.fontWeights.bold, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: theme.colors.primaryMuted, margin: `${theme.spacing.md} 0 ${theme.spacing.sm}`,
    }}>
      {children}
    </div>
  )
}

function Poster({ url, w = 36 }: { url: string | null | undefined; w?: number }) {
  return <div style={{
    width: `${w}px`, height: `${Math.round(w * 1.5)}px`, flexShrink: 0, borderRadius: '3px',
    background: url ? `url(${url}) center/cover` : theme.colors.surfaceHover,
  }} />
}

// ─── Completar lista ────────────────────────────────────────────────────────

export function CompleteListModal({ listId, listName, onClose, onChanged }: {
  listId: number; listName: string; onClose: () => void; onChanged: () => void
}) {
  const [data, setData]         = useState<ListCompletion | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [picked, setPicked]     = useState<Set<string>>(new Set())
  const [adding, setAdding]     = useState(false)
  const [done, setDone]         = useState<Record<number, 'added' | 'dismissed'>>({})

  async function run() {
    setError(null)
    setData(null)
    const res = await ipc<AiResult<ListCompletion>>('ai:completeList', listId)
    if (!res.ok) { setError(res.error); return }
    setData(res.data)
    setPicked(new Set(res.data.fromCatalog.map(c => `${c.kind}:${c.id}`)))
  }

  useEffect(() => { run() }, [listId])

  async function addPicked() {
    if (!data) return
    setAdding(true)
    const entries = data.fromCatalog.filter(c => picked.has(`${c.kind}:${c.id}`)).map(c => ({ kind: c.kind, id: c.id }))
    const added = await ipc<number>('lists:addMany', listId, entries)
    setAdding(false)
    showToast(`${added} ${added === 1 ? 'título adicionado' : 'títulos adicionados'} a "${listName}".`)
    setData({ ...data, fromCatalog: data.fromCatalog.filter(c => !picked.has(`${c.kind}:${c.id}`)) })
    setPicked(new Set())
    onChanged()
  }

  async function addDiscover(s: Suggestion) {
    const res = await ipc<AiResult<unknown>>('tmdb:addToWatchlist', s.tmdbId, s.tipo, listId)
    if (!res.ok) { showToast(res.error, 'error'); return }
    await ipc('ai:feedback', s.tmdbId, s.tipo, s.title, s.year || null, 'added')
    setDone(d => ({ ...d, [s.tmdbId]: 'added' }))
    onChanged()
  }

  async function dismiss(s: Suggestion) {
    await ipc('ai:feedback', s.tmdbId, s.tipo, s.title, s.year || null, 'dismissed')
    setDone(d => ({ ...d, [s.tmdbId]: 'dismissed' }))
  }

  function togglePick(c: ListCandidateRef) {
    const k = `${c.kind}:${c.id}`
    const next = new Set(picked)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setPicked(next)
  }

  return (
    <Modal open onClose={onClose} title={`Completar "${listName}" com IA`} width="720px">
      <div style={{ padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}` }}>
        {error ? <ErrorBox message={error} onRetry={run} />
        : !data ? <Thinking text="Entendendo o critério da lista e procurando o que combina…" />
        : (
          <>
            <SectionTitle>Do seu catálogo · {data.fromCatalog.length}</SectionTitle>
            {data.fromCatalog.length === 0 ? (
              <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>Nada do catálogo ficou de fora desta lista.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {data.fromCatalog.map(c => (
                    <label key={`${c.kind}:${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
                      <input type="checkbox" checked={picked.has(`${c.kind}:${c.id}`)} onChange={() => togglePick(c)}
                        style={{ accentColor: theme.colors.primary, width: '16px', height: '16px' }} />
                      <Poster url={c.cover_path} w={28} />
                      <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary, flex: 1 }}>
                        {c.title} <span style={{ color: theme.colors.textMuted }}>{c.year ? `(${c.year})` : ''}</span>
                      </span>
                      {c.kind === 'watchlist' && <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.warning }}>Próximos</span>}
                      {c.rating ? <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>★ {c.rating}</span> : null}
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={addPicked} loading={adding} disabled={picked.size === 0} style={{ marginTop: theme.spacing.sm }}>
                  Adicionar {picked.size} à lista
                </Button>
              </>
            )}

            <SectionTitle>Para descobrir · {data.discover.length}</SectionTitle>
            {data.discover.length === 0 && (
              <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>Sem novidades desta vez.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              {data.discover.map(s => (
                <div key={s.tmdbId} style={{
                  display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start',
                  opacity: done[s.tmdbId] === 'dismissed' ? 0.4 : 1,
                }}>
                  <Poster url={s.posterUrl} w={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary, fontWeight: theme.fontWeights.bold }}>
                      {s.title} <span style={{ color: theme.colors.textMuted, fontWeight: theme.fontWeights.regular }}>({s.year})</span>
                    </div>
                    <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, lineHeight: 1.5 }}>{s.why}</div>
                  </div>
                  {done[s.tmdbId] === 'added' ? (
                    <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.success, whiteSpace: 'nowrap' }}>✓ Próximos + lista</span>
                  ) : done[s.tmdbId] === 'dismissed' ? (
                    <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>descartado</span>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <Button size="sm" onClick={() => addDiscover(s)}>+ Próximos</Button>
                      <Button size="sm" variant="ghost" onClick={() => dismiss(s)}>Não curti</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, marginTop: theme.spacing.md }}>
              "+ Próximos" põe o título na sua fila e nesta lista ao mesmo tempo.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Sugerir listas novas ───────────────────────────────────────────────────

export function SuggestListsModal({ onClose, onCreated, onOpenList }: {
  onClose: () => void; onCreated: () => void; onOpenList: (id: number) => void
}) {
  const [data, setData]       = useState<ListProposal[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [names, setNames]     = useState<Record<number, string>>({})
  const [created, setCreated] = useState<Record<number, number>>({})
  const [busy, setBusy]       = useState<number | null>(null)

  async function run() {
    setError(null)
    setData(null)
    setCreated({})
    const res = await ipc<AiResult<ListProposal[]>>('ai:suggestLists')
    if (!res.ok) { setError(res.error); return }
    setData(res.data)
    setNames(Object.fromEntries(res.data.map((p, i) => [i, p.name])))
  }

  useEffect(() => { run() }, [])

  async function create(p: ListProposal, i: number) {
    setBusy(i)
    const res = await ipc<AiResult<{ listId: number }>>('ai:createList', {
      name: names[i] ?? p.name, kind: p.kind, description: p.description,
      items: p.items.map(it => ({ kind: it.kind, id: it.id })),
    })
    setBusy(null)
    if (!res.ok) { showToast(res.error, 'error'); return }
    setCreated(c => ({ ...c, [i]: res.data.listId }))
    showToast(`Lista "${names[i] ?? p.name}" criada.`)
    onCreated()
  }

  return (
    <Modal open onClose={onClose} title="Sugestões de listas" width="760px">
      <div style={{ padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}` }}>
        {error ? <ErrorBox message={error} onRetry={run} />
        : !data ? <Thinking text="Procurando temas e sagas escondidos no seu catálogo…" />
        : (
          <>
            <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, margin: `${theme.spacing.md} 0` }}>
              Só com títulos que você já tem. Dá para mudar o nome antes de criar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {data.map((p, i) => (
                <div key={i} style={{
                  background: theme.colors.surface, border: `1px solid ${theme.colors.surfaceElevated}`,
                  borderRadius: theme.radius.md, padding: theme.spacing.md,
                }}>
                  <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Input
                      label={`${LIST_KIND_LABEL[p.kind as ListKind]?.one ?? 'Lista'} · ${p.items.length} títulos`}
                      value={names[i] ?? ''}
                      onChange={e => setNames(n => ({ ...n, [i]: e.target.value }))}
                      disabled={!!created[i]}
                      style={{ flex: 1, minWidth: '240px' }}
                    />
                    {created[i] ? (
                      <Button variant="ghost" onClick={() => onOpenList(created[i])}>✓ Criada · abrir →</Button>
                    ) : (
                      <Button onClick={() => create(p, i)} loading={busy === i} disabled={!(names[i] ?? '').trim()}>Criar lista</Button>
                    )}
                  </div>
                  {p.description && (
                    <p style={{ fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, margin: `${theme.spacing.sm} 0` }}>{p.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                    {p.items.map(it => (
                      <div key={`${it.kind}:${it.id}`} title={`${it.title}${it.year ? ` (${it.year})` : ''}`}>
                        <Poster url={it.cover_path} w={44} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.md }}>
              <Button variant="ghost" onClick={run}>↻ Gerar outras</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
