function palette(mask, fill, stroke) {
  return {
    fill: mask ? '#ffffff' : fill,
    stroke: mask ? '#ffffff' : stroke,
  }
}

function finish(ctx, mask, fill, stroke, line = 3) {
  const ink = palette(mask, fill, stroke)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = mask ? Math.max(line, 4) : line
  ctx.fillStyle = ink.fill
  ctx.strokeStyle = ink.stroke
  if (fill !== 'none') ctx.fill()
  ctx.stroke()
}

function rounded(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function drawStar(ctx, size, mask) {
  ctx.beginPath()
  for (let i = 0; i < 5; i += 1) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const inner = outer + Math.PI / 5
    const ox = Math.cos(outer) * size
    const oy = Math.sin(outer) * size
    const ix = Math.cos(inner) * size * 0.42
    const iy = Math.sin(inner) * size * 0.42
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(ix, iy)
  }
  ctx.closePath()
  finish(ctx, mask, '#F4D35E', '#5C3A21', 3)
}

function drawBeer(ctx, size, mask) {
  const w = size * 0.7
  const h = size * 1.05
  rounded(ctx, -w / 2, -h * 0.25, w, h * 0.85, 8)
  finish(ctx, mask, '#F6C945', '#5C3A21', 3)
  rounded(ctx, -w / 2 + 4, -h * 0.42, w - 8, h * 0.28, 10)
  finish(ctx, mask, '#FFF7E8', '#5C3A21', 2.5)
  ctx.beginPath()
  ctx.arc(w * 0.62, h * 0.12, size * 0.18, -0.8, 0.8)
  finish(ctx, mask, 'transparent', '#5C3A21', 3.5)
}

function drawChili(ctx, size, mask) {
  ctx.beginPath()
  ctx.moveTo(-size * 0.15, -size * 0.55)
  ctx.quadraticCurveTo(size * 0.7, -size * 0.2, size * 0.45, size * 0.5)
  ctx.quadraticCurveTo(-size * 0.05, size * 0.7, -size * 0.4, size * 0.15)
  ctx.quadraticCurveTo(-size * 0.55, -size * 0.25, -size * 0.15, -size * 0.55)
  ctx.closePath()
  finish(ctx, mask, '#E85D4C', '#5C3A21', 3)
  ctx.beginPath()
  ctx.moveTo(-size * 0.08, -size * 0.55)
  ctx.quadraticCurveTo(size * 0.05, -size * 0.85, size * 0.22, -size * 0.62)
  ctx.strokeStyle = mask ? '#ffffff' : '#3F7D4E'
  ctx.lineWidth = 4
  ctx.stroke()
}

function drawBacon(ctx, size, mask) {
  ctx.beginPath()
  ctx.moveTo(-size * 0.7, -size * 0.15)
  ctx.quadraticCurveTo(-size * 0.2, -size * 0.55, size * 0.1, -size * 0.1)
  ctx.quadraticCurveTo(size * 0.45, size * 0.3, size * 0.75, -size * 0.05)
  ctx.lineTo(size * 0.72, size * 0.22)
  ctx.quadraticCurveTo(size * 0.4, size * 0.55, size * 0.05, size * 0.18)
  ctx.quadraticCurveTo(-size * 0.25, -size * 0.2, -size * 0.72, size * 0.12)
  ctx.closePath()
  finish(ctx, mask, '#F2A07B', '#5C3A21', 3)
}

function drawSign(ctx, size, mask) {
  rounded(ctx, -size * 0.08, -size * 0.1, size * 0.16, size * 0.85, 4)
  finish(ctx, mask, '#D9C4A5', '#5C3A21', 2.5)
  rounded(ctx, -size * 0.7, -size * 0.7, size * 1.4, size * 0.7, 10)
  finish(ctx, mask, '#7EC8E3', '#5C3A21', 3)
}

function drawCoffee(ctx, size, mask) {
  rounded(ctx, -size * 0.45, -size * 0.15, size * 0.9, size * 0.75, 8)
  finish(ctx, mask, '#F4E1C1', '#5C3A21', 3)
  ctx.beginPath()
  ctx.arc(size * 0.55, size * 0.18, size * 0.22, -1.1, 1.1)
  ctx.strokeStyle = mask ? '#ffffff' : '#5C3A21'
  ctx.lineWidth = 3.5
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, -size * 0.12, size * 0.32, size * 0.1, 0, 0, Math.PI * 2)
  finish(ctx, mask, '#6B3F2A', '#5C3A21', 2)
}

function drawHeart(ctx, size, mask) {
  ctx.beginPath()
  ctx.moveTo(0, size * 0.45)
  ctx.bezierCurveTo(-size * 0.9, size * 0.05, -size * 0.55, -size * 0.7, 0, -size * 0.2)
  ctx.bezierCurveTo(size * 0.55, -size * 0.7, size * 0.9, size * 0.05, 0, size * 0.45)
  finish(ctx, mask, '#F472B6', '#5C3A21', 3)
}

function drawFlower(ctx, size, mask) {
  for (let i = 0; i < 5; i += 1) {
    ctx.save()
    ctx.rotate((i * Math.PI * 2) / 5)
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.38, size * 0.22, size * 0.34, 0, 0, Math.PI * 2)
    finish(ctx, mask, '#F9A8D4', '#5C3A21', 2.2)
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2)
  finish(ctx, mask, '#FDE68A', '#5C3A21', 2)
}

function drawPlane(ctx, size, mask) {
  ctx.beginPath()
  ctx.moveTo(-size * 0.7, 0)
  ctx.lineTo(size * 0.75, -size * 0.12)
  ctx.lineTo(size * 0.35, size * 0.08)
  ctx.closePath()
  finish(ctx, mask, '#93C5FD', '#5C3A21', 2.5)
  ctx.beginPath()
  ctx.moveTo(-size * 0.05, -size * 0.02)
  ctx.lineTo(-size * 0.35, -size * 0.45)
  ctx.lineTo(size * 0.05, -size * 0.08)
  ctx.closePath()
  finish(ctx, mask, '#BFDBFE', '#5C3A21', 2)
}

function drawPin(ctx, size, mask) {
  ctx.beginPath()
  ctx.arc(0, -size * 0.15, size * 0.38, Math.PI, 0)
  ctx.lineTo(0, size * 0.7)
  ctx.closePath()
  finish(ctx, mask, '#FB7185', '#5C3A21', 3)
  ctx.beginPath()
  ctx.arc(0, -size * 0.18, size * 0.14, 0, Math.PI * 2)
  finish(ctx, mask, '#FFF7E8', '#5C3A21', 2)
}

function drawBow(ctx, size, mask) {
  ctx.beginPath()
  ctx.ellipse(-size * 0.32, 0, size * 0.32, size * 0.24, -0.3, 0, Math.PI * 2)
  finish(ctx, mask, '#F9A8D4', '#5C3A21', 2.5)
  ctx.beginPath()
  ctx.ellipse(size * 0.32, 0, size * 0.32, size * 0.24, 0.3, 0, Math.PI * 2)
  finish(ctx, mask, '#F9A8D4', '#5C3A21', 2.5)
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2)
  finish(ctx, mask, '#FDE68A', '#5C3A21', 2)
}

const THEMES = {
  fnb: [drawBeer, drawChili, drawBacon, drawCoffee, drawStar, drawSign],
  travel: [drawSign, drawPlane, drawPin, drawStar, drawCoffee, drawBeer],
  lovely: [drawHeart, drawFlower, drawBow, drawStar, drawChili, drawCoffee],
}

function hashSeed(value) {
  let hash = 2166136261
  for (const ch of value) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function rngFrom(seed) {
  let state = seed || 1
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function paintStickers(ctx, { text, x, y, fontSize, layout, theme = 'fnb', mask = false }) {
  const drawers = THEMES[theme] ?? THEMES.fnb
  const rng = rngFrom(hashSeed(`${text}|${theme}`))
  const count = 8
  const boxW = layout.total + fontSize * 0.9
  const boxH = fontSize * 1.35

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.28
    const radiusX = boxW * 0.52 + fontSize * 0.18
    const radiusY = boxH * 0.72 + fontSize * 0.12
    const px = x + Math.cos(angle) * radiusX
    const py = y + Math.sin(angle) * radiusY
    const scale = fontSize * (0.28 + rng() * 0.16)
    const rot = (rng() - 0.5) * 0.9
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(rot)
    drawers[i % drawers.length](ctx, scale, mask)
    ctx.restore()
  }

  for (let i = 0; i < 4; i += 1) {
    const angle = rng() * Math.PI * 2
    ctx.save()
    ctx.translate(
      x + Math.cos(angle) * (boxW * 0.38),
      y + Math.sin(angle) * (boxH * 0.55),
    )
    ctx.rotate((rng() - 0.5) * 0.6)
    drawStar(ctx, fontSize * (0.12 + rng() * 0.08), mask)
    ctx.restore()
  }
}
