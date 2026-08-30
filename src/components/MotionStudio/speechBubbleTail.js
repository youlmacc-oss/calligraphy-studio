export const TAIL_HANDLE_RADIUS = 12

export function defaultBubbleTail() {
  return {
    enabled: false,
    tip: { x: -18, y: 56 },
    baseStart: { x: -14, y: 20 },
    baseEnd: { x: 14, y: 20 },
  }
}

export function normalizeBubbleTail(raw) {
  const fallback = defaultBubbleTail()
  if (!raw || typeof raw !== 'object') return fallback
  return {
    enabled: Boolean(raw.enabled),
    tip: pointOf(raw.tip, fallback.tip),
    baseStart: pointOf(raw.baseStart, fallback.baseStart),
    baseEnd: pointOf(raw.baseEnd, fallback.baseEnd),
  }
}

function pointOf(value, fallback) {
  return {
    x: Number.isFinite(Number(value?.x)) ? Number(value.x) : fallback.x,
    y: Number.isFinite(Number(value?.y)) ? Number(value.y) : fallback.y,
  }
}

export function resolveTailAbs(box, tail) {
  if (!box?.visible || !tail?.enabled) return null
  return {
    tip: { x: box.x + (Number(tail.tip?.x) || 0), y: box.y + (Number(tail.tip?.y) || 0) },
    baseStart: { x: box.x + (Number(tail.baseStart?.x) || 0), y: box.y + (Number(tail.baseStart?.y) || 0) },
    baseEnd: { x: box.x + (Number(tail.baseEnd?.x) || 0), y: box.y + (Number(tail.baseEnd?.y) || 0) },
  }
}

export function hitTestTailHandle(abs, x, y, radius = TAIL_HANDLE_RADIUS) {
  if (!abs) return null
  let best = null
  let bestD = radius
  ;['tip', 'baseStart', 'baseEnd'].forEach((key) => {
    const pt = abs[key]
    if (!pt) return
    const dist = Math.hypot(x - pt.x, y - pt.y)
    if (dist <= bestD) {
      best = key
      bestD = dist
    }
  })
  return best
}

function attachEdge(tip, left, top, w, h) {
  const cx = left + w / 2
  const cy = top + h / 2
  const dx = tip.x - cx
  const dy = tip.y - cy
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'top' : 'bottom'
}

function clampOnEdge(edge, px, py, left, top, w, h, inset) {
  const right = left + w
  const bottom = top + h
  const pad = Math.max(6, inset)
  if (edge === 'top') return { x: Math.min(right - pad, Math.max(left + pad, px)), y: top }
  if (edge === 'bottom') return { x: Math.min(right - pad, Math.max(left + pad, px)), y: bottom }
  if (edge === 'left') return { x: left, y: Math.min(bottom - pad, Math.max(top + pad, py)) }
  return { x: right, y: Math.min(bottom - pad, Math.max(top + pad, py)) }
}

function orderOnEdge(edge, a, b) {
  if (edge === 'top') return a.x <= b.x ? [a, b] : [b, a]
  if (edge === 'right') return a.y <= b.y ? [a, b] : [b, a]
  if (edge === 'bottom') return a.x >= b.x ? [a, b] : [b, a]
  return a.y >= b.y ? [a, b] : [b, a]
}

function buildRoundedRectWithTail(ctx, left, top, w, h, radius, tailAbs) {
  const r = Math.min(radius, w / 2, h / 2)
  const right = left + w
  const bottom = top + h
  const edge = tailAbs ? attachEdge(tailAbs.tip, left, top, w, h) : null
  const start = tailAbs ? clampOnEdge(edge, tailAbs.baseStart.x, tailAbs.baseStart.y, left, top, w, h, r) : null
  const end = tailAbs ? clampOnEdge(edge, tailAbs.baseEnd.x, tailAbs.baseEnd.y, left, top, w, h, r) : null
  const ordered = start && end ? orderOnEdge(edge, start, end) : null
  const first = ordered?.[0]
  const second = ordered?.[1]
  const tip = tailAbs?.tip

  const emitTail = (side) => {
    if (!tip || edge !== side) return
    ctx.lineTo(first.x, first.y)
    ctx.lineTo(tip.x, tip.y)
    ctx.lineTo(second.x, second.y)
  }

  ctx.moveTo(left + r, top)
  if (edge === 'top') emitTail('top')
  ctx.lineTo(right - r, top)
  ctx.quadraticCurveTo(right, top, right, top + r)
  if (edge === 'right') emitTail('right')
  ctx.lineTo(right, bottom - r)
  ctx.quadraticCurveTo(right, bottom, right - r, bottom)
  if (edge === 'bottom') emitTail('bottom')
  ctx.lineTo(left + r, bottom)
  ctx.quadraticCurveTo(left, bottom, left, bottom - r)
  if (edge === 'left') emitTail('left')
  ctx.lineTo(left, top + r)
  ctx.quadraticCurveTo(left, top, left + r, top)
}

export function drawSpeechBubbleWithTail(ctx, box, tail, style = {}) {
  if (!ctx || !box?.visible) return
  const w = Math.max(24, Number(box.width) || 96)
  const h = Math.max(20, Number(box.height) || 40)
  const left = box.x - w / 2
  const top = box.y - h / 2
  const radius = Math.min(style.radius ?? 12, w / 2, h / 2)
  const abs = tail?.enabled ? resolveTailAbs(box, tail) : null

  ctx.save()
  ctx.beginPath()
  buildRoundedRectWithTail(ctx, left, top, w, h, radius, abs)
  ctx.closePath()
  ctx.fillStyle = style.bgColor || '#ffffff'
  ctx.fill()
  const borderWidth = Number(style.borderWidth)
  if (borderWidth > 0) {
    ctx.lineWidth = borderWidth
    ctx.strokeStyle = style.borderColor || '#000000'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

export function drawTailHandles(ctx, abs) {
  if (!ctx || !abs) return
  const marks = [
    { pt: abs.tip, fill: '#22d3ee' },
    { pt: abs.baseStart, fill: '#facc15' },
    { pt: abs.baseEnd, fill: '#facc15' },
  ]
  ctx.save()
  marks.forEach(({ pt, fill }) => {
    if (!pt) return
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = 1.4
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()
  })
  ctx.restore()
}
