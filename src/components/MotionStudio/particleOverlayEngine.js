export const PARTICLE_NONE = 'none'
export const PARTICLE_SPARKLE = 'sparkle'
export const PARTICLE_HEARTS = 'hearts'
export const PARTICLE_SWEAT = 'sweat'
export const PARTICLE_TEARS = 'tears'

export const PARTICLE_LAYERS = [
  { id: PARTICLE_SPARKLE, label: '반짝이', icon: '✨' },
  { id: PARTICLE_HEARTS, label: '하트', icon: '💕' },
  { id: PARTICLE_SWEAT, label: '땀방울', icon: '💦' },
  { id: PARTICLE_TEARS, label: '눈물', icon: '😢' },
]

const TAU = Math.PI * 2

function wrap01(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return 0
  return ((n % 1) + 1) % 1
}

export function normalizeParticleLayers(value) {
  const ids = new Set(PARTICLE_LAYERS.map((item) => item.id))
  const list = Array.isArray(value) ? value : (value ? [value] : [])
  return list.filter((id) => ids.has(id))
}

function star(ctx, x, y, r, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#fff7ae'
  ctx.beginPath()
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU
    const rad = i % 2 === 0 ? r : r * 0.38
    const px = x + Math.cos(a) * rad
    const py = y + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function heart(ctx, x, y, s, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#fb7185'
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.35, x - s, y - s * 0.1, x, y + s * 0.85)
  ctx.bezierCurveTo(x + s, y - s * 0.1, x, y - s * 0.35, x, y + s * 0.3)
  ctx.fill()
  ctx.restore()
}

function drop(ctx, x, y, s, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.15, x, y + s)
  ctx.quadraticCurveTo(x - s * 0.7, y + s * 0.15, x, y - s)
  ctx.fill()
  ctx.restore()
}

export function paintParticleOverlay(ctx, {
  size = 360,
  time01 = 0,
  layers = [],
} = {}) {
  const edge = Math.max(8, Math.round(Number(size) || 360))
  const u = wrap01(time01)
  const on = normalizeParticleLayers(layers)
  if (!ctx || !on.length) return

  if (on.includes(PARTICLE_SPARKLE)) {
    for (let i = 0; i < 7; i += 1) {
      const phase = wrap01(u + i * 0.13)
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(phase * TAU * 2))
      star(
        ctx,
        edge * (0.12 + ((i * 37) % 80) / 100),
        edge * (0.1 + ((i * 19) % 70) / 100),
        5 + (i % 3) * 2,
        twinkle,
      )
    }
  }

  if (on.includes(PARTICLE_HEARTS)) {
    for (let i = 0; i < 5; i += 1) {
      const phase = wrap01(u * 0.85 + i * 0.2)
      heart(
        ctx,
        edge * (0.18 + ((i * 23) % 64) / 100),
        edge * (0.92 - phase * 0.72),
        9 + (i % 3) * 2,
        0.35 + 0.55 * (1 - phase),
      )
    }
  }

  if (on.includes(PARTICLE_SWEAT)) {
    for (let i = 0; i < 4; i += 1) {
      const phase = wrap01(u * 1.15 + i * 0.18)
      drop(
        ctx,
        edge * (0.72 + i * 0.05),
        edge * (0.12 + phase * 0.28),
        6 + i,
        '#7dd3fc',
        0.45 + 0.4 * (1 - phase),
      )
    }
  }

  if (on.includes(PARTICLE_TEARS)) {
    for (let i = 0; i < 4; i += 1) {
      const phase = wrap01(u * 0.9 + i * 0.22)
      const side = i % 2 === 0 ? -1 : 1
      drop(
        ctx,
        edge * (0.5 + side * 0.16),
        edge * (0.42 + phase * 0.38),
        7,
        '#38bdf8',
        0.55 + 0.35 * (1 - phase),
      )
    }
  }
}
