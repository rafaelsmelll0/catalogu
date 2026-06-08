import { useEffect } from 'react'

interface ShortcutMap {
  [key: string]: () => void
}

export function useKeyboardShortcuts(map: ShortcutMap) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tag    = target.tagName.toLowerCase()
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        target.isContentEditable

      const key   = e.key.toLowerCase()
      const combo = [
        e.ctrlKey || e.metaKey ? 'ctrl' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey   ? 'alt'   : '',
        key,
      ].filter(Boolean).join('+')

      if (key === 'escape' && map.escape) {
        map.escape()
        return
      }

      if (isEditing) return

      if (map[combo]) {
        e.preventDefault()
        map[combo]()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [map])
}
