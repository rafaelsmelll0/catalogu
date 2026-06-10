import { useEffect, useState, useMemo } from 'react'
import { normalize } from '../lib/normalize.ts'
import { theme } from '../styles/theme.ts'
import type { Media, ListCandidate, WatchlistItem } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { MediaGrid } from '../components/MediaGrid.tsx'
import { MarkAsWatchedModal } from '../components/MarkAsWatchedModal.tsx'
import { showToast } from '../components/Toast.tsx'
import { Button, Input, Modal, Badge } from '../components/ui/index.ts'
import Roll from '../assets/roll.svg?react'

interface ListItem {
  id:          number
  name:        string
  description: string
  media_count: number
}

interface ListMediaItem extends Media {
  isProximo:    boolean
  watchlistId?: number
}

const STATUS_LABELS: Record<string, string> = {
  assistido:     '✓ Assistido',
  assistindo:    '▶ Assistindo',
  nao_assistido: '✕ Não assistido',
  nao_lembro:    '? Não lembro',
}

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'muted' | 'warning'> = {
  assistido:     'success',
  assistindo:    'primary',
  nao_assistido: 'muted',
  nao_lembro:    'warning',
}

export function ListasPage() {
  const { fetchAll, items: allMedia }                        = useMediaStore()
  const { items: watchlistItems, fetchAll: fetchWatchlist }  = useWatchlistStore()

  const [lists, setLists]                         = useState<ListItem[]>([])
  const [selected, setSelected]                   = useState<ListItem | null>(null)
  const [listMedia, setListMedia]                 = useState<ListMediaItem[]>([])
  const [detailItem, setDetailItem]               = useState<ListCandidate | null>(null)
  const [moveToCatalog, setMoveToCatalog]         = useState<WatchlistItem | null>(null)
  const [loading, setLoading]                     = useState(true)
  const [showCreate, setShowCreate]               = useState(false)
  const [showAddMedia, setShowAddMedia]           = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newName, setNewName]                     = useState('')
  const [newDesc, setNewDesc]                     = useState('')
  const [editMode, setEditMode]                   = useState(false)
  const [addSearch, setAddSearch]                 = useState('')
  const [hoveredList, setHoveredList]             = useState<number | null>(null)

  useEffect(() => { fetchAll(); fetchWatchlist(); loadLists() }, [])

  async function loadLists() {
    setLoading(true)
    const data = await window.electronAPI.invoke('lists:getAll') as ListItem[]
    setLists(data)
    setLoading(false)
  }

  async function loadListMedia(listId: number) {
    const data = await window.electronAPI.invoke('lists:getMedia', listId) as ListMediaItem[]
    setListMedia(data)
  }

  async function handleSelectList(list: ListItem) {
    setSelected(list)
    setNewName(list.name)
    setNewDesc(list.description)
    setEditMode(false)
    await loadListMedia(list.id)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    await window.electronAPI.invoke('lists:create', newName.trim(), newDesc.trim())
    showToast(`Lista "${newName}" criada!`)
    setNewName(''); setNewDesc(''); setShowCreate(false)
    await loadLists()
  }

  async function handleUpdate() {
    if (!selected || !newName.trim()) return
    await window.electronAPI.invoke('lists:update', selected.id, newName.trim(), newDesc.trim())
    showToast('Lista atualizada!')
    setEditMode(false)
    await loadLists()
    setSelected(prev => prev ? { ...prev, name: newName, description: newDesc } : null)
  }

  async function handleDelete() {
    if (!selected) return
    await window.electronAPI.invoke('lists:delete', selected.id)
    showToast(`Lista "${selected.name}" removida.`, 'info')
    setSelected(null); setListMedia([]); setShowDeleteConfirm(false)
    await loadLists()
  }

  async function handleAddCandidate(candidate: ListCandidate) {
    if (!selected) return
    if (candidate.isProximo) {
      await window.electronAPI.invoke('lists:addWatchlistItem', candidate.sourceId, selected.id)
    } else {
      await window.electronAPI.invoke('lists:addMedia', candidate.sourceId, selected.id)
    }
    await loadListMedia(selected.id)
    await loadLists()
    showToast('Mídia adicionada à lista!')
  }

  async function handleRemoveItem(item: ListCandidate) {
    if (!selected) return
    if (item.isProximo && item.sourceId) {
      await window.electronAPI.invoke('lists:removeWatchlistItem', item.sourceId, selected.id)
    } else {
      await window.electronAPI.invoke('lists:removeMedia', item.sourceId, selected.id)
    }
    await loadListMedia(selected.id)
    await loadLists()
    setDetailItem(null)
    showToast('Mídia removida da lista.', 'info')
  }

  const listWatchlistIds = new Set(
    listMedia.filter(m => m.isProximo && m.watchlistId).map(m => m.watchlistId!)
  )
  const listMediaIds = new Set(listMedia.filter(m => !m.isProximo).map(m => m.id))

  const allCandidates: ListCandidate[] = useMemo(() => {
    const catalog: ListCandidate[] = allMedia
      .filter(m => !listMediaIds.has(m.id))
      .map(m => ({
        id:           m.id,
        title:        m.title,
        tipo:         m.tipo,
        release_year: m.release_year,
        synopsis:     m.synopsis,
        cover_path:   m.cover_path,
        duration:     m.duration,
        director:     m.director,
        genres:       m.genres,
        rating:       m.rating,
        observations: m.observations,
        tmdb_id:      m.tmdb_id,
        watched_status: m.watched_status,
        isProximo:    false,
        sourceId:     m.id,
      }))

    const proximos: ListCandidate[] = watchlistItems
      .filter(w => !listWatchlistIds.has(w.id))
      .map(w => ({
        id:           -(w.id),
        title:        w.title,
        tipo:         w.tipo,
        release_year: w.release_year,
        synopsis:     w.synopsis,
        cover_path:   w.cover_path,
        duration:     w.duration,
        director:     w.director,
        genres:       w.genres,
        tmdb_id:      w.tmdb_id,
        isProximo:    true,
        sourceId:     w.id,
      }))

    return [...catalog, ...proximos]
  }, [allMedia, watchlistItems, listMediaIds, listWatchlistIds])

  const filteredToAdd = addSearch.trim()
    ? allCandidates.filter(m =>
        normalize(m.title).includes(normalize(addSearch)) ||
        (m.release_year ?? '').includes(addSearch)
      )
    : allCandidates

  function toCandidate(m: ListMediaItem): ListCandidate {
    return {
      id:           m.id,
      title:        m.title,
      tipo:         m.tipo,
      release_year: m.release_year,
      synopsis:     m.synopsis,
      cover_path:   m.cover_path,
      duration:     m.duration,
      director:     m.director,
      genres:       m.genres,
      rating:       m.rating,
      observations: m.observations,
      tmdb_id:      m.tmdb_id,
      watched_status: m.watched_status,
      isProximo:    m.isProximo,
      sourceId:     m.isProximo ? (m.watchlistId ?? Math.abs(m.id)) : m.id,
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', background: theme.colors.bg }}>

      {/* Sidebar */}
      <div style={{
        width: '260px', flexShrink: 0,
        background: theme.colors.surface,
        borderRight: `1px solid ${theme.colors.surfaceElevated}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: theme.spacing.md,
          borderBottom: `1px solid ${theme.colors.surfaceElevated}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: showCreate ? theme.spacing.sm : 0,
          }}>
            <h2 style={{ fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.bold }}>
              Minhas Listas
            </h2>
            <Button size="sm" onClick={() => setShowCreate(v => !v)}>+ Nova</Button>
          </div>

          {showCreate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              <Input label="Nome" value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              <Input label="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                <Button size="sm" onClick={handleCreate} style={{ flex: 1 }}>Criar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              Carregando...
            </div>
          ) : lists.length === 0 ? (
            <div style={{
              padding: theme.spacing.lg, color: theme.colors.textMuted,
              fontSize: theme.fontSizes.ui, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.sm,
            }}>
              <Roll style={{ width: '40px', height: '40px', opacity: 0.3 }} />
              Nenhuma lista ainda
            </div>
          ) : lists.map(list => {
            const isActive  = selected?.id === list.id
            const isHovered = hoveredList === list.id
            return (
              <div
                key={list.id}
                onClick={() => handleSelectList(list)}
                onMouseEnter={() => setHoveredList(list.id)}
                onMouseLeave={() => setHoveredList(null)}
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  cursor: 'pointer',
                  background: isActive
                    ? theme.colors.primaryGlow
                    : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${theme.colors.primary}`
                    : '3px solid transparent',
                  transition: `all ${theme.transitions.fast}`,
                }}
              >
                <div style={{
                  fontSize: theme.fontSizes.ui,
                  fontWeight: isActive ? theme.fontWeights.bold : theme.fontWeights.regular,
                  color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {list.name}
                </div>
                <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, marginTop: '2px' }}>
                  {list.media_count} {list.media_count === 1 ? 'título' : 'títulos'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Área principal */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: theme.spacing.md,
          }}>
            <Roll style={{ width: '80px', height: '80px', opacity: 0.2, animation: 'float 3s ease-in-out infinite' }} />
            <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              Selecione uma lista ou crie uma nova
            </p>
          </div>
        ) : (
          <>
            {/* Header da lista */}
            <div style={{
              padding: `${theme.spacing.lg} ${theme.layout.pagePadding}`,
              borderBottom: `1px solid ${theme.colors.surfaceElevated}`,
              background: theme.colors.bg, flexShrink: 0,
            }}>
              {editMode ? (
                <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                  <Input label="Nome" value={newName} onChange={e => setNewName(e.target.value)} />
                  <Input label="Descrição" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                  <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                    <Button onClick={handleUpdate}>Salvar</Button>
                    <Button variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md }}>
                  <div>
                    <h1 style={{
                      fontSize: theme.fontSizes.h1, fontWeight: theme.fontWeights.black,
                      fontFamily: theme.fonts.display,
                    }}>
                      {selected.name}
                    </h1>
                    {selected.description && (
                      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.ui, marginTop: theme.spacing.xs }}>
                        {selected.description}
                      </p>
                    )}
                    <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small, marginTop: theme.spacing.xs }}>
                      {listMedia.length} {listMedia.length === 1 ? 'título' : 'títulos'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexShrink: 0 }}>
                    <Button onClick={() => { setAddSearch(''); setShowAddMedia(true) }}>+ Adicionar</Button>
                    <Button variant="ghost" onClick={() => setEditMode(true)}>✎ Editar</Button>
                    <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Excluir lista</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Grid */}
            <div style={{ flex: 1, paddingTop: theme.spacing.lg }}>
              <MediaGrid
                items={listMedia as unknown as Media[]}
                onCardClick={(m: Media) => {
                  const item = listMedia.find(lm => lm.id === m.id)
                  if (item) setDetailItem(toCandidate(item))
                }}
                emptyMessage="Esta lista está vazia — clique em + Adicionar"
                emptyIcon="roll"
              />
            </div>
          </>
        )}
      </div>

      {/* Modal: Adicionar mídia à lista */}
      <Modal
        open={showAddMedia}
        onClose={() => setShowAddMedia(false)}
        title={`Adicionar à "${selected?.name}"`}
        width="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
          <div style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            borderBottom: `1px solid ${theme.colors.surface}`,
            display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
          }}>
            <Input
              icon="⌕"
              placeholder="Buscar título..."
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              autoFocus
            />
            <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
              {filteredToAdd.length} de {allCandidates.length} disponíveis
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: `${theme.spacing.xs} ${theme.spacing.lg}` }}>
            {filteredToAdd.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: theme.spacing.md,
                color: theme.colors.textMuted, fontSize: theme.fontSizes.ui,
              }}>
                <Roll style={{ width: '48px', height: '48px', opacity: 0.2 }} />
                {allCandidates.length === 0
                  ? 'Todas as mídias já estão nesta lista'
                  : 'Nenhum resultado para a busca'}
              </div>
            ) : filteredToAdd.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: `${theme.spacing.sm} 0`,
                  borderBottom: `1px solid ${theme.colors.surface}`,
                  gap: theme.spacing.sm,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: theme.fontSizes.ui,
                      color: theme.colors.textPrimary,
                      fontWeight: theme.fontWeights.medium,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.title}
                    </span>
                    {m.isProximo && (
                      <Badge variant="warning" size="sm">PRÓXIMO</Badge>
                    )}
                  </div>
                  <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, marginTop: '2px' }}>
                    {m.tipo} · {m.release_year}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleAddCandidate(m)} style={{ flexShrink: 0 }}>
                  + Adicionar
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar exclusão de lista */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Excluir lista"
        width="400px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.lg }}>
            Tem certeza que deseja excluir a lista <strong style={{ color: theme.colors.textPrimary }}>"{selected?.name}"</strong>?
            Os filmes e séries não serão apagados, apenas removidos desta lista.
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Excluir lista</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Detalhe do card da lista */}
      <Modal
        open={!!detailItem && !moveToCatalog}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? ''}
        width="480px"
      >
        {detailItem && (
          <div style={{ padding: theme.spacing.lg }}>

            <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
              {detailItem.cover_path && (
                <img
                  src={detailItem.cover_path}
                  alt={detailItem.title}
                  style={{
                    width: '72px', height: '108px',
                    objectFit: 'cover', borderRadius: theme.radius.sm,
                    flexShrink: 0, boxShadow: theme.shadows.card,
                  }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                  <Badge customColor={theme.colors.typeColors[detailItem.tipo]} size="sm">
                    {detailItem.tipo}
                  </Badge>
                  {detailItem.isProximo
                    ? <Badge variant="warning" size="sm">PRÓXIMO</Badge>
                    : <Badge variant={STATUS_VARIANT[detailItem.watched_status ?? 'nao_assistido']} size="sm">
                        {STATUS_LABELS[detailItem.watched_status ?? 'nao_assistido']}
                      </Badge>
                  }
                </div>

                <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                  {detailItem.release_year}
                  {detailItem.duration && ` · ${detailItem.tipo === 'filme'
                    ? `${Math.floor(detailItem.duration / 60)}h ${detailItem.duration % 60}min`
                    : `${detailItem.duration} ep.`}`}
                </div>

                {detailItem.director && (
                  <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                    Dir. {detailItem.director}
                  </div>
                )}

                {!detailItem.isProximo && detailItem.rating != null && detailItem.rating > 0 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                    padding: '2px 10px',
                    background: `${theme.colors.success}20`,
                    border: `1px solid ${theme.colors.success}50`,
                    borderRadius: theme.radius.md, alignSelf: 'flex-start',
                  }}>
                    <span style={{
                      fontSize: '22px', fontWeight: theme.fontWeights.black,
                      fontFamily: theme.fonts.display, color: theme.colors.success, lineHeight: 1,
                    }}>
                      {detailItem.rating.toFixed(1)}
                    </span>
                    <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>/ 10</span>
                  </div>
                )}
              </div>
            </div>

            {detailItem.genres && detailItem.genres.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: theme.spacing.md }}>
                {detailItem.genres.map(g => <Badge key={g} variant="muted" size="sm">{g}</Badge>)}
              </div>
            )}

            {detailItem.synopsis && (
              <p style={{
                color: theme.colors.textMuted, fontSize: theme.fontSizes.small,
                lineHeight: 1.6, marginBottom: theme.spacing.lg,
                display: '-webkit-box', WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {detailItem.synopsis}
              </p>
            )}

            {!detailItem.isProximo && detailItem.observations && (
              <div style={{
                marginBottom: theme.spacing.lg, padding: theme.spacing.md,
                background: theme.colors.surface,
                borderLeft: `3px solid ${theme.colors.primary}`,
                borderRadius: theme.radius.sm,
              }}>
                <div style={{
                  fontSize: '10px', color: theme.colors.primary, marginBottom: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: theme.fontWeights.bold,
                }}>
                  Observações
                </div>
                <p style={{
                  color: theme.colors.textSecondary, fontSize: theme.fontSizes.small,
                  lineHeight: 1.6, fontStyle: 'italic', margin: 0,
                }}>
                  {detailItem.observations}
                </p>
              </div>
            )}

            <div style={{
              display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end',
              paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.surface}`,
            }}>
              <Button variant="ghost" onClick={() => setDetailItem(null)}>Fechar</Button>
              <Button variant="danger" onClick={() => handleRemoveItem(detailItem)}>
                Remover da lista
              </Button>
              {detailItem.isProximo && (
                <Button onClick={() => {
                  const wItem = watchlistItems.find(w => w.id === detailItem.sourceId)
                  if (wItem) setMoveToCatalog(wItem)
                }}>
                  → Adicionar
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Mover Próximo para catálogo */}
      {moveToCatalog && (
        <MarkAsWatchedModal
          item={moveToCatalog}
          onClose={() => setMoveToCatalog(null)}
          onDone={async () => {
            setMoveToCatalog(null)
            setDetailItem(null)
            await fetchWatchlist()
            if (selected) await loadListMedia(selected.id)
          }}
        />
      )}
    </div>
  )
}
