import { inspectRenderedSlice } from '../utils/debugger.js'
import { primeHqContext } from '../utils/hqRender.js'
import { resamplePremultiplied } from '../utils/imageProcessor.js'
import {
  TEXT_ENGINE_DEFAULT,
  TEXT_ENGINE_SMART_RECOLOR,
  applyTextEngine,
  characterReadOnlyCeil,
  normalizeTextEngineMode,
  paintVectorOverlayCaption,
} from '../utils/textProcessingPipeline.js'

export { CUT_CAPTIONS, captionForCutIndex } from './cutCaptions.js'
export {
  TEXT_ENGINE_DEFAULT,
  TEXT_ENGINE_MODES,
  TEXT_ENGINE_ORIGINAL,
  TEXT_ENGINE_SMART_RECOLOR,
  TEXT_ENGINE_VECTOR_OVERLAY,
  applyTextEngine,
  characterReadOnlyCeil,
  normalizeTextEngineMode,
} from '../utils/textProcessingPipeline.js'

export const KAKAO_STICKER_SIZE = 360
export const CROP_EDGE_INSET = 1
export const KAKAO_SAFE_PAD = 0.06
export const KAKAO_FIT_RATIO = 0.88
export const MODE_A_SAFE_PAD = 0.08
export const SLICE_SCALE_MIN = 50
export const SLICE_SCALE_MAX = 150
export const SLICE_SCALE_DEFAULT = 100
export const EMO_SIDE_MIN = 280
export const EMO_SIDE_MAX = 600
export const EMO_SIDE_DEFAULT = 380
export const PREVIEW_ZOOM_MIN = 10
export const PREVIEW_ZOOM_MAX = 200
export const PREVIEW_ZOOM_STEP = 5
export const PREVIEW_ZOOM_DEFAULT = 35
export const OUTLINE_DEFAULT = true
export const SLICE_PIPELINE = 'crop → 4-corner flood-fill-alpha(T=18)'
export const TEXT_RECOLOR_BYPASS = true
export const TEXT_ROI_HARD_LOCK = true
export const TEXT_STROKE_PRESERVE = true
export const CHARACTER_LOCK_RATIO = 0.8
export const CHARACTER_WRITE_FLOOR_RATIO = 0.32
export const SPLITTER_LIVE_REV = '2026.08.29-default-5x4'
export const ALPHA_SNIFF_THRESHOLD = 250
export const DEFAULT_SHEET_ROWS = 4
export const DEFAULT_SHEET_COLS = 5
export const DEFAULT_SHEET_COUNT = 20
export const PNG_GUIDE_STORAGE_KEY = 'styler-png-guide-hide'
export const PNG_GUIDE_TITLE = '4×5 투명 시트 권장'
export const PNG_GUIDE_OK_LABEL = '확인하고 계속하기'
export const PNG_GUIDE_HIDE_LABEL = '오늘 하루 다시 보지 않기'
export const PNG_GUIDE_BODY = '4행 × 5열 (20개) 투명 PNG 시트를 기본 규격으로 권장합니다. 흰색 배경 및 다른 비율의 시트도 제한 없이 자유롭게 업로드할 수 있습니다.'
export const PNG_GUIDE_FOOT = 'PNG·JPG·WebP 모두 올릴 수 있습니다. 다른 배열은 좌측 규격 프리셋으로 바꿉니다.'
export const SHEET_ACCEPT = 'image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif'

export function pngGuideTodayKey(now = new Date()) {
  const date = now instanceof Date ? now : new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function resolveGuideStorage(storage) {
  if (storage) return storage
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function isPngGuideHiddenToday(storage) {
  const store = resolveGuideStorage(storage)
  if (!store?.getItem) return false
  try {
    return store.getItem(PNG_GUIDE_STORAGE_KEY) === pngGuideTodayKey()
  } catch {
    return false
  }
}

export function hidePngGuideToday(storage) {
  const store = resolveGuideStorage(storage)
  if (!store?.setItem) return
  try {
    store.setItem(PNG_GUIDE_STORAGE_KEY, pngGuideTodayKey())
  } catch {
    /* ignore quota / private mode */
  }
}

function alphaProbePoints(width, height) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const mx = (w / 2) | 0
  const my = (h / 2) | 0
  return [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [mx, 0],
    [mx, h - 1],
    [0, my],
    [w - 1, my],
  ]
}

export function sniffImageDataHasAlpha(imageData, threshold = ALPHA_SNIFF_THRESHOLD) {
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  if (!data || !width || !height) return false
  const cut = Number.isFinite(Number(threshold)) ? Number(threshold) : ALPHA_SNIFF_THRESHOLD
  const points = alphaProbePoints(width, height)
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i]
    if (data[(y * width + x) * 4 + 3] < cut) return true
  }
  return false
}

export function sniffCanvasHasAlpha(source, threshold = ALPHA_SNIFF_THRESHOLD) {
  const width = Math.max(0, source?.width || 0)
  const height = Math.max(0, source?.height || 0)
  if (!width || !height) return false
  const ctx = source.getContext?.('2d', { willReadFrequently: true })
  if (!ctx?.getImageData) return false
  const cut = Number.isFinite(Number(threshold)) ? Number(threshold) : ALPHA_SNIFF_THRESHOLD
  const points = alphaProbePoints(width, height)
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i]
    if (ctx.getImageData(x, y, 1, 1).data[3] < cut) return true
  }
  return false
}

export function clampSliceScale(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return SLICE_SCALE_DEFAULT
  return Math.min(SLICE_SCALE_MAX, Math.max(SLICE_SCALE_MIN, n))
}

export function clampEmoSideWidth(width) {
  const n = Math.round(Number(width))
  if (!Number.isFinite(n)) return EMO_SIDE_DEFAULT
  return Math.max(EMO_SIDE_MIN, Math.min(EMO_SIDE_MAX, n))
}

export function clampPreviewZoomPercent(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return PREVIEW_ZOOM_DEFAULT
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, n))
}

export function stepPreviewZoomPercent(current, delta = PREVIEW_ZOOM_STEP) {
  return clampPreviewZoomPercent((Number(current) || PREVIEW_ZOOM_DEFAULT) + (Number(delta) || 0))
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 열 수 없습니다.'))
    }
    image.src = url
  })
}

export function imageToCanvas(image) {
  const { canvas, ctx } = makeAlphaCanvas(
    Math.max(1, image.naturalWidth || image.width),
    Math.max(1, image.naturalHeight || image.height),
  )
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0)
  return canvas
}

function colorDist(r, g, b, bg) {
  return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2])
}

function sampleBackground(data, width, height) {
  const spots = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [2, Math.floor(height / 2)],
  ]
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  spots.forEach(([x, y]) => {
    const i = (Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))) * 4
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    a += data[i + 3]
  })
  const n = spots.length
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)]
}

function isForeground(data, index, bg, threshold) {
  const p = index * 4
  if (data[p + 3] < 18) return false
  if (bg[3] < 18) return data[p + 3] >= 18
  return colorDist(data[p], data[p + 1], data[p + 2], bg) > threshold
}

function boxesNear(a, b, gap) {
  return a.x <= b.x + b.w + gap
    && b.x <= a.x + a.w + gap
    && a.y <= b.y + b.h + gap
    && b.y <= a.y + a.h + gap
}

export function mergeNearbyBoxes(boxes, gap = 12) {
  const items = boxes.map((box) => ({ ...box }))
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (!boxesNear(items[i], items[j], gap)) continue
        const a = items[i]
        const b = items[j]
        const x = Math.min(a.x, b.x)
        const y = Math.min(a.y, b.y)
        const w = Math.max(a.x + a.w, b.x + b.w) - x
        const h = Math.max(a.y + a.h, b.y + b.h) - y
        items[i] = { x, y, w, h, count: (a.count || 0) + (b.count || 0) }
        items.splice(j, 1)
        merged = true
        break outer
      }
    }
  }
  return items
}

export function findContentBoxes(imageData, { minArea = 80, threshold = 42 } = {}) {
  const { width, height, data } = imageData
  const bg = sampleBackground(data, width, height)
  const visited = new Uint8Array(width * height)
  const boxes = []
  const maxArea = width * height * 0.78

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (visited[start] || !isForeground(data, start, bg, threshold)) continue
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let count = 0
      const stack = [start]
      visited[start] = 1
      while (stack.length) {
        const cur = stack.pop()
        const cx = cur % width
        const cy = (cur / width) | 0
        count += 1
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy
        const neighbors = [cur - 1, cur + 1, cur - width, cur + width]
        for (const next of neighbors) {
          if (next < 0 || next >= visited.length || visited[next]) continue
          const nx = next % width
          if (Math.abs(nx - cx) > 1) continue
          if (!isForeground(data, next, bg, threshold)) continue
          visited[next] = 1
          stack.push(next)
        }
      }
      const w = maxX - minX + 1
      const h = maxY - minY + 1
      if (count >= minArea && w * h < maxArea) {
        boxes.push({ x: minX, y: minY, w, h, count })
      }
    }
  }

  boxes.sort((a, b) => a.y - b.y || a.x - b.x)
  const gap = Math.max(8, Math.round(Math.min(width, height) * 0.012))
  return mergeNearbyBoxes(boxes, gap).sort((a, b) => a.y - b.y || a.x - b.x)
}

function resolveSheetImageData(source) {
  if (source?.data && source.width && source.height) return source
  const ctx = source?.getContext?.('2d', { willReadFrequently: true })
  if (!ctx || !source?.width || !source?.height) return null
  return ctx.getImageData(0, 0, source.width, source.height)
}

function medianNumbers(values) {
  const list = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (!list.length) return 0
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

function smoothDensity(density, radius = 2) {
  const size = density?.length || 0
  const out = new Float32Array(size)
  const span = Math.max(1, Math.round(Number(radius) || 2))
  for (let i = 0; i < size; i += 1) {
    let sum = 0
    let count = 0
    for (let k = -span; k <= span; k += 1) {
      const j = i + k
      if (j < 0 || j >= size) continue
      sum += density[j]
      count += 1
    }
    out[i] = count ? sum / count : 0
  }
  return out
}

function collectDensityRuns(density, threshold) {
  const runs = []
  let start = -1
  for (let i = 0; i < density.length; i += 1) {
    if (density[i] > threshold) {
      if (start < 0) start = i
      continue
    }
    if (start >= 0) {
      runs.push({ start, end: i - 1 })
      start = -1
    }
  }
  if (start >= 0) runs.push({ start, end: density.length - 1 })
  return runs
}

function mergeRunsByGap(runs, mergeGap) {
  if (!runs.length) return []
  const merged = [{ start: runs[0].start, end: runs[0].end }]
  const gapLimit = Math.max(0, Number(mergeGap) || 0)
  for (let i = 1; i < runs.length; i += 1) {
    const prev = merged[merged.length - 1]
    const gap = runs[i].start - prev.end - 1
    if (gap <= gapLimit) {
      prev.end = runs[i].end
      continue
    }
    merged.push({ start: runs[i].start, end: runs[i].end })
  }
  return merged
}

function mergeShortCaptionRuns(runs) {
  if (runs.length < 2) return runs.map((run) => ({ ...run }))
  const heights = runs.map((run) => run.end - run.start + 1)
  const typical = medianNumbers(heights)
  const out = []
  runs.forEach((run) => {
    const height = run.end - run.start + 1
    if (out.length && typical && height < typical * 0.62) {
      const prev = out[out.length - 1]
      const gap = run.start - prev.end - 1
      const prevH = prev.end - prev.start + 1
      if (gap <= Math.max(22, prevH * 0.55)) {
        prev.end = run.end
        return
      }
    }
    out.push({ start: run.start, end: run.end })
  })
  return out
}

export function findProjectionSegments(densityArray, threshold = 0.015, minSize = 8, options = {}) {
  const density = smoothDensity(densityArray, options.smooth ?? 1)
  let peak = 0
  for (let i = 0; i < density.length; i += 1) peak = Math.max(peak, density[i])
  const rel = Number.isFinite(Number(options.relativeCut)) ? Number(options.relativeCut) : 0.2
  const cut = Math.max(Number(threshold) || 0.015, peak * rel)
  const raw = collectDensityRuns(density, cut).filter((run) => (run.end - run.start + 1) >= Math.max(3, Math.round(Number(minSize) * 0.28)))
  const closed = mergeRunsByGap(raw, options.mergeGap ?? 1)
  const paired = options.mergeCaption === false ? closed : mergeShortCaptionRuns(closed)
  const floor = Math.max(4, Math.round(Number(minSize) || 8))
  const pad = options.pad == null ? 2 : Math.max(0, Math.round(Number(options.pad) || 0))
  return paired
    .filter((run) => (run.end - run.start + 1) >= floor)
    .map((run) => ({
      start: Math.max(0, run.start - pad),
      end: Math.min(density.length - 1, run.end + pad),
    }))
}

function isProjectionInk(data, width, x, y, bg) {
  const i = (y * width + x) * 4
  const a = data[i + 3]
  if (a < 20) return false
  if ((bg?.[3] ?? 255) < 18) return a >= 80
  return isForeground(data, y * width + x, bg, 42)
}

function isLooseForeground(data, width, x, y, bg) {
  const i = (y * width + x) * 4
  if (data[i + 3] > 20) return true
  return isForeground(data, y * width + x, bg, 42)
}

function makeGridCell(x0, y0, x1, y1) {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.max(1, Math.abs(x1 - x0) + 1)
  const h = Math.max(1, Math.abs(y1 - y0) + 1)
  return { x, y, w, h, width: w, height: h }
}

function roiDensityX(imageData, x0, x1, y0, y1, isActive) {
  const span = Math.max(1, y1 - y0 + 1)
  const density = new Float32Array(Math.max(1, x1 - x0 + 1))
  for (let x = x0; x <= x1; x += 1) {
    let active = 0
    for (let y = y0; y <= y1; y += 1) {
      if (isActive(x, y)) active += 1
    }
    density[x - x0] = active / span
  }
  return density
}

function roiDensityY(imageData, x0, x1, y0, y1, isActive) {
  const span = Math.max(1, x1 - x0 + 1)
  const density = new Float32Array(Math.max(1, y1 - y0 + 1))
  for (let y = y0; y <= y1; y += 1) {
    let active = 0
    for (let x = x0; x <= x1; x += 1) {
      if (isActive(x, y)) active += 1
    }
    density[y - y0] = active / span
  }
  return density
}

function usefulSegments(segments, fullSize) {
  const limit = Math.max(8, fullSize * 0.9)
  return (segments || []).filter((seg) => (seg.end - seg.start + 1) < limit)
}

function splitCellByProjection(cell, imageData, isActive, depth = 0) {
  const x = Math.max(0, Math.floor(cell.x))
  const y = Math.max(0, Math.floor(cell.y))
  const w = Math.max(1, Math.round(cell.w || cell.width || 1))
  const h = Math.max(1, Math.round(cell.h || cell.height || 1))
  const x1 = x + w - 1
  const y1 = y + h - 1
  if (depth > 6 || w < 14 || h < 14) return [makeGridCell(x, y, x1, y1)]
  const ySeg = usefulSegments(
    findProjectionSegments(
      roiDensityY(imageData, x, x1, y, y1, isActive),
      0.02,
      Math.max(8, h * 0.028),
      { mergeCaption: true, relativeCut: 0.2, smooth: 1, mergeGap: 1 },
    ).map((seg) => ({ start: seg.start + y, end: seg.end + y })),
    h,
  )
  const xSeg = usefulSegments(
    findProjectionSegments(
      roiDensityX(imageData, x, x1, y, y1, isActive),
      0.02,
      Math.max(8, w * 0.028),
      { mergeCaption: false, relativeCut: 0.2, smooth: 1, mergeGap: 1 },
    ).map((seg) => ({ start: seg.start + x, end: seg.end + x })),
    w,
  )
  if (ySeg.length >= 2 && xSeg.length >= 2 && ySeg.length * xSeg.length <= 48) {
    const cells = []
    ySeg.forEach((row) => {
      xSeg.forEach((col) => {
        cells.push(makeGridCell(col.start, row.start, col.end, row.end))
      })
    })
    return cells
  }
  if (ySeg.length >= 2) {
    return ySeg.flatMap((row) => splitCellByProjection(
      makeGridCell(x, row.start, x1, row.end),
      imageData,
      isActive,
      depth + 1,
    ))
  }
  if (xSeg.length >= 2) {
    return xSeg.flatMap((col) => splitCellByProjection(
      makeGridCell(col.start, y, col.end, y1),
      imageData,
      isActive,
      depth + 1,
    ))
  }
  return [makeGridCell(x, y, x1, y1)]
}

function mergeCaptionNeighbors(cells) {
  const items = (Array.isArray(cells) ? cells : []).map((box) => makeGridCell(
    box.x,
    box.y,
    box.x + (box.w || box.width) - 1,
    box.y + (box.h || box.height) - 1,
  )).sort((a, b) => a.y - b.y || a.x - b.x)
  let changed = true
  while (changed) {
    changed = false
    outer: for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i]
        const b = items[j]
        const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        if (overlap < Math.min(a.w, b.w) * 0.68) continue
        const gap = b.y - (a.y + a.h)
        if (gap < -10 || gap > Math.max(28, a.h * 0.55)) continue
        if (b.h > a.h * 0.72) continue
        items[i] = makeGridCell(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x + a.w, b.x + b.w) - 1, Math.max(a.y + a.h, b.y + b.h) - 1)
        items.splice(j, 1)
        changed = true
        break outer
      }
    }
  }
  return items.sort((a, b) => a.y - b.y || a.x - b.x)
}

function countProfilePeaks(density, minGap) {
  const smooth = smoothDensity(density, 3)
  let peak = 0
  for (let i = 0; i < smooth.length; i += 1) peak = Math.max(peak, smooth[i])
  const floor = peak * 0.32
  const gap = Math.max(8, Math.round(Number(minGap) || 8))
  const peaks = []
  for (let i = 2; i < smooth.length - 2; i += 1) {
    if (smooth[i] < floor) continue
    if (smooth[i] < smooth[i - 1] || smooth[i] < smooth[i + 1]) continue
    if (peaks.length && i - peaks[peaks.length - 1] < gap) {
      if (smooth[i] > smooth[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i
      continue
    }
    peaks.push(i)
  }
  return peaks.length
}

export const SHEET_GRID_PRESETS = [
  { id: '5x4', cols: 5, rows: 4, count: 20, label: '5×4 · 20', hint: '5열×4행 20칸. AI 생성 표준 시트 기본값입니다.', isDefault: true },
  { id: '7x4', cols: 7, rows: 4, count: 28, label: '7×4 · 28', hint: '7열×4행 28칸. 와이드 카카오 시트에 맞춥니다.' },
  { id: '6x4', cols: 6, rows: 4, count: 24, label: '6×4 · 24', hint: '6열×4행 24칸. 중간 폭 시트에 맞춥니다.' },
  { id: '4x4', cols: 4, rows: 4, count: 16, label: '4×4 · 16', hint: '4열×4행 16칸. 정사각에 가까운 시트에 맞춥니다.' },
]

export function getRecommendedGrid(_width, _height) {
  return { cols: DEFAULT_SHEET_COLS, rows: DEFAULT_SHEET_ROWS }
}

export function isAcceptedSheetFile(file) {
  if (!file) return false
  const type = String(file.type || '')
  if (type.startsWith('image/')) return true
  return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(String(file.name || ''))
}

export function handleDefaultSheetUpload(imageElement, setGridCells, setDetectedText) {
  const width = Math.max(1, imageElement?.naturalWidth || imageElement?.width || 1)
  const height = Math.max(1, imageElement?.naturalHeight || imageElement?.height || 1)
  const cells = generateSheetGrid(width, height, DEFAULT_SHEET_COLS, DEFAULT_SHEET_ROWS)
  if (typeof setGridCells === 'function') setGridCells(cells.slice())
  if (typeof setDetectedText === 'function') {
    setDetectedText(`${DEFAULT_SHEET_ROWS}행 × ${DEFAULT_SHEET_COLS}열 = ${cells.length}개`)
  }
  return {
    cells,
    rows: DEFAULT_SHEET_ROWS,
    cols: DEFAULT_SHEET_COLS,
    count: cells.length,
    engine: 'default-5x4',
    verticalGuides: equalSplitGuides(DEFAULT_SHEET_COLS),
    horizontalGuides: equalSplitGuides(DEFAULT_SHEET_ROWS),
  }
}

export function generateSheetGrid(imageWidth, imageHeight, cols = 5, rows = 4) {
  return buildRegularGridCells(imageWidth, imageHeight, rows, cols).map((cell, index) => ({
    ...cell,
    id: `cell-${Math.floor(index / Math.max(1, cols))}-${index % Math.max(1, cols)}`,
    index: index + 1,
    width: cell.w,
    height: cell.h,
  }))
}

export function guessStickerGridShape(width, height, rowPeaks = 0, colPeaks = 0) {
  const known = SHEET_GRID_PRESETS.find((preset) => preset.rows === rowPeaks && preset.cols === colPeaks)
  if (known) return { rows: known.rows, cols: known.cols }
  return getRecommendedGrid(width, height)
}

export function buildRegularGridCells(width, height, rows, cols) {
  const rCount = Math.max(1, Math.round(Number(rows) || 1))
  const cCount = Math.max(1, Math.round(Number(cols) || 1))
  const w = Math.max(1, Math.round(Number(width) || 1))
  const h = Math.max(1, Math.round(Number(height) || 1))
  const cells = []
  for (let row = 0; row < rCount; row += 1) {
    const y0 = Math.round((row * h) / rCount)
    const y1 = Math.round(((row + 1) * h) / rCount) - 1
    for (let col = 0; col < cCount; col += 1) {
      const x0 = Math.round((col * w) / cCount)
      const x1 = Math.round(((col + 1) * w) / cCount) - 1
      cells.push(makeGridCell(x0, y0, x1, y1))
    }
  }
  return cells
}

export function isCollapsedSmartGrid(cells, width, height) {
  const items = Array.isArray(cells) ? cells : []
  if (!items.length) return true
  if (items.length >= 12) return false
  if (width < 360 || height < 280) return false
  const medW = medianNumbers(items.map((box) => box.w || box.width))
  const medH = medianNumbers(items.map((box) => box.h || box.height))
  const fullHeightStrips = medH >= height * 0.78
  const fullWidthBands = medW >= width * 0.78
  if (items.length > 6 || (!fullHeightStrips && !fullWidthBands)) return false
  const meta = inferGuidesFromSmartBoxes(items, width, height)
  const oneAxis = items.length === 1
    || (meta.rows <= 1 && meta.cols >= 2)
    || (meta.cols <= 1 && meta.rows >= 2)
  return oneAxis
}

export function isOverSplitSmartGrid(cells, width, height) {
  const items = Array.isArray(cells) ? cells : []
  if (!items.length || width < 360 || height < 280) return false
  const meta = inferGuidesFromSmartBoxes(items, width, height)
  if (SHEET_GRID_PRESETS.some((preset) => (
    preset.rows === meta.rows && preset.cols === meta.cols && preset.count === items.length
  ))) {
    return false
  }
  const recommended = getRecommendedGrid(width, height)
  const expected = recommended.rows * recommended.cols
  if (items.length === expected && meta.rows === recommended.rows && meta.cols === recommended.cols) {
    return false
  }
  if (meta.rows >= recommended.rows + 1 && items.length > expected) return true
  if (meta.cols >= recommended.cols + 1 && items.length > expected) return true
  return items.length > expected && items.length <= 36
}

export function detectSmartEmoticonGrid(sourceCanvas) {
  const imageData = resolveSheetImageData(sourceCanvas)
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  if (!data || !width || !height) {
    return { cells: [], rows: 0, cols: 0 }
  }
  const bg = sampleBackground(data, width, height)
  const isActive = (x, y) => isProjectionInk(data, width, x, y, bg)
  const raw = splitCellByProjection({ x: 0, y: 0, w: width, h: height }, imageData, isActive, 0)
  let cells = mergeCaptionNeighbors(raw)
  let engine = 'projection'
  if (isCollapsedSmartGrid(cells, width, height) || isOverSplitSmartGrid(cells, width, height)) {
    const loose = (x, y) => isLooseForeground(data, width, x, y, bg)
    const rowPeaks = countProfilePeaks(roiDensityY(imageData, 0, width - 1, 0, height - 1, loose), height * 0.12)
    const colPeaks = countProfilePeaks(roiDensityX(imageData, 0, width - 1, 0, height - 1, loose), width * 0.08)
    const shape = guessStickerGridShape(width, height, rowPeaks, colPeaks)
    cells = generateSheetGrid(width, height, shape.cols, shape.rows)
    engine = 'adaptive-grid'
  }
  const meta = inferGuidesFromSmartBoxes(cells, width, height)
  return {
    cells,
    rows: meta.rows,
    cols: meta.cols,
    count: cells.length,
    engine,
    verticalGuides: meta.verticalGuides,
    horizontalGuides: meta.horizontalGuides,
  }
}

export function handleSheetAutoDetection(imageElement, setGridCells, setDetectedCountText) {
  const width = Math.max(1, imageElement?.naturalWidth || imageElement?.width || 1)
  const height = Math.max(1, imageElement?.naturalHeight || imageElement?.height || 1)
  const canvas = imageElement?.getContext ? imageElement : document.createElement('canvas')
  if (canvas !== imageElement) {
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx?.drawImage(imageElement, 0, 0)
  }
  const detected = detectSmartEmoticonGrid(canvas)
  const cells = detected.cells || []
  if (typeof setGridCells === 'function') setGridCells(cells.slice())
  if (typeof setDetectedCountText === 'function') {
    setDetectedCountText(formatSmartGridLabel(detected) || `${cells.length}개`)
  }
  return detected
}

function clusterAxisMeans(values, gap) {
  const sorted = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (!sorted.length) return []
  const groups = [[sorted[0]]]
  const limit = Math.max(4, Number(gap) || 8)
  for (let i = 1; i < sorted.length; i += 1) {
    const group = groups[groups.length - 1]
    if (sorted[i] - group[group.length - 1] <= limit) {
      group.push(sorted[i])
      continue
    }
    groups.push([sorted[i]])
  }
  return groups.map((group) => group.reduce((sum, value) => sum + value, 0) / group.length)
}

export function inferGuidesFromSmartBoxes(boxes, width, height) {
  const items = Array.isArray(boxes) ? boxes : []
  const w = Math.max(1, Number(width) || 1)
  const h = Math.max(1, Number(height) || 1)
  if (!items.length) {
    return { rows: 0, cols: 0, count: 0, verticalGuides: [], horizontalGuides: [] }
  }
  const medH = medianNumbers(items.map((box) => box.h)) || Math.max(12, h * 0.08)
  const medW = medianNumbers(items.map((box) => box.w)) || Math.max(12, w * 0.08)
  const rowMeans = clusterAxisMeans(items.map((box) => box.y + box.h / 2), Math.max(10, medH * 0.55))
  const colMeans = clusterAxisMeans(items.map((box) => box.x + box.w / 2), Math.max(10, medW * 0.55))
  const verticalGuides = []
  for (let i = 0; i < colMeans.length - 1; i += 1) {
    verticalGuides.push((colMeans[i] + colMeans[i + 1]) / 2 / w)
  }
  const horizontalGuides = []
  for (let i = 0; i < rowMeans.length - 1; i += 1) {
    horizontalGuides.push((rowMeans[i] + rowMeans[i + 1]) / 2 / h)
  }
  return {
    rows: rowMeans.length,
    cols: colMeans.length,
    count: items.length,
    verticalGuides,
    horizontalGuides,
    engine: 'projection',
  }
}

export function formatSmartGridLabel(meta) {
  const rows = Number(meta?.rows) || 0
  const cols = Number(meta?.cols) || 0
  const count = Number(meta?.count) || Number(meta?.cells?.length) || (rows * cols)
  if (!rows || !cols || !count) return ''
  return `${rows}행 × ${cols}열 = ${count}개`
}

export const DOUBLE_HEIGHT_RATIO = 1.7
export const DOUBLE_WIDTH_RATIO = 1.7
export const PUNCH_HOLES_DEFAULT = false
export const TEXT_ZONE_ANCHOR_DEFAULT = 'bottom'
export const VIEW_BG_MODES = ['checker', 'dark', 'light']
export const VIEW_BG_DEFAULT = 'checker'

function medianBoxMetric(boxes, key) {
  const values = (Array.isArray(boxes) ? boxes : [])
    .map((box) => Number(box?.[key]) || 0)
    .filter((value) => value > 0)
    .sort((a, b) => a - b)
  if (!values.length) return 0
  const mid = Math.floor(values.length / 2)
  if (values.length % 2) return values[mid]
  return (values[mid - 1] + values[mid]) / 2
}

export function medianBoxHeight(boxes) {
  return medianBoxMetric(boxes, 'h')
}

export function medianBoxWidth(boxes) {
  return medianBoxMetric(boxes, 'w')
}

export function splitDoubleHeightBoxes(boxes, ratio = DOUBLE_HEIGHT_RATIO) {
  const items = Array.isArray(boxes) ? boxes : []
  const medianHeight = medianBoxHeight(items)
  if (!medianHeight) return items.map((box) => ({ ...box }))
  const limit = medianHeight * (Number(ratio) || DOUBLE_HEIGHT_RATIO)
  const next = []
  items.forEach((box) => {
    const h = Number(box.h) || 0
    if (!(h > limit)) {
      next.push({ ...box })
      return
    }
    const topH = Math.floor(h / 2)
    const botH = Math.ceil(h / 2)
    next.push({
      ...box,
      x: box.x,
      y: box.y,
      w: box.w,
      h: topH,
    })
    next.push({
      ...box,
      x: box.x,
      y: box.y + topH,
      w: box.w,
      h: botH,
    })
  })
  return next.sort((a, b) => a.y - b.y || a.x - b.x)
}

export function splitDoubleWidthBoxes(boxes, ratio = DOUBLE_WIDTH_RATIO) {
  const items = Array.isArray(boxes) ? boxes : []
  const medianWidth = medianBoxWidth(items)
  if (!medianWidth) return items.map((box) => ({ ...box }))
  const limit = medianWidth * (Number(ratio) || DOUBLE_WIDTH_RATIO)
  const next = []
  items.forEach((box) => {
    const w = Number(box.w) || 0
    if (!(w > limit)) {
      next.push({ ...box })
      return
    }
    const leftW = Math.floor(w / 2)
    const rightW = Math.ceil(w / 2)
    next.push({
      ...box,
      x: box.x,
      y: box.y,
      w: leftW,
      h: box.h,
    })
    next.push({
      ...box,
      x: box.x + leftW,
      y: box.y,
      w: rightW,
      h: box.h,
    })
  })
  return next.sort((a, b) => a.y - b.y || a.x - b.x)
}

export function splitMergedSmartBoxes(boxes, ratio = DOUBLE_HEIGHT_RATIO) {
  return splitDoubleWidthBoxes(splitDoubleHeightBoxes(boxes, ratio), ratio)
}

export function cycleViewBgMode(current = VIEW_BG_DEFAULT) {
  const index = VIEW_BG_MODES.indexOf(current)
  return VIEW_BG_MODES[(index < 0 ? 0 : index + 1) % VIEW_BG_MODES.length]
}

function opaqueBounds(imageData) {
  const { width, height, data } = imageData
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 12) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function analyzeSheet(source) {
  const maxSide = 1280
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  if (scale >= 0.999) {
    const data = source.getContext('2d').getImageData(0, 0, source.width, source.height)
    return { data, scale: 1 }
  }
  const tmp = document.createElement('canvas')
  tmp.width = Math.max(1, Math.round(source.width * scale))
  tmp.height = Math.max(1, Math.round(source.height * scale))
  tmp.getContext('2d').drawImage(source, 0, 0, tmp.width, tmp.height)
  return {
    data: tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height),
    scale,
  }
}

export function equalSplitGuides(count, start = 0, end = 1) {
  const n = Math.max(1, Math.min(12, Math.round(count) || 1))
  if (n <= 1) return []
  const a = Number(start) || 0
  const b = Number(end) || 1
  return Array.from({ length: n - 1 }, (_, index) => a + (b - a) * ((index + 1) / n))
}

export function clampGuide(value, prev, next, minGap = 0.028) {
  const lo = prev + minGap
  const hi = next - minGap
  if (hi <= lo) return (prev + next) / 2
  return Math.max(lo, Math.min(hi, Number(value) || 0))
}

export function moveGuide(list, index, nextRatio, minGap = 0.028, start = 0, end = 1) {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return list
  const prev = index === 0 ? start : list[index - 1]
  const next = index === list.length - 1 ? end : list[index + 1]
  const copy = list.slice()
  copy[index] = clampGuide(nextRatio, prev, next, minGap)
  return copy
}

export const DEFAULT_CROP_BOUNDS = { left: 0, top: 0, right: 1, bottom: 1 }

export function normalizeBounds(bounds = DEFAULT_CROP_BOUNDS, minGap = 0.05) {
  const next = { ...DEFAULT_CROP_BOUNDS, ...bounds }
  next.left = Math.max(0, Math.min(1 - minGap, Number(next.left) || 0))
  next.right = Math.min(1, Math.max(next.left + minGap, Number(next.right) || 1))
  next.top = Math.max(0, Math.min(1 - minGap, Number(next.top) || 0))
  next.bottom = Math.min(1, Math.max(next.top + minGap, Number(next.bottom) || 1))
  return next
}

export function insertGuide(list, start = 0, end = 1, maxLines = 11) {
  const items = Array.isArray(list) ? list.slice() : []
  if (items.length >= maxLines) return items
  const edges = [start, ...items, end]
  let best = 0
  let gap = 0
  for (let i = 0; i < edges.length - 1; i += 1) {
    const size = edges[i + 1] - edges[i]
    if (size > gap) {
      gap = size
      best = i
    }
  }
  items.splice(best, 0, (edges[best] + edges[best + 1]) / 2)
  return items
}

export function removeGuide(list, index) {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return list
  return list.filter((_, i) => i !== index)
}

export function sourceSpan(startRatio, endRatio, originSize) {
  const size = Math.max(1, Math.round(Number(originSize) || 1))
  const a = Math.max(0, Math.min(1, Number(startRatio) || 0)) * size
  const b = Math.max(0, Math.min(1, Number(endRatio) || 0)) * size
  const origin = Math.max(0, Math.min(size - 1, Math.floor(Math.min(a, b) + 1e-9)))
  const end = Math.max(origin + 1, Math.min(size, Math.ceil(Math.max(a, b) - 1e-9)))
  return { origin, size: end - origin }
}

export function containFitRect(sliceW, sliceH, size = KAKAO_STICKER_SIZE, fitRatio = KAKAO_FIT_RATIO) {
  const maxDim = size * fitRatio
  const scale = Math.min(maxDim / Math.max(1, sliceW), maxDim / Math.max(1, sliceH))
  const renderW = Math.max(1, Math.round(sliceW * scale))
  const renderH = Math.max(1, Math.round(sliceH * scale))
  return {
    maxDim,
    scale,
    renderW,
    renderH,
    renderX: Math.round((size - renderW) / 2),
    renderY: Math.round((size - renderH) / 2),
  }
}

export function applyCustomSliceScale(fit, customScale = SLICE_SCALE_DEFAULT, size = KAKAO_STICKER_SIZE) {
  const zoom = clampSliceScale(customScale) / 100
  const renderW = Math.max(1, Math.round((fit?.renderW || 1) * zoom))
  const renderH = Math.max(1, Math.round((fit?.renderH || 1) * zoom))
  return {
    ...fit,
    customScale: clampSliceScale(customScale),
    renderW,
    renderH,
    renderX: Math.round((size - renderW) / 2),
    renderY: Math.round((size - renderH) / 2),
  }
}

export function expandBoxFooter(source, box, limitY) {
  const width = source.width
  const height = source.height
  const x = Math.max(0, Math.floor(box.x))
  const y = Math.max(0, Math.floor(box.y))
  const w = Math.max(1, Math.min(width - x, Math.ceil(box.w)))
  const h = Math.max(1, Math.min(height - y, Math.ceil(box.h)))
  const y1 = y + h
  const cap = Math.min(height, Math.max(y1, Math.floor(Number(limitY) || y1)))
  if (cap <= y1) return { x, y, w, h }
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { x, y, w, h }
  const band = ctx.getImageData(x, y1, w, cap - y1)
  let last = -1
  let empty = 0
  for (let row = 0; row < band.height; row += 1) {
    let ink = 0
    for (let col = 0; col < w; col += 1) {
      const i = (row * w + col) * 4
      if (band.data[i + 3] < 28) continue
      const luma = pixelLuma(band.data[i], band.data[i + 1], band.data[i + 2])
      const chroma = pixelChroma(band.data[i], band.data[i + 1], band.data[i + 2])
      if (chroma < 42 && (luma <= 118 || luma >= 205)) ink += 1
    }
    if (ink > w * 0.018) {
      last = row
      empty = 0
    } else {
      empty += 1
      if (last >= 0 && empty >= 3) break
    }
  }
  if (last < 0) return { x, y, w, h }
  return { x, y, w, h: h + last + 1 }
}

function expandSmartBoxFooters(source, boxes, crop) {
  const items = Array.isArray(boxes) ? boxes : []
  if (!items.length || !source) return items
  const sheetH = source.height || 0
  const cropBottom = Math.round((Number(crop?.bottom) > 0 ? crop.bottom : 1) * sheetH)
  return items.map((box, index) => {
    const bottom = (Number(box.y) || 0) + (Number(box.h) || 0)
    let limitY = Math.min(sheetH, cropBottom)
    let foundBelow = false
    items.forEach((other, j) => {
      if (j === index) return
      const overlapX = other.x < box.x + box.w && other.x + other.w > box.x
      if (!overlapX) return
      if (other.y < bottom - 4) return
      foundBelow = true
      limitY = Math.min(limitY, Math.floor(other.y))
    })
    if (!foundBelow) {
      limitY = Math.min(limitY, Math.ceil(bottom + Math.max(28, (Number(box.h) || 0) * 0.4)))
    }
    return expandBoxFooter(source, box, limitY)
  })
}

export function splitGuideBoxes(width, height, verticalGuides = [], horizontalGuides = [], bounds = DEFAULT_CROP_BOUNDS) {
  const b = normalizeBounds(bounds)
  const xs = [b.left, ...[...verticalGuides]
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > b.left + 0.002 && item < b.right - 0.002)
    .sort((a, c) => a - c), b.right]
  const ys = [b.top, ...[...horizontalGuides]
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > b.top + 0.002 && item < b.bottom - 0.002)
    .sort((a, c) => a - c), b.bottom]
  const boxes = []
  for (let row = 0; row < ys.length - 1; row += 1) {
    const ySpan = sourceSpan(ys[row], ys[row + 1], height)
    for (let col = 0; col < xs.length - 1; col += 1) {
      const xSpan = sourceSpan(xs[col], xs[col + 1], width)
      boxes.push({
        x: xSpan.origin,
        y: ySpan.origin,
        w: xSpan.size,
        h: ySpan.size,
      })
    }
  }
  return boxes
}

export function splitGridBoxes(width, height, cols, rows, verticalGuides, horizontalGuides, bounds) {
  const safeCols = Math.max(1, Math.min(12, Math.round(cols) || 1))
  const safeRows = Math.max(1, Math.min(12, Math.round(rows) || 1))
  const v = Array.isArray(verticalGuides) ? verticalGuides : equalSplitGuides(safeCols)
  const h = Array.isArray(horizontalGuides) ? horizontalGuides : equalSplitGuides(safeRows)
  return splitGuideBoxes(width, height, v, h, bounds)
}

function parseHexColor(hex, fallback = [10, 10, 12]) {
  const raw = String(hex || '').replace('#', '')
  if (raw.length !== 6) return fallback
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  if ([r, g, b].some((item) => Number.isNaN(item))) return fallback
  return [r, g, b]
}

export const FLOOD_FILL_TOLERANCE = 18

function flattenTransparentPixels(imageData) {
  if (!imageData?.data) return imageData
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
  return imageData
}

function colorEuclid(r, g, b, seed) {
  const dr = r - seed[0]
  const dg = g - seed[1]
  const db = b - seed[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function isLightBackgroundSeed(r, g, b, a) {
  if (a < 12) return false
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  if (luma >= 228 && chroma < 42) return true
  if (luma >= 210 && chroma < 28) return true
  return luma >= 198 && chroma < 16
}

function collectFloodSeeds(data, width, height, extraSeeds = []) {
  const seeds = []
  const seen = new Set()
  const pushSeed = (r, g, b) => {
    const key = `${r},${g},${b}`
    if (seen.has(key)) return
    seen.add(key)
    seeds.push([r, g, b])
  }
  const sample = (x, y) => {
    const i = (y * width + x) * 4
    if (!isLightBackgroundSeed(data[i], data[i + 1], data[i + 2], data[i + 3])) return
    pushSeed(data[i], data[i + 1], data[i + 2])
  }
  sample(0, 0)
  sample(width - 1, 0)
  sample(0, height - 1)
  sample(width - 1, height - 1)
  extraSeeds.forEach((seed) => {
    if (!Array.isArray(seed) || seed.length < 3) return
    const a = seed[3] == null ? 255 : seed[3]
    if (a < 12) return
    if (!isLightBackgroundSeed(seed[0], seed[1], seed[2], a)) return
    pushSeed(seed[0], seed[1], seed[2])
  })
  if (!seeds.length) pushSeed(255, 255, 255)
  return seeds
}

function isCharacterStrokePixel(r, g, b, a) {
  if (a < 28) return false
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  if (luma <= 118) return true
  if (luma <= 168 && chroma >= 16) return true
  return false
}

function isColorBarrierPixel(r, g, b, a) {
  if (a < 28) return false
  if (isCharacterStrokePixel(r, g, b, a)) return true
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  if (chroma >= 32 && luma < 236) return true
  return false
}

function paperSeedLuma(seeds) {
  let max = 0
  for (let i = 0; i < seeds.length; i += 1) {
    max = Math.max(max, pixelLuma(seeds[i][0], seeds[i][1], seeds[i][2]))
  }
  return max || 255
}

function isFloodFillBackground(r, g, b, a, seeds, tolerance) {
  if (a < 12) return true
  if (isColorBarrierPixel(r, g, b, a)) return false
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  if (luma < 220) return false
  if (chroma >= 36) return false
  if (paperSeedLuma(seeds) - luma > 12) return false
  for (let i = 0; i < seeds.length; i += 1) {
    if (colorEuclid(r, g, b, seeds[i]) <= tolerance) return true
  }
  return false
}

function markExteriorBackground(imageData, {
  tolerance = FLOOD_FILL_TOLERANCE,
  extraSeeds = [],
} = {}) {
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  const outer = new Uint8Array(Math.max(0, width * height))
  if (!data || !width || !height) return outer
  const seeds = collectFloodSeeds(data, width, height, extraSeeds)
  const fillable = (x, y) => {
    const i = (y * width + x) * 4
    return isFloodFillBackground(data[i], data[i + 1], data[i + 2], data[i + 3], seeds, tolerance)
  }
  const isBridgeGap = (x, y) => {
    let barriers = 0
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (!ox && !oy) continue
        const nx = x + ox
        const ny = y + oy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        if (!fillable(nx, ny)) barriers += 1
      }
    }
    return barriers >= 3
  }
  const sealed = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      if (!fillable(x, y)) {
        sealed[p] = 1
        continue
      }
      const left = x > 0 && !fillable(x - 1, y)
      const right = x < width - 1 && !fillable(x + 1, y)
      const up = y > 0 && !fillable(x, y - 1)
      const down = y < height - 1 && !fillable(x, y + 1)
      if (left || right || up || down) sealed[p] = 1
    }
  }
  const queue = []
  const enqueue = (x, y, asSeed = false) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const p = y * width + x
    if (outer[p] || !fillable(x, y)) return
    if (!asSeed && (sealed[p] || isBridgeGap(x, y))) return
    outer[p] = 1
    queue.push(p)
  }
  enqueue(0, 0, true)
  enqueue(width - 1, 0, true)
  enqueue(0, height - 1, true)
  enqueue(width - 1, height - 1, true)
  let head = 0
  while (head < queue.length) {
    const cur = queue[head]
    head += 1
    const cx = cur % width
    const cy = (cur / width) | 0
    const nexts = [cur - 1, cur + 1, cur - width, cur + width]
    for (let k = 0; k < nexts.length; k += 1) {
      const next = nexts[k]
      if (next < 0 || next >= outer.length || outer[next]) continue
      const nx = next % width
      const ny = (next / width) | 0
      if (Math.abs(nx - cx) > 1) continue
      if (!fillable(nx, ny) || sealed[next] || isBridgeGap(nx, ny)) continue
      const ni = next * 4
      if (isColorBarrierPixel(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) continue
      outer[next] = 1
      queue.push(next)
    }
  }
  const collar = []
  for (let p = 0; p < outer.length; p += 1) {
    if (!outer[p]) continue
    const cx = p % width
    const cy = (p / width) | 0
    const nexts = [p - 1, p + 1, p - width, p + width]
    for (let k = 0; k < nexts.length; k += 1) {
      const next = nexts[k]
      if (next < 0 || next >= outer.length || outer[next]) continue
      const nx = next % width
      const ny = (next / width) | 0
      if (Math.abs(nx - cx) > 1) continue
      if (!fillable(nx, ny) || isBridgeGap(nx, ny)) continue
      collar.push(next)
    }
  }
  for (let i = 0; i < collar.length; i += 1) outer[collar[i]] = 1
  return outer
}

export function floodFillAlphaKey(imageData, {
  tolerance = FLOOD_FILL_TOLERANCE,
  extraSeeds = [],
} = {}) {
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  if (!data || !width || !height) return imageData
  const outer = markExteriorBackground(imageData, { tolerance, extraSeeds })
  for (let p = 0; p < outer.length; p += 1) {
    if (!outer[p]) continue
    const i = p * 4
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
  }
  flattenTransparentPixels(imageData)
  return imageData
}

export function processHighQualitySmartSplit(ctx, width, height, tolerance = FLOOD_FILL_TOLERANCE) {
  return applyFloodFillTransparency(ctx, width, height, {
    tolerance,
    punchHoles: false,
  })
}

function paintBinaryMask(maskCtx, outer, width, height) {
  const image = maskCtx.createImageData(width, height)
  const data = image.data
  for (let p = 0; p < outer.length; p += 1) {
    const i = p * 4
    if (outer[p]) {
      data[i + 3] = 0
      continue
    }
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = 255
  }
  maskCtx.putImageData(image, 0, 0)
}

function softenMaskCanvas(mask, width, height) {
  const { canvas, ctx } = makeAlphaCanvas(width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (typeof ctx.filter === 'string') {
    ctx.filter = 'blur(1.15px)'
  }
  ctx.drawImage(mask, 0, 0)
  ctx.filter = 'none'
  return canvas
}

function cropSourceCell(sourceCanvas, sx, sy, sWidth, sHeight) {
  const x = Math.max(0, Math.floor(Number(sx) || 0))
  const y = Math.max(0, Math.floor(Number(sy) || 0))
  const sw = Math.max(1, Math.round(Number(sWidth) || 1))
  const sh = Math.max(1, Math.round(Number(sHeight) || 1))
  const srcW = Math.max(1, sourceCanvas?.width || sw)
  const srcH = Math.max(1, sourceCanvas?.height || sh)
  const dw = Math.max(1, Math.min(sw, srcW - x))
  const dh = Math.max(1, Math.min(sh, srcH - y))
  const { canvas: cell, ctx: cellCtx } = makeAlphaCanvas(dw, dh)
  cellCtx.imageSmoothingEnabled = true
  cellCtx.imageSmoothingQuality = 'high'
  cellCtx.drawImage(sourceCanvas, x, y, dw, dh, 0, 0, dw, dh)
  return { cell, cellCtx, dw, dh, x, y }
}

export function extractLosslessCell(sourceCanvas, sx, sy, sWidth, sHeight) {
  return cropSourceCell(sourceCanvas, sx, sy, sWidth, sHeight).cell
}

export function extractCleanEmoticonCell(sourceCanvas, sx, sy, sWidth, sHeight, options = {}) {
  const opts = typeof options === 'number' ? { tolerance: options } : (options || {})
  const { cell, cellCtx, dw, dh } = cropSourceCell(sourceCanvas, sx, sy, sWidth, sHeight)
  if (opts.transparent === false || opts.lossless) return cell

  const probe = cellCtx.getImageData(0, 0, dw, dh)
  stripCropGuideResidue(probe)
  const outer = markExteriorBackground(probe, {
    tolerance: opts.tolerance ?? FLOOD_FILL_TOLERANCE,
  })
  const { canvas: mask, ctx: maskCtx } = makeAlphaCanvas(dw, dh)
  paintBinaryMask(maskCtx, outer, dw, dh)
  const softMask = softenMaskCanvas(mask, dw, dh)
  cellCtx.globalCompositeOperation = 'destination-in'
  cellCtx.drawImage(softMask, 0, 0)
  cellCtx.globalCompositeOperation = 'source-over'
  if (opts.punchHoles) {
    const keyed = cellCtx.getImageData(0, 0, dw, dh)
    punchIsolatedBackgroundHoles(keyed, {
      tolerance: opts.tolerance ?? FLOOD_FILL_TOLERANCE,
      protectBounds: textZoneBounds(dh, opts.textZonePercent, opts.textZoneAnchor),
    })
    flattenTransparentPixels(keyed)
    cellCtx.putImageData(keyed, 0, 0)
  }
  return cell
}

export function processHybridSheetCell(sourceCanvas, sx, sy, sWidth, sHeight, options = {}) {
  const opts = typeof options === 'number' ? { tolerance: options } : (options || {})
  const lossless = opts.lossless === true
    || (opts.lossless !== false && sniffCanvasHasAlpha(sourceCanvas))
  if (opts.transparent === false || lossless) {
    return extractLosslessCell(sourceCanvas, sx, sy, sWidth, sHeight)
  }
  return extractCleanEmoticonCell(sourceCanvas, sx, sy, sWidth, sHeight, {
    ...opts,
    lossless: false,
  })
}

export function processHighQualityCrop(sourceCanvas, sx, sy, sWidth, sHeight, options = {}) {
  return processHybridSheetCell(sourceCanvas, sx, sy, sWidth, sHeight, options)
}

function isIslandPaperPixel(r, g, b, a, seeds, tolerance) {
  if (a < 12) return false
  if (isCharacterStrokePixel(r, g, b, a)) return false
  const luma = pixelLuma(r, g, b)
  if (luma < 186) return false
  if (!seeds.length) return luma >= 232 && pixelChroma(r, g, b) < 20
  for (let i = 0; i < seeds.length; i += 1) {
    if (colorEuclid(r, g, b, seeds[i]) <= tolerance) return true
  }
  return false
}

function inLetterExclusion(x, y, bounds) {
  if (!bounds) return false
  const y0 = Number(bounds.y0)
  const y1 = Number(bounds.y1)
  if (!Number.isFinite(y0) || !Number.isFinite(y1) || y1 <= y0) return false
  if (y < y0 || y >= y1) return false
  const hasX0 = Number.isFinite(Number(bounds.x0))
  const hasX1 = Number.isFinite(Number(bounds.x1))
  if (hasX0 && x < Number(bounds.x0)) return false
  if (hasX1 && x > Number(bounds.x1)) return false
  return true
}

export function punchIsolatedBackgroundHoles(imageData, {
  tolerance = FLOOD_FILL_TOLERANCE,
  extraSeeds = [],
  protectBounds = null,
} = {}) {
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  if (!data || !width || !height) return imageData
  const seeds = collectFloodSeeds(data, width, height, extraSeeds)
  const fillable = (x, y) => {
    if (inLetterExclusion(x, y, protectBounds)) return false
    const i = (y * width + x) * 4
    return isIslandPaperPixel(data[i], data[i + 1], data[i + 2], data[i + 3], seeds, tolerance)
  }
  const seen = new Uint8Array(width * height)
  const queue = []
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start]) continue
    const sx = start % width
    const sy = (start / width) | 0
    if (!fillable(sx, sy)) {
      seen[start] = 1
      continue
    }
    queue.length = 0
    seen[start] = 1
    queue.push(start)
    let head = 0
    while (head < queue.length) {
      const cur = queue[head]
      head += 1
      const i = cur * 4
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      const cx = cur % width
      const cy = (cur / width) | 0
      const nexts = [cur - 1, cur + 1, cur - width, cur + width]
      for (let k = 0; k < nexts.length; k += 1) {
        const next = nexts[k]
        if (next < 0 || next >= seen.length || seen[next]) continue
        const nx = next % width
        const ny = (next / width) | 0
        if (Math.abs(nx - cx) > 1) continue
        if (!fillable(nx, ny)) {
          seen[next] = 1
          continue
        }
        seen[next] = 1
        queue.push(next)
      }
    }
  }
  flattenTransparentPixels(imageData)
  return imageData
}

export function applyFloodFillTransparency(ctx, width = KAKAO_STICKER_SIZE, height = width, options = {}) {
  if (!ctx?.getImageData || !ctx.putImageData) return ctx
  const w = Math.max(1, Math.round(Number(width) || KAKAO_STICKER_SIZE))
  const h = Math.max(1, Math.round(Number(height) || w))
  const imageData = ctx.getImageData(0, 0, w, h)
  floodFillAlphaKey(imageData, {
    tolerance: options.tolerance ?? FLOOD_FILL_TOLERANCE,
  })
  if (options.punchHoles) {
    punchIsolatedBackgroundHoles(imageData, {
      tolerance: options.tolerance ?? FLOOD_FILL_TOLERANCE,
      protectBounds: options.protectBounds ?? textZoneBounds(
        h,
        options.textZonePercent,
        options.textZoneAnchor,
      ),
    })
  }
  flattenTransparentPixels(imageData)
  ctx.putImageData(imageData, 0, 0)
  return ctx
}

function makeAlphaCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  primeHqContext(ctx)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  return { canvas, ctx }
}

function downsampleStepped(source, destW, destH) {
  let cur = source
  let w = source.width
  let h = source.height
  while (w > destW * 1.7 || h > destH * 1.7) {
    const nextW = Math.max(destW, Math.round(w * 0.5))
    const nextH = Math.max(destH, Math.round(h * 0.5))
    const { canvas: tmp, ctx } = makeAlphaCanvas(nextW, nextH)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, nextW, nextH)
    cur = tmp
    w = nextW
    h = nextH
  }
  if (w === destW && h === destH) return cur
  const srcCtx = cur.getContext?.('2d', { willReadFrequently: true })
  if (srcCtx?.getImageData) {
    const sampled = resamplePremultiplied(srcCtx.getImageData(0, 0, w, h), destW, destH)
    const { canvas: out, ctx } = makeAlphaCanvas(destW, destH)
    ctx.putImageData(sampled, 0, 0)
    return out
  }
  const { canvas: out, ctx } = makeAlphaCanvas(destW, destH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, destW, destH)
  return out
}

export const TEXT_BAND_RATIO = 0.65
export const TEXT_ZONE_MIN = 5
export const TEXT_ZONE_MAX = 50
export const TEXT_ZONE_DEFAULT = 20

function pixelLuma(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function pixelChroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

export function clampTextZonePercent(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return TEXT_ZONE_DEFAULT
  return Math.min(TEXT_ZONE_MAX, Math.max(TEXT_ZONE_MIN, n))
}

export function textBandStartY(height, bandStart = TEXT_BAND_RATIO) {
  return Math.max(0, Math.floor(Number(height) * (Number(bandStart) || TEXT_BAND_RATIO)))
}

export function textZoneStartY(height, textZonePercent = TEXT_ZONE_DEFAULT) {
  const h = Math.max(0, Number(height) || 0)
  const limit = h * (1 - clampTextZonePercent(textZonePercent) / 100)
  return Math.max(0, Math.min(h, Math.floor(limit) + 1))
}

export function textZoneBounds(height, textZonePercent = TEXT_ZONE_DEFAULT, textZoneAnchor = TEXT_ZONE_ANCHOR_DEFAULT) {
  const h = Math.max(0, Number(height) || 0)
  const pct = clampTextZonePercent(textZonePercent)
  if (textZoneAnchor === 'top') {
    const y1 = Math.max(0, Math.min(h, Math.round(h * pct / 100)))
    return { y0: 0, y1 }
  }
  return { y0: textZoneStartY(h, pct), y1: h }
}

function eachTextZoneY(height, options, visit) {
  const percent = options?.textZonePercent ?? TEXT_ZONE_DEFAULT
  const anchor = options?.textZoneAnchor === 'top' ? 'top' : TEXT_ZONE_ANCHOR_DEFAULT
  const { y0, y1 } = textZoneBounds(height, percent, anchor)
  for (let y = y0; y < y1; y += 1) visit(y)
  return { y0, y1 }
}

function isColorfulBodyPixel(r, g, b, a) {
  if (a < 28) return false
  const luma = pixelLuma(r, g, b)
  return pixelChroma(r, g, b) > 46 && luma > 28 && luma < 232
}

function isDarkTextInk(r, g, b, a) {
  if (a < 40) return false
  return r < 80 && g < 80 && b < 80
}

function isPaperPlatePixel(r, g, b, a) {
  if (a < 12) return false
  if (isDarkTextInk(r, g, b, a)) return false
  if (isColorfulBodyPixel(r, g, b, a)) return false
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  if (luma >= 198 && chroma < 40) return true
  return luma >= 186 && chroma < 28
}

function isDarkInkHalo(r, g, b, a) {
  if (a < 40) return false
  if (isDarkTextInk(r, g, b, a)) return false
  if (isColorfulBodyPixel(r, g, b, a)) return false
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  return luma < 152 && chroma < 28 && r < 152 && g < 152 && b < 152
}

function isDarkBrownInk(r, g, b, a) {
  if (a < 40) return false
  const luma = pixelLuma(r, g, b)
  const chroma = pixelChroma(r, g, b)
  return luma < 110 && chroma < 72 && r < 140 && g < 120 && b < 115
}

function isGlyphInkPixel(r, g, b, a, y = 0, height = 1) {
  if (a < 40) return false
  if (isDarkTextInk(r, g, b, a) || isDarkInkHalo(r, g, b, a)) return true
  if (y >= height * 0.26 && isDarkBrownInk(r, g, b, a)) return true
  return false
}

function resolveTextZoneStartY(height, { bandStart, textZonePercent } = {}) {
  if (textZonePercent != null || bandStart == null) {
    return textZoneStartY(height, textZonePercent ?? TEXT_ZONE_DEFAULT)
  }
  return textBandStartY(height, bandStart)
}

function bboxGap(a, b) {
  const sepX = a.maxX < b.minX ? b.minX - a.maxX - 1 : b.maxX < a.minX ? a.minX - b.maxX - 1 : 0
  const sepY = a.maxY < b.minY ? b.minY - a.maxY - 1 : b.maxY < a.minY ? a.minY - b.maxY - 1 : 0
  return { sepX, sepY }
}

function glyphComponentsClose(a, b) {
  const { sepX, sepY } = bboxGap(a, b)
  const ha = a.maxY - a.minY + 1
  const hb = b.maxY - b.minY + 1
  const wa = a.maxX - a.minX + 1
  const wb = b.maxX - b.minX + 1
  const allowY = Math.max(3, Math.round(0.4 * Math.min(ha, hb)))
  const allowX = Math.max(4, Math.round(0.35 * Math.min(wa, wb)))
  return sepX <= allowX && sepY <= allowY
}

function labelGlyphComponents(data, width, height, bandY0 = 0, bandY1 = height) {
  const total = width * height
  const parent = new Int32Array(total)
  parent.fill(-1)
  const y0 = Math.max(0, bandY0)
  const y1 = Math.min(height, bandY1)
  const inkAt = (p) => {
    const i = p * 4
    const y = (p / width) | 0
    return isGlyphInkPixel(data[i], data[i + 1], data[i + 2], data[i + 3], y, height)
  }
  const find = (start) => {
    let n = start
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]]
      n = parent[n]
    }
    return n
  }
  const unite = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      if (!inkAt(p)) continue
      parent[p] = p
      if (x > 0 && parent[p - 1] >= 0) unite(p, p - 1)
      if (y > y0 && parent[p - width] >= 0) unite(p, p - width)
      if (x > 0 && y > y0 && parent[p - width - 1] >= 0) unite(p, p - width - 1)
      if (x + 1 < width && y > y0 && parent[p - width + 1] >= 0) unite(p, p - width + 1)
    }
  }
  const comps = new Map()
  for (let p = 0; p < total; p += 1) {
    if (parent[p] < 0) continue
    const root = find(p)
    const x = p % width
    const y = (p / width) | 0
    let comp = comps.get(root)
    if (!comp) {
      comp = { pixels: [], minX: x, minY: y, maxX: x, maxY: y }
      comps.set(root, comp)
    }
    comp.pixels.push(p)
    if (x < comp.minX) comp.minX = x
    if (y < comp.minY) comp.minY = y
    if (x > comp.maxX) comp.maxX = x
    if (y > comp.maxY) comp.maxY = y
  }
  return [...comps.values()]
}

function isCaptionComponent(comp, width, height, anchor = 'bottom') {
  const area = comp.pixels.length
  if (area < 4) return false
  if (area > width * height * 0.12) return false
  if (comp.maxY - comp.minY + 1 > height * 0.42) return false
  const cy = (comp.minY + comp.maxY) * 0.5
  if (anchor === 'top') {
    if (cy > height * 0.55) return false
    return true
  }
  if (cy < height * 0.28) return false
  return true
}

function findCaptionRowBand(data, width, height, anchor = 'bottom') {
  const counts = new Float64Array(height)
  const minInk = Math.max(3, Math.round(width * 0.015))
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (isGlyphInkPixel(data[i], data[i + 1], data[i + 2], data[i + 3], y, height)) counts[y] += 1
    }
  }
  const smooth = new Float64Array(height)
  for (let y = 0; y < height; y += 1) {
    let sum = 0
    let n = 0
    for (let k = -2; k <= 2; k += 1) {
      const yy = y + k
      if (yy < 0 || yy >= height) continue
      sum += counts[yy]
      n += 1
    }
    smooth[y] = n ? sum / n : 0
  }
  if (anchor === 'top') {
    const limit = Math.floor(height * 0.58)
    let y0 = -1
    for (let y = 0; y < limit; y += 1) {
      if (smooth[y] >= minInk) {
        y0 = y
        break
      }
    }
    if (y0 < 0) return null
    let y1 = y0
    let gap = 0
    for (let y = y0 + 1; y < limit; y += 1) {
      if (smooth[y] >= minInk * 0.4) {
        y1 = y
        gap = 0
      } else {
        gap += 1
        if (gap > 6) break
      }
    }
    return { y0, y1: y1 + 1 }
  }
  const searchFrom = Math.floor(height * 0.26)
  let y1 = -1
  for (let y = height - 1; y >= searchFrom; y -= 1) {
    if (smooth[y] >= minInk) {
      y1 = y
      break
    }
  }
  if (y1 < 0) return null
  let y0 = y1
  let gap = 0
  const maxLine = Math.max(28, Math.round(height * 0.22))
  for (let y = y1 - 1; y >= searchFrom; y -= 1) {
    if (y1 - y > maxLine) break
    if (smooth[y] >= minInk * 0.4) {
      y0 = y
      gap = 0
    } else {
      gap += 1
      if (gap > 8) break
    }
  }
  return { y0, y1: y1 + 1 }
}

function planCaptionInk(imageData, options = {}) {
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  const mask = new Uint8Array(Math.max(0, width * height))
  const empty = { mask, y0: 0, y1: 0, minX: 0, maxX: -1, width, height, data, comps: [], accepted: new Set() }
  if (!data || !width || !height) return empty
  const opts = typeof options === 'number' ? { textZonePercent: TEXT_ZONE_DEFAULT } : options
  const percent = opts.textZonePercent ?? TEXT_ZONE_DEFAULT
  const anchor = opts.textZoneAnchor === 'top' ? 'top' : TEXT_ZONE_ANCHOR_DEFAULT
  const slider = textZoneBounds(height, percent, anchor)
  const rows = findCaptionRowBand(data, width, height, anchor) || slider
  const comps = labelGlyphComponents(data, width, height, rows.y0, rows.y1)
  const accepted = new Set()
  comps.forEach((comp, index) => {
    if (isCaptionComponent(comp, width, height, anchor)) accepted.add(index)
  })
  let minY = height
  let maxY = -1
  let minX = width
  let maxX = -1
  accepted.forEach((index) => {
    const comp = comps[index]
    if (comp.minY < minY) minY = comp.minY
    if (comp.maxY > maxY) maxY = comp.maxY
    if (comp.minX < minX) minX = comp.minX
    if (comp.maxX > maxX) maxX = comp.maxX
  })
  if (maxY < 0) {
    return { mask, y0: rows.y0, y1: rows.y1, minX: 0, maxX: -1, width, height, data, comps, accepted }
  }
  accepted.forEach((index) => {
    comps[index].pixels.forEach((p) => {
      mask[p] = 1
    })
  })
  return { mask, y0: minY, y1: maxY + 1, minX, maxX, width, height, data, comps, accepted }
}

export function buildTextGlyphMask(imageData, options = {}) {
  const plan = planCaptionInk(imageData, options)
  return { mask: plan.mask, y0: plan.y0, y1: plan.y1, width: plan.width, height: plan.height }
}

export function clearTextPlatePixels(imageData) {
  return imageData
}

function isStrokeInk(r, g, b, a) {
  return isDarkTextInk(r, g, b, a) || isDarkInkHalo(r, g, b, a)
}

function isLightGlyphFill(r, g, b, a) {
  if (a < 40) return false
  if (isStrokeInk(r, g, b, a)) return false
  if (isColorfulBodyPixel(r, g, b, a)) return false
  return pixelLuma(r, g, b) >= 140 && pixelChroma(r, g, b) < 48
}

function isSolidInkInterior(data, p, width, height) {
  const i = p * 4
  if (!isDarkTextInk(data[i], data[i + 1], data[i + 2], data[i + 3])) return false
  const x = p % width
  const y = (p / width) | 0
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (let d = 0; d < dirs.length; d += 1) {
    const nx = x + dirs[d][0]
    const ny = y + dirs[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false
    const ni = (ny * width + nx) * 4
    if (!isDarkTextInk(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) return false
  }
  return true
}

function isBorderInk(data, p, width, height) {
  const i = p * 4
  if (!isStrokeInk(data[i], data[i + 1], data[i + 2], data[i + 3])) return false
  const x = p % width
  const y = (p / width) | 0
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (let d = 0; d < dirs.length; d += 1) {
    const nx = x + dirs[d][0]
    const ny = y + dirs[d][1]
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true
    const ni = (ny * width + nx) * 4
    if (!isStrokeInk(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) return true
  }
  return false
}

function markSmallLightFills(data, width, height, x0, x1, y0, y1) {
  const fill = new Uint8Array(width * height)
  const seen = new Uint8Array(width * height)
  const maxArea = Math.round(width * height * 0.065)
  const dirs = [1, -1, width, -width]
  const floodX0 = Math.max(0, x0 - 2)
  const floodX1 = Math.min(width - 1, x1 + 2)
  const floodY0 = Math.max(0, y0 - 2)
  const floodY1 = Math.min(height, y1 + 2)
  const inside = (x, y) => x >= floodX0 && x <= floodX1 && y >= floodY0 && y < floodY1
  for (let y = floodY0; y < floodY1; y += 1) {
    for (let x = floodX0; x <= floodX1; x += 1) {
      const start = y * width + x
      if (seen[start]) continue
      const i = start * 4
      if (!isLightGlyphFill(data[i], data[i + 1], data[i + 2], data[i + 3])) continue
      const stack = [start]
      const pixels = []
      let touchesStroke = false
      let touchesColorful = false
      seen[start] = 1
      while (stack.length) {
        const p = stack.pop()
        pixels.push(p)
        const px = p % width
        const py = (p / width) | 0
        for (let d = 0; d < dirs.length; d += 1) {
          const n = p + dirs[d]
          const nx = n % width
          const ny = (n / width) | 0
          if (!inside(nx, ny)) continue
          if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue
          const ni = n * 4
          if (isColorfulBodyPixel(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) {
            touchesColorful = true
            continue
          }
          if (isStrokeInk(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) {
            touchesStroke = true
            continue
          }
          if (seen[n]) continue
          if (!isLightGlyphFill(data[ni], data[ni + 1], data[ni + 2], data[ni + 3])) continue
          seen[n] = 1
          stack.push(n)
        }
      }
      if (touchesColorful || !touchesStroke || pixels.length < 2 || pixels.length > maxArea) continue
      for (let n = 0; n < pixels.length; n += 1) {
        const py = (pixels[n] / width) | 0
        if (py < y0 || py >= y1) continue
        fill[pixels[n]] = 1
      }
    }
  }
  return fill
}

function pixelTouchesColorful(data, x, y, width, height) {
  for (let oy = -2; oy <= 2; oy += 1) {
    for (let ox = -2; ox <= 2; ox += 1) {
      if (!ox && !oy) continue
      const nx = x + ox
      const ny = y + oy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const i = (ny * width + nx) * 4
      if (isColorfulBodyPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) return true
    }
  }
  return false
}

export function paintCutCaption(target, text, size = KAKAO_STICKER_SIZE) {
  return paintVectorOverlayCaption(target, text, size)
}

export function applyTextTone(imageData, mode = 'original', customHex = '#111111', options = {}) {
  const engine = normalizeTextEngineMode(options.textEngineMode ?? options.engine)
  if (TEXT_RECOLOR_BYPASS && engine !== TEXT_ENGINE_SMART_RECOLOR) return imageData
  if (!imageData?.data || mode === 'original') return imageData
  const { data, width, height } = imageData
  const backup = new Uint8ClampedArray(data)
  try {
    const [tr, tg, tb] = parseHexColor(customHex)
    const textZonePercent = options.textZonePercent ?? TEXT_ZONE_DEFAULT
    const textZoneAnchor = options.textZoneAnchor === 'top' ? 'top' : TEXT_ZONE_ANCHOR_DEFAULT
    const plan = planCaptionInk(imageData, { textZonePercent, textZoneAnchor })
    const yMin = plan.y0
    const writeFloor = Math.floor(height * CHARACTER_WRITE_FLOOR_RATIO)
    const yThreshold = characterReadOnlyCeil(height, yMin)
    if (plan.maxX < 0 || !plan.accepted.size) return imageData
    const x0 = plan.minX
    const x1 = plan.maxX
    const y1 = plan.y1
    const lightFill = TEXT_STROKE_PRESERVE
      ? markSmallLightFills(backup, width, height, x0, x1, yMin, y1)
      : null
    const interior = new Uint8Array(width * height)
    if (TEXT_STROKE_PRESERVE) {
      for (let y = yMin; y < y1; y += 1) {
        if (y < yThreshold || y < writeFloor) continue
        for (let x = x0; x <= x1; x += 1) {
          const p = y * width + x
          if (isSolidInkInterior(backup, p, width, height)) interior[p] = 1
        }
      }
    }
    let fillHits = 0
    if (TEXT_STROKE_PRESERVE) {
      for (let y = yMin; y < y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const p = y * width + x
          if (interior[p] || (lightFill && lightFill[p])) fillHits += 1
        }
      }
      if (!fillHits) {
        for (let y = yMin; y < y1; y += 1) {
          if (y < yThreshold || y < writeFloor) continue
          for (let x = x0; x <= x1; x += 1) {
            const p = y * width + x
            if (!plan.mask[p]) continue
            if (isSolidInkInterior(backup, p, width, height) || !isBorderInk(backup, p, width, height)) {
              interior[p] = 1
            }
          }
        }
      }
    }
    for (let y = yMin; y < y1; y += 1) {
      if (y < yThreshold) continue
      if (TEXT_ROI_HARD_LOCK && y < writeFloor) continue
      for (let x = x0; x <= x1; x += 1) {
        const p = y * width + x
        const i = p * 4
        const pr = backup[i]
        const pg = backup[i + 1]
        const pb = backup[i + 2]
        const pa = backup[i + 3]
        const core = Boolean(interior[p])
        const enclosed = Boolean(lightFill && lightFill[p])
        if (TEXT_STROKE_PRESERVE && !core && !enclosed) continue
        if (isColorfulBodyPixel(pr, pg, pb, pa)) continue
        if (pixelTouchesColorful(backup, x, y, width, height)) continue
        const stroke = isStrokeInk(pr, pg, pb, pa) || isDarkBrownInk(pr, pg, pb, pa)
        if (TEXT_STROKE_PRESERVE && stroke && !core) continue
        if (!TEXT_STROKE_PRESERVE && !plan.mask[p]) continue
        let r = pr
        let g = pg
        let b = pb
        if (mode === 'black') {
          const luma = pixelLuma(pr, pg, pb)
          const t = 0.88 * (1 - luma / 255)
          r = pr * (1 - t)
          g = pg * (1 - t)
          b = pb * (1 - t)
        } else if (mode === 'white') {
          r = 255
          g = 255
          b = 255
        } else if (mode === 'custom') {
          r = tr
          g = tg
          b = tb
        }
        data[i] = Math.max(0, Math.min(255, Math.round(r)))
        data[i + 1] = Math.max(0, Math.min(255, Math.round(g)))
        data[i + 2] = Math.max(0, Math.min(255, Math.round(b)))
        data[i + 3] = pa
      }
    }
    return imageData
  } catch {
    data.set(backup)
    return imageData
  }
}

export function applyOutlineAssist(imageData) {
  return imageData
}

export function enhanceSliceImageData(imageData, { amount = 0.42, contrast = 1.07 } = {}) {
  if (!imageData?.data) return imageData
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)
  const mid = 128
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (src[i + 3] < 10) continue
      if (isPaperPlatePixel(src[i], src[i + 1], src[i + 2], src[i + 3])) continue
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0
        let count = 0
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = Math.max(0, Math.min(width - 1, x + ox))
            const ny = Math.max(0, Math.min(height - 1, y + oy))
            sum += src[(ny * width + nx) * 4 + channel]
            count += 1
          }
        }
        const value = src[i + channel]
        const blur = sum / count
        const diff = value - blur
        const edge = Math.min(1, Math.abs(diff) / 36)
        const adaptive = amount * (0.45 + edge * 0.85)
        const sharp = value + diff * adaptive
        const contrasted = (sharp - mid) * contrast + mid
        data[i + channel] = Math.max(0, Math.min(255, Math.round(contrasted)))
      }
    }
  }
  return imageData
}

function stripCropGuideResidue(imageData) {
  if (!imageData?.data) return imageData
  const { data, width, height } = imageData
  if (height < 4 || width < 8) return imageData
  const scoreRow = (y) => {
    let dark = 0
    let other = 0
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 18) continue
      const luma = pixelLuma(data[i], data[i + 1], data[i + 2])
      const chroma = pixelChroma(data[i], data[i + 1], data[i + 2])
      if (luma < 42 && chroma < 24) dark += 1
      else other += 1
    }
    return { dark, other }
  }
  const zeroRow = (y) => {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
  const maybeStrip = (y, neighborY) => {
    if (y < 0 || y >= height || neighborY < 0 || neighborY >= height) return
    const cur = scoreRow(y)
    const span = cur.dark + cur.other
    if (cur.dark < width * 0.28 || span < width * 0.32) return
    if (cur.other > cur.dark * 0.35) return
    const next = scoreRow(neighborY)
    if (next.dark > cur.dark * 0.45) return
    zeroRow(y)
  }
  maybeStrip(height - 1, height - 2)
  maybeStrip(0, 1)
  return imageData
}

export function fitToKakaoCanvas(source, box, {
  size = KAKAO_STICKER_SIZE,
  pad = KAKAO_SAFE_PAD,
  fitRatio = KAKAO_FIT_RATIO,
  transparent = true,
  background: _background,
  textMode = 'original',
  customColor = '#111111',
  outline = false,
  lockFrame = false,
  customScale = SLICE_SCALE_DEFAULT,
  textZonePercent = TEXT_ZONE_DEFAULT,
  textZoneAnchor = TEXT_ZONE_ANCHOR_DEFAULT,
  punchHoles = PUNCH_HOLES_DEFAULT,
  lossless,
} = {}) {
  void outline
  const inset = CROP_EDGE_INSET
  const sx = Math.max(0, Math.floor(box.x + 1e-9) + inset)
  const sy = Math.max(0, Math.floor(box.y + 1e-9) + inset)
  const sw = Math.max(1, Math.min(source.width - sx, Math.max(1, Math.round(box.w) - inset * 2)))
  const sh = Math.max(1, Math.min(source.height - sy, Math.max(1, Math.round(box.h) - inset * 2)))
  const bypass = lossless === true || (lossless !== false && sniffCanvasHasAlpha(source))
  const crop = processHighQualityCrop(source, sx, sy, sw, sh, {
    transparent,
    punchHoles: Boolean(punchHoles && !bypass),
    textZonePercent,
    textZoneAnchor,
    lossless: bypass,
  })
  const dwSrc = crop.width
  const dhSrc = crop.height
  const { canvas, ctx } = makeAlphaCanvas(size, size)
  if (!transparent) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
  }
  const innerRatio = lockFrame ? fitRatio : (1 - pad * 2)
  const fit = applyCustomSliceScale(containFitRect(dwSrc, dhSrc, size, innerRatio), customScale, size)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (bypass) {
    ctx.drawImage(crop, 0, 0, dwSrc, dhSrc, fit.renderX, fit.renderY, fit.renderW, fit.renderH)
    void textMode
    void customColor
    return canvas
  }
  const factor = 3
  const { canvas: hi, ctx: hiCtx } = makeAlphaCanvas(Math.max(2, fit.renderW * factor), Math.max(2, fit.renderH * factor))
  hiCtx.imageSmoothingEnabled = true
  hiCtx.imageSmoothingQuality = 'high'
  hiCtx.drawImage(crop, 0, 0, dwSrc, dhSrc, 0, 0, hi.width, hi.height)
  const scaled = downsampleStepped(hi, fit.renderW, fit.renderH)
  ctx.drawImage(scaled, fit.renderX, fit.renderY)
  const pixels = ctx.getImageData(0, 0, size, size)
  flattenTransparentPixels(pixels)
  ctx.putImageData(pixels, 0, 0)
  void textMode
  void customColor
  return canvas
}

export async function fileToSheetCanvas(file) {
  const image = await loadImage(file)
  return imageToCanvas(image)
}

export function sliceSheet(source, {
  mode = 'smart',
  cols = DEFAULT_SHEET_COLS,
  rows = DEFAULT_SHEET_ROWS,
  transparent = true,
  verticalGuides,
  horizontalGuides,
  bounds,
  textMode = 'original',
  customColor = '#111111',
  outline = false,
  customScale = SLICE_SCALE_DEFAULT,
  textZonePercent = TEXT_ZONE_DEFAULT,
  textZoneAnchor = TEXT_ZONE_ANCHOR_DEFAULT,
  punchHoles = PUNCH_HOLES_DEFAULT,
  textEngineMode = TEXT_ENGINE_DEFAULT,
  lossless,
} = {}) {
  const analyzed = analyzeSheet(source)
  const bypass = lossless === true || (lossless !== false && sniffImageDataHasAlpha(analyzed.data))
  const crop = normalizeBounds(bounds)
  const scale = analyzed.scale || 1
  const projected = mode === 'grid' ? { cells: [] } : detectSmartEmoticonGrid(analyzed.data)
  const projectedBoxes = (projected.cells || []).map((box) => ({
    x: box.x / scale,
    y: box.y / scale,
    w: (box.w || box.width) / scale,
    h: (box.h || box.height) / scale,
  }))
  const raw = mode === 'grid'
    ? splitGridBoxes(source.width, source.height, cols, rows, verticalGuides, horizontalGuides, crop)
    : (projectedBoxes.length >= 2
      ? projectedBoxes
      : splitMergedSmartBoxes(findContentBoxes(analyzed.data).map((box) => ({
        x: box.x / scale,
        y: box.y / scale,
        w: box.w / scale,
        h: box.h / scale,
        count: box.count,
      }))))
  const boxes = mode === 'grid' ? raw : expandSmartBoxFooters(source, raw, crop)
  const gridMeta = mode === 'grid'
    ? { rows, cols, count: boxes.length, engine: 'grid' }
    : {
      ...inferGuidesFromSmartBoxes(boxes, source.width, source.height),
      engine: projected.engine || 'projection',
      count: boxes.length,
    }
  const items = boxes.map((box, index) => {
    const canvas = fitToKakaoCanvas(source, box, {
      transparent,
      textMode,
      customColor,
      outline,
      lockFrame: mode === 'grid',
      pad: mode === 'grid' ? KAKAO_SAFE_PAD : MODE_A_SAFE_PAD,
      customScale,
      textZonePercent,
      textZoneAnchor,
      punchHoles: Boolean(transparent && punchHoles && !bypass),
      lossless: bypass,
    })
    applyTextEngine(canvas, {
      textEngineMode,
      index,
      size: KAKAO_STICKER_SIZE,
      paintVector: (target, caption) => paintCutCaption(target, caption, KAKAO_STICKER_SIZE),
      recolorPixels: (target) => {
        const sliceCtx = target.getContext('2d')
        if (!sliceCtx) return
        const tone = sliceCtx.getImageData(0, 0, target.width, target.height)
        applyTextTone(tone, textMode, customColor, {
          textZonePercent,
          textZoneAnchor,
          textEngineMode: TEXT_ENGINE_SMART_RECOLOR,
        })
        sliceCtx.putImageData(tone, 0, 0)
      },
    })
    const cutIndex = index + 1
    console.log('[Splitter Live]', cutIndex, '처리 완료')
    const name = `kakao-360-${String(cutIndex).padStart(2, '0')}.png`
    const diagnostics = inspectRenderedSlice({
      canvas,
      source,
      box,
      index,
      name,
      mode,
      textMode,
      outline,
      customScale,
      textZonePercent,
      textZoneAnchor,
      punchHoles: Boolean(transparent && punchHoles && !bypass),
      transparent,
      lossless: bypass,
    })
    return {
      id: `emo-${cutIndex}`,
      index,
      name,
      canvas,
      preview: canvas.toDataURL('image/png'),
      lossless: bypass,
      diagnostics,
      gridMeta,
      box,
    }
  })
  items.gridMeta = gridMeta
  return items
}
