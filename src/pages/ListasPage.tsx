import { useEffect, useState } from 'react'
import { normalize } from '../lib/normalize.ts'
import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { MediaGrid } from '../components/MediaGrid.tsx'
import { showToast } from '../components/Toast.tsx'
import { Button, Input, Modal } from '../components/ui/index.ts'
import Roll from '../assets/roll.svg?react'

interface ListItem {
  id:          number
  name:        string
  description: string
  media_count: number
}

export function ListasPage() {
  const { fetchAll, items: allMedia } = useMediaStore()
  const [lists, setLists]                         = useState<ListItem[]>([])
  const [selected, setSelected]                   = useState<ListItem | null>(null)
  const [listMedia, setListMedia]                 = useState<Media[]>([])
  const [detailMedia, setDetailMedia]             = useState<Media | null>(null)
  const [loading, setLoading]                     = useState(true)
  const [showCreate, setShowCreate]               = useState(false)
  const [showAddMedia, setShowAddMedia]           = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newName, setNewName]                     = useState('')
  const [newDesc, setNewDesc]                     = useState('')
  const [editMode, setEditMode]                   = useState(false)
  const [addSearch, setAddSearch]                 = useState('')
  const [hoveredList, setHoveredList]             = useState<number | null>(null)

  useEffect(() => { fetchAll(); loadLists() }, [])

  async function loadLists() {
    setLoading(true)
    const data = await window.electronAPI.invoke('lists:getAll') as ListItem[]
    setLists(data)
    setLoading(false)
  }

  async function loadListMedia(listId: number) {
    const data = await window.electronAPI.invoke('lists:getMedia', listId) as Media[]
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

  async function handleAddMedia(mediaId: number) {
    if (!selected) return
    await window.electronAPI.invoke('lists:addMedia', mediaId, selected.id)
    await loadListMedia(selected.id)
    await loadLists()
    showToast('Mídia adicionada à lista!')
  }

  async function handleRemoveMedia(mediaId: number) {
    if (!selected) return
    await window.electronAPI.invoke('lists:removeMedia', mediaId, selected.id)
    await loadListMedia(selected.id)
    await loadLists()
    setDetailMedia(null)
    showToast('Mídia removida da lista.', 'info')
  }

  const mediaNotInList = allMedia.filter(m => !listMedia.some(lm => lm.id === m.id))
  const filteredToAdd  = addSearch.trim()
    ? mediaNotInList.filter(m =>
        normalize(m.title).includes(normalize(addSearch)) ||
        (m.release_year ?? '').includes(addSearch)
      )
    : mediaNotInList

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', background: theme.colors.bg }}>

      {/* — Sidebar — */}
      <div style={{
        width: '260px', flexShrink: 0,
        background: theme.colors.surface,
        borderRight: `1px solid ${theme.colors.surfaceElevated}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header sidebar */}
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
            <Button size="sm" onClick={() => setShowCreate(v => !v)}>
              + Nova
            </Button>
          </div>

          {showCreate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              <Input
                label="Nome"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <Input
                label="Descrição"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                <Button size="sm" onClick={handleCreate} style={{ flex: 1 }}>Criar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }}>
                  × Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de listas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.fontSizes.ui }}>
              Carregando...
            </div>
          ) : lists.length === 0 ? (
            <div style={{
              padding: theme.spacing.lg,
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.ui,
              textAlign: 'center',
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
                    : isHovered
                      ? 'rgba(255,255,255,0.04)'
                      : 'transparent',
                  borderLeft: isActive
                    ? `3px solid ${theme.colors.primary}`
                    : '3px solid transparent',
                  transition: `background ${theme.transitions.fast}`,
                }}
              >
                <div style={{
                  fontSize: theme.fontSizes.ui,
                  fontWeight: isActive ? theme.fontWeights.bold : theme.fontWeights.medium,
                  color: isActive ? theme.colors.primary : theme.colors.textPrimary,
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

      {/* — Área principal — */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
            {/* Header da lista selecionada */}
            <div style={{
              padding: `${theme.spacing.lg} ${theme.layout.pagePadding}`,
              borderBottom: `1px solid ${theme.colors.surfaceElevated}`,
              background: theme.colors.bg,
              flexShrink: 0,
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
                      fontSize: theme.fontSizes.h1,
                      fontWeight: theme.fontWeights.black,
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
                    <Button onClick={() => { setAddSearch(''); setShowAddMedia(true) }}>
                      + Adicionar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditMode(true)}>
                      ✎ Editar
                    </Button>
                    <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                      Excluir lista
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Grid de mídias da lista */}
            <div style={{ flex: 1, paddingTop: theme.spacing.lg }}>
              <MediaGrid
                items={listMedia}
                onCardClick={setDetailMedia}
                emptyMessage="Esta lista está vazia — clique em + Adicionar"
                emptyIcon="roll"
              />
            </div>
          </>
        )}
      </div>

      {/* — Modal: Adicionar mídia à lista — */}
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
              {filteredToAdd.length} de {mediaNotInList.length} disponíveis
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
                {mediaNotInList.length === 0
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
                  <div style={{
                    fontSize: theme.fontSizes.ui,
                    color: theme.colors.textPrimary,
                    fontWeight: theme.fontWeights.medium,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, marginTop: '2px' }}>
                    {m.tipo} · {m.release_year}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleAddMedia(m.id)} style={{ flexShrink: 0 }}>
                  + Adicionar
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* — Modal: Confirmar exclusão de lista — */}
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

      {/* — Modal: Remover mídia da lista — */}
      <Modal
        open={!!detailMedia}
        onClose={() => setDetailMedia(null)}
        title={detailMedia?.title ?? ''}
        width="420px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.xs }}>
            {detailMedia?.tipo} · {detailMedia?.release_year}
          </p>
          {detailMedia?.synopsis && (
            <p style={{
              color: theme.colors.textMuted, fontSize: theme.fontSizes.small,
              lineHeight: 1.6, marginBottom: theme.spacing.lg,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {detailMedia.synopsis}
            </p>
          )}
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setDetailMedia(null)}>Fechar</Button>
            <Button variant="danger" onClick={() => detailMedia && handleRemoveMedia(detailMedia.id)}>
              Remover da lista
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
