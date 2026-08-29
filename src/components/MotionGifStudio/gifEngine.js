import { clampLoopSeconds, paintMotionFrame } from './motionPresets.js'
import { delayMsFromOptions, encodeRgbaFrames, wrapGifBytes, maskRgbaTransparency, ALPHA_CUT } from './gifEncodeCore.js'
import { primeHqContext } from '../../utils/hqRender.js'
import { applyBilateralEdgePreserve } from '../../utils/imageProcessor.js'

function yieldFrame() {
  return new Promise((resolve) => {
    const kick = () => setTimeout(resolve, 0)
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(kick)
      return
    }
    kick()
  })
}

export function countGifFrames(fps, loopSeconds) {
  const rate = Math.max(1, Math.round(Number(fps) || 12))
  const seconds = clampLoopSeconds(loopSeconds)
  return Math.max(2, Math.round(rate * seconds))
}

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

export async function renderFramesToGif(frames, options = {}) {
  const list = Array.isArray(frames) ? frames.filter(Boolean) : []
  const rgba = list.map((frame) => readFramePixels(frame, options.width, options.height))
  const uint8 = encodeRgbaFrames(rgba, options)
  return wrapGifBytes(uint8, {
    width: options.width || rgba[0]?.width,
    height: options.height || rgba[0]?.height,
    frames: rgba.length,
  })
}

function encodeWithWorker(buffers, options) {
  if (typeof Worker === 'undefined') return null
  try {
    const worker = new Worker(new URL('./gifEncodeWorker.js', import.meta.url), { type: 'module' })
    return new Promise((resolve, reject) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const timer = setInterval(() => {
        if (!options.signal?.aborted) return
        clearInterval(timer)
        worker.terminate()
        reject(new Error('내보내기를 취소했습니다.'))
      }, 80)
      worker.onmessage = (event) => {
        if (event.data?.id !== id) return
        if (event.data.type === 'progress') options.onProgress?.(event.data.pct, event.data.index, event.data.total)
        if (event.data.type === 'done') {
          clearInterval(timer)
          worker.terminate()
          resolve(new Uint8Array(event.data.buffer))
        }
        if (event.data.type === 'error') {
          clearInterval(timer)
          worker.terminate()
          reject(new Error(event.data.message))
        }
      }
      worker.onerror = (error) => {
        clearInterval(timer)
        worker.terminate()
        reject(new Error(error?.message || '워커 인코딩에 실패했습니다.'))
      }
      worker.postMessage({
        id,
        width: options.width,
        height: options.height,
        delay: delayMsFromOptions(options),
        transparent: options.transparent !== false,
        buffers,
      }, buffers)
    })
  } catch {
    return null
  }
}

async function encodeRgbaNonBlocking(frames, options) {
  const workerJob = encodeWithWorker(frames.map((frame) => frame.data.buffer), options)
  if (workerJob) return workerJob
  let lastYield = 0
  return encodeRgbaFrames(frames, {
    ...options,
    onProgress: async (pct, index, total) => {
      options.onProgress?.(pct, index, total)
      if (index - lastYield >= 1) {
        lastYield = index
        await yieldFrame()
      }
    },
  })
}

export async function encodeMotionGif({
  source,
  width,
  height,
  fps = 12,
  loopSeconds = 2,
  preset = 'none',
  intensity = 70,
  onProgress,
  signal,
} = {}) {
  if (!source) throw new Error('인코딩할 소스가 없습니다.')
  const w = Math.max(1, Math.round(width || source.width || 360))
  const h = Math.max(1, Math.round(height || source.height || 360))
  const frameCount = countGifFrames(fps, loopSeconds)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  primeHqContext(ctx)
  const frames = []
  onProgress?.(0, 0, frameCount, 'render')
  try {
    for (let i = 0; i < frameCount; i += 1) {
      if (signal?.aborted) throw new Error('내보내기를 취소했습니다.')
      paintMotionFrame(ctx, source, {
        width: w,
        height: h,
        time01: i / frameCount,
        preset,
        intensity,
      })
      const pixels = ctx.getImageData(0, 0, w, h)
      applyBilateralEdgePreserve(pixels, { mix: 0.52 })
      frames.push({ data: maskRgbaTransparency(pixels.data, ALPHA_CUT), width: w, height: h })
      onProgress?.(Math.round(((i + 1) / frameCount) * 45), i + 1, frameCount, 'render')
      await yieldFrame()
    }
    const uint8 = await encodeRgbaNonBlocking(frames, {
      width: w,
      height: h,
      fps,
      transparent: true,
      alphaThreshold: ALPHA_CUT,
      signal,
      onProgress: (pct, index, total) => {
        onProgress?.(45 + Math.round(pct * 0.55), index, total, 'encode')
      },
    })
    onProgress?.(100, frameCount, frameCount, 'done')
    return wrapGifBytes(uint8, { width: w, height: h, frames: frameCount })
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export function revokeGifUrl(url) {
  if (url) URL.revokeObjectURL(url)
}

export function formatEta(startedAt, pct) {
  if (!startedAt || pct < 3) return ''
  const elapsed = performance.now() - startedAt
  const remain = elapsed * ((100 - pct) / pct)
  const seconds = Math.max(1, Math.ceil(remain / 1000))
  return `남은 약 ${seconds}초`
}
