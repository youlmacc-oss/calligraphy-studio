import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import { clampLoopSeconds, paintMotionFrame } from './motionPresets.js'

const ALPHA_CUT = 16
const GIF_HEADER = 'GIF89a'

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

function headerText(bytes, length) {
  let out = ''
  const n = Math.min(length, bytes.length)
  for (let i = 0; i < n; i += 1) out += String.fromCharCode(bytes[i])
  return out
}

function assertValidGif(uint8) {
  if (!uint8?.byteLength) throw new Error('GIF 인코더가 0바이트 파일을 반환했습니다.')
  if (headerText(uint8, 6) !== GIF_HEADER) {
    throw new Error('유효한 GIF89a Blob이 아닙니다.')
  }
}

export function countGifFrames(fps, loopSeconds) {
  const rate = fps === 24 ? 24 : 12
  const seconds = clampLoopSeconds(loopSeconds)
  return Math.max(2, Math.round(rate * seconds))
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
    if (options.signal?.aborted) throw new Error('내보내기를 취소했습니다.')
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
  assertValidGif(uint8)
  const blob = new Blob([uint8], { type: 'image/gif' })
  if (!blob.size) throw new Error('GIF Blob 크기가 0입니다.')
  const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(blob)
    : ''
  return { blob, url, uint8, byteLength: uint8.byteLength, width, height, frames: list.length }
}

function releaseCanvas(canvas) {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

function yieldFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export async function encodeMotionGif({
  source,
  width,
  height,
  fps = 12,
  loopSeconds = 2,
  preset = 'jellyBounce',
  intensity = 70,
  onProgress,
  signal,
} = {}) {
  if (!source) throw new Error('인코딩할 소스가 없습니다.')
  const w = Math.max(1, Math.round(width || source.width || 360))
  const h = Math.max(1, Math.round(height || source.height || 360))
  const frameCount = countGifFrames(fps, loopSeconds)
  const frames = []
  onProgress?.(0, 0, frameCount)
  try {
    for (let i = 0; i < frameCount; i += 1) {
      if (signal?.aborted) throw new Error('내보내기를 취소했습니다.')
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      paintMotionFrame(canvas.getContext('2d', { willReadFrequently: true }), source, {
        width: w,
        height: h,
        time01: i / frameCount,
        preset,
        intensity,
      })
      frames.push(canvas)
      onProgress?.(Math.round(((i + 1) / frameCount) * 70), i + 1, frameCount)
      if (i % 2 === 0) await yieldFrame()
    }
    const result = await renderFramesToGif(frames, {
      width: w,
      height: h,
      fps,
      transparent: true,
      signal,
      onProgress: (pct) => onProgress?.(70 + Math.round(pct * 0.3), frameCount, frameCount),
    })
    onProgress?.(100, frameCount, frameCount)
    return result
  } finally {
    frames.forEach(releaseCanvas)
  }
}

export function revokeGifUrl(url) {
  if (url) URL.revokeObjectURL(url)
}
