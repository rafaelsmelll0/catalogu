import { useState, useRef, useEffect } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props {
  allGenres:  string[]
  selected:   string[]
  onChange:   (genres: string[]) => void
  label?:     string
  fullWidth?: boolean
}

export function GenreMultiSelect({ allGenres, selected, onChange, label, fullWidth }: Props) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  function toggle(genre: string) {
    onChange(selected.includes(genre)
      ? selected.filter(g => g !== genre)
      : [...selected, genre]
    )
  }

  function clearAll() {
    onChange([])
    setSearch('')
  }

  const filtered = allGenres.filter(g =>
    g.toLowerCase().includes(search.toLowerCase())
  )

  const hasSelection = selected.length > 0
  const displayText  =
    selected.length === 0 ? 'Todos os gêneros' :
    selected.length === 1 ? selected[0] :
                            `${selected.length} gêneros selecionados`

  return (
    <div ref={ref} style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', gap: '6px',
      width: fullWidth ? '100%' : 'auto',
    }}>
      {label && (
        <label style={{
          fontSize: '10px',
          color: open ? theme.colors.primary : theme.colors.textMuted,
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          transition: `color ${theme.transitions.fast}`,
          paddingLeft: '2px',
        }}>
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="focus-ring"
        style={{
          background:    theme.colors.surface,
          border:        `1px solid ${open ? theme.colors.primary : theme.colors.surfaceElevated}`,
          borderRadius:  theme.radius.md,
          color:         theme.colors.textPrimary,
          fontSize:      theme.fontSizes.body,
          fontWeight:    theme.fontWeights.medium,
          fontFamily:    theme.fonts.sans,
          padding:       `0 ${theme.spacing.md}`,
          height:        '52px',
          cursor:        'pointer',
          display:       'flex',
          alignItems:    'center',
          justifyContent: 'space-between',
          gap:           theme.spacing.sm,
          width:         '100%',
          textAlign:     'left',
          transition:    `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
          boxShadow:     open ? `0 0 0 3px ${theme.colors.primaryGlow}` : 'none',
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', gap: theme.spacing.xs,
          minWidth: 0, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayText}
        </span>

        {selected.length > 1 && (
          <span style={{
            background: theme.colors.primary, color: '#fff',
            borderRadius: theme.radius.full,
            fontSize: '10px', fontWeight: theme.fontWeights.bold,
            minWidth: '20px', height: '20px', padding: '0 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {selected.length}
          </span>
        )}

        <span style={{
          color: theme.colors.textMuted, fontSize: '10px',
          transition: `transform ${theme.transitions.fast}`,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0, right: 0,
          minWidth: '260px',
          background: theme.colors.surfaceElevated,
          border: `1px solid ${theme.colors.surfaceHover}`,
          borderRadius: theme.radius.md,
          boxShadow: theme.shadows.modal,
          zIndex: 1000,
          animation: 'dropdownIn 0.15s ease-out',
          overflow: 'hidden',
        }}>
          <div style={{ padding: theme.spacing.sm, borderBottom: `1px solid ${theme.colors.surface}` }}>
            <input
              autoFocus
              placeholder="Buscar gênero..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: theme.colors.surface,
                border: `1px solid ${theme.colors.surfaceHover}`,
                borderRadius: theme.radius.sm,
                color: theme.colors.textPrimary,
                fontSize: theme.fontSizes.ui,
                padding: '8px 12px',
                outline: 'none',
                fontFamily: theme.fonts.sans,
              }}
            />
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '6px 0' }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: theme.spacing.md,
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.ui,
                textAlign: 'center',
              }}>
                Nenhum gênero encontrado
              </div>
            ) : filtered.map(genre => {
              const isSelected = selected.includes(genre)
              return (
                <div
                  key={genre}
                  onClick={() => toggle(genre)}
                  style={{
                    padding: `10px ${theme.spacing.md}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
                    background: isSelected ? theme.colors.primaryGlow : 'transparent',
                    transition: `background ${theme.transitions.fast}`,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{
                    width: '18px', height: '18px',
                    borderRadius: '4px',
                    border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.surfaceHover}`,
                    background: isSelected ? theme.colors.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: `all ${theme.transitions.fast}`,
                  }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: '11px', lineHeight: 1, fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <span style={{
                    fontSize: theme.fontSizes.ui,
                    color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                    fontWeight: isSelected ? theme.fontWeights.bold : theme.fontWeights.regular,
                    flex: 1,
                  }}>
                    {genre}
                  </span>
                </div>
              )
            })}
          </div>

          {hasSelection && (
            <div style={{
              padding: `8px ${theme.spacing.md}`,
              borderTop: `1px solid ${theme.colors.surface}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: theme.fontSizes.tiny, color: theme.colors.textMuted }}>
                {selected.length} selecionado(s)
              </span>
              <button
                onClick={clearAll}
                style={{
                  background: 'none', border: 'none',
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.tiny,
                  cursor: 'pointer', padding: '4px 8px',
                  borderRadius: theme.radius.sm,
                  transition: `color ${theme.transitions.fast}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = theme.colors.danger)}
                onMouseLeave={e => (e.currentTarget.style.color = theme.colors.textMuted)}
              >
                × Limpar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
