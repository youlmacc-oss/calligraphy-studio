export function defaultViewEdit() {
  return {
    rotation90: 0,
    flipH: false,
    flipV: false,
    crop: null,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    vignette: 0,
    ink: 0,
  }
}

export function hasViewEdit(edit) {
  if (!edit) return false
  return Boolean(
    edit.rotation90
    || edit.flipH
    || edit.flipV
    || edit.crop
    || edit.brightness !== 100
    || edit.contrast !== 100
    || edit.saturation !== 100
    || edit.vignette
    || edit.ink,
  )
}

function fitAspect(rect, aspectId) {
  if (!aspectId || aspectId === 'free') return rect
  const ratio = aspectId === '1:1' ? 1 : aspectId === '16:9' ? 16 / 9 : aspectId === '4:3' ? 4 / 3 : 0
  if (!ratio) return rect
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  let width = rect.w
  let height = width / ratio
  if (height > rect.h) {
    height = rect.h
    width = height * ratio
  }
  return {
    x: Math.max(0, Math.min(1 - width, cx - width / 2)),
    y: Math.max(0, Math.min(1 - height, cy - height / 2)),
    w: width,
    h: height,
  }
}

export function makeCropRect(aspectId = 'free') {
  return fitAspect({ x: 0.12, y: 0.12, w: 0.76, h: 0.76 }, aspectId)
}

export function constrainCrop(rect, aspectId = 'free') {
  const next = {
    x: Math.max(0, Math.min(0.92, rect.x)),
    y: Math.max(0, Math.min(0.92, rect.y)),
    w: Math.max(0.08, Math.min(1, rect.w)),
    h: Math.max(0.08, Math.min(1, rect.h)),
  }
  if (next.x + next.w > 1) next.x = 1 - next.w
  if (next.y + next.h > 1) next.y = 1 - next.h
  return fitAspect(next, aspectId)
}

export function applyViewEdit(source, edit, { letterbox = true, skipCrop = false } = {}) {
  if (!source || !edit) return source
  const active = { ...edit, crop: skipCrop ? null : edit.crop }
  if (!hasViewEdit(active)) return source
  const w = source.width
  const h = source.height
  const stage = document.createElement('canvas')
  stage.width = w
  stage.height = h
  const ctx = stage.getContext('2d')
  ctx.filter = `brightness(${edit.brightness ?? 100}%) contrast(${edit.contrast ?? 100}%) saturate(${edit.saturation ?? 100}%) grayscale(${edit.ink ?? 0}%)`
  ctx.translate(w / 2, h / 2)
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1)
  const rad = ((edit.rotation90 || 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const packedW = w * cos + h * sin
  const packedH = w * sin + h * cos
  const fit = Math.min(w / packedW, h / packedH)
  ctx.scale(fit, fit)
  ctx.rotate(rad)
  ctx.drawImage(source, -w / 2, -h / 2)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.filter = 'none'

  if ((edit.vignette ?? 0) > 0) {
    const glow = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.72)
    glow.addColorStop(0, 'rgba(0,0,0,0)')
    glow.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, (edit.vignette ?? 0) / 100)})`)
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
  }

  const crop = !skipCrop && edit.crop
  if (!crop) return stage

  const sx = Math.round(crop.x * w)
  const sy = Math.round(crop.y * h)
  const sw = Math.max(8, Math.round(crop.w * w))
  const sh = Math.max(8, Math.round(crop.h * h))
  const cut = document.createElement('canvas')
  cut.width = sw
  cut.height = sh
  cut.getContext('2d').drawImage(stage, sx, sy, sw, sh, 0, 0, sw, sh)
  if (!letterbox) return cut

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const scale = Math.min(w / sw, h / sh)
  ctx.drawImage(cut, (w - sw * scale) / 2, (h - sh * scale) / 2, sw * scale, sh * scale)
  return stage
}

export function animateViewEdit(edit, style, t) {
  const base = { ...defaultViewEdit(), ...edit }
  const wave = 0.5 - Math.cos(t * Math.PI * 2) / 2
  if (style === 'glitch') {
    return { ...base, contrast: 100 + wave * 28, saturation: 100 + wave * 20, brightness: 96 + wave * 12 }
  }
  if (style === 'chrome') {
    return { ...base, brightness: 92 + wave * 22, contrast: 104 + wave * 10, saturation: 90 + wave * 18 }
  }
  return { ...base, brightness: 92 + wave * 18, contrast: 100 + wave * 8, saturation: 100 + wave * 6 }
}

export function gifStyleFromPreset(preset) {
  const shader = preset?.shader || ''
  if (shader.includes('wave') || shader.includes('calli') || shader.includes('kinetic')) return 'float'
  if (shader.includes('chrome') || shader.includes('glass') || shader.includes('hologram') || shader.includes('crystal')) return 'fade'
  return 'pulse'
}
