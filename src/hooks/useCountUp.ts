import { useEffect, useState } from 'react'

export function useCountUp(target: number, duration = 1000): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) { setValue(0); return }

    const start    = performance.now()
    const startVal = 0
    const diff     = target - startVal
    let raf: number

    const tick = (now: number) => {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)  // easeOutCubic
      setValue(startVal + diff * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
