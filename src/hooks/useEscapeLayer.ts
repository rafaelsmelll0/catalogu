import { useEffect, useRef } from 'react'

/**
 * Pilha de "camadas" que fecham com Esc (modais, dropdowns, busca).
 * Um único listener global chama só a camada do topo — assim o Esc num dropdown
 * dentro de um modal fecha o dropdown, e não o modal (nem os modais de baixo).
 */
const stack: { current: () => void }[] = []

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return
  e.preventDefault()
  e.stopPropagation()
  stack[stack.length - 1].current()
}

export function useEscapeLayer(active: boolean, onEscape: () => void) {
  // Ref para não re-empilhar a cada render quando o callback muda de identidade.
  const handler = useRef(onEscape)
  handler.current = onEscape

  useEffect(() => {
    if (!active) return
    const entry = { get current() { return handler.current } }
    if (stack.length === 0) document.addEventListener('keydown', onKeyDown, true)
    stack.push(entry)
    return () => {
      const i = stack.lastIndexOf(entry)
      if (i >= 0) stack.splice(i, 1)
      if (stack.length === 0) document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [active])
}
