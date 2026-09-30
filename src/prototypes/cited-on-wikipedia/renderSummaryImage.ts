/**
 * Rasterise a rendered `SummaryBadge` to PNG — no dependencies. Rather than
 * re-implementing the layout, it paints what the browser already laid out:
 * every `[data-paint]` element at its on-screen rect, with its computed styles.
 * So the image matches the preview exactly, including wrapping and theme.
 *
 * - `box`   — background, border, radius
 * - `image` — drawn as-is (must be CORS-enabled, or the canvas is tainted)
 * - `icon`  — the Codex icon's inline SVG, filled with the element's text colour
 * - `text`  — word by word at each word's layout position
 */

function px(value: string): number {
  return Number.parseFloat(value) || 0
}

function paintBox(ctx: CanvasRenderingContext2D, el: Element) {
  const rect = el.getBoundingClientRect()
  const style = getComputedStyle(el)
  const radius = Math.min(px(style.borderTopLeftRadius), rect.height / 2, rect.width / 2)
  const border = px(style.borderTopWidth)

  ctx.beginPath()
  ctx.roundRect(rect.left + border / 2, rect.top + border / 2, rect.width - border, rect.height - border, radius)
  ctx.fillStyle = style.backgroundColor
  ctx.fill()
  if (border > 0 && style.borderTopStyle !== 'none') {
    ctx.lineWidth = border
    ctx.strokeStyle = style.borderTopColor
    ctx.stroke()
  }
}

async function paintImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  if (!img.complete) await img.decode()
  const rect = img.getBoundingClientRect()
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function paintIcon(ctx: CanvasRenderingContext2D, el: Element, scale: number) {
  const svg = el.querySelector('svg')
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // Rasterise at output resolution so the icon stays crisp.
  clone.setAttribute('width', String(rect.width * scale))
  clone.setAttribute('height', String(rect.height * scale))
  clone.setAttribute('fill', getComputedStyle(el).color)
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
  ctx.drawImage(await loadImage(src), rect.left, rect.top, rect.width, rect.height)
}

function paintText(ctx: CanvasRenderingContext2D, el: Element) {
  const style = getComputedStyle(el)
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  ctx.fillStyle = style.color
  ctx.textBaseline = 'alphabetic'

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (const match of text.matchAll(/\S+/g)) {
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      const rect = range.getBoundingClientRect()
      const metrics = ctx.measureText(match[0])
      const ascent = metrics.fontBoundingBoxAscent
      const descent = metrics.fontBoundingBoxDescent
      // Centre the font's content box in the word's line box, as layout does.
      const baseline = rect.top + (rect.height - (ascent + descent)) / 2 + ascent
      ctx.fillText(match[0], rect.left, baseline)
    }
  }
}

/** PNG of `root` (a rendered `SummaryBadge`) at `scale`× its on-screen size. */
export async function renderSummaryImage(root: HTMLElement, scale = 2): Promise<Blob> {
  const bounds = root.getBoundingClientRect()
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(bounds.width * scale)
  canvas.height = Math.ceil(bounds.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  ctx.scale(scale, scale)
  ctx.translate(-bounds.left, -bounds.top)

  // Document order, so later elements paint over earlier ones as on screen.
  const targets = [root, ...root.querySelectorAll<HTMLElement>('[data-paint]')]
  for (const el of targets) {
    const kind = el.dataset.paint
    if (kind === 'box') paintBox(ctx, el)
    else if (kind === 'image') await paintImage(ctx, el as HTMLImageElement)
    else if (kind === 'icon') await paintIcon(ctx, el, scale)
    else if (kind === 'text') paintText(ctx, el)
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode PNG'))), 'image/png'),
  )
}
