import { GIFEncoder, quantize, applyPalette } from 'gifenc'

export const ALPHA_CUT = 16
export const GIF_HEADER = 'GIF89a'
const NETSCAPE = [78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48]

export function delayMsFromOptions(options = {}) {
  if (Number.isFinite(Number(options.delay)) && Number(options.delay) > 0) {
    return Math.max(20, Math.round(Number(options.delay)))
  }
  const fps = Math.max(1, Number(options.fps) || 12)
  return Math.max(20, Math.round(1000 / fps))
}

function headerText(bytes, length) {
  let out = ''
  const n = Math.min(length, bytes.length)
  for (let i = 0; i < n; i += 1) out += String.fromCharCode(bytes[i])
  return out
}

export function hasNetscapeLoop(uint8) {
  if (!uint8?.length) return false
  const limit = uint8.length - NETSCAPE.length
  for (let i = 0; i <= limit; i += 1) {
    let match = true
    for (let j = 0; j < NETSCAPE.length; j += 1) {
      if (uint8[i + j] !== NETSCAPE[j]) {
        match = false
        break
      }
    }
    if (match) return true
  }
  return false
}

export function assertValidGif(uint8) {
  if (!uint8?.byteLength) throw new Error('GIF 인코더가 0바이트 파일을 반환했습니다.')
  if (headerText(uint8, 6) !== GIF_HEADER) {
    throw new Error('유효한 GIF89a Blob이 아닙니다.')
  }
  if (!hasNetscapeLoop(uint8)) {
    throw new Error('무한 루프(NETSCAPE2.0, repeat: 0) 헤더가 없습니다.')
  }
}

export function isGifTransparentPixel(r, g, b, a, cut = ALPHA_CUT) {
  if (a === 0) return true
  if (a < cut) return true
  if (a < 180) {
    const luma = r * 0.299 + g * 0.587 + b * 0.114
    if (luma > 242 || luma < 12) return true
  }
  return false
}

export function maskRgbaTransparency(rgba, cut = ALPHA_CUT) {
  const copy = new Uint8ClampedArray(rgba)
  for (let i = 0; i < copy.length; i += 4) {
    if (isGifTransparentPixel(copy[i], copy[i + 1], copy[i + 2], copy[i + 3], cut)) {
      copy[i] = 0
      copy[i + 1] = 0
      copy[i + 2] = 0
      copy[i + 3] = 0
    } else {
      copy[i + 3] = 255
    }
  }
  return copy
}

function encodeTransparentFrame(rgba, cut = ALPHA_CUT) {
  const masked = maskRgbaTransparency(rgba, cut)
  const colors = (quantize(masked, 255, { format: 'rgb565' }) || []).map((color) => color.slice(0, 3))
  if (!colors.length) colors.push([0, 0, 0])
  const raw = applyPalette(masked, colors, 'rgb565')
  const index = new Uint8Array(raw.length)
  for (let p = 0, i = 0; i < raw.length; i += 1, p += 4) {
    index[i] = masked[p + 3] === 0 ? 0x00 : (raw[i] + 1) & 255
  }
  const table = [[0, 0, 0], ...colors].slice(0, 256)
  return { index, palette: table, transparentIndex: 0x00 }
}

export function encodeRgbaFrames(frames, options = {}) {
  const list = Array.isArray(frames) ? frames.filter(Boolean) : []
  if (!list.length) throw new Error('인코딩할 프레임이 없습니다.')
  const width = Math.max(1, Math.round(Number(options.width) || list[0].width || 1))
  const height = Math.max(1, Math.round(Number(options.height) || list[0].height || 1))
  const delay = delayMsFromOptions(options)
  const transparent = options.transparent !== false
  const alphaCut = Math.min(20, Math.max(10, Number(options.alphaThreshold) || ALPHA_CUT))
  const gif = GIFEncoder()

  for (let i = 0; i < list.length; i += 1) {
    if (options.signal?.aborted) throw new Error('내보내기를 취소했습니다.')
    const pixels = list[i]
    if (pixels.width !== width || pixels.height !== height) {
      throw new Error('모든 GIF 프레임 크기가 같아야 합니다.')
    }
    const mapped = transparent
      ? encodeTransparentFrame(pixels.data, alphaCut)
      : (() => {
        const palette = quantize(pixels.data, 256, { format: 'rgb565' })
        return {
          index: applyPalette(pixels.data, palette, 'rgb565'),
          palette,
          transparentIndex: 0,
        }
      })()
    gif.writeFrame(mapped.index, width, height, {
      palette: mapped.palette,
      delay,
      repeat: i === 0 ? 0 : -1,
      dispose: 2,
      transparent,
      transparentIndex: mapped.transparentIndex,
    })
    options.onProgress?.(Math.round(((i + 1) / list.length) * 100), i + 1, list.length)
  }

  gif.finish()
  const bytes = gif.bytes()
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  assertValidGif(uint8)
  return uint8
}

export async function encodeRgbaFramesAsync(frames, options = {}) {
  const list = Array.isArray(frames) ? frames.filter(Boolean) : []
  if (!list.length) throw new Error('인코딩할 프레임이 없습니다.')
  const width = Math.max(1, Math.round(Number(options.width) || list[0].width || 1))
  const height = Math.max(1, Math.round(Number(options.height) || list[0].height || 1))
  const delay = delayMsFromOptions(options)
  const transparent = options.transparent !== false
  const alphaCut = Math.min(20, Math.max(10, Number(options.alphaThreshold) || ALPHA_CUT))
  const gif = GIFEncoder()
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

  for (let i = 0; i < list.length; i += 1) {
    if (options.signal?.aborted) throw new Error('내보내기를 취소했습니다.')
    const pixels = list[i]
    if (pixels.width !== width || pixels.height !== height) {
      throw new Error('모든 GIF 프레임 크기가 같아야 합니다.')
    }
    const mapped = transparent
      ? encodeTransparentFrame(pixels.data, alphaCut)
      : (() => {
        const palette = quantize(pixels.data, 256, { format: 'rgb565' })
        return {
          index: applyPalette(pixels.data, palette, 'rgb565'),
          palette,
          transparentIndex: 0,
        }
      })()
    gif.writeFrame(mapped.index, width, height, {
      palette: mapped.palette,
      delay,
      repeat: i === 0 ? 0 : -1,
      dispose: 2,
      transparent,
      transparentIndex: mapped.transparentIndex,
    })
    options.onProgress?.(Math.round(((i + 1) / list.length) * 100), i + 1, list.length)
    await tick()
  }

  gif.finish()
  const out = gif.bytes()
  const encoded = out instanceof Uint8Array ? out : new Uint8Array(out)
  assertValidGif(encoded)
  return encoded
}

export function wrapGifBytes(uint8, meta = {}) {
  const blob = new Blob([uint8], { type: 'image/gif' })
  if (!blob.size) throw new Error('GIF Blob 크기가 0입니다.')
  const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(blob)
    : ''
  return {
    blob,
    url,
    uint8,
    byteLength: uint8.byteLength,
    width: meta.width,
    height: meta.height,
    frames: meta.frames,
  }
}
