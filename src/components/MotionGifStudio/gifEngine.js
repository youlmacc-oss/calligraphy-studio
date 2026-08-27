import { GIFEncoder, quantize, applyPalette } from 'gifenc'

const MIN_BYTES = 5 * 1024
const ALPHA_CUT = 16

function readFramePixels(frame, width, height) {
  if (frame?.data && frame.width && frame.height) {
    return { data: frame.data, width: frame.width, height: frame.height }
  }
  const canvas = frame
  const w = Math.max(1, Math.round(Number(width) || canvas.width || 1))
  const h = Math.max(1, Math.round(Number(height) || canvas.height || 1))
  const ctx = canvas.getContext?.('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('GIF 프레임 캔버스를 읽을 수 없습니다.')
  const image = ctx.getImageData(0, 0, w, h)
  return { data: image.data, width: w, height: h }
}

function withTransparentIndex(rgba, palette) {
  const table = palette.map((color) => color.slice(0, 3))
  if (!table.length) table.push([0, 0, 0])
  const transparentIndex = Math.min(255, table.length)
  const index = applyPalette(rgba, table, 'rgb565')
  for (let p = 0, i = 0; i < index.length; i += 1, p += 4) {
    if (rgba[p + 3] < ALPHA_CUT) index[i] = transparentIndex
  }
  if (table.length < 256) table.push([0, 0, 0])
  return { index, palette: table, transparentIndex }
}

function delayMsFromOptions(options) {
  if (Number.isFinite(Number(options.delay)) && Number(options.delay) > 0) {
    return Math.max(20, Math.round(Number(options.delay)))
  }
  const fps = Math.max(1, Number(options.fps) || 12)
  return Math.max(20, Math.round(1000 / fps))
}

export async function renderFramesToGif(frames, options = {}) {
  const list = Array.isArray(frames) ? frames.filter(Boolean) : []
  if (!list.length) throw new Error('인코딩할 프레임이 없습니다.')
  const first = readFramePixels(list[0], options.width, options.height)
  const width = Math.max(1, Math.round(Number(options.width) || first.width))
  const height = Math.max(1, Math.round(Number(options.height) || first.height))
  const delay = delayMsFromOptions(options)
  const transparent = options.transparent !== false
  const gif = GIFEncoder()

  for (let i = 0; i < list.length; i += 1) {
    const pixels = readFramePixels(list[i], width, height)
    if (pixels.width !== width || pixels.height !== height) {
      throw new Error('모든 GIF 프레임 크기가 같아야 합니다.')
    }
    const maxColors = transparent ? 255 : 256
    const palette = quantize(pixels.data, maxColors, { format: 'rgb565' })
    const mapped = transparent
      ? withTransparentIndex(pixels.data, palette)
      : {
        index: applyPalette(pixels.data, palette, 'rgb565'),
        palette,
        transparentIndex: 0,
      }
    gif.writeFrame(mapped.index, width, height, {
      palette: mapped.palette,
      delay,
      repeat: i === 0 ? 0 : -1,
      transparent,
      transparentIndex: mapped.transparentIndex,
    })
    options.onProgress?.(Math.round(((i + 1) / list.length) * 100), i + 1, list.length)
  }

  gif.finish()
  const bytes = gif.bytes()
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (!uint8.byteLength) throw new Error('GIF 인코더가 0바이트 파일을 반환했습니다.')
  if (uint8.byteLength < MIN_BYTES) {
    throw new Error(`GIF 파일이 너무 작습니다 (${uint8.byteLength}B). 5KB 이상이어야 합니다.`)
  }
  const blob = new Blob([uint8], { type: 'image/gif' })
  const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(blob)
    : ''
  return { blob, url, uint8, byteLength: uint8.byteLength, width, height, frames: list.length }
}

export function revokeGifUrl(url) {
  if (url) URL.revokeObjectURL(url)
}
