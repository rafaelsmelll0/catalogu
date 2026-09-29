import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { normalize } from '../lib/normalize.ts'
import { ipc } from '../lib/ipc.ts'
import { theme } from '../styles/theme.ts'
import {
  LIST_KIND_LABEL,
  type AiSettings, type Franchise, type ListEntryRef, type ListInfo, type ListKind, type ListSortMode, type Media,
} from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { DetailsModal } from '../components/DetailsModal.tsx'
import { WatchlistDetailsModal } from '../components/WatchlistDetailsModal.tsx'
import { showToast } from '../components/Toast.tsx'
import { Button, Input, Modal, Badge, Select, Tooltip, type SelectOption } from '../components/ui/index.ts'
import { SortableListGrid } from '../components/lists/SortableListGrid.tsx'
import { AddToListModal } from '../components/lists/AddToListModal.tsx'
import { FranchisesModal } from '../components/lists/FranchisesModal.tsx'
import { FranchiseParts } from '../components/lists/FranchiseParts.tsx'
import { CompleteListModal, SuggestListsModal } from '../components/lists/AiListModals.tsx'
import { SweepModal } from '../components/lists/SweepModal.tsx'
import { AnimatedRoll } from '../components/AnimatedCat.tsx'
import { LISTS_CHANGED_EVENT } from '../components/ListPickerModal.tsx'

interface ListMediaItem extends Media {
  isProximo:    boolean
  watchlistId?: number
}

const KIND_ORDER: ListKind[] = ['franquia', 'saga', 'tema', 'livre']

const KIND_COLOR: Record<ListKind, string> = {
  franquia: theme.colors.primary,
  saga:     theme.colors.info,
  tema:     theme.colors.warning,
  livre:    theme.colors.textMuted,
}

const SORT_OPTIONS: SelectOption<ListSortMode>[] = [
  { value: 'lancamento', label: 'Ordem de lançamento' },
  { value: 'manual',     label: 'Ordem manual (arraste)' },
  { value: 'titulo',     label: 'Título (A–Z)' },
  { value: 'nota',       label: 'Sua nota' },
]

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`
}

export function ListasPage() {
  const { fetchAll, items: allMedia }                       = useMediaStore()
  const { items: watchlistItems, fetchAll: fetchWatchlist } = useWatchlistStore()
  const [params, setParams] = useSearchParams()

  const [lists, setLists]           = useState<ListInfo[]>([])
  const [loading, setLoading]       = useState(true)
  const [listMedia, setListMedia]   = useState<ListMediaItem[]>([])
  const [franchise, setFranchise]   = useState<Franchise | null>(null)
  const [aiEnabled, setAiEnabled]   = useState(false)
  const [sidebarQuery, setSidebarQuery] = useState('')
  const [collapsed, setCollapsed]   = useState<Set<ListKind>>(new Set())

  // formulários
  const [showCreate, setShowCreate] = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [formName, setFormName]     = useState('')
  const [formDesc, setFormDesc]     = useState('')
  const [formKind, setFormKind]     = useState<ListKind>('tema')

  // modais
  const [showAdd, setShowAdd]               = useState(false)
  const [showDelete, setShowDelete]         = useState(false)
  const [showFranchises, setShowFranchises] = useState(false)
  const [showComplete, setShowComplete]     = useState(false)
  const [showSuggest, setShowSuggest]       = useState(false)
  const [showSweep, setShowSweep]           = useState(false)
  const [detail, setDetail]                 = useState<ListMediaItem | null>(null)

  const selectedId = Number(params.get('lista')) || null
  const selected   = lists.find(l => l.id === selectedId) ?? null

  useEffect(() => {
    fetchAll()
    fetchWatchlist()
    loadLists()
    ipc<AiSettings>('ai:getSettings').then(s => setAiEnabled(s.hasKey)).catch(() => {})
  }, [])

  // Vindo do card "Franquias" da Início: abre direto a janela de franquias
  useEffect(() => {
    if (params.get('franquias')) {
      setShowFranchises(true)
      const next = new URLSearchParams(params)
      next.delete('franquias')
      setParams(next, { replace: true })
    }
  }, [])

  // Mudanças feitas pelo seletor de listas aberto em outro lugar (busca, detalhes…)
  useEffect(() => {
    const onChange = () => { loadLists(); if (selectedId) loadListContent(selectedId) }
    window.addEventListener(LISTS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(LISTS_CHANGED_EVENT, onChange)
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) { setListMedia([]); setFranchise(null); return }
    setEditMode(false)
    loadListContent(selectedId)
  }, [selectedId])

  async function loadLists() {
    try {
      setLists(await ipc<ListInfo[]>('lists:getAll'))
    } finally {
      setLoading(false)
    }
  }

  async function loadListContent(listId: number) {
    const [media, fr] = await Promise.all([
      ipc<ListMediaItem[]>('lists:getMedia', listId),
      ipc<Franchise | null>('franchises:forList', listId).catch(() => null),
    ])
    setListMedia(media)
    setFranchise(fr)
  }

  /** Recarrega tudo que uma mudança pode ter afetado (lista, contadores, fila). */
  async function refresh() {
    await Promise.all([loadLists(), selectedId ? loadListContent(selectedId) : null, fetchWatchlist(), fetchAll()])
  }

  function selectList(id: number | null) {
    setParams(id ? { lista: String(id) } : {}, { replace: true })
  }

  // ─── CRUD de listas ────────────────────────────────────────────────────────

  function nameTaken(name: string, exceptId?: number) {
    const n = normalize(name.trim())
    return lists.some(l => l.id !== exceptId && normalize(l.name) === n)
  }

  async function handleCreate() {
    const name = formName.trim()
    if (!name) return
    if (nameTaken(name)) { showToast(`Já existe uma lista chamada "${name}".`, 'error'); return }
    try {
      const id = await ipc<number>('lists:create', name, formDesc.trim(), formKind)
      showToast(`Lista "${name}" criada!`)
      setShowCreate(false)
      setFormName(''); setFormDesc('')
      await loadLists()
      selectList(id)
    } catch (err) {
      console.error('[ListasPage.create]', err)
      showToast('Não foi possível criar a lista.', 'error')
    }
  }

  function startEdit() {
    if (!selected) return
    setFormName(selected.name)
    setFormDesc(selected.description)
    setFormKind(selected.kind)
    setEditMode(true)
  }

  async function handleUpdate() {
    if (!selected || !formName.trim()) return
    if (nameTaken(formName, selected.id)) { showToast(`Já existe uma lista chamada "${formName.trim()}".`, 'error'); return }
    try {
      await ipc('lists:update', selected.id, { name: formName.trim(), description: formDesc.trim(), kind: formKind })
      showToast('Lista atualizada!')
      setEditMode(false)
      await loadLists()
    } catch (err) {
      console.error('[ListasPage.update]', err)
      showToast('Não foi possível salvar a lista.', 'error')
    }
  }

  async function handleDelete() {
    if (!selected) return
    await ipc('lists:delete', selected.id)
    showToast(`Lista "${selected.name}" removida.`, 'info')
    setShowDelete(false)
    selectList(null)
    await loadLists()
  }

  async function handleSort(mode: ListSortMode) {
    if (!selected) return
    await ipc('lists:update', selected.id, { sort_mode: mode })
    setLists(ls => ls.map(l => l.id === selected.id ? { ...l, sort_mode: mode } : l))
    await loadListContent(selected.id)
  }

  async function handleReorder(ordered: Media[]) {
    if (!selected) return
    const refs: ListEntryRef[] = (ordered as ListMediaItem[]).map(m =>
      m.isProximo ? { kind: 'watchlist', id: m.watchlistId! } : { kind: 'media', id: m.id })
    await ipc('lists:reorder', selected.id, refs)
    if (selected.sort_mode !== 'manual') {
      setLists(ls => ls.map(l => l.id === selected.id ? { ...l, sort_mode: 'manual' } : l))
      showToast('Ordem manual salva. Dá para voltar à ordem de lançamento no seletor.', 'info')
    }
    await loadListContent(selected.id)
  }

  async function removeFromList(item: ListMediaItem) {
    if (!selected) return
    if (item.isProximo) await ipc('lists:removeWatchlistItem', item.watchlistId, selected.id)
    else await ipc('lists:removeMedia', item.id, selected.id)
    setDetail(null)
    showToast(`Removido de "${selected.name}".`, 'info')
    await Promise.all([loadListContent(selected.id), loadLists()])
  }

  async function unlinkFranchise() {
    if (!selected) return
    await ipc('franchises:unlink', selected.id)
    setFranchise(null)
    await loadLists()
  }

  // ─── Derivados ─────────────────────────────────────────────────────────────

  const inListKeys = useMemo(() => new Set(listMedia.map(m =>
    m.isProximo ? `watchlist:${m.watchlistId}` : `media:${m.id}`)), [listMedia])

  const grouped = useMemo(() => {
    const q = normalize(sidebarQuery.trim())
    const filtered = q ? lists.filter(l => normalize(l.name).includes(q)) : lists
    return KIND_ORDER
      .map(kind => ({ kind, items: filtered.filter(l => l.kind === kind) }))
      .filter(g => g.items.length > 0)
  }, [lists, sidebarQuery])

  const detailWatchlist = detail?.isProximo ? watchlistItems.find(w => w.id === detail.watchlistId) ?? null : null
  const detailMedia     = detail && !detail.isProximo ? allMedia.find(m => m.id === detail.id) ?? detail : null
  const numbered        = !!selected && (selected.kind === 'franquia' || selected.kind === 'saga')
    && (selected.sort_mode === 'lancamento' || selected.sort_mode === 'manual')

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', background: theme.colors.bg }}>

      {/* Sidebar */}
      <aside style={{
        width: '280px', flexShrink: 0, background: theme.colors.surface,
        borderRight: `1px solid ${theme.colors.surfaceElevated}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: theme.spacing.md, borderBottom: `1px solid ${theme.colors.surfaceElevated}`, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.bold }}>Minhas Listas</h2>
            <Button size="sm" onClick={() => { setShowCreate(v => !v); setFormName(''); setFormDesc(''); setFormKind('tema') }}>+ Nova</Button>
          </div>

          {showCreate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              <Input label="Nome" value={formName} onChange={e => setFormName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              <Input label="Descrição (opcional)" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              <KindPicker value={formKind} onChange={setFormKind} />
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                <Button size="sm" onClick={handleCreate} style={{ flex: 1 }}>Criar</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: theme.spacing.xs }}>
            <Button size="sm" variant="secondary" onClick={() => setShowFranchises(true)} style={{ flex: 1 }}>🎞 Franquias</Button>
            <Tooltip content={aiEnabled ? 'A IA propõe listas com o que você já tem' : 'Configure a IA em Configurações'} side="bottom">
              <Button size="sm" variant="secondary" onClick={() => setShowSuggest(true)} disabled={!aiEnabled} style={{ flex: 1 }}>
                ✦ Sugerir listas
              </Button>
            </Tooltip>
          </div>
          {lists.length > 0 && (
            <Tooltip
              content={aiEnabled
                ? 'Procura no catálogo e em Próximos o que se encaixa nas listas que você já tem'
                : 'Sem IA, encaixa só pelas franquias do TMDB'}
              side="bottom"
            >
              <Button size="sm" variant="secondary" onClick={() => setShowSweep(true)} style={{ width: '100%' }}>
                🔎 Varrer catálogo nas listas
              </Button>
            </Tooltip>
          )}

          {lists.length > 6 && (
            <input
              placeholder="Filtrar listas…"
              value={sidebarQuery}
              onChange={e => setSidebarQuery(e.target.value)}
              className="focus-ring"
              style={{
                background: theme.colors.bg, border: `1px solid ${theme.colors.surfaceElevated}`,
                borderRadius: theme.radius.sm, padding: '6px 10px', color: theme.colors.textPrimary,
                fontSize: theme.fontSizes.small,
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: theme.spacing.md }}>
          {loading ? (
            <div style={{ padding: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>Carregando…</div>
          ) : lists.length === 0 ? (
            <div style={{
              padding: theme.spacing.lg, color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.sm,
            }}>
              <AnimatedRoll size={40} style={{ opacity: 0.5 }} />
              Nenhuma lista ainda
            </div>
          ) : grouped.map(g => {
            const isCollapsed = collapsed.has(g.kind) && !sidebarQuery
            return (
              <div key={g.kind}>
                <button
                  onClick={() => setCollapsed(c => {
                    const next = new Set(c)
                    if (next.has(g.kind)) next.delete(g.kind)
                    else next.add(g.kind)
                    return next
                  })}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: theme.spacing.xs,
                    padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.xs}`,
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: '10px', fontWeight: theme.fontWeights.bold, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: theme.colors.textMuted,
                  }}
                >
                  <span style={{ width: '10px' }}>{isCollapsed ? '▸' : '▾'}</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: KIND_COLOR[g.kind] }} />
                  {LIST_KIND_LABEL[g.kind].many}
                  <span style={{ marginLeft: 'auto', fontWeight: theme.fontWeights.regular }}>{g.items.length}</span>
                </button>
                {!isCollapsed && g.items.map(list => (
                  <SidebarItem key={list.id} list={list} active={list.id === selectedId} onClick={() => selectList(list.id)} />
                ))}
              </div>
            )
          })}
        </div>
      </aside>

      {/* Área principal */}
      <section style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: theme.spacing.md }}>
            <AnimatedRoll size={80} style={{ opacity: 0.45 }} />
            <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>Selecione uma lista ou crie uma nova</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div style={{ padding: `${theme.spacing.lg} ${theme.layout.pagePadding}`, borderBottom: `1px solid ${theme.colors.surfaceElevated}` }}>
              {editMode ? (
                <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                  <Input label="Nome" value={formName} onChange={e => setFormName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUpdate()} />
                  <Input label="Descrição" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                  <KindPicker value={formKind} onChange={setFormKind} />
                  <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                    <Button onClick={handleUpdate}>Salvar</Button>
                    <Button variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <Badge customColor={KIND_COLOR[selected.kind]} size="sm">{LIST_KIND_LABEL[selected.kind].one}</Badge>
                    <h1 style={{ fontSize: theme.fontSizes.h1, fontWeight: theme.fontWeights.black, fontFamily: theme.fonts.display, marginTop: theme.spacing.xs }}>
                      {selected.name}
                    </h1>
                    {selected.description && (
                      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginTop: theme.spacing.xs }}>{selected.description}</p>
                    )}
                    <ListSummary list={selected} />
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button onClick={() => setShowAdd(true)}>+ Adicionar</Button>
                    {aiEnabled && <Button variant="secondary" onClick={() => setShowComplete(true)}>✦ Completar com IA</Button>}
                    <Button variant="ghost" onClick={startEdit}>✎ Editar</Button>
                    <Button variant="ghost" onClick={() => setShowDelete(true)}>Excluir</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Franquia do TMDB vinculada */}
            {franchise && (
              <div style={{
                margin: `${theme.spacing.md} ${theme.layout.pagePadding} 0`, padding: theme.spacing.md,
                background: theme.colors.surface, border: `1px solid ${theme.colors.surfaceElevated}`, borderRadius: theme.radius.md,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, flex: 1 }}>
                    🎞 Franquia no TMDB: <strong style={{ color: theme.colors.textPrimary }}>{franchise.name}</strong>
                    {' · '}{franchise.owned} de {franchise.parts.length} no catálogo
                    {franchise.inProximos > 0 && ` · ${franchise.inProximos} em Próximos`}
                    {franchise.missing > 0 && <span style={{ color: theme.colors.danger }}> · faltam {franchise.missing}</span>}
                    {franchise.upcoming > 0 && ` · ${franchise.upcoming} em breve`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={unlinkFranchise}>Desvincular</Button>
                </div>
                <FranchiseParts
                  parts={franchise.parts}
                  listId={selected.id}
                  inList={inListKeys}
                  onChanged={refresh}
                />
              </div>
            )}

            {/* Barra de ordenação */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: theme.spacing.md,
              padding: `${theme.spacing.md} ${theme.layout.pagePadding}`, flexWrap: 'wrap',
            }}>
              <div style={{ width: '240px' }}>
                <Select<ListSortMode> options={SORT_OPTIONS} value={selected.sort_mode} onChange={handleSort} fullWidth />
              </div>
              <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                Arraste os cards para montar a ordem que quiser (ex.: cronologia da história).
              </span>
            </div>

            <SortableListGrid
              items={listMedia}
              numbered={numbered}
              onCardClick={m => setDetail(m as ListMediaItem)}
              onReorder={handleReorder}
            />
          </>
        )}
      </section>

      {/* Modais */}
      {showAdd && selected && (
        <AddToListModal
          listId={selected.id}
          listName={selected.name}
          catalog={allMedia}
          watchlist={watchlistItems}
          inList={inListKeys}
          onClose={() => setShowAdd(false)}
          onAdded={refresh}
        />
      )}

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Excluir lista" width="400px">
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
            Excluir a lista <strong style={{ color: theme.colors.textPrimary }}>"{selected?.name}"</strong>?
            Os filmes e séries continuam no catálogo; só a lista some.
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Excluir lista</Button>
          </div>
        </div>
      </Modal>

      {detailMedia && selected && (
        <DetailsModal
          media={detailMedia}
          onClose={() => { setDetail(null); refresh() }}
          listContext={{ name: selected.name, onRemove: () => removeFromList(detail!) }}
        />
      )}
      {detailWatchlist && selected && (
        <WatchlistDetailsModal
          item={detailWatchlist}
          onClose={() => { setDetail(null); refresh() }}
          onWatched={refresh}
          listContext={{ name: selected.name, onRemove: () => removeFromList(detail!) }}
        />
      )}

      {showFranchises && (
        <FranchisesModal
          onClose={() => { setShowFranchises(false); refresh() }}
          onOpenList={id => { setShowFranchises(false); selectList(id); loadLists() }}
          onChanged={loadLists}
        />
      )}
      {showComplete && selected && (
        <CompleteListModal
          listId={selected.id}
          listName={selected.name}
          onClose={() => setShowComplete(false)}
          onChanged={refresh}
        />
      )}
      {showSweep && (
        <SweepModal listCount={lists.length} onClose={() => setShowSweep(false)} onApplied={refresh} />
      )}
      {showSuggest && (
        <SuggestListsModal
          onClose={() => setShowSuggest(false)}
          onCreated={loadLists}
          onOpenList={id => { setShowSuggest(false); selectList(id) }}
        />
      )}
    </div>
  )
}

// ─── Peças ──────────────────────────────────────────────────────────────────

function SidebarItem({ list, active, onClick }: { list: ListInfo; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const pct = list.media_count ? Math.round((list.watched_count / list.media_count) * 100) : 0
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: `${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.lg}`,
        cursor: 'pointer',
        background: active ? theme.colors.primaryGlow : hover ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderLeft: `3px solid ${active ? theme.colors.primary : 'transparent'}`,
        transition: `all ${theme.transitions.fast}`,
      }}
    >
      <div style={{
        fontSize: theme.fontSizes.ui, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontWeight: active ? theme.fontWeights.bold : theme.fontWeights.regular,
        color: active ? theme.colors.textPrimary : theme.colors.textSecondary,
      }}>
        {list.tmdb_collection_id ? '🎞 ' : ''}{list.name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: '3px' }}>
        <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, whiteSpace: 'nowrap' }}>
          {list.watched_count}/{list.media_count} vistos
        </span>
        <div style={{ flex: 1, height: '3px', background: theme.colors.surfaceHover, borderRadius: theme.radius.full, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? theme.colors.success : theme.colors.primary }} />
        </div>
      </div>
    </div>
  )
}

function ListSummary({ list }: { list: ListInfo }) {
  const parts = [
    `${list.media_count} ${list.media_count === 1 ? 'título' : 'títulos'}`,
    `${list.watched_count} ${list.watched_count === 1 ? 'assistido' : 'assistidos'}`,
    list.avg_rating ? `nota média ${String(list.avg_rating).replace('.', ',')}` : null,
    list.watched_minutes > 0 ? `${formatMinutes(list.watched_minutes)} em filmes` : null,
  ].filter(Boolean)
  const pct = list.media_count ? Math.round((list.watched_count / list.media_count) * 100) : 0
  return (
    <div style={{ marginTop: theme.spacing.sm }}>
      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small }}>{parts.join(' · ')}</p>
      {list.media_count > 0 && (
        <div style={{ width: '260px', height: '4px', background: theme.colors.surfaceHover, borderRadius: theme.radius.full, overflow: 'hidden', marginTop: '6px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? theme.colors.success : theme.colors.primary, transition: 'width 0.4s ease' }} />
        </div>
      )}
    </div>
  )
}

function KindPicker({ value, onChange }: { value: ListKind; onChange: (k: ListKind) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {KIND_ORDER.map(k => {
        const on = k === value
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            className="focus-ring"
            style={{
              padding: '4px 12px', borderRadius: theme.radius.full, cursor: 'pointer', fontSize: theme.fontSizes.small,
              border: `1px solid ${on ? KIND_COLOR[k] : theme.colors.surfaceHover}`,
              background: on ? `${KIND_COLOR[k]}30` : 'transparent',
              color: on ? theme.colors.textPrimary : theme.colors.textMuted,
            }}
          >
            {LIST_KIND_LABEL[k].one}
          </button>
        )
      })}
    </div>
  )
}
