import { useEffect, useState } from 'react'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import type { Franchise } from '../../types/index.ts'
import { Modal, Button } from '../ui/index.ts'
import { showToast } from '../Toast.tsx'
import { FranchiseParts } from './FranchiseParts.tsx'

interface Props {
  onClose:    () => void
  onOpenList: (listId: number) => void
  /** listas foram criadas/alteradas */
  onChanged:  () => void
}

/**
 * Franquias encontradas no catálogo pelas coleções do TMDB. Na primeira vez
 * analisa todos os filmes (uma consulta por filme); depois, só os novos.
 */
export function FranchisesModal({ onClose, onOpenList, onChanged }: Props) {
  const [scan, setScan]             = useState<{ current: number; total: number } | null>(null)
  const [franchises, setFranchises] = useState<Franchise[] | null>(null)
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  const [creating, setCreating]     = useState<number | null>(null)

  async function load() {
    const pending = await ipc<number>('franchises:pendingScan')
    if (pending > 0) {
      setScan({ current: 0, total: pending })
      await ipc('franchises:scan')
      setScan(null)
    }
    setFranchises(await ipc<Franchise[]>('franchises:getAll'))
  }

  useEffect(() => {
    const unsub = window.electronAPI.on('franchises:progress', (...args) => setScan(args[0] as { current: number; total: number }))
    load().catch(err => {
      console.error('[FranchisesModal]', err)
      showToast('Não foi possível analisar as franquias. Verifique sua conexão.', 'error')
      setScan(null)
      setFranchises([])
    })
    return unsub
  }, [])

  async function reload() {
    setFranchises(await ipc<Franchise[]>('franchises:getAll'))
    onChanged()
  }

  async function createList(f: Franchise) {
    setCreating(f.collectionId)
    try {
      const { listId } = await ipc<{ listId: number }>('franchises:createList', f.collectionId)
      showToast(`Lista "${f.name}" criada com ${f.owned + f.inProximos} títulos.`)
      await reload()
      onOpenList(listId)
    } catch (err) {
      console.error('[FranchisesModal.createList]', err)
      showToast('Não foi possível criar a lista.', 'error')
    } finally {
      setCreating(null)
    }
  }

  const shown = (franchises ?? []).filter(f => !onlyIncomplete || f.missing > 0)
  const withoutList = (franchises ?? []).filter(f => !f.listId).length

  return (
    <Modal open onClose={onClose} title="Franquias no seu catálogo" width="820px">
      <div style={{ padding: theme.spacing.lg }}>
        {scan ? (
          <div style={{ padding: `${theme.spacing.xl} 0`, textAlign: 'center' }}>
            <div style={{ fontSize: theme.fontSizes.body, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }}>
              Descobrindo a franquia de cada filme no TMDB…
            </div>
            <div style={{ height: '6px', background: theme.colors.surface, borderRadius: theme.radius.full, overflow: 'hidden', maxWidth: '420px', margin: '0 auto' }}>
              <div style={{
                height: '100%', background: theme.colors.primary, borderRadius: theme.radius.full,
                width: `${scan.total ? Math.round((scan.current / scan.total) * 100) : 0}%`, transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
              {scan.current} de {scan.total} · só na primeira vez; depois, apenas os títulos novos
            </div>
          </div>
        ) : franchises === null ? (
          <p style={{ color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.xl }}>Carregando…</p>
        ) : franchises.length === 0 ? (
          <p style={{ color: theme.colors.textMuted, textAlign: 'center', padding: theme.spacing.xl }}>
            Nenhuma franquia com 2 ou mais filmes no seu catálogo.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md, flexWrap: 'wrap' }}>
              <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary, flex: 1 }}>
                {franchises.length} franquias{withoutList > 0 && ` · ${withoutList} ainda sem lista`}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.fontSizes.small, color: theme.colors.textSecondary, cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyIncomplete} onChange={e => setOnlyIncomplete(e.target.checked)} style={{ accentColor: theme.colors.primary }} />
                Só as que têm filmes faltando
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {shown.map(f => (
                <div key={f.collectionId} style={{
                  background: theme.colors.surface, border: `1px solid ${theme.colors.surfaceElevated}`,
                  borderRadius: theme.radius.md, padding: theme.spacing.md,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted }}>
                        {f.owned} de {f.parts.length} no catálogo · {f.watched} vistos
                        {f.inProximos > 0 && ` · ${f.inProximos} em Próximos`}
                        {f.missing > 0 && <span style={{ color: theme.colors.danger }}> · faltam {f.missing}</span>}
                        {f.upcoming > 0 && ` · ${f.upcoming} em breve`}
                      </div>
                    </div>
                    {f.listId ? (
                      <Button size="sm" variant="ghost" onClick={() => onOpenList(f.listId!)}>Abrir lista "{f.listName}" →</Button>
                    ) : (
                      <Button size="sm" onClick={() => createList(f)} loading={creating === f.collectionId}>+ Criar lista</Button>
                    )}
                  </div>
                  <FranchiseParts parts={f.parts} listId={f.listId} size="sm" onChanged={reload} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
