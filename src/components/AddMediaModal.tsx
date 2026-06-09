import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import { useMediaStore } from '../store/mediaStore.ts'
import { useWatchlistStore } from '../store/watchlistStore.ts'
import {
  Modal, Button, Input, Textarea, Select, Badge, RatingSlider,
  type SelectOption,
} from './ui/index.ts'

type Step = 'tipo' | 'busca' | 'selecao' | 'form'
type TipoMidia = 'filme' | 'serie'
type Status = 'assistido' | 'assistindo' | 'nao_assistido' | 'nao_lembro'

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
  genres:         string
  director:       string
  cast:           string
  tmdb_id:        number | null
}

const EMPTY_FORM: FormData = {
  title: '', release_year: '', synopsis: '', observations: '',
  rating: 0, duration: '', watched: '', cover_path: '', backdrop_path: '',
  tipo: 'filme', watched_status: 'assistido',
  genres: '', director: '', cast: '',
  tmdb_id: null,
}

const STATUS_OPTIONS: SelectOption<Status>[] = [
  { value: 'assistido',     label: 'Assistido',      color: '#46D369' },
  { value: 'assistindo',    label: 'Assistindo',     color: '#8055d0' },
  { value: 'nao_assistido', label: 'Não assistido',  color: '#808080' },
  { value: 'nao_lembro',   label: 'Não lembro',     color: '#F5A623' },
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
  const { addMedia }   = useMediaStore()
  const { addItem }    = useWatchlistStore()
  const [step, setStep]           = useState<Step>('tipo')
  const [tipo, setTipo]           = useState<TipoMidia>('filme')
  const [query, setQuery]         = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]     = useState<SearchResult[]>([])
  const [form, setForm]           = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

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
      setForm({
        ...EMPTY_FORM, tipo,
        title:         details.title ?? details.name ?? '',
        release_year:  (details.release_date ?? details.first_air_date ?? '').slice(0, 4),
        synopsis:      details.overview,
        duration:      String(details.runtime ?? details.number_of_episodes ?? ''),
        genres:        (details.genres ?? []).map(g => g.name).join(', '),
        cover_path:    posterUrl,
        backdrop_path: backdropUrl,
        director, cast,
        tmdb_id:       details.id,
      })
      setStep('form')
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
          release_year:   form.release_year  || undefined,
          synopsis:       form.synopsis      || undefined,
          observations:   form.observations  || undefined,
          rating:         form.rating > 0 ? form.rating : undefined,
          duration:       form.duration ? Number(form.duration) : undefined,
          watched:        form.watched  ? Number(form.watched)  : undefined,
          cover_path:     form.cover_path    || undefined,
          backdrop_path:  form.backdrop_path || undefined,
          tipo:           form.tipo,
          watched_status: form.watched_status,
          genres:         form.genres ? form.genres.split(',').map(g => g.trim()).filter(Boolean) : [],
          director:       form.director      || undefined,
          cast:           form.cast   ? form.cast.split(',').map(c => c.trim()).filter(Boolean)   : [],
          tmdb_id:        form.tmdb_id ?? undefined,
        })
      }
      onClose()
    } catch {
      setError('Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const titleByStep: Record<Step, string> = {
    tipo:    mode === 'watchlist' ? 'Adicionar a Próximos' : 'Adicionar Mídia',
    busca:   `Buscar ${tipo}`,
    selecao: 'Selecionar resultado',
    form:    form.title || 'Preencher dados',
  }

  return (
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
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md, fontSize: theme.fontSizes.ui }}>
              {results.length} resultado(s) para "{query}". Selecione:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  disabled={searching}
                  className="focus-ring"
                  style={{
                    background: theme.colors.surface,
                    border: `1px solid ${theme.colors.surfaceHover}`,
                    borderRadius: theme.radius.md,
                    color: theme.colors.textPrimary,
                    cursor: searching ? 'wait' : 'pointer',
                    padding: theme.spacing.sm,
                    textAlign: 'left',
                    display: 'flex', gap: theme.spacing.sm,
                    transition: `all ${theme.transitions.fast}`,
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
                  {r.posterUrl && (
                    <img src={r.posterUrl} alt={r.title}
                      style={{ width: '56px', height: '84px', objectFit: 'cover', borderRadius: theme.radius.sm, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: theme.fontWeights.bold, fontSize: theme.fontSizes.ui, marginBottom: '4px' }}>
                      {r.title} {r.year && <span style={{ color: theme.colors.textMuted, fontWeight: 400 }}>({r.year})</span>}
                    </div>
                    <div style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.fontSizes.small,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {r.overview || 'Sem sinopse.'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('busca')} style={{ marginTop: theme.spacing.md }}>
              ← Voltar à busca
            </Button>
          </div>
        )}

        {/* STEP: FORM */}
        {step === 'form' && (
          <div>
            {form.cover_path && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.spacing.lg }}>
                <img src={form.cover_path} alt={form.title}
                  style={{
                    height: '200px',
                    borderRadius: theme.radius.md,
                    objectFit: 'cover',
                    boxShadow: theme.shadows.card,
                  }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>

              <Input
                label="Título *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />

              <div style={{ display: 'grid', gridTemplateColumns: mode === 'watchlist' ? '1fr' : '1fr 1fr', gap: theme.spacing.md }}>
                <Select<TipoMidia>
                  label="Tipo"
                  options={TIPO_OPTIONS}
                  value={form.tipo}
                  onChange={v => setForm(f => ({ ...f, tipo: v }))}
                  fullWidth
                />
                {mode !== 'watchlist' && (
                  <Select<Status>
                    label="Status"
                    options={STATUS_OPTIONS}
                    value={form.watched_status}
                    onChange={v => setForm(f => ({ ...f, watched_status: v }))}
                    fullWidth
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                <Input
                  label="Ano"
                  value={form.release_year}
                  onChange={e => setForm(f => ({ ...f, release_year: e.target.value }))}
                />
                <Input
                  label={form.tipo === 'filme' ? 'Duração (min)' : 'Episódios'}
                  type="number"
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                />
              </div>

              {mode !== 'watchlist' && (
                <RatingSlider
                  value={form.rating}
                  onChange={v => setForm(f => ({ ...f, rating: v }))}
                />
              )}

              <Input
                label="Gêneros (separados por vírgula)"
                value={form.genres}
                onChange={e => setForm(f => ({ ...f, genres: e.target.value }))}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                <Input
                  label="Diretor"
                  value={form.director}
                  onChange={e => setForm(f => ({ ...f, director: e.target.value }))}
                />
                <Input
                  label="Elenco (vírgula)"
                  value={form.cast}
                  onChange={e => setForm(f => ({ ...f, cast: e.target.value }))}
                />
              </div>

              <Textarea
                label="Sinopse"
                value={form.synopsis}
                onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))}
                rows={3}
              />

              {mode !== 'watchlist' && (
                <Textarea
                  label="Observações pessoais"
                  value={form.observations}
                  onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                  rows={2}
                />
              )}

              <Input
                label="URL do poster"
                value={form.cover_path}
                onChange={e => setForm(f => ({ ...f, cover_path: e.target.value }))}
              />
            </div>

            <div style={{
              display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end',
              marginTop: theme.spacing.lg,
              paddingTop: theme.spacing.md,
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
  )
}
