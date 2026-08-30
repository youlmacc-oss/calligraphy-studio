import { GIFEncoder, quantize } from 'gifenc'
import { ensureEmoticonFontsReady } from '../../lib/emoticonFonts.js'
import {
  buildCaptionPose,
  normalizeTextMotionEffect,
} from '../../components/MotionStudio/dynamicTextMotion.js'
import { paintDynamicTextMotion } from '../../components/MotionStudio/DynamicTextMotionRenderer.js'
import { clampSequenceFps, stillLoopFrameCount } from '../../components/MotionStudio/motionSequencer.js'
import { applyDefringeToContext } from '../imageProcessor.js'
import { normalizeParticleLayers, paintParticleOverlay } from '../../components/MotionStudio/particleOverlayEngine.js'
import { paintMotionFrame } from '../../components/MotionGifStudio/motionPresets.js'
import { floydSteinbergIndex } from './floydSteinberg.js'
import {
  isAnimatedWebp,
  makeUncompressedAlphChunk,
  muxAnimatedWebp,
  stillWebpFramePayload,
} from './webpAnimMux.js'

export const ENCODER_SIZE = 360
export const ENCODER_ALPHA_CUT = 16
const GIF_HEADER = 'GIF89a'

export function yieldToMain() {
  return new Promise((resolve) => {
    const kick = () => setTimeout(resolve, 0)
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(kick)
      return
    }
    kick()
  })
}

export function frameProgressCopy(kind, current, total) {
  const label = kind === 'webp' ? 'WebP' : 'GIF'
  const now = Math.max(0, Math.round(Number(current) || 0))
  const max = Math.max(1, Math.round(Number(total) || 1))
  return `🎬 ${label} 생성 중... (${now} / ${max} 프레임 처리 완료)`
}

function delayMsFromFps(fps) {
  return Math.max(20, Math.round(1000 / clampSequenceFps(fps)))
}

function loadFrameImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('empty'))
      return
    }
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('frame'))
    image.src = url
  })
}

function paintCharacter(ctx, image, size) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, size, size)
  if (!image) return
  const sw = image.naturalWidth || image.width || 1
  const sh = image.naturalHeight || image.height || 1
  const scale = Math.min(size / sw, size / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh)
  applyDefringeToContext(ctx, size, size)
}

function maskOpaqueRgb(rgba, alphaCut = ENCODER_ALPHA_CUT) {
  const copy = new Uint8ClampedArray(rgba)
  for (let i = 0; i < copy.length; i += 4) {
    if (copy[i + 3] < alphaCut) {
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

function headerText(bytes, length) {
  let out = ''
  const n = Math.min(length, bytes.length)
  for (let i = 0; i < n; i += 1) out += String.fromCharCode(bytes[i])
  return out
}

export function assertGifBytes(uint8) {
  if (!uint8?.byteLength) throw new Error('GIF 인코더가 빈 파일을 반환했습니다.')
  if (headerText(uint8, 6) !== GIF_HEADER) throw new Error('유효한 GIF89a가 아닙니다.')
}

function report(onProgress, payload) {
  onProgress?.(payload)
}

function paintTextAndParticles(ctx, {
  size,
  effect,
  index,
  total,
  time01,
  particles,
  captionOn,
  captionText,
  customText,
  captionSize,
  captionStroke,
  captionFont,
  captionTail,
  posX = 0,
  posY = 0,
}) {
  const pose = buildCaptionPose({
    enabled: captionOn,
    text: captionText,
    customText: customText ?? captionText,
    effect,
    index,
    total: Math.max(1, total),
    sizeId: captionSize,
    strokeId: captionStroke,
    fontId: captionFont,
    edge: size,
    posX,
    posY,
  })
  if (pose) {
    pose.tail = captionTail
    paintDynamicTextMotion(ctx, { size, pose, showHandles: false })
  }
  const layers = normalizeParticleLayers(particles)
  if (layers.length) {
    paintParticleOverlay(ctx, { size, time01, layers })
  }
}

export async function composeStillMotionCanvases(frame, options = {}) {
  const size = ENCODER_SIZE
  const effect = normalizeTextMotionEffect(options.effect)
  await ensureEmoticonFontsReady(options.captionFont || options.fontId)
  let image = null
  try {
    image = await loadFrameImage(frame?.url)
  } catch {
    image = null
  }
  const total = stillLoopFrameCount(options.fps, options.loopSeconds, 1)
  const canvases = []
  for (let i = 0; i < total; i += 1) {
    const time01 = i / total
    report(options.onProgress, {
      stage: 'render',
      current: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 48),
      message: frameProgressCopy(options.format, i + 1, total),
    })
    await yieldToMain()
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!ctx) throw new Error('Canvas 2D를 만들 수 없습니다.')
    paintMotionFrame(ctx, image, {
      width: size,
      height: size,
      time01,
      preset: options.preset ?? 'none',
      intensity: options.intensity ?? 70,
      isolate: options.isolate !== false,
    })
    paintTextAndParticles(ctx, {
      size,
      effect,
      item: frame,
      index: i,
      total,
      time01,
      particles: options.particles,
      captionOn: options.captionOn,
      captionText: options.captionText ?? options.customText,
      customText: options.customText ?? options.captionText,
      captionSize: options.captionSize,
      captionStroke: options.captionStroke,
      captionFont: options.captionFont || options.fontId,
      captionTail: options.captionTail,
      posX: options.posX,
      posY: options.posY,
    })
    canvases.push(canvas)
    await yieldToMain()
  }
  return canvases
}

export async function composeSequenceCanvases(frames, options = {}) {
  const list = Array.isArray(frames) ? frames.filter((item) => item?.url) : []
  if (!list.length) throw new Error('타임라인에 프레임이 없습니다.')
  if (options.stillLoop || list.length === 1) {
    return composeStillMotionCanvases(list[0], options)
  }
  const size = ENCODER_SIZE
  const effect = normalizeTextMotionEffect(options.effect)
  await ensureEmoticonFontsReady(options.captionFont || options.fontId)
  const canvases = []
  for (let i = 0; i < list.length; i += 1) {
    report(options.onProgress, {
      stage: 'render',
      current: i + 1,
      total: list.length,
      percent: Math.round(((i + 1) / list.length) * 48),
      message: frameProgressCopy(options.format, i + 1, list.length),
    })
    await yieldToMain()
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
    if (!ctx) throw new Error('Canvas 2D를 만들 수 없습니다.')
    let image = null
    try {
      image = await loadFrameImage(list[i].url)
    } catch {
      image = null
    }
    paintCharacter(ctx, image, size)
    paintTextAndParticles(ctx, {
      size,
      effect,
      item: list[i],
      index: i,
      total: list.length,
      time01: list.length ? i / list.length : 0,
      particles: options.particles,
      captionOn: options.captionOn,
      captionText: options.captionText ?? options.customText,
      customText: options.customText ?? options.captionText,
      captionSize: options.captionSize,
      captionStroke: options.captionStroke,
      captionFont: options.captionFont || options.fontId,
      captionTail: options.captionTail,
      posX: options.posX,
      posY: options.posY,
    })
    canvases.push(canvas)
    await yieldToMain()
  }
  return canvases
}

export async function encodeGifFromCanvases(canvases, options = {}) {
  const list = Array.isArray(canvases) ? canvases.filter(Boolean) : []
  if (!list.length) throw new Error('인코딩할 프레임이 없습니다.')
  const width = Math.max(1, Math.round(Number(list[0].width) || ENCODER_SIZE))
  const height = Math.max(1, Math.round(Number(list[0].height) || ENCODER_SIZE))
  if (width !== ENCODER_SIZE || height !== ENCODER_SIZE) {
    throw new Error('출력 해상도는 360×360만 허용합니다.')
  }
  const delay = delayMsFromFps(options.fps)
  const gif = GIFEncoder()
  for (let i = 0; i < list.length; i += 1) {
    await yieldToMain()
    const canvas = list[i]
    if (canvas.width !== width || canvas.height !== height) {
      throw new Error('모든 프레임이 360×360이어야 합니다.')
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const imageData = ctx.getImageData(0, 0, width, height)
    const masked = maskOpaqueRgb(imageData.data)
    const colors = (quantize(masked, 255, { format: 'rgb565' }) || []).map((color) => color.slice(0, 3))
    if (!colors.length) colors.push([0, 0, 0])
    const raw = floydSteinbergIndex(
      { width, height, data: imageData.data },
      colors,
      255,
      ENCODER_ALPHA_CUT,
    )
    const index = new Uint8Array(raw.length)
    for (let p = 0; p < raw.length; p += 1) {
      index[p] = raw[p] === 255 ? 0x00 : raw[p] + 1
    }
    const palette = [[0, 0, 0], ...colors].slice(0, 256)
    gif.writeFrame(index, width, height, {
      palette,
      delay,
      repeat: i === 0 ? 0 : -1,
      dispose: 2,
      transparent: true,
      transparentIndex: 0x00,
    })
    const packed = 48 + Math.round(((i + 1) / list.length) * 52)
    report(options.onProgress, {
      stage: 'gif',
      current: i + 1,
      total: list.length,
      percent: packed,
      message: frameProgressCopy('gif', i + 1, list.length),
    })
    await yieldToMain()
  }
  gif.finish()
  const bytes = gif.bytes()
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  assertGifBytes(uint8)
  return uint8
}

function canvasToWebpBytes(canvas, quality = 0.92) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('이 브라우저는 WebP 인코더를 지원하지 않습니다.'))
      return
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('WebP 프레임 인코딩에 실패했습니다.'))
        return
      }
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer))).catch(reject)
    }, 'image/webp', quality)
  })
}

export async function encodeWebpFromCanvases(canvases, options = {}) {
  const list = Array.isArray(canvases) ? canvases.filter(Boolean) : []
  if (!list.length) throw new Error('인코딩할 프레임이 없습니다.')
  const width = ENCODER_SIZE
  const height = ENCODER_SIZE
  const delay = delayMsFromFps(options.fps)
  const payloads = []
  for (let i = 0; i < list.length; i += 1) {
    await yieldToMain()
    const canvas = list[i]
    if (canvas.width !== width || canvas.height !== height) {
      throw new Error('모든 프레임이 360×360이어야 합니다.')
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const imageData = ctx.getImageData(0, 0, width, height)
    const still = await canvasToWebpBytes(canvas)
    let payload = stillWebpFramePayload(still)
    const hasAlph = parseHasAlph(still)
    if (!hasAlph) {
      payload = concatPayload(makeUncompressedAlphChunk(imageData), payload)
    }
    if (!payload.length) throw new Error('WebP 프레임 페이로드가 비었습니다.')
    payloads.push(payload)
    const packed = 48 + Math.round(((i + 1) / list.length) * 52)
    report(options.onProgress, {
      stage: 'webp',
      current: i + 1,
      total: list.length,
      percent: packed,
      message: frameProgressCopy('webp', i + 1, list.length),
    })
    await yieldToMain()
  }
  const bytes = muxAnimatedWebp(payloads, { width, height, delay })
  if (!isAnimatedWebp(bytes)) throw new Error('Animated WebP 컨테이너가 아닙니다.')
  return bytes
}

function parseHasAlph(bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  for (let i = 12; i + 4 <= src.length; i += 1) {
    if (src[i] === 65 && src[i + 1] === 76 && src[i + 2] === 80 && src[i + 3] === 72) return true
    if (src[i] === 86 && src[i + 1] === 80 && src[i + 2] === 56 && src[i + 3] === 76) return true
  }
  return false
}

function concatPayload(a, b) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

export async function encodeMotionExport(frames, options = {}) {
  const format = String(options.format || 'gif').toLowerCase()
  const canvases = await composeSequenceCanvases(frames, options)
  if (format === 'webp') {
    const uint8 = await encodeWebpFromCanvases(canvases, options)
    const blob = new Blob([uint8], { type: 'image/webp' })
    return { blob, uint8, mime: 'image/webp', ext: 'webp', width: ENCODER_SIZE, height: ENCODER_SIZE, frames: canvases.length }
  }
  const uint8 = await encodeGifFromCanvases(canvases, options)
  const blob = new Blob([uint8], { type: 'image/gif' })
  return { blob, uint8, mime: 'image/gif', ext: 'gif', width: ENCODER_SIZE, height: ENCODER_SIZE, frames: canvases.length }
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return url
}

export async function openCheckerboardPreview(blob) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('미리보기 변환 실패'))
    reader.readAsDataURL(blob)
  })
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>미리보기</title>
<style>
html,body{margin:0;min-height:100%;display:grid;place-items:center;background:#12121a}
.checkerboard-bg{width:${ENCODER_SIZE}px;height:${ENCODER_SIZE}px;background:repeating-conic-gradient(#3a3a48 0% 25%,#1a1a22 0% 50%) 0 0/20px 20px !important}
img{display:block;width:${ENCODER_SIZE}px;height:${ENCODER_SIZE}px;object-fit:contain}
</style></head><body><div class="checkerboard-bg"><img alt="preview" src="${dataUrl}"></div></body></html>`
  const page = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  window.open(page, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(page), 8000)
}
