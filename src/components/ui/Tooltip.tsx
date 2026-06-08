import { ReactNode, useState, useRef, useEffect } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props {
  children: ReactNode
  content:  string
  side?:    'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ children, content, side = 'top' }: Props) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0 })
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!visible || !wrapperRef.current) return
    const r   = wrapperRef.current.getBoundingClientRect()
    const gap = 8

    const positions = {
      top:    { top: r.top - gap,          left: r.left + r.width / 2 },
      bottom: { top: r.bottom + gap,       left: r.left + r.width / 2 },
      left:   { top: r.top + r.height / 2, left: r.left - gap },
      right:  { top: r.top + r.height / 2, left: r.right + gap },
    }
    setCoords(positions[side])
  }, [visible, side])

  const transforms = {
    top:    'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left:   'translate(-100%, -50%)',
    right:  'translate(0, -50%)',
  }

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: transforms[side],
            background: '#000',
            color: theme.colors.textPrimary,
            fontSize: '11px',
            fontWeight: theme.fontWeights.medium,
            padding: '6px 10px',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.surfaceHover}`,
            boxShadow: theme.shadows.card,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
            animation: 'dropdownIn 0.15s ease-out',
          }}
        >
          {content}
        </div>
      )}
    </>
  )
}
