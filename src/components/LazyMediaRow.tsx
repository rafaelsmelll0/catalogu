import { useEffect, useRef, useState } from 'react'
import { theme } from '../styles/theme.ts'
import type { Media } from '../types/index.ts'
import { MediaRow } from './MediaRow.tsx'

interface Props {
  title:       string
  items:       Media[]
  onCardClick: (media: Media) => void
}

export function LazyMediaRow({ title, items, onCardClick }: Props) {
  const [shouldRender, setShouldRender] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (shouldRender) return
    if (!ref.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [shouldRender])

  if (shouldRender) {
    return <MediaRow title={title} items={items} onCardClick={onCardClick} />
  }

  return (
    <div
      ref={ref}
      style={{
        marginBottom: theme.spacing.xl,
        height: `calc(${theme.layout.cardHeight} + 100px)`,
      }}
    >
      <h2 style={{
        fontSize: theme.fontSizes.h3,
        fontWeight: theme.fontWeights.bold,
        color: theme.colors.textPrimary,
        padding: `0 ${theme.layout.pagePadding}`,
        marginBottom: theme.spacing.md,
        letterSpacing: '0.01em',
      }}>
        {title}
      </h2>
    </div>
  )
}
