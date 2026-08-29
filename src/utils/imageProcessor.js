const SPATIAL = [1, 0.6065, 0.6065, 0.3679]
const EDGE_LUMA = 36

let premulScratch = null

function scratchPremul(width, height) {
  if (!premulScratch) premulScratch = document.createElement('canvas')
  if (premulScratch.width !== width || premulScratch.height !== height) {
    premulScratch.width = width
    premulScratch.height = height
  }
  return premulScratch
}

function wrapImageData(data, width, height) {
  const bytes = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data)
  if (typeof ImageData === 'function') {
    try {
      return new ImageData(bytes, width, height)
    } catch {
      /* Node or older engines */
    }
  }
  return { data: bytes, width, height }
}

function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value
}

export function premultiplyRgbByAlpha(imageData) {
  if (!imageData?.data) return imageData
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      continue
    }
    if (a === 255) continue
    data[i] = (data[i] * a + 127) / 255 | 0
    data[i + 1] = (data[i + 1] * a + 127) / 255 | 0
    data[i + 2] = (data[i + 2] * a + 127) / 255 | 0
  }
  return imageData
}

export function unmultiplyRgbByAlpha(imageData) {
  if (!imageData?.data) return imageData
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      continue
    }
    if (a === 255) continue
    data[i] = clampByte((data[i] * 255 + (a >> 1)) / a | 0)
    data[i + 1] = clampByte((data[i + 1] * 255 + (a >> 1)) / a | 0)
    data[i + 2] = clampByte((data[i + 2] * 255 + (a >> 1)) / a | 0)
  }
  return imageData
}

function samplePremul(src, width, height, x, y) {
  const ix = x < 0 ? 0 : x > width - 1 ? width - 1 : x
  const iy = y < 0 ? 0 : y > height - 1 ? height - 1 : y
  const i = (iy * width + ix) * 4
  const a = src[i + 3]
  return [src[i] * a, src[i + 1] * a, src[i + 2] * a, a]
}

export function resamplePremultiplied(imageData, destW, destH) {
  if (!imageData?.data) return imageData
  const width = Math.max(1, Math.round(destW || imageData.width))
  const height = Math.max(1, Math.round(destH || imageData.height))
  const sw = imageData.width
  const sh = imageData.height
  const src = imageData.data
  if (width === sw && height === sh) {
    return wrapImageData(new Uint8ClampedArray(src), sw, sh)
  }
  const dest = new Uint8ClampedArray(width * height * 4)
  const scaleX = sw / width
  const scaleY = sh / height
  for (let y = 0; y < height; y += 1) {
    const sy = (y + 0.5) * scaleY - 0.5
    const y0 = Math.floor(sy)
    const fy = sy - y0
    const y1 = y0 + 1
    const wy0 = 1 - fy
    const wy1 = fy
    for (let x = 0; x < width; x += 1) {
      const sx = (x + 0.5) * scaleX - 0.5
      const x0 = Math.floor(sx)
      const fx = sx - x0
      const x1 = x0 + 1
      const wx0 = 1 - fx
      const wx1 = fx
      const p00 = samplePremul(src, sw, sh, x0, y0)
      const p10 = samplePremul(src, sw, sh, x1, y0)
      const p01 = samplePremul(src, sw, sh, x0, y1)
      const p11 = samplePremul(src, sw, sh, x1, y1)
      const r = (p00[0] * wx0 + p10[0] * wx1) * wy0 + (p01[0] * wx0 + p11[0] * wx1) * wy1
      const g = (p00[1] * wx0 + p10[1] * wx1) * wy0 + (p01[1] * wx0 + p11[1] * wx1) * wy1
      const b = (p00[2] * wx0 + p10[2] * wx1) * wy0 + (p01[2] * wx0 + p11[2] * wx1) * wy1
      const a = (p00[3] * wx0 + p10[3] * wx1) * wy0 + (p01[3] * wx0 + p11[3] * wx1) * wy1
      const i = (y * width + x) * 4
      if (a < 0.5) {
        dest[i] = 0
        dest[i + 1] = 0
        dest[i + 2] = 0
        dest[i + 3] = 0
        continue
      }
      dest[i] = clampByte(r / a)
      dest[i + 1] = clampByte(g / a)
      dest[i + 2] = clampByte(b / a)
      dest[i + 3] = clampByte(a)
    }
  }
  return wrapImageData(dest, width, height)
}

function lumaAt(data, width, height, x, y) {
  const ix = x < 0 ? 0 : x > width - 1 ? width - 1 : x
  const iy = y < 0 ? 0 : y > height - 1 ? height - 1 : y
  const i = (iy * width + ix) * 4
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
}

export function applyBilateralEdgePreserve(imageData, { mix = 0.52 } = {}) {
  if (!imageData?.data) return imageData
  const amount = Math.max(0, Math.min(1, Number(mix) || 0))
  if (amount <= 0) return imageData
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)
  const rangeScale = 1 / (2 * 22 * 22)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const a = src[i + 3]
      if (a < 16) continue
      const center = lumaAt(src, width, height, x, y)
      let edge = 0
      let wr = 0
      let wg = 0
      let wb = 0
      let wsum = 0
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox
          const ny = y + oy
          const luma = lumaAt(src, width, height, nx, ny)
          const dl = luma - center
          if (Math.abs(dl) > EDGE_LUMA) edge += 1
          const spatial = SPATIAL[Math.abs(ox) + Math.abs(oy)]
          const range = Math.exp(-(dl * dl) * rangeScale)
          const w = spatial * range
          const ni = ((ny < 0 ? 0 : ny > height - 1 ? height - 1 : ny) * width
            + (nx < 0 ? 0 : nx > width - 1 ? width - 1 : nx)) * 4
          wr += src[ni] * w
          wg += src[ni + 1] * w
          wb += src[ni + 2] * w
          wsum += w
        }
      }
      if (edge >= 2 || wsum <= 0) continue
      const inv = 1 / wsum
      data[i] = clampByte(src[i] * (1 - amount) + (wr * inv) * amount)
      data[i + 1] = clampByte(src[i + 1] * (1 - amount) + (wg * inv) * amount)
      data[i + 2] = clampByte(src[i + 2] * (1 - amount) + (wb * inv) * amount)
    }
  }
  return imageData
}

function primeCtx(ctx) {
  if (!ctx) return ctx
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

export function blitPremultiplied(target, source, destW, destH, {
  live: _live = false,
  edgePreserve: _edgePreserve = true,
} = {}) {
  if (!target || !source || typeof document === 'undefined') return false
  const width = Math.max(1, Math.round(destW || source.width || 1))
  const height = Math.max(1, Math.round(destH || source.height || 1))
  const srcW = source.width || 1
  const srcH = source.height || 1
  try {
    const srcCtx = source.getContext?.('2d', { willReadFrequently: true })
    if (!srcCtx) return false
    const raw = srcCtx.getImageData(0, 0, srcW, srcH)
    const pixels = width * height
    const useGpu = pixels > 160 * 160
        const destCtx = target.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!destCtx) return false
    primeCtx(destCtx)
    destCtx.setTransform(1, 0, 0, 1, 0, 0)
    destCtx.clearRect(0, 0, width, height)

    let out
    if (useGpu) {
      const premul = scratchPremul(srcW, srcH)
      const pctx = premul.getContext('2d', { willReadFrequently: true })
      const copy = new ImageData(new Uint8ClampedArray(raw.data), srcW, srcH)
      premultiplyRgbByAlpha(copy)
      pctx.putImageData(copy, 0, 0)
      destCtx.drawImage(premul, 0, 0, width, height)
      out = destCtx.getImageData(0, 0, width, height)
      unmultiplyRgbByAlpha(out)
    } else {
      out = resamplePremultiplied(raw, width, height)
    }

    const packed = wrapImageData(out.data, out.width, out.height)
    destCtx.putImageData(packed, 0, 0)
    return true
  } catch {
    return false
  }
}

const DEFRINGE_ALPHA_CUT = 16
export const ALPHA_FEATHER_PX = 1.5

function lumaRgb(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function chromaRgb(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function isWhiteFringePixel(r, g, b, a) {
  if (a < 8) return false
  return lumaRgb(r, g, b) >= 198 && chromaRgb(r, g, b) < 52
}

export function featherAlphaEdge(imageData, { radius = ALPHA_FEATHER_PX, strength = 28 } = {}) {
  if (!imageData?.data) return imageData
  const { data, width, height } = imageData
  if (!width || !height) return imageData
  const feather = Math.max(1.2, Math.min(1.5, Number(radius) || ALPHA_FEATHER_PX))
  const weight = Math.max(20, Math.min(32, Number(strength) || 28))
  const origA = new Uint8Array(width * height)
  for (let p = 0; p < origA.length; p += 1) origA[p] = data[p * 4 + 3]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      const a = origA[p]
      if (a < 10) continue
      let bgCount = 0
      let minD = feather + 1
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          if (!ox && !oy) continue
          const nx = x + ox
          const ny = y + oy
          const outside = nx < 0 || ny < 0 || nx >= width || ny >= height
          const clear = outside || origA[ny * width + nx] < 10
          if (!clear) continue
          if (Math.abs(ox) <= 1 && Math.abs(oy) <= 1) bgCount += 1
          const d = Math.hypot(ox, oy)
          if (d < minD) minD = d
        }
      }
      if (bgCount === 0 && minD > feather) continue
      const i = p * 4
      const luma = lumaRgb(data[i], data[i + 1], data[i + 2])
      if (bgCount >= 7) {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 0
        continue
      }
      let smooth = 255 - bgCount * weight
      if (minD <= feather) {
        const t = Math.min(1, minD / feather)
        const gauss = 0.35 + 0.65 * t * t * (3 - 2 * t)
        smooth = Math.min(smooth, Math.round(255 * gauss))
      }
      if (luma < 64) smooth = Math.max(smooth, 188)
      data[i + 3] = Math.max(0, Math.min(a, Math.max(0, smooth)))
    }
  }
  return imageData
}

export function defringeAlphaEdge(imageData, { alphaCut = DEFRINGE_ALPHA_CUT } = {}) {
  if (!imageData?.data) return imageData
  const { data, width, height } = imageData
  if (!width || !height) return imageData
  const cut = Math.max(1, Math.round(Number(alphaCut) || DEFRINGE_ALPHA_CUT))
  const opaque = new Uint8Array(width * height)
  for (let p = 0; p < opaque.length; p += 1) {
    opaque[p] = data[p * 4 + 3] >= cut ? 1 : 0
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      if (!opaque[p]) continue
      const left = x === 0 || !opaque[p - 1]
      const right = x === width - 1 || !opaque[p + 1]
      const up = y === 0 || !opaque[p - width]
      const down = y === height - 1 || !opaque[p + width]
      if (!left && !right && !up && !down) continue
      const i = p * 4
      if (!isWhiteFringePixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        let sr = 0
        let sg = 0
        let sb = 0
        let sc = 0
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!ox && !oy) continue
            const nx = x + ox
            const ny = y + oy
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
            const np = ny * width + nx
            if (!opaque[np]) continue
            const ni = np * 4
            sr += data[ni]
            sg += data[ni + 1]
            sb += data[ni + 2]
            sc += 1
          }
        }
        if (sc) {
          data[i] = (data[i] + Math.round((sr / sc) * 2)) / 3 | 0
          data[i + 1] = (data[i + 1] + Math.round((sg / sc) * 2)) / 3 | 0
          data[i + 2] = (data[i + 2] + Math.round((sb / sc) * 2)) / 3 | 0
        }
        continue
      }
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
  return imageData
}

export function applyDefringeToContext(ctx, width, height) {
  if (!ctx?.getImageData || !ctx.putImageData) return ctx
  const w = Math.max(1, Math.round(Number(width) || ctx.canvas?.width || 1))
  const h = Math.max(1, Math.round(Number(height) || ctx.canvas?.height || w))
  const imageData = ctx.getImageData(0, 0, w, h)
  defringeAlphaEdge(imageData)
  ctx.putImageData(imageData, 0, 0)
  return ctx
}
