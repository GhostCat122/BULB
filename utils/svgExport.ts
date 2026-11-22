/*
 * Export vectoriel (SVG) du plan.
 *
 * Parcourt le DOM du plan et le reconstruit en SVG « natif » :
 * - les tracés SVG de la ligne sont recopiés avec leurs styles calculés ;
 * - les blocs CSS (fonds, bordures, arrondis, ombres internes) deviennent des <rect> ;
 * - les pictogrammes (<img> SVG et masques CSS) sont intégrés comme groupes vectoriels ;
 * - les textes deviennent des <text> éditables (Inkscape, Illustrator…) ;
 * - les rotations CSS (noms inclinés) deviennent des transform SVG.
 */

const SVG_NS = 'http://www.w3.org/2000/svg'
const PRESENTATION_PROPS = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'clip-rule',
]

let uid = 0

function n(v: number): string {
  return (Math.round(v * 1000) / 1000).toString()
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function isTransparent(color: string): boolean {
  return !color || color === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(color)
}

function colorAttrs(color: string, attr: string): string {
  const m = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
  if (m) {
    return `${attr}="rgb(${m[1]},${m[2]},${m[3]})" ${attr}-opacity="${m[4]}"`
  }
  return `${attr}="${color}"`
}

function px(v: string, ref: number): number {
  if (!v) {
    return 0
  }
  if (v.endsWith('%')) {
    return Number.parseFloat(v) / 100 * ref
  }
  return Number.parseFloat(v) || 0
}

function extractUrl(css: string): string | null {
  const m = css.match(/url\((['"]?)(.*?)\1\)/)
  return m ? m[2] : null
}

/* ----------------------------- SVG externes ----------------------------- */

const svgCache = new Map<string, Promise<string | null>>()

function fetchSvgText(url: string): Promise<string | null> {
  if (!svgCache.has(url)) {
    let p: Promise<string | null>
    if (url.startsWith('data:image/svg+xml')) {
      const comma = url.indexOf(',')
      const meta = url.slice(0, comma)
      const data = url.slice(comma + 1)
      p = Promise.resolve(meta.includes(';base64') ? atob(data) : decodeURIComponent(data))
    } else {
      p = fetch(url)
        .then(r => (r.ok ? r.text() : null))
        .then(t => (t && t.includes('<svg') ? t : null))
        .catch(() => null)
    }
    svgCache.set(url, p)
  }
  return svgCache.get(url)!
}

/**
 * Fige les styles calculés d'un SVG vivant en attributs de présentation,
 * pour que le fichier exporté ne dépende plus d'aucune feuille de style.
 */
const DEFAULTS: Record<string, string> = {
  'fill': 'rgb(0, 0, 0)',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
  'stroke': 'none',
  'stroke-width': '1px',
  'stroke-opacity': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'stroke-dasharray': 'none',
  'stroke-dashoffset': '0px',
  'opacity': '1',
  'clip-rule': 'nonzero',
}

function bakeSvgStyles(live: Element, clone: Element): void {
  const liveEls = [live, ...live.querySelectorAll('*')]
  const cloneEls = [clone, ...clone.querySelectorAll('*')]
  const computed = new Map<Element, CSSStyleDeclaration>()
  liveEls.forEach((el: any, i: number) => {
    const c = cloneEls[i] as Element
    if (!c) {
      return
    }
    const tag = el.tagName.toLowerCase()
    if (['style', 'title', 'desc', 'metadata', 'script'].includes(tag)) {
      c.remove()
      return
    }
    const cs = getComputedStyle(el)
    computed.set(el, cs)
    if (cs.display === 'none' && !['defs', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'symbol', 'stop'].includes(tag)) {
      c.remove()
      return
    }
    // N'écrit que ce qui diffère du parent (propriétés héritées) ou de la valeur par défaut
    // (la racine <svg> n'est pas recopiée : ses enfants directs repartent des valeurs par défaut)
    const parentCs = i === 0 || el.parentElement === live ? null : computed.get(el.parentElement)
    for (const prop of PRESENTATION_PROPS) {
      let v = cs.getPropertyValue(prop)
      if (!v) {
        continue
      }
      const reference = prop === 'opacity' || !parentCs ? DEFAULTS[prop] : parentCs.getPropertyValue(prop)
      if (v === reference && i > 0) {
        c.removeAttribute(prop)
        continue
      }
      if (prop === 'fill' || prop === 'stroke') {
        v = v.replace(/url\("?(#[^")]+)"?\)/, 'url($1)')
      }
      c.setAttribute(prop, v)
    }
    if (tag === 'text' || tag === 'tspan') {
      c.setAttribute('font-family', cs.fontFamily)
      c.setAttribute('font-size', cs.fontSize)
      c.setAttribute('font-weight', cs.fontWeight)
      c.setAttribute('font-style', cs.fontStyle)
    }
    c.removeAttribute('style')
    c.removeAttribute('class')
    for (const a of [...c.attributes]) {
      if (a.name.startsWith('data-') || a.name.startsWith('stroke-cap') || a.name.startsWith('stroke-join-')) {
        c.removeAttribute(a.name)
      }
    }
  })
}

/** Rend les id internes uniques (dégradés, clipPath…) pour éviter les collisions. */
function prefixIds(root: Element): void {
  const prefix = `b${++uid}-`
  const ids = new Set<string>()
  for (const el of [root, ...root.querySelectorAll('[id]')]) {
    const id = el.getAttribute('id')
    if (id) {
      ids.add(id)
      el.setAttribute('id', prefix + id)
    }
  }
  if (!ids.size) {
    return
  }
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const a of [...el.attributes]) {
      let v = a.value
      for (const id of ids) {
        v = v.split(`url(#${id})`).join(`url(#${prefix}${id})`)
        if ((a.name === 'href' || a.name === 'xlink:href') && v === `#${id}`) {
          v = `#${prefix}${id}`
        }
      }
      if (v !== a.value) {
        el.setAttribute(a.name, v)
      }
    }
  }
}

function viewBoxOf(svg: Element): [number, number, number, number] | null {
  const vb = svg.getAttribute('viewBox')
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number)
    if (p.length === 4 && p.every(x => !Number.isNaN(x))) {
      return [p[0], p[1], p[2], p[3]]
    }
  }
  const w = Number.parseFloat(svg.getAttribute('width') ?? '')
  const h = Number.parseFloat(svg.getAttribute('height') ?? '')
  if (w && h) {
    return [0, 0, w, h]
  }
  return null
}

/**
 * Intègre un SVG externe (image ou masque) dans la boîte donnée.
 * `recolor` : couleur unique à appliquer (cas des masques CSS).
 */
async function inlineExternalSvg(
  url: string,
  box: { x: number, y: number, w: number, h: number },
  sizing: string,
  recolor: string | null,
): Promise<string> {
  const text = await fetchSvgText(url)
  if (!text) {
    return recolor ? '' : `<image x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" href="${esc(url)}"/>`
  }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const parsed = doc.documentElement
  if (!parsed || parsed.tagName.toLowerCase() !== 'svg') {
    return ''
  }
  // Rendu « vivant » caché pour récupérer les styles calculés (feuilles <style> internes, etc.)
  const holder = document.createElement('div')
  holder.style.cssText = 'position:absolute;left:-100000px;top:0;width:100px;height:100px;overflow:hidden;visibility:hidden'
  const live = document.importNode(parsed, true) as unknown as Element
  holder.appendChild(live)
  document.body.appendChild(holder)
  const clone = live.cloneNode(true) as Element
  bakeSvgStyles(live, clone)
  holder.remove()

  if (recolor) {
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      for (const attr of ['fill', 'stroke']) {
        const v = el.getAttribute(attr)
        if (v && v !== 'none' && !v.startsWith('url(')) {
          el.setAttribute(attr, recolor)
        }
      }
    }
  }
  prefixIds(clone)

  const vb = viewBoxOf(parsed) ?? [0, 0, box.w, box.h]
  const [vx, vy, vw, vh] = vb
  let sx: number
  let sy: number
  if (sizing === 'auto') {
    const iw = Number.parseFloat(parsed.getAttribute('width') ?? '') || vw
    const ih = Number.parseFloat(parsed.getAttribute('height') ?? '') || vh
    sx = iw / vw
    sy = ih / vh
  } else if (sizing === '100%' || sizing === '100% auto') {
    sx = sy = box.w / vw
  } else {
    // contain, 100% 100%, et comportement par défaut d'une <img> (preserveAspectRatio meet)
    sx = sy = Math.min(box.w / vw, box.h / vh)
  }
  const dx = box.x + (box.w - vw * sx) / 2 - vx * sx
  const dy = box.y + (box.h - vh * sy) / 2 - vy * sy

  const inner = [...clone.childNodes]
    .map(c => (c.nodeType === 1 ? new XMLSerializer().serializeToString(c) : ''))
    .join('')
    .replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')
  const fill = recolor ? ` fill="${recolor}"` : (clone.getAttribute('fill') ? ` fill="${clone.getAttribute('fill')}"` : '')
  return `<g transform="matrix(${n(sx)} 0 0 ${n(sy)} ${n(dx)} ${n(dy)})"${fill}>${inner}</g>`
}

/* ------------------------------ Parcours DOM ------------------------------ */

interface Ctx {
  ox: number
  oy: number
  exclude: (el: Element) => boolean
}

function neutralizeTransform(el: HTMLElement): () => void {
  const saved = ['transform', 'translate', 'rotate', 'scale'].map(p => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)])
  for (const [p] of saved) {
    el.style.setProperty(p, 'none', 'important')
  }
  return () => {
    for (const [p, v, prio] of saved) {
      if (v) {
        el.style.setProperty(p, v, prio)
      } else {
        el.style.removeProperty(p)
      }
    }
  }
}

function cssTransformMatrix(cs: CSSStyleDeclaration): DOMMatrix {
  let m = new DOMMatrix()
  if (cs.translate && cs.translate !== 'none') {
    const [tx = '0', ty = '0'] = cs.translate.split(' ')
    m = m.translate(Number.parseFloat(tx), Number.parseFloat(ty))
  }
  if (cs.rotate && cs.rotate !== 'none') {
    const deg = cs.rotate.endsWith('turn') ? Number.parseFloat(cs.rotate) * 360 : Number.parseFloat(cs.rotate)
    m = m.rotate(deg)
  }
  if (cs.scale && cs.scale !== 'none') {
    const [sx = '1', sy] = cs.scale.split(' ')
    m = m.scale(Number.parseFloat(sx), Number.parseFloat(sy ?? sx))
  }
  if (cs.transform && cs.transform !== 'none') {
    m = m.multiply(new DOMMatrix(cs.transform))
  }
  return m
}

function paintBox(el: Element, cs: CSSStyleDeclaration, r: DOMRect, ctx: Ctx, out: string[]): void {
  const x = r.left - ctx.ox
  const y = r.top - ctx.oy
  const w = r.width
  const h = r.height
  if (w <= 0 || h <= 0) {
    return
  }
  // Rayons d'arrondi, réduits proportionnellement comme le fait CSS quand ils débordent
  let rx = px(cs.borderTopLeftRadius.split(' ')[0], w)
  let ry = px(cs.borderTopLeftRadius.split(' ')[1] ?? cs.borderTopLeftRadius.split(' ')[0], h)
  const f = Math.min(1, rx > 0 ? w / (2 * rx) : 1, ry > 0 ? h / (2 * ry) : 1)
  rx *= f
  ry *= f
  const round = (inset: number) => {
    const a = Math.max(rx - inset, 0)
    const b = Math.max(ry - inset, 0)
    return a > 0 || b > 0 ? ` rx="${n(a)}" ry="${n(b)}"` : ''
  }

  if (!isTransparent(cs.backgroundColor)) {
    out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${round(0)} ${colorAttrs(cs.backgroundColor, 'fill')}/>`)
  }

  const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => {
    const width = cs.getPropertyValue(`border-${s.toLowerCase()}-width`)
    const style = cs.getPropertyValue(`border-${s.toLowerCase()}-style`)
    const color = cs.getPropertyValue(`border-${s.toLowerCase()}-color`)
    return { w: style === 'none' || style === 'hidden' ? 0 : Number.parseFloat(width) || 0, color, style }
  })
  const uniform = sides.every(s => s.w === sides[0].w && s.color === sides[0].color && s.style === sides[0].style)
  if (uniform && sides[0].w > 0 && !isTransparent(sides[0].color)) {
    const bw = sides[0].w
    const dash = sides[0].style === 'dashed' ? ` stroke-dasharray="${n(bw * 3)} ${n(bw * 3)}"` : (sides[0].style === 'dotted' ? ` stroke-dasharray="${n(bw)} ${n(bw)}"` : '')
    out.push(`<rect x="${n(x + bw / 2)}" y="${n(y + bw / 2)}" width="${n(w - bw)}" height="${n(h - bw)}"${round(bw / 2)} fill="none" ${colorAttrs(sides[0].color, 'stroke')} stroke-width="${n(bw)}"${dash}/>`)
  } else if (!uniform) {
    const [t, rgt, b, l] = sides
    const seg = (sx: number, sy: number, sw: number, sh: number, c: string) => {
      if (sw > 0 && sh > 0 && !isTransparent(c)) {
        out.push(`<rect x="${n(sx)}" y="${n(sy)}" width="${n(sw)}" height="${n(sh)}" ${colorAttrs(c, 'fill')}/>`)
      }
    }
    seg(x, y, w, t.w, t.color)
    seg(x + w - rgt.w, y, rgt.w, h, rgt.color)
    seg(x, y + h - b.w, w, b.w, b.color)
    seg(x, y, l.w, h, l.color)
  }

  // Ombres internes (ex. anneau blanc des terminus)
  if (cs.boxShadow && cs.boxShadow !== 'none') {
    const re = /(rgba?\([^)]*\)|#[0-9a-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+inset/gi
    let m: RegExpExecArray | null
    const bw = uniform ? sides[0].w : 0
    while ((m = re.exec(cs.boxShadow)) !== null) {
      const spread = Number.parseFloat(m[5])
      if (spread > 0 && Number.parseFloat(m[2]) === 0 && Number.parseFloat(m[3]) === 0) {
        const inset = bw + spread / 2
        out.push(`<rect x="${n(x + inset)}" y="${n(y + inset)}" width="${n(w - 2 * inset)}" height="${n(h - 2 * inset)}"${round(inset)} fill="none" ${colorAttrs(m[1], 'stroke')} stroke-width="${n(spread)}"/>`)
      }
    }
  }
}

function textAttrs(cs: CSSStyleDeclaration): string {
  const ls = cs.letterSpacing && cs.letterSpacing !== 'normal' ? ` letter-spacing="${n(Number.parseFloat(cs.letterSpacing))}"` : ''
  const family = cs.fontFamily.replace(/"/g, '\'')
  return `font-family="${esc(family)}" font-size="${n(Number.parseFloat(cs.fontSize))}" font-weight="${cs.fontWeight}" font-style="${cs.fontStyle}" ${colorAttrs(cs.color, 'fill')}${ls}`
}

function paintText(node: Text, cs: CSSStyleDeclaration, ctx: Ctx, out: string[]): void {
  const raw = node.data
  if (!raw.trim()) {
    return
  }
  const vertical = cs.writingMode.startsWith('vertical')
  const upper = cs.textTransform === 'uppercase'
  const lower = cs.textTransform === 'lowercase'

  // Regroupe les caractères par ligne visuelle (espaces de bord retirés)
  type Run = { chars: string[], rects: DOMRect[] }
  const runs: Run[] = []
  const range = document.createRange()
  let current: Run | null = null
  for (let i = 0; i < raw.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const rects = range.getClientRects()
    if (!rects.length) {
      continue
    }
    const cr = rects[0]
    if (cr.width === 0 && cr.height === 0) {
      continue
    }
    const ch = /\s/.test(raw[i]) ? ' ' : raw[i]
    const last = current ? current.rects[0] : null
    const sameLine = last && (vertical ? Math.abs(cr.left - last.left) < 1 : Math.abs(cr.top - last.top) < 1)
    if (current && sameLine) {
      current.chars.push(ch)
      current.rects.push(cr)
    } else {
      current = { chars: [ch], rects: [cr] }
      runs.push(current)
    }
  }
  for (const run of runs) {
    while (run.chars.length && run.chars[0] === ' ') {
      run.chars.shift()
      run.rects.shift()
    }
    while (run.chars.length && run.chars[run.chars.length - 1] === ' ') {
      run.chars.pop()
      run.rects.pop()
    }
  }
  const visible = runs.filter(run => run.chars.length > 0)
  if (!visible.length) {
    return
  }
  const bounds = (rects: DOMRect[]) => {
    const l = Math.min(...rects.map(q => q.left))
    const t = Math.min(...rects.map(q => q.top))
    return new DOMRect(l, t, Math.max(...rects.map(q => q.right)) - l, Math.max(...rects.map(q => q.bottom)) - t)
  }

  // Ligne de base : marqueur invisible inséré juste avant le texte
  let baselineOffset: number | null = null
  // (impossible dans un conteneur flex/grid : le marqueur deviendrait un élément flex)
  if (!vertical && !/flex|grid/.test(cs.display)) {
    const marker = document.createElement('span')
    marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline'
    node.parentNode!.insertBefore(marker, node)
    const mr = marker.getBoundingClientRect()
    marker.remove()
    baselineOffset = mr.bottom - bounds(visible[0].rects).top
  }

  const canvas = document.createElement('canvas').getContext('2d')!
  canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const metrics = canvas.measureText('Hg')
  const asc = metrics.fontBoundingBoxAscent || Number.parseFloat(cs.fontSize) * 0.8
  const desc = metrics.fontBoundingBoxDescent || Number.parseFloat(cs.fontSize) * 0.2

  for (const run of visible) {
    let text = run.chars.join('')
    const rect = bounds(run.rects)
    if (upper) {
      text = text.toUpperCase()
    } else if (lower) {
      text = text.toLowerCase()
    }
    const attrs = textAttrs(cs)
    if (vertical) {
      const x0 = rect.left - ctx.ox + (rect.width - (asc + desc)) / 2 + desc
      const y0 = rect.top - ctx.oy
      out.push(`<text transform="translate(${n(x0)} ${n(y0)}) rotate(90)" x="0" y="0" xml:space="preserve" ${attrs}>${esc(text)}</text>`)
    } else {
      const x = rect.left - ctx.ox
      const offset = baselineOffset ?? ((rect.height - (asc + desc)) / 2 + asc)
      const y = rect.top - ctx.oy + offset
      out.push(`<text x="${n(x)}" y="${n(y)}" xml:space="preserve" ${attrs}>${esc(text)}</text>`)
    }
  }
}

function paintInlineSvg(svg: SVGSVGElement, r: DOMRect, ctx: Ctx, out: string[]): void {
  const clone = svg.cloneNode(true) as Element
  bakeSvgStyles(svg, clone)
  prefixIds(clone)
  const x = r.left - ctx.ox
  const y = r.top - ctx.oy
  const vb = svg.getAttribute('viewBox') ? viewBoxOf(svg) : null
  let tr = `translate(${n(x)} ${n(y)})`
  if (vb) {
    const s = Math.min(r.width / vb[2], r.height / vb[3])
    const dx = x + (r.width - vb[2] * s) / 2 - vb[0] * s
    const dy = y + (r.height - vb[3] * s) / 2 - vb[1] * s
    tr = `matrix(${n(s)} 0 0 ${n(s)} ${n(dx)} ${n(dy)})`
  }
  const inner = [...clone.childNodes]
    .map(c => (c.nodeType === 1 ? new XMLSerializer().serializeToString(c) : ''))
    .join('')
    .replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')
  out.push(`<g transform="${tr}">${inner}</g>`)
}

/**
 * Ordre de peinture simplifié des enfants (équivalent local des règles CSS) :
 * z-index négatifs, puis éléments non positionnés et textes, puis positionnés
 * sans z-index (ou 0), puis z-index positifs croissants — à égalité, ordre du DOM.
 */
function paintOrder(el: Element): ChildNode[] {
  const children = [...el.childNodes]
  const keyed = children.map((child, i) => {
    if (child.nodeType !== Node.ELEMENT_NODE) {
      return { child, layer: 1, z: 0, i }
    }
    const cs = getComputedStyle(child as Element)
    const positioned = cs.position !== 'static'
    const z = cs.zIndex === 'auto' ? null : Number.parseInt(cs.zIndex, 10)
    // Un z-index s'applique aussi aux éléments flex/grid non positionnés
    const parentDisplay = getComputedStyle(el).display
    const zApplies = positioned || /flex|grid/.test(parentDisplay)
    if (zApplies && z !== null && z < 0) {
      return { child, layer: 0, z, i }
    }
    if (zApplies && z !== null && z > 0) {
      return { child, layer: 3, z, i }
    }
    if (positioned || (zApplies && z === 0)) {
      return { child, layer: 2, z: 0, i }
    }
    return { child, layer: 1, z: 0, i }
  })
  keyed.sort((a, b) => a.layer - b.layer || a.z - b.z || a.i - b.i)
  return keyed.map(k => k.child)
}

async function walk(el: Element, ctx: Ctx, out: string[], isRoot = false): Promise<void> {
  if (ctx.exclude(el)) {
    return
  }
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') {
    return
  }

  let restore: (() => void) | null = null
  let open = ''
  const hasTransform = !isRoot && ((cs.transform && cs.transform !== 'none') || (cs.rotate && cs.rotate !== 'none') || (cs.translate && cs.translate !== 'none') || (cs.scale && cs.scale !== 'none'))
  if (hasTransform && el instanceof HTMLElement) {
    const m = cssTransformMatrix(cs)
    const [oxs, oys] = cs.transformOrigin.split(' ')
    restore = neutralizeTransform(el)
    const r0 = el.getBoundingClientRect()
    const ox = r0.left - ctx.ox + px(oxs, r0.width)
    const oy = r0.top - ctx.oy + px(oys, r0.height)
    open = `<g transform="translate(${n(ox)} ${n(oy)}) matrix(${n(m.a)} ${n(m.b)} ${n(m.c)} ${n(m.d)} ${n(m.e)} ${n(m.f)}) translate(${n(-ox)} ${n(-oy)})"`
  }
  const opacity = Number.parseFloat(cs.opacity)
  if (opacity < 1) {
    open = open ? `${open} opacity="${n(opacity)}"` : `<g opacity="${n(opacity)}"`
  }
  if (open) {
    out.push(`${open}>`)
  }

  try {
    const r = el.getBoundingClientRect()
    const tag = el.tagName.toLowerCase()

    if (tag === 'svg') {
      paintInlineSvg(el as SVGSVGElement, r, ctx, out)
      return
    }
    if (tag === 'img') {
      const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src
      if (src) {
        out.push(await inlineExternalSvg(src, { x: r.left - ctx.ox, y: r.top - ctx.oy, w: r.width, h: r.height }, 'contain', null))
      }
      return
    }

    const mask = cs.maskImage && cs.maskImage !== 'none' ? cs.maskImage : (cs.getPropertyValue('-webkit-mask-image') || 'none')
    const maskUrl = mask !== 'none' ? extractUrl(mask) : null
    if (maskUrl) {
      const color = isTransparent(cs.backgroundColor) ? 'none' : cs.backgroundColor
      if (color !== 'none') {
        const size = cs.maskSize || cs.getPropertyValue('-webkit-mask-size') || 'auto'
        out.push(await inlineExternalSvg(maskUrl, { x: r.left - ctx.ox, y: r.top - ctx.oy, w: r.width, h: r.height }, size, color))
      }
    } else {
      paintBox(el, cs, r, ctx, out)
      const bg = cs.backgroundImage && cs.backgroundImage !== 'none' ? extractUrl(cs.backgroundImage) : null
      if (bg) {
        out.push(await inlineExternalSvg(bg, { x: r.left - ctx.ox, y: r.top - ctx.oy, w: r.width, h: r.height }, cs.backgroundSize, null))
      }
    }

    for (const child of paintOrder(el)) {
      if (child.nodeType === Node.TEXT_NODE) {
        paintText(child as Text, cs, ctx, out)
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        await walk(child as Element, ctx, out)
      }
    }
  } finally {
    if (open) {
      out.push('</g>')
    }
    restore?.()
  }
}

export interface SvgExportOptions {
  /** Éléments à ignorer (par défaut : classe « export-hide », comme l'export PNG). */
  exclude?: (el: Element) => boolean
}

export async function domToSvg(root: HTMLElement, options: SvgExportOptions = {}): Promise<string> {
  await document.fonts?.ready
  const rect = root.getBoundingClientRect()
  const ctx: Ctx = {
    ox: rect.left,
    oy: rect.top,
    exclude: options.exclude ?? (el => (el.getAttribute('class') ?? '').includes('export-hide')),
  }
  const out: string[] = []
  await walk(root, ctx, out, true)
  const w = n(rect.width)
  const h = n(rect.height)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${out.join('\n')}\n</svg>\n`
}
