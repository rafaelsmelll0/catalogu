import { theme } from '../../styles/theme.ts'

interface Props {
  value:    number
  onChange: (v: number) => void
  label?:   string
}

const CLASSIFICATIONS: Record<number, string> = {
  0:  '—',
  1:  'Terrível',
  2:  'Muito ruim',
  3:  'Ruim',
  4:  'Fraco',
  5:  'Mediano',
  6:  'Ok',
  7:  'Bom',
  8:  'Muito bom',
  9:  'Excelente',
  10: 'Obra-prima',
}

function getColor(rating: number) {
  if (rating === 0) return '#555'
  if (rating < 4)  return '#e5404a'
  if (rating < 6)  return '#e5a040'
  if (rating < 8)  return '#e5d440'
  return '#46D369'
}

export function RatingSlider({ value, onChange, label = 'Sua nota' }: Props) {
  const color       = getColor(value)
  const percent     = (value / 10) * 100
  const classification = CLASSIFICATIONS[Math.round(value)] ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{
          fontSize: '10px',
          color: theme.colors.textMuted,
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {label}
        </label>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.xs }}>
          <span style={{
            fontSize: '28px',
            fontWeight: theme.fontWeights.black,
            fontFamily: theme.fonts.display,
            color,
            lineHeight: 1,
            transition: `color ${theme.transitions.normal}`,
          }}>
            {value.toFixed(1)}
          </span>
          <span style={{
            fontSize: theme.fontSizes.small,
            color: theme.colors.textMuted,
            fontWeight: theme.fontWeights.medium,
          }}>
            {classification}
          </span>
        </div>
      </div>

      <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute', left: 0, right: 0,
          height: '6px',
          background: theme.colors.surfaceElevated,
          borderRadius: theme.radius.full,
        }} />

        <div style={{
          position: 'absolute', left: 0,
          height: '6px',
          width: `${percent}%`,
          background: `linear-gradient(90deg, ${getColor(0.1)}, ${color})`,
          borderRadius: theme.radius.full,
          transition: `width ${theme.transitions.fast}, background ${theme.transitions.normal}`,
        }} />

        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i / 10) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '2px', height: '8px',
            background: i <= value ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
            borderRadius: '1px',
            pointerEvents: 'none',
          }} />
        ))}

        <input
          type="range"
          min={0} max={10} step={0.5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer' }}
        />

        <div style={{
          position: 'absolute',
          left: `${percent}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '20px', height: '20px',
          background: color,
          border: '3px solid #fff',
          borderRadius: '50%',
          boxShadow: `0 2px 8px ${color}88`,
          transition: `left ${theme.transitions.fast}, background ${theme.transitions.normal}`,
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}
