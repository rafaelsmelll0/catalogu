import { type ReactNode, useState, useRef, useLayoutEffect } from 'react'
import { theme } from '../../styles/theme.ts'

interface Props {
  children: ReactNode
  content:  string
  side?:    'top' | 'bottom' | 'left' | 'right'
}

const GAP    = 8
const MARGIN = 8

/**
 * Dica ao passar o mouse. Mede o próprio tamanho antes de aparecer e se mantém
 * dentro da janela: se não cabe do lado pedido, vira para o oposto; se encosta
 * numa borda, desliza para dentro. Textos longos quebram linha.
 */
export function Tooltip({ children, content, side = 'top' }: Props) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState<{ top: number; left: number } | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const tipRef     = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!visible || !wrapperRef.current || !tipRef.current) { setPos(null); return }
    const a = wrapperRef.current.getBoundingClientRect()
    const { width: w, height: h } = tipRef.current.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight

    const place = (s: Props['side']) => {
      switch (s) {
        case 'bottom': return { top: a.bottom + GAP,            left: a.left + a.width / 2 - w / 2 }
        case 'left':   return { top: a.top + a.height / 2 - h / 2, left: a.left - GAP - w }
        case 'right':  return { top: a.top + a.height / 2 - h / 2, left: a.right + GAP }
        default:       return { top: a.top - GAP - h,           left: a.left + a.width / 2 - w / 2 }
      }
    }
    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const

    let p = place(side)
    const overflows = (q: { top: number; left: number }) =>
      q.top < MARGIN || q.top + h > vh - MARGIN || q.left < MARGIN || q.left + w > vw - MARGIN
    if ((side === 'top' || side === 'bottom') ? (p.top < MARGIN || p.top + h > vh - MARGIN) : overflows(p)) {
      const q = place(opposite[side])
      if (!overflows(q) || (side === 'top' || side === 'bottom')) p = q
    }

    setPos({
      top:  Math.min(Math.max(p.top,  MARGIN), vh - h - MARGIN),
      left: Math.min(Math.max(p.left, MARGIN), vw - w - MARGIN),
    })
  }, [visible, side, content])

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
          ref={tipRef}
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            // Primeiro render invisível só para medir; depois aparece já no lugar certo
            visibility: pos ? 'visible' : 'hidden',
            maxWidth: '300px',
            background: '#000',
            color: theme.colors.textPrimary,
            fontSize: '11px',
            fontWeight: theme.fontWeights.medium,
            lineHeight: 1.4,
            padding: '6px 10px',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.surfaceHover}`,
            boxShadow: theme.shadows.card,
            whiteSpace: 'normal',
            pointerEvents: 'none',
            zIndex: 9999,
            animation: pos ? 'dropdownIn 0.15s ease-out' : 'none',
          }}
        >
          {content}
        </div>
      )}
    </>
  )
}
