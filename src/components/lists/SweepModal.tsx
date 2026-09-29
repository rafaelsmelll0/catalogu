import { useEffect, useMemo, useState } from 'react'
import { theme } from '../../styles/theme.ts'
import { ipc } from '../../lib/ipc.ts'
import { LIST_KIND_LABEL, type AiResult, type ListEntryRef, type SweepItem, type SweepResult } from '../../types/index.ts'
import { Modal, Button, Badge } from '../ui/index.ts'
import { showToast } from '../Toast.tsx'
import CatSit from '../../assets/cat-sit.svg?react'

interface Props {
  listCount: number
  onClose:   () => void
  onApplied: () => void
}

const itemKey = (listId: number, i: SweepItem) => `${listId}:${i.kind}:${i.id}`

/**
 * Varredura: o catálogo e Próximos inteiros contra todas as listas existentes.
 * Franquias vêm do TMDB (certeiro); temas vêm da IA. Tudo passa por revisão.
 */
export function SweepModal({ listCount, onClose, onApplied }: Props) {
  const [data, setData]       = useState<SweepResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  async function run() {
    setError(null)
    setData(null)
    const res = await ipc<AiResult<SweepResult>>('lists:sweep')
    if (!res.ok) { setError(res.error); return }
    setData(res.data)
    setChecked(new Set(res.data.groups.flatMap(g => g.items.map(i => itemKey(g.listId, i)))))
  }

  useEffect(() => { run() }, [])

  useEffect(() => {
    if (data || error) return
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [data, error])

  const total = useMemo(() => data?.groups.reduce((n, g) => n + g.items.length, 0) ?? 0, [data])

  function toggle(k: string) {
    const next = new Set(checked)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setChecked(next)
  }

  function toggleGroup(listId: number, items: SweepItem[], on: boolean) {
    const next = new Set(checked)
    for (const i of items) {
      if (on) next.add(itemKey(listId, i))
      else next.delete(itemKey(listId, i))
    }
    setChecked(next)
  }

  async function apply() {
    if (!data) return
    setApplying(true)
    const add = data.groups.map(g => ({
      listId:  g.listId,
      entries: g.items.filter(i => checked.has(itemKey(g.listId, i))).map<ListEntryRef>(i => ({ kind: i.kind, id: i.id })),
    }))
    const dismissed = data.groups.flatMap(g => g.items
      .filter(i => !checked.has(itemKey(g.listId, i)))
      .map(i => ({ listId: g.listId, entry: { kind: i.kind, id: i.id } as ListEntryRef })))
    const res = await ipc<AiResult<{ added: number }>>('lists:applySweep', { add, dismissed })
    setApplying(false)
    if (!res.ok) { showToast(res.error, 'error'); return }
    const lists = add.filter(a => a.entries.length).length
    showToast(res.data.added
      ? `${res.data.added} ${res.data.added === 1 ? 'título encaixado' : 'títulos encaixados'} em ${lists} ${lists === 1 ? 'lista' : 'listas'}.`
      : 'Nada adicionado; as recusas foram lembradas.')
    onApplied()
    onClose()
  }

  async function resetDismissed() {
    await ipc('lists:resetSweep')
    showToast('As recusas foram esquecidas. Varrendo de novo…', 'info')
    run()
  }

  return (
    <Modal open onClose={onClose} title="Varrer catálogo nas listas" width="780px">
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '78vh' }}>
        {error ? (
          <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
            <p style={{ color: theme.colors.danger, fontSize: theme.fontSizes.ui, marginBottom: theme.spacing.md }}>{error}</p>
            <Button onClick={run}>Tentar de novo</Button>
          </div>
        ) : !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.xxl} 0` }}>
            <CatSit style={{ width: '90px', height: '90px', animation: 'float 2s ease-in-out infinite' }} />
            <div style={{ color: theme.colors.textPrimary, fontSize: theme.fontSizes.body }}>
              Comparando catálogo e Próximos com suas {listCount} listas…
            </div>
            <div style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.small }}>{elapsed}s</div>
          </div>
        ) : (
          <>
            <div style={{ padding: `${theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.sm}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
                {total === 0
                  ? 'Tudo em ordem: nada do seu catálogo ficou de fora das listas.'
                  : <>{total} {total === 1 ? 'sugestão' : 'sugestões'} em {data.groups.length} {data.groups.length === 1 ? 'lista' : 'listas'}. Desmarque o que não pertence.</>}
              </div>
              {!data.aiUsed && !data.aiError && (
                <Note>Sem IA configurada, só entram as franquias do TMDB. Com a IA, a varredura também encaixa nos temas.</Note>
              )}
              {data.aiError && <Note color={theme.colors.warning}>A parte da IA falhou ({data.aiError}); abaixo, só as franquias do TMDB.</Note>}
              {data.franchisesPending > 20 && (
                <Note>As franquias ainda não foram analisadas. Abra 🎞 Franquias uma vez para incluí-las.</Note>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${theme.spacing.lg}` }}>
              {data.groups.map(g => {
                const on = g.items.filter(i => checked.has(itemKey(g.listId, i))).length
                return (
                  <div key={g.listId} style={{ marginBottom: theme.spacing.lg }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.sm} 0`,
                      borderBottom: `1px solid ${theme.colors.surface}`, marginBottom: theme.spacing.xs,
                    }}>
                      <span style={{ fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>{g.listName}</span>
                      <Badge variant="muted" size="sm">{LIST_KIND_LABEL[g.kind].one}</Badge>
                      <span style={{ fontSize: theme.fontSizes.small, color: theme.colors.textMuted, flex: 1 }}>{on}/{g.items.length}</span>
                      <button
                        onClick={() => toggleGroup(g.listId, g.items, on < g.items.length)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.fontSizes.small, color: theme.colors.primaryMuted }}
                      >
                        {on < g.items.length ? 'Marcar todos' : 'Desmarcar todos'}
                      </button>
                    </div>
                    {g.items.map(i => {
                      const k = itemKey(g.listId, i)
                      return (
                        <label key={k} style={{
                          display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer',
                          padding: `5px ${theme.spacing.xs}`, borderRadius: theme.radius.sm,
                          opacity: checked.has(k) ? 1 : 0.5,
                        }}>
                          <input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)}
                            style={{ accentColor: theme.colors.primary, width: '16px', height: '16px', flexShrink: 0 }} />
                          <div style={{
                            width: '26px', height: '39px', flexShrink: 0, borderRadius: '3px',
                            background: i.cover_path ? `url(${i.cover_path}) center/cover` : theme.colors.surfaceHover,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textPrimary }}>
                              {i.title} <span style={{ color: theme.colors.textMuted }}>{i.year ? `(${i.year})` : ''}</span>
                              {i.kind === 'watchlist' && <span style={{ marginLeft: '6px' }}><Badge variant="warning" size="sm">PRÓXIMO</Badge></span>}
                            </div>
                            <div style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>{i.reason}</div>
                          </div>
                          <span style={{
                            fontSize: '10px', fontWeight: theme.fontWeights.bold, padding: '2px 8px', borderRadius: theme.radius.full,
                            color: i.source === 'tmdb' ? theme.colors.success : theme.colors.primaryMuted,
                            background: i.source === 'tmdb' ? `${theme.colors.success}18` : theme.colors.primaryGlow,
                          }}>
                            {i.source === 'tmdb' ? 'TMDB' : 'IA'}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <div style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderTop: `1px solid ${theme.colors.surface}`,
              display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
            }}>
              <button onClick={resetDismissed} title="Volta a sugerir o que você desmarcou em varreduras anteriores"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, textAlign: 'left' }}>
                ↺ Voltar a sugerir o que recusei
              </button>
              <div style={{ flex: 1 }} />
              {total > 0 && (
                <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted, maxWidth: '240px', textAlign: 'right' }}>
                  Os desmarcados não voltam a ser sugeridos para aquela lista.
                </span>
              )}
              <Button variant="ghost" onClick={onClose}>{total ? 'Cancelar' : 'Fechar'}</Button>
              {total > 0 && (
                <Button onClick={apply} loading={applying}>
                  Adicionar {checked.size}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function Note({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: theme.fontSizes.small, color: color ?? theme.colors.textMuted }}>
      {children}
    </div>
  )
}
