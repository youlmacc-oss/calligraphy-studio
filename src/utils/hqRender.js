import { blitPremultiplied } from './imageProcessor.js'

export const HQ_KERNEL = [
  0, -1, 0,
  -1, 5, -1,
  0, -1, 0,
]

const FRINGE_CUT = 22
const OPAQUE_SNAP = 248
const SHARP_MIX = 0.32

export function hqPixelRatio(zoomPercent = 100) {
  const raw = typeof window !== 'undefined' ? Number(window.devicePixelRatio) : 0
  const dpr = Number.isFinite(raw) && raw > 0 ? raw : 2
  const zoom = Math.max(1, Number(zoomPercent) / 100 || 1)
  return Math.min(4, Math.max(2, dpr) * (zoom > 1 ? zoom : 1))
}

export function primeHqContext(ctx) {
  if (!ctx) return ctx
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

export function blitToHiDpiCanvas(target, source, {
  cssWidth,
  cssHeight,
  zoomPercent = 100,
  live = false,
  edgePreserve = true,
} = {}) {
  if (!target || !source) return target
  const w = Math.max(1, Math.round(Number(cssWidth) || source.width || 1))
  const h = Math.max(1, Math.round(Number(cssHeight) || source.height || 1))
  const dpr = hqPixelRatio(zoomPercent)
  const bw = Math.max(1, Math.round(w * dpr))
  const bh = Math.max(1, Math.round(h * dpr))
  if (target.width !== bw || target.height !== bh) {
    target.width = bw
    target.height = bh
  }
  target.style.width = `${w}px`
  target.style.height = `${h}px`
  const ctx = target.getContext('2d', { alpha: true })
  if (!ctx) return target
  primeHqContext(ctx)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, bw, bh)
  if (live) {
    ctx.drawImage(source, 0, 0, bw, bh)
    return target
  }
  const ok = blitPremultiplied(target, source, bw, bh, { live: false, edgePreserve })
  if (!ok) ctx.drawImage(source, 0, 0, bw, bh)
  return target
}

function alphaAt(data, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return 0
  return data[(y * width + x) * 4 + 3]
}

export function removeAlphaFringe(imageData) {
  if (!imageData?.data) return imageData
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const a = src[i + 3]
      if (a === 0) {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        continue
      }
      if (a >= OPAQUE_SNAP) {
        data[i + 3] = 255
        continue
      }
      if (a >= FRINGE_CUT) continue
      const edge = (
        alphaAt(src, width, height, x - 1, y) === 0
        || alphaAt(src, width, height, x + 1, y) === 0
        || alphaAt(src, width, height, x, y - 1) === 0
        || alphaAt(src, width, height, x, y + 1) === 0
      )
      if (!edge) continue
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
  return imageData
}

export function applySharpenKernel3x3(imageData, mix = SHARP_MIX) {
  if (!imageData?.data) return imageData
  const amount = Math.max(0, Math.min(1, Number(mix) || SHARP_MIX))
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (src[i + 3] < FRINGE_CUT) continue
      for (let channel = 0; channel < 3; channel += 1) {
        let acc = 0
        let k = 0
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = Math.max(0, Math.min(width - 1, x + ox))
            const ny = Math.max(0, Math.min(height - 1, y + oy))
            acc += src[(ny * width + nx) * 4 + channel] * HQ_KERNEL[k]
            k += 1
          }
        }
        const base = src[i + channel]
        data[i + channel] = Math.max(0, Math.min(255, Math.round(base * (1 - amount) + acc * amount)))
      }
    }
  }
  return imageData
}

export function polishHqImageData(imageData) {
  removeAlphaFringe(imageData)
  applySharpenKernel3x3(imageData)
  if (!imageData?.data) return imageData
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= 10) continue
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
  }
  return imageData
}
