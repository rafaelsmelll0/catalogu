import { useEffect, useState, useRef } from 'react'
import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { Button, Badge } from './ui/index.ts'

interface Props {
  items:          Media[]
  onDetailsClick: (media: Media) => void
  onAddToList?:   (media: Media) => void
}

const ROTATION_MS = 15000
const FADE_MS     = 600

export function HeroBanner({ items, onDetailsClick, onAddToList }: Props) {
  const pool = items.filter(m => m.backdrop_path && m.backdrop_path.trim() !== '')

  const [current, setCurrent] = useState<Media | null>(null)
  const [visible, setVisible] = useState(true)

  const poolRef    = useRef(pool)
  const currentRef = useRef<Media | null>(null)
  const pausedRef  = useRef(false)
  const bgRef      = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rafRef     = useRef<number | null>(null)

  useEffect(() => { poolRef.current = pool },       [pool])
  useEffect(() => { currentRef.current = current }, [current])

  // Inicializa com um filme aleatório
  useEffect(() => {
    if (!current && pool.length > 0) {
      setCurrent(pickRandom(pool, null))
    }
  }, [pool.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rotação a cada 15s
  useEffect(() => {
    if (pool.length <= 1) return
    const interval = setInterval(() => {
      if (pausedRef.current) return
      setVisible(false)
      setTimeout(() => {
        const next = pickRandom(poolRef.current, currentRef.current)
        if (next) setCurrent(next)
        setVisible(true)
      }, FADE_MS)
    }, ROTATION_MS)
    return () => clearInterval(interval)
  }, [pool.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Parallax — manipula DOM diretamente, zero re-render
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const updateParallax = () => {
      rafRef.current = null
      const scrollY = main.scrollTop

      if (scrollY > 600) return

      const parallaxOffset = scrollY * 0.4
      const contentOffset  = scrollY * 0.15
      const scrollOpacity  = Math.max(1 - scrollY / 400, 0)

      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${parallaxOffset}px, 0) scale(1.1)`
      }
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${contentOffset}px, 0)`
        contentRef.current.style.opacity   = String(scrollOpacity)
      }
    }

    const onScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(updateParallax)
    }

    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  if (!current) {
    return (
      <div style={{
        height: '520px',
        background: 'linear-gradient(135deg, #1a0d40 0%, #2d0855 40%, #141414 100%)',
      }} />
    )
  }

  const fadeOpacity = visible ? 1 : 0

  return (
    <div
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
      style={{ position: 'relative', height: '520px', overflow: 'hidden' }}
    >
      {/* Fundo com backdrop */}
      <div
        ref={bgRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: `url(${current.backdrop_path}) center/cover no-repeat`,
          transform: 'translate3d(0, 0, 0) scale(1.1)',
          opacity: fadeOpacity,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      />

      {/* Overlay gradiente */}
      <div style={{
        position: 'absolute', inset: 0,
        background: theme.gradients.heroOverlay,
        pointerEvents: 'none',
      }} />

      {/* Overlay inferior */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '160px',
        background: theme.gradients.heroBottom,
        pointerEvents: 'none',
      }} />

      {/* Conteúdo */}
      <div
        ref={contentRef}
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          padding: `0 ${theme.layout.pagePadding} ${theme.spacing.xxl}`,
          maxWidth: '640px',
          transform: 'translate3d(0, 0, 0)',
          opacity: fadeOpacity,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
            <Badge customColor={theme.colors.typeColors[current.tipo]}>{current.tipo}</Badge>
            {current.release_year && <Badge variant="muted">{current.release_year}</Badge>}
            {current.rating != null && current.rating > 0 && (
              <Badge customColor={
                current.rating >= 8 ? theme.colors.success :
                current.rating >= 6 ? theme.colors.warning :
                                       theme.colors.danger
              }>
                ★ {current.rating.toFixed(1)}
              </Badge>
            )}
          </div>

          <h1 style={{
            fontFamily:    theme.fonts.display,
            fontSize:      theme.fontSizes.hero,
            fontWeight:    theme.fontWeights.black,
            lineHeight:    1.05,
            color:         theme.colors.textPrimary,
            letterSpacing: '-0.01em',
            marginBottom:  theme.spacing.md,
            textTransform: 'uppercase',
            textShadow:    '0 4px 24px rgba(0,0,0,0.8)',
          }}>
            {current.title}
          </h1>

          {current.synopsis && (
            <p style={{
              fontSize:        theme.fontSizes.body,
              lineHeight:      1.5,
              color:           theme.colors.textSecondary,
              marginBottom:    theme.spacing.lg,
              display:         '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow:        'hidden',
              textShadow:      '0 2px 8px rgba(0,0,0,0.7)',
            }}>
              {current.synopsis}
            </p>
          )}

          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            <Button size="lg" onClick={() => onDetailsClick(current)}>
              ▶ Ver Detalhes
            </Button>
            <Button variant="secondary" size="lg" onClick={() => onAddToList?.(current)}>
              + Lista
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function pickRandom(pool: Media[], current: Media | null): Media | null {
  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]
  const filtered = current ? pool.filter(m => m.id !== current.id) : pool
  return filtered[Math.floor(Math.random() * filtered.length)]
}
