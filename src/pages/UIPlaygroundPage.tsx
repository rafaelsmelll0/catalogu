import { useState } from 'react'
import { theme } from '../styles/theme.ts'
import {
  Button, Input, Textarea, Select, Modal, Badge, RatingSlider, Skeleton, CardSkeleton,
  type SelectOption,
} from '../components/ui/index.ts'

const TIPO_OPTS: SelectOption[] = [
  { value: 'filme', label: 'Filme', color: '#6137b9' },
  { value: 'serie', label: 'Série', color: '#54B9C5' },
  { value: 'anime', label: 'Anime', color: '#46D369' },
]

const STATUS_OPTS: SelectOption[] = [
  { value: 'assistido',     label: 'Assistido',    color: '#46D369' },
  { value: 'assistindo',    label: 'Assistindo',   color: '#6137b9' },
  { value: 'nao_assistido', label: 'Não assistido', color: '#808080' },
  { value: 'nao_lembro',   label: 'Não lembro',   color: '#F5A623' },
]

export function UIPlaygroundPage() {
  const [text, setText]         = useState('')
  const [area, setArea]         = useState('')
  const [tipo, setTipo]         = useState('filme')
  const [status, setStatus]     = useState('assistido')
  const [rating, setRating]     = useState(7.5)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]   = useState(false)

  const section: React.CSSProperties = {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    background: theme.colors.surface,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.surfaceElevated}`,
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: theme.fontSizes.h3,
    fontWeight: theme.fontWeights.bold,
    marginBottom: theme.spacing.md,
    color: theme.colors.textPrimary,
  }

  return (
    <div style={{ padding: `${theme.spacing.xl} ${theme.layout.pagePadding}`, background: theme.colors.bg, minHeight: '100vh' }}>
      <h1 style={{
        fontSize: theme.fontSizes.h1, fontWeight: theme.fontWeights.black,
        fontFamily: theme.fonts.display, marginBottom: theme.spacing.xl,
      }}>
        UI PLAYGROUND
      </h1>

      {/* BUTTONS */}
      <div style={section}>
        <h2 style={sectionTitle}>Buttons</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Button icon="▶">Reproduzir</Button>
          <Button variant="secondary" icon="+">Adicionar</Button>
          <Button
            loading={loading}
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500) }}
          >
            Clique para Loading
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>

      {/* INPUTS */}
      <div style={section}>
        <h2 style={sectionTitle}>Inputs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <Input label="Título" value={text} onChange={e => setText(e.target.value)} />
          <Input label="Com ícone" icon="⌕" value={text} onChange={e => setText(e.target.value)} />
          <Input label="Com hint" value={text} onChange={e => setText(e.target.value)} hint="Texto auxiliar abaixo" />
          <Input label="Com erro" value={text} onChange={e => setText(e.target.value)} error="Campo obrigatório" />
        </div>
        <Textarea label="Sinopse" value={area} onChange={e => setArea(e.target.value)} rows={3} />
      </div>

      {/* SELECTS */}
      <div style={section}>
        <h2 style={sectionTitle}>Selects</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
          <Select label="Tipo" options={TIPO_OPTS} value={tipo} onChange={setTipo} fullWidth />
          <Select label="Status" options={STATUS_OPTS} value={status} onChange={setStatus} fullWidth />
        </div>
      </div>

      {/* RATING */}
      <div style={section}>
        <h2 style={sectionTitle}>Rating Slider</h2>
        <RatingSlider value={rating} onChange={setRating} />
      </div>

      {/* BADGES */}
      <div style={section}>
        <h2 style={sectionTitle}>Badges</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="success">Assistido</Badge>
          <Badge variant="info">Novo</Badge>
          <Badge variant="warning">Não lembro</Badge>
          <Badge variant="danger">Excluído</Badge>
          <Badge variant="muted">Sci-fi</Badge>
          <Badge customColor="#6137b9">Filme</Badge>
          <Badge customColor="#54B9C5">Série</Badge>
          <Badge customColor="#46D369">Anime</Badge>
        </div>
      </div>

      {/* SKELETONS */}
      <div style={section}>
        <h2 style={sectionTitle}>Skeletons</h2>
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Skeleton width="60%" height="24px" />
      </div>

      {/* MODAL */}
      <div style={section}>
        <h2 style={sectionTitle}>Modal</h2>
        <Button onClick={() => setShowModal(true)}>Abrir Modal</Button>
        <Modal open={showModal} onClose={() => setShowModal(false)} title="Modal de Exemplo">
          <div style={{ padding: theme.spacing.lg }}>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
              Modal com backdrop blur, animação suave de entrada, fecha com ESC ou clicando fora.
            </p>
            <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={() => setShowModal(false)}>Confirmar</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
