import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import { todayLocal } from '../lib/date.ts'
import type { Media, WatchlistItem } from '../types/index.ts'
import { MarkAsWatchedModal } from './MarkAsWatchedModal.tsx'
import {
  Modal, Button, Input, Textarea, Select, Badge, RatingSlider,
  type SelectOption,
} from './ui/index.ts'

type Step      = 'tipo' | 'busca' | 'selecao' | 'form'
type TipoMidia = 'filme' | 'serie'
type Status    = 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'

type ConflictType =
  | 'duplicate_catalog'
  | 'duplicate_watchlist'
  | 'in_watchlist'
  | 'in_catalog'

interface ConflictState {
  type:           ConflictType
  mediaItem?:     Media
  watchlistItem?: WatchlistItem
}

interface SearchResult {
  id:        number
  title:     string
  overview:  string
  year:      string
  posterUrl: string | null
  rawData:   Record<string, unknown>
}

interface FormData {
  title:          string
  release_year:   string
  synopsis:       string
  observations:   string
  rating:         number
  duration:       string
  watched:        string
  cover_path:     string
  backdrop_path:  string
  tipo:           TipoMidia
  watched_status: Status
  watched_date:   string
  genres:         string
  director:       string
  cast:           string
  tmdb_id:        number | null
}

const EMPTY_FORM: FormData = {
  title: '', release_year: '', synopsis: '', observations: '',
  rating: 0, duration: '', watched: '', cover_path: '', backdrop_path: '',
  tipo: 'filme', watched_status: 'assistido', watched_date: '',
  genres: '', director: '', cast: '', tmdb_id: null,
}

const STATUS_OPTIONS: SelectOption<Status>[] = [
  { value: 'assistido',     label: 'Assistido',     color: '#46D369' },
  { value: 'assistindo',    label: 'Assistindo',    color: '#8055d0' },
  { value: 'nao_assistido', label: 'Não assistido', color: '#808080' },
  { value: 'nao_lembro',   label: 'Não lembro',    color: '#F5A623' },
]

const TIPO_OPTIONS: SelectOption<TipoMidia>[] = [
  { value: 'filme', label: 'Filme', color: '#8055d0' },
  { value: 'serie', label: 'Série', color: '#54B9C5' },
]

interface Props {
  onClose: () => void
  mode?:   'catalog' | 'watchlist'
}

export function AddMediaModal({ onClose, mode = 'catalog' }: Props) {
  const { addMedia } = useMediaStore()
  const { addItem }  = useWatchlistStore()

  const [step, setStep]           = useState<Step>('tipo')
  const [tipo, setTipo]           = useState<TipoMidia>('filme')
  const [query, setQuery]         = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]     = useState<SearchResult[]>([])
  const [form, setForm]           = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [conflict, setConflict]   = useState<ConflictState | null>(null)
  const [moveItem, setMoveItem]   = useState<WatchlistItem | null>(null)

  // Multi-select (só modo watchlist)
  const [multiMode, setMultiMode]       = useState(false)
  const [selected, setSelected]         = useState<Set<number>>(new Set())
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; title: string } | null>(null)
  const [bulkDone, setBulkDone]         = useState(false)
  const [bulkLog, setBulkLog]           = useState<{ title: string; status: 'added' | 'dup_watchlist' | 'dup_catalog' | 'error' }[]>([])

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    try {
      const channel = tipo === 'filme' ? 'tmdb:searchMovies' : 'tmdb:searchSeries'
      const raw = await window.electronAPI.invoke(channel, query) as {
        id: number; title: string; overview: string
        release_date: string; poster_path: string | null
      }[]
      const mapped: SearchResult[] = await Promise.all(raw.map(async r => ({
        id: r.id, title: r.title, overview: r.overview,
        year: (r.release_date ?? '').slice(0, 4),
        posterUrl: r.poster_path
          ? await window.electronAPI.invoke('tmdb:posterUrl', r.poster_path) as string
          : null,
        rawData: r as unknown as Record<string, unknown>,
      })))
      setResults(mapped)
      setStep('selecao')
    } catch {
      setError('Erro na busca. Verifique sua conexão.')
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(result: SearchResult) {
    setSearching(true)
    try {
      const channel = tipo === 'filme' ? 'tmdb:movieDetails' : 'tmdb:tvDetails'
      const details = await window.electronAPI.invoke(channel, result.id) as {
        id: number; title?: string; name?: string; overview: string
        release_date?: string; first_air_date?: string
        runtime?: number; number_of_episodes?: number
        genres: { name: string }[]
        poster_path:   string | null
        backdrop_path: string | null
        credits: {
          cast: { name: string; order: number }[]
          crew: { name: string; job: string }[]
        }
      }
      const posterUrl = details.poster_path
        ? await window.electronAPI.invoke('tmdb:posterUrl', details.poster_path) as string
        : ''
      const backdropUrl = details.backdrop_path
        ? await window.electronAPI.invoke('tmdb:backdropUrl', details.backdrop_path) as string
        : ''
      const director = details.credits?.crew?.find(c => c.job === 'Director')?.name ?? ''
      const cast = (details.credits?.cast ?? []).slice(0, 5).map(c => c.name).join(', ')
      const newForm = {
        ...EMPTY_FORM, tipo,
        title:         details.title ?? details.name ?? '',
        release_year:  (details.release_date ?? details.first_air_date ?? '').slice(0, 4),
        synopsis:      details.overview,
        duration:      String(details.runtime ?? details.number_of_episodes ?? ''),
        genres:        (details.genres ?? []).map((g: { name: string }) => g.name).join(', '),
        cover_path:    posterUrl,
        backdrop_path: backdropUrl,
        director, cast,
        tmdb_id: details.id,
      }
      setForm(newForm)

      const tmdbId      = details.id
      const title       = details.title ?? details.name ?? ''
      const releaseYear = (details.release_date ?? details.first_air_date ?? '').slice(0, 4) || undefined

      let detectedConflict: ConflictState | null = null
      if (mode === 'catalog') {
        const inCatalog = await window.electronAPI.invoke('media:findDuplicate', tmdbId, title, releaseYear) as Media | null
        if (inCatalog) detectedConflict = { type: 'duplicate_catalog', mediaItem: inCatalog }
        else {
          const inWatchlist = await window.electronAPI.invoke('watchlist:findDuplicate', tmdbId, title, releaseYear) as WatchlistItem | null
          if (inWatchlist) detectedConflict = { type: 'in_watchlist', watchlistItem: inWatchlist }
        }
      } else {
        const inWatchlist = await window.electronAPI.invoke('watchlist:findDuplicate', tmdbId, title, releaseYear) as WatchlistItem | null
        if (inWatchlist) detectedConflict = { type: 'duplicate_watchlist', watchlistItem: inWatchlist }
        else {
          const inCatalog = await window.electronAPI.invoke('media:findDuplicate', tmdbId, title, releaseYear) as Media | null
          if (inCatalog) detectedConflict = { type: 'in_catalog', mediaItem: inCatalog }
        }
      }

      if (detectedConflict) {
        setConflict(detectedConflict)
      } else {
        setStep('form')
      }
    } catch {
      setError('Erro ao buscar detalhes.')
    } finally {
      setSearching(false)
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return }
    setSaving(true)
    setError(null)
    try {
      await doSave()
    } catch {
      setError('Erro ao salvar.')
      setSaving(false)
    }
  }

  async function doSave() {
    if (mode === 'watchlist') {
      await addItem({
        title:         form.title,
        tipo:          form.tipo,
        release_year:  form.release_year  || undefined,
        synopsis:      form.synopsis      || undefined,
        cover_path:    form.cover_path    || undefined,
        backdrop_path: form.backdrop_path || undefined,
        duration:      form.duration ? Number(form.duration) : undefined,
        director:      form.director      || undefined,
        genres:        form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
        cast:          form.cast   ? form.cast.split(',').map(c => c.trim()).filter(Boolean)   : [],
        tmdb_id:       form.tmdb_id ?? undefined,
      })
    } else {
      await addMedia({
        title:          form.title,
        release_year:   form.release_year   || undefined,
        synopsis:       form.synopsis       || undefined,
        observations:   form.observations   || undefined,
        rating:         form.rating > 0 ? form.rating : undefined,
        duration:       form.duration ? Number(form.duration) : undefined,
        watched:        form.watched  ? Number(form.watched)  : undefined,
        cover_path:     form.cover_path     || undefined,
        backdrop_path:  form.backdrop_path  || undefined,
        tipo:           form.tipo,
        watched_status: form.watched_status,
        watched_date:   form.watched_status === 'assistido' ? (form.watched_date || todayLocal()) : undefined,
        genres:         form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
        director:       form.director       || undefined,
        cast:           form.cast   ? form.cast.split(',').map(c => c.trim()).filter(Boolean)   : [],
        tmdb_id:        form.tmdb_id ?? undefined,
      })
    }
    onClose()
  }

  async function handleBulkAdd() {
    if (selected.size === 0) return
    const toAdd = results.filter(r => selected.has(r.id))
    setBulkProgress({ current: 0, total: toAdd.length, title: '' })
    setBulkLog([])

    let added = 0
    for (const r of toAdd) {
      setBulkProgress({ current: added, total: toAdd.length, title: r.title })
      try {
        const channel = tipo === 'filme' ? 'tmdb:movieDetails' : 'tmdb:tvDetails'
        const details = await window.electronAPI.invoke(channel, r.id) as {
          id: number; title?: string; name?: string; overview: string
          release_date?: string; first_air_date?: string
          runtime?: number; number_of_episodes?: number
          genres: { name: string }[]
          poster_path: string | null
          backdrop_path: string | null
          credits: { cast: { name: string }[]; crew: { name: string; job: string }[] }
        }

        const tmdbId      = details.id
        const title       = details.title ?? details.name ?? ''
        const releaseYear = (details.release_date ?? details.first_air_date ?? '').slice(0, 4) || undefined
        const inWatchlist = await window.electronAPI.invoke('watchlist:findDuplicate', tmdbId, title, releaseYear)
        const inCatalog   = await window.electronAPI.invoke('media:findDuplicate', tmdbId, title, releaseYear)

        if (inWatchlist) {
          setBulkLog(prev => [...prev, { title, status: 'dup_watchlist' }])
          added++; continue
        }
        if (inCatalog) {
          setBulkLog(prev => [...prev, { title, status: 'dup_catalog' }])
          added++; continue
        }

        const posterUrl   = details.poster_path   ? await window.electronAPI.invoke('tmdb:posterUrl', details.poster_path)     as string : ''
        const backdropUrl = details.backdrop_path ? await window.electronAPI.invoke('tmdb:backdropUrl', details.backdrop_path) as string : ''
        const director    = details.credits?.crew?.find((c: { job: string }) => c.job === 'Director')?.name ?? ''
        const cast        = (details.credits?.cast ?? []).slice(0, 5).map((c: { name: string }) => c.name)
        const genres      = (details.genres ?? []).map((g: { name: string }) => g.name)

        await addItem({
          title, tipo,
          release_year:  releaseYear,
          synopsis:      details.overview || undefined,
          cover_path:    posterUrl   || undefined,
          backdrop_path: backdropUrl || undefined,
          duration:      details.runtime ?? details.number_of_episodes ?? undefined,
          director:      director    || undefined,
          genres, cast,
          tmdb_id: details.id,
        })
        setBulkLog(prev => [...prev, { title, status: 'added' }])
      } catch {
        setBulkLog(prev => [...prev, { title: r.title, status: 'error' }])
      }

      added++
      setBulkProgress({ current: added, total: toAdd.length, title: r.title })
      await new Promise(res => setTimeout(res, 150))
    }

    setBulkProgress({ current: toAdd.length, total: toAdd.length, title: '' })
    setBulkDone(true)
  }

  const titleByStep: Record<Step, string> = {
    tipo:    mode === 'watchlist' ? 'Adicionar a Próximos' : 'Adicionar Mídia',
    busca:   `Buscar ${tipo}`,
    selecao: 'Selecionar resultado',
    form:    form.title || 'Preencher dados',
  }

  if (moveItem) {
    return (
      <MarkAsWatchedModal
        item={moveItem}
        onClose={() => { setMoveItem(null); setConflict(null) }}
        onDone={onClose}
      />
    )
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={titleByStep[step]}
        width={step === 'selecao' ? '680px' : step === 'form' ? '600px' : '480px'}
      >
        <div style={{ padding: theme.spacing.lg }}>

          {error && (
            <div style={{
              background: 'rgba(229,9,14,0.12)',
              border: `1px solid ${theme.colors.danger}`,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.sm,
              marginBottom: theme.spacing.md,
              fontSize: theme.fontSizes.ui,
              color: theme.colors.danger,
            }}>
              {error}
            </div>
          )}

          {/* STEP: TIPO */}
          {step === 'tipo' && (
            <div>
              <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg, fontSize: theme.fontSizes.ui }}>
                Que tipo de mídia deseja adicionar?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                {TIPO_OPTIONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setTipo(t.value); setStep('busca') }}
                    className="focus-ring"
                    style={{
                      background: theme.colors.surface,
                      border: `1px solid ${theme.colors.surfaceHover}`,
                      borderRadius: theme.radius.md,
                      color: theme.colors.textPrimary,
                      fontSize: theme.fontSizes.body,
                      fontWeight: theme.fontWeights.medium,
                      padding: theme.spacing.md,
                      cursor: 'pointer', textAlign: 'left',
                      transition: `all ${theme.transitions.fast}`,
                      display: 'flex', alignItems: 'center', gap: theme.spacing.md,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = theme.colors.primary
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = theme.colors.surfaceHover
                      e.currentTarget.style.background = theme.colors.surface
                    }}
                  >
                    <Badge customColor={t.color} size="md">{t.label}</Badge>
                    <span style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui }}>
                      Busca no TMDB
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setStep('form')}
                  className="focus-ring"
                  style={{
                    background: 'transparent',
                    border: `1px dashed ${theme.colors.surfaceHover}`,
                    borderRadius: theme.radius.md,
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes.ui,
                    padding: theme.spacing.md,
                    cursor: 'pointer', textAlign: 'left',
                    transition: `all ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = theme.colors.textPrimary }}
                  onMouseLeave={e => { e.currentTarget.style.color = theme.colors.textMuted }}
                >
                  ✏ Adicionar manualmente (sem busca)
                </button>
              </div>
            </div>
          )}

          {/* STEP: BUSCA */}
          {step === 'busca' && (
            <div>
              <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md, fontSize: theme.fontSizes.ui }}>
                Digite o título para buscar:
              </p>
              <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.md, alignItems: 'flex-end' }}>
                <Input
                  icon="⌕"
                  label="Título"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button onClick={handleSearch} loading={searching} disabled={!query.trim()} size="lg">
                  Buscar
                </Button>
              </div>
              <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                <Button variant="ghost" size="sm" onClick={() => setStep('tipo')}>← Voltar</Button>
                <Button variant="ghost" size="sm" onClick={() => { setForm({ ...EMPTY_FORM, tipo }); setStep('form') }}>
                  Preencher manualmente
                </Button>
              </div>
            </div>
          )}

          {/* STEP: SELEÇÃO */}
          {step === 'selecao' && (
            <div>
              {/* Barra de progresso do bulk add */}
              {bulkProgress && (
                <div style={{
                  marginBottom: theme.spacing.md,
                  padding: theme.spacing.md,
                  background: theme.colors.surface,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.surfaceElevated}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                    <span style={{ fontSize: theme.fontSizes.ui, color: theme.colors.textSecondary }}>
                      {bulkDone ? 'Concluído!' : bulkProgress.title || 'Aguarde...'}
                    </span>
                    <span style={{ fontSize: theme.fontSizes.ui, fontWeight: theme.fontWeights.bold, color: theme.colors.primary }}>
                      {bulkProgress.current}/{bulkProgress.total}
                    </span>
                  </div>
                  <div style={{ height: '6px', background: theme.colors.surfaceElevated, borderRadius: theme.radius.full, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: theme.colors.primary,
                      borderRadius: theme.radius.full,
                      width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  {/* Log de resultados */}
                  {bulkLog.length > 0 && (
                    <div style={{
                      marginTop: theme.spacing.sm,
                      maxHeight: '160px',
                      overflowY: 'auto',
                      display: 'flex', flexDirection: 'column', gap: '3px',
                    }}>
                      {bulkLog.map((entry, i) => {
                        const color =
                          entry.status === 'added'         ? theme.colors.success :
                          entry.status === 'dup_watchlist' ? theme.colors.warning :
                          entry.status === 'dup_catalog'   ? theme.colors.warning :
                                                             theme.colors.danger
                        const label =
                          entry.status === 'added'         ? '✓ Adicionado' :
                          entry.status === 'dup_watchlist' ? '⚠ Já está em Próximos' :
                          entry.status === 'dup_catalog'   ? '⚠ Já está no catálogo' :
                                                             '✗ Erro'
                        return (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: theme.fontSizes.tiny, padding: '2px 0',
                            borderBottom: `1px solid ${theme.colors.surfaceElevated}`,
                          }}>
                            <span style={{ color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {entry.title}
                            </span>
                            <span style={{ color, flexShrink: 0, marginLeft: theme.spacing.sm, fontWeight: theme.fontWeights.bold }}>
                              {label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {bulkDone && (
                    <div style={{ marginTop: theme.spacing.sm, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button size="sm" onClick={onClose}>Fechar</Button>
                    </div>
                  )}
                </div>
              )}

              {!bulkProgress && (
                <>
                  {/* Header com contador e botão multi-select */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
                    <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui }}>
                      {results.length} resultado(s) para "{query}".{' '}
                      {multiMode && selected.size > 0 && (
                        <span style={{ color: theme.colors.primary, fontWeight: theme.fontWeights.bold }}>
                          {selected.size} selecionado(s)
                        </span>
                      )}
                    </p>
                    {mode === 'watchlist' && (
                      <Button
                        variant={multiMode ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => { setMultiMode(m => !m); setSelected(new Set()) }}
                      >
                        {multiMode ? '✕ Cancelar seleção' : '☑ Selecionar vários'}
                      </Button>
                    )}
                  </div>

                  {/* Lista de resultados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                    {results.map(r => {
                      const isSelected = selected.has(r.id)
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            if (multiMode) {
                              setSelected(prev => {
                                const next = new Set(prev)
                                if (next.has(r.id)) next.delete(r.id)
                                else next.add(r.id)
                                return next
                              })
                            } else {
                              handleSelect(r)
                            }
                          }}
                          disabled={searching}
                          className="focus-ring"
                          style={{
                            background: isSelected ? theme.colors.primaryGlow : theme.colors.surface,
                            border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.surfaceHover}`,
                            borderRadius: theme.radius.md,
                            color: theme.colors.textPrimary,
                            cursor: searching ? 'wait' : 'pointer',
                            padding: theme.spacing.sm,
                            textAlign: 'left',
                            display: 'flex', gap: theme.spacing.sm, alignItems: 'center',
                            transition: `all ${theme.transitions.fast}`,
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = theme.colors.primary
                              e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = theme.colors.surfaceHover
                              e.currentTarget.style.background = theme.colors.surface
                            }
                          }}
                        >
                          {/* Checkbox visual no modo multi */}
                          {multiMode && (
                            <div style={{
                              width: '18px', height: '18px', flexShrink: 0,
                              borderRadius: '4px',
                              border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.surfaceHover}`,
                              background: isSelected ? theme.colors.primary : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: `all ${theme.transitions.fast}`,
                            }}>
                              {isSelected && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>✓</span>}
                            </div>
                          )}

                          {r.posterUrl && (
                            <img src={r.posterUrl} alt={r.title}
                              style={{ width: '56px', height: '84px', objectFit: 'cover', borderRadius: theme.radius.sm, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: theme.fontWeights.bold, fontSize: theme.fontSizes.ui, marginBottom: '4px' }}>
                              {r.title} {r.year && <span style={{ color: theme.colors.textMuted, fontWeight: 400 }}>({r.year})</span>}
                            </div>
                            <div style={{
                              color: theme.colors.textSecondary, fontSize: theme.fontSizes.small,
                              lineHeight: 1.4, display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {r.overview || 'Sem sinopse.'}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: theme.spacing.md,
                  }}>
                    <Button variant="ghost" size="sm" onClick={() => setStep('busca')}>
                      ← Voltar à busca
                    </Button>
                    {multiMode && selected.size > 0 && (
                      <Button onClick={handleBulkAdd}>
                        + Adicionar {selected.size} título{selected.size > 1 ? 's' : ''}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP: FORM */}
          {step === 'form' && (
            <div>
              {form.cover_path && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.spacing.lg }}>
                  <img src={form.cover_path} alt={form.title}
                    style={{ height: '200px', borderRadius: theme.radius.md, objectFit: 'cover', boxShadow: theme.shadows.card }} />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                <Input label="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <Select<TipoMidia> label="Tipo" options={TIPO_OPTIONS} value={form.tipo}
                    onChange={v => setForm(f => ({ ...f, tipo: v }))} fullWidth />
                  {mode !== 'watchlist' && (
                    <Select<Status> label="Status" options={STATUS_OPTIONS} value={form.watched_status}
                      onChange={v => setForm(f => ({ ...f, watched_status: v }))} fullWidth />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <Input label="Ano" value={form.release_year} onChange={e => setForm(f => ({ ...f, release_year: e.target.value }))} />
                  <Input label={form.tipo === 'filme' ? 'Duração (min)' : 'Episódios'} type="number"
                    value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
                </div>

                {mode !== 'watchlist' && (
                  <RatingSlider value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
                )}

                {mode !== 'watchlist' && form.watched_status === 'assistido' && (
                  <Input
                    label="Data em que assistiu"
                    type="date"
                    value={form.watched_date || todayLocal()}
                    max={todayLocal()}
                    onChange={e => setForm(f => ({ ...f, watched_date: e.target.value }))}
                  />
                )}

                <Input label="Gêneros (separados por vírgula)" value={form.genres}
                  onChange={e => setForm(f => ({ ...f, genres: e.target.value }))} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <Input label="Diretor" value={form.director} onChange={e => setForm(f => ({ ...f, director: e.target.value }))} />
                  <Input label="Elenco (vírgula)" value={form.cast} onChange={e => setForm(f => ({ ...f, cast: e.target.value }))} />
                </div>

                <Textarea label="Sinopse" value={form.synopsis} onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))} rows={3} />

                {mode !== 'watchlist' && (
                  <Textarea label="Observações pessoais" value={form.observations}
                    onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} rows={2} />
                )}

                <Input label="URL do poster" value={form.cover_path}
                  onChange={e => setForm(f => ({ ...f, cover_path: e.target.value }))} />
              </div>

              <div style={{
                display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end',
                marginTop: theme.spacing.lg, paddingTop: theme.spacing.md,
                borderTop: `1px solid ${theme.colors.surface}`,
              }}>
                <Button variant="ghost" size="lg" onClick={() => setStep(results.length > 0 ? 'selecao' : 'busca')}>
                  ← Voltar
                </Button>
                <Button onClick={handleSave} loading={saving} size="lg">
                  {mode === 'watchlist' ? 'Adicionar a Próximos' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: já existe no catálogo */}
      <Modal
        open={conflict?.type === 'duplicate_catalog'}
        onClose={() => setConflict(null)}
        title="Título já cadastrado"
        width="420px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, lineHeight: 1.6, marginBottom: theme.spacing.lg }}>
            <strong style={{ color: theme.colors.textPrimary }}>{form.title}</strong> já está no seu catálogo.
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConflict(null)}>OK</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: está em Próximos → oferecer mover para catálogo */}
      <Modal
        open={conflict?.type === 'in_watchlist'}
        onClose={() => setConflict(null)}
        title="Título em Próximos"
        width="440px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, lineHeight: 1.6, marginBottom: theme.spacing.lg }}>
            <strong style={{ color: theme.colors.textPrimary }}>{form.title}</strong> está na sua lista de Próximos.
            Deseja mover para o catálogo agora?
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConflict(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (conflict?.watchlistItem) {
                setMoveItem(conflict.watchlistItem)
                setConflict(null)
              }
            }}>
              Mover para o catálogo
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: duplicata direta em Próximos */}
      <Modal
        open={conflict?.type === 'duplicate_watchlist'}
        onClose={() => setConflict(null)}
        title="Título já em Próximos"
        width="420px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, lineHeight: 1.6, marginBottom: theme.spacing.lg }}>
            <strong style={{ color: theme.colors.textPrimary }}>{form.title}</strong> já está na sua lista de Próximos.
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConflict(null)}>OK</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: já está no catálogo (tentou add em Próximos) */}
      <Modal
        open={conflict?.type === 'in_catalog'}
        onClose={() => setConflict(null)}
        title="Título já no catálogo"
        width="420px"
      >
        <div style={{ padding: theme.spacing.lg }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.ui, lineHeight: 1.6, marginBottom: theme.spacing.lg }}>
            <strong style={{ color: theme.colors.textPrimary }}>{form.title}</strong> já está no seu catálogo de {conflict?.mediaItem?.tipo === 'filme' ? 'filmes' : 'séries'}.
          </p>
          <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setConflict(null)}>OK</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
