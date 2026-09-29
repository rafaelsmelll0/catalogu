import { memo, type CSSProperties } from 'react'
import sitRaw from '../assets/cat-sit.svg?raw'
import logoRaw from '../assets/catalogu-logo.svg?raw'
import rollRaw from '../assets/roll.svg?raw'

/**
 * O gatinho do Catalogu animado em SVG (nítido em qualquer tamanho, sem GIF).
 *
 * Os SVGs originais são reaproveitados: marcamos com classes as peças que se
 * mexem — olhos (piscar), pupilas (olhar), orelhas, bigodes, patas e o rolo de
 * filme — e as animações ficam no CSS (tokens.css, seção "Gatinho animado").
 */

interface Parts {
  eyes:   number
  pupils: number[]
  ears:   [number, number]
  reel:   number[]
  reelCenter: [number, number]
  pawL:   number
  pawR:   number
  whiskR: number
  whiskL: number
}

// Índices na ordem do documento de <g>, <path>, <circle> e <ellipse> de cada SVG
const SIT: Parts = {
  eyes: 7, pupils: [9, 10, 12, 13], ears: [5, 6],
  reel: [14, 15, 16], reelCenter: [133.75, 195.46],
  pawL: 17, pawR: 18, whiskR: 25, whiskL: 29,
}
const LOGO: Parts = {
  eyes: 13, pupils: [15, 16, 18, 19], ears: [11, 12],
  reel: [20, 21, 22], reelCenter: [572.25, 195.46],
  pawL: 23, pawR: 24, whiskR: 32, whiskL: 36,
}

/**
 * O objeto de innerHTML é criado uma vez e reaproveitado: se cada render passar
 * um objeto novo, o React recoloca o SVG e as animações recomeçam do zero (era o
 * "flick" nas telas com cronômetro de espera).
 */
function build(raw: string, p: Partial<Parts> & Pick<Parts, 'reel' | 'reelCenter'>): { inner: { __html: string }; ratio: number } {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  const svg = doc.documentElement
  const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(/[\s,]+/).map(Number)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  // ids repetidos quebrariam várias cópias na mesma tela
  svg.removeAttribute('id')
  svg.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'))

  const els = Array.from(svg.querySelectorAll('g, path, circle, ellipse'))
  const tag = (i: number, cls: string) => els[i]?.setAttribute('class', `${els[i].getAttribute('class') ?? ''} ${cls}`.trim())

  if (p.eyes !== undefined) tag(p.eyes, 'cat-eyes')
  p.pupils?.forEach(i => tag(i, 'cat-pupil'))
  if (p.ears) { tag(p.ears[0], 'cat-ear cat-ear-l'); tag(p.ears[1], 'cat-ear cat-ear-r') }
  if (p.pawL !== undefined) tag(p.pawL, 'cat-paw cat-paw-l')
  if (p.pawR !== undefined) tag(p.pawR, 'cat-paw cat-paw-r')
  if (p.whiskR !== undefined) tag(p.whiskR, 'cat-whisk cat-whisk-r')
  if (p.whiskL !== undefined) tag(p.whiskL, 'cat-whisk cat-whisk-l')
  // O rolo são três peças (disco, furos, eixo) girando em torno do mesmo centro
  p.reel.forEach(i => {
    tag(i, 'cat-reel')
    els[i]?.setAttribute('style', `transform-origin: ${p.reelCenter[0]}px ${p.reelCenter[1]}px`)
  })

  return { inner: { __html: new XMLSerializer().serializeToString(svg) }, ratio: vh / vw }
}

// Rolo de filme: disco roxo, furos e eixo giram dentro do contorno
const ROLL = { reel: [5, 6, 7], reelCenter: [76.09, 76.09] as [number, number] }

let rollCache: ReturnType<typeof build> | null = null
const roll = () => (rollCache ??= build(rollRaw, ROLL))

let sitCache: ReturnType<typeof build> | null = null
let logoCache: ReturnType<typeof build> | null = null
const sit  = () => (sitCache  ??= build(sitRaw, SIT))
const logo = () => (logoCache ??= build(logoRaw, LOGO))

interface CatProps {
  /** largura em px */
  size?:  number
  /** idle: vivo e tranquilo · loading: gira o rolo (indicador de carregamento) */
  mode?:  'idle' | 'loading'
  style?: CSSProperties
}

export const AnimatedCat = memo(function AnimatedCat({ size = 120, mode = 'idle', style }: CatProps) {
  const { inner, ratio } = sit()
  return (
    <span
      className={`acat acat-${mode}`}
      role="img"
      aria-label={mode === 'loading' ? 'Carregando' : 'Gatinho do Catalogu'}
      style={{ display: 'inline-block', width: size, height: size * ratio, ...style }}
      dangerouslySetInnerHTML={inner}
    />
  )
})

/** Logo com o gatinho que pisca de vez em quando e gira o rolo ao passar o mouse. */
export const AnimatedLogo = memo(function AnimatedLogo({ height = 36 }: { height?: number }) {
  const { inner, ratio } = logo()
  return (
    <span
      className="acat acat-logo"
      role="img"
      aria-label="Catalogu"
      style={{ display: 'block', height, width: height / ratio }}
      dangerouslySetInnerHTML={inner}
    />
  )
})

interface RollProps {
  /** lado em px */
  size?:  number
  /** idle: rola de um lado para o outro, como uma roda · spin: gira no lugar (carregando) */
  mode?:  'idle' | 'spin'
  style?: CSSProperties
}

/** Rolo de filme animado (telas vazias e indicador de carregamento pequeno). */
export const AnimatedRoll = memo(function AnimatedRoll({ size = 80, mode = 'idle', style }: RollProps) {
  const { inner } = roll()
  return (
    <span
      className={`acat aroll aroll-${mode}`}
      role="img"
      aria-label={mode === 'spin' ? 'Carregando' : 'Rolo de filme'}
      style={{ display: 'inline-block', width: size, height: size, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={inner}
    />
  )
})
