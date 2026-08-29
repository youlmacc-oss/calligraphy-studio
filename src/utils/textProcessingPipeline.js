import { captionForCutIndex } from '../lib/cutCaptions.js'
import { GOLDEN_BASELINE } from './diagnosticsBaseline.js'

export const TEXT_ENGINE_ORIGINAL = 'ORIGINAL'
export const TEXT_ENGINE_VECTOR_OVERLAY = 'VECTOR_OVERLAY'
export const TEXT_ENGINE_SMART_RECOLOR = 'SMART_RECOLOR'
export const TEXT_ENGINE_DEFAULT = TEXT_ENGINE_ORIGINAL

export const TEXT_ENGINE_MODES = [
  {
    id: TEXT_ENGINE_ORIGINAL,
    label: '원본 유지',
    tooltip: '비트맵을 바꾸지 않습니다. AI 원본 그래픽을 그대로 둡니다',
  },
  {
    id: TEXT_ENGINE_VECTOR_OVERLAY,
    label: '벡터 오버레이',
    tooltip: '하단 존에 3중 외곽선·흰 채움·ㅇ 내부 보존으로 다시 그립니다',
  },
  {
    id: TEXT_ENGINE_SMART_RECOLOR,
    label: '스마트 리컬러',
    tooltip: '하단 ROI 글자만 색을 바꿉니다. 캐릭터·손·케이크는 읽기 전용입니다',
  },
]

const LOCK_RATIO = GOLDEN_BASELINE.splitter.characterLockRatio
const WRITE_FLOOR_RATIO = GOLDEN_BASELINE.splitter.characterWriteFloorRatio
const STICKER_SIZE = GOLDEN_BASELINE.splitter.targetCanvas.height

export function normalizeTextEngineMode(mode) {
  const key = String(mode || '').trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (key === TEXT_ENGINE_VECTOR_OVERLAY || key === 'VECTOR' || key === 'OVERLAY') {
    return TEXT_ENGINE_VECTOR_OVERLAY
  }
  if (key === TEXT_ENGINE_SMART_RECOLOR || key === 'SMART' || key === 'RECOLOR') {
    return TEXT_ENGINE_SMART_RECOLOR
  }
  return TEXT_ENGINE_ORIGINAL
}

export function characterReadOnlyCeil(height, extraY0 = 0) {
  const h = Math.max(0, Number(height) || 0)
  return Math.max(
    Math.floor(h * LOCK_RATIO),
    Math.floor(h * WRITE_FLOOR_RATIO),
    Math.floor(Number(extraY0) || 0),
  )
}

function eraseCaptionBand(ctx, x, y, w, h) {
  if (!ctx?.getImageData || w < 1 || h < 1) return
  const img = ctx.getImageData(x, y, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 16) continue
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    if (chroma > 46) continue
    const luma = r * 0.299 + g * 0.587 + b * 0.114
    if (luma >= 90 && luma <= 210) continue
    d[i] = 0
    d[i + 1] = 0
    d[i + 2] = 0
    d[i + 3] = 0
  }
  ctx.putImageData(img, x, y)
}

export function fillClosedGlyphCounters(ctx, x0, y0, x1, y1) {
  const canvas = ctx?.canvas
  const w = canvas?.width || 0
  const h = canvas?.height || 0
  if (!w || !h || !ctx?.getImageData) return ctx
  const bx0 = Math.max(0, Math.floor(Number(x0) || 0))
  const by0 = Math.max(0, Math.floor(Number(y0) || 0))
  const bx1 = Math.min(w - 1, Math.ceil(Number(x1) || 0))
  const by1 = Math.min(h - 1, Math.ceil(Number(y1) || 0))
  if (bx1 <= bx0 || by1 <= by0) return ctx
  const img = ctx.getImageData(0, 0, w, h)
  const { data } = img
  const bw = bx1 - bx0 + 1
  const bh = by1 - by0 + 1
  const seen = new Uint8Array(bw * bh)
  const queue = []
  const slot = (x, y) => (y - by0) * bw + (x - bx0)
  const tryEnq = (x, y) => {
    if (x < bx0 || x > bx1 || y < by0 || y > by1) return
    const s = slot(x, y)
    if (seen[s]) return
    if (data[(y * w + x) * 4 + 3] >= 12) return
    seen[s] = 1
    queue.push(x, y)
  }
  for (let x = bx0; x <= bx1; x += 1) {
    tryEnq(x, by0)
    tryEnq(x, by1)
  }
  for (let y = by0; y <= by1; y += 1) {
    tryEnq(bx0, y)
    tryEnq(bx1, y)
  }
  for (let q = 0; q < queue.length; q += 2) {
    const x = queue[q]
    const y = queue[q + 1]
    tryEnq(x - 1, y)
    tryEnq(x + 1, y)
    tryEnq(x, y - 1)
    tryEnq(x, y + 1)
  }
  for (let y = by0; y <= by1; y += 1) {
    for (let x = bx0; x <= bx1; x += 1) {
      if (seen[slot(x, y)]) continue
      const i = (y * w + x) * 4
      if (data[i + 3] >= 12) continue
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return ctx
}

export function paintVectorOverlayCaption(target, text, size = STICKER_SIZE) {
  const ctx = target?.getContext ? target.getContext('2d') : target
  const label = String(text || '').trim()
  if (!ctx?.strokeText || !label) return target
  const edge = Math.max(2, Math.round(Number(size) || STICKER_SIZE))
  const band = Math.round(edge * 0.22)
  const x = edge / 2
  const y = edge - Math.round(band * 0.42)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  eraseCaptionBand(ctx, 0, edge - band, edge, band)
  ctx.font = 'bold 30px "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 12
  ctx.strokeText(label, x, y)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(label, x, y)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 8
  ctx.strokeText(label, x, y)
  ctx.lineWidth = 5
  ctx.strokeText(label, x, y)
  ctx.lineWidth = 3
  ctx.strokeText(label, x, y)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(label, x, y)
  const tw = ctx.measureText(label).width
  fillClosedGlyphCounters(ctx, x - tw / 2 - 18, y - 28, x + tw / 2 + 18, y + 28)
  ctx.restore()
  return target
}

export function resolveEngineCaption(options = {}) {
  if (options.enabled === false || options.captionOn === false) return ''
  if (Object.prototype.hasOwnProperty.call(options, 'customText')) {
    return String(options.customText || '').trim()
  }
  if (Object.prototype.hasOwnProperty.call(options, 'caption')) {
    return String(options.caption || '').trim()
  }
  return captionForCutIndex(options.index)
}

export function applyTextEngine(canvas, options = {}) {
  const engine = normalizeTextEngineMode(options.mode ?? options.textEngineMode)
  if (!canvas || engine === TEXT_ENGINE_ORIGINAL) return canvas
  if (engine === TEXT_ENGINE_VECTOR_OVERLAY) {
    const caption = resolveEngineCaption(options)
    if (!caption) return canvas
    if (typeof options.paintVector === 'function') {
      options.paintVector(canvas, caption)
    } else {
      paintVectorOverlayCaption(canvas, caption, options.size)
    }
    return canvas
  }
  if (engine === TEXT_ENGINE_SMART_RECOLOR && typeof options.recolorPixels === 'function') {
    options.recolorPixels(canvas)
  }
  return canvas
}
