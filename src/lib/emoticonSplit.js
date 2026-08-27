export const KAKAO_STICKER_SIZE = 360
export const KAKAO_SAFE_PAD = 0.06
export const KAKAO_FIT_RATIO = 0.88
export const MODE_A_SAFE_PAD = 0.08

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

function knockoutImageData(imageData, bg, threshold = 42) {
  const data = imageData.data
  const soft = threshold + 28
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 18) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    }
    if (bg[3] < 18) continue
    const dist = colorDist(data[i], data[i + 1], data[i + 2], bg)
    if (dist <= threshold) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    } else if (dist < soft) {
      data[i + 3] = Math.round(data[i + 3] * ((dist - threshold) / (soft - threshold)))
    }
  }
  return imageData
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

function makeAlphaCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
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
  const { canvas: out, ctx } = makeAlphaCanvas(destW, destH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, destW, destH)
  return out
}

export const TEXT_BAND_RATIO = 0.65

function pixelLuma(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function pixelChroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

export function textBandStartY(height, bandStart = TEXT_BAND_RATIO) {
  return Math.max(0, Math.floor(Number(height) * (Number(bandStart) || TEXT_BAND_RATIO)))
}

function isColorfulBodyPixel(r, g, b, a) {
  if (a < 28) return false
  const luma = pixelLuma(r, g, b)
  return pixelChroma(r, g, b) > 46 && luma > 28 && luma < 232
}

function nearColorfulBody(data, width, height, x, y) {
  for (let dy = -5; dy <= 1; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const i = (ny * width + nx) * 4
      if (isColorfulBodyPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) return true
    }
  }
  return false
}

export function buildTextGlyphMask(imageData, bandStart = TEXT_BAND_RATIO) {
  const width = imageData?.width || 0
  const height = imageData?.height || 0
  const data = imageData?.data
  const mask = new Uint8Array(Math.max(0, width * height))
  if (!data || !width || !height) return { mask, y0: 0, width, height }
  const y0 = textBandStartY(height, bandStart)
  const raw = new Uint8Array(width * height)
  for (let y = y0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < 28) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (isColorfulBodyPixel(r, g, b, a)) continue
      const luma = pixelLuma(r, g, b)
      const ink = luma <= 102 || luma >= 208
      if (!ink && nearColorfulBody(data, width, height, x, y)) continue
      let edge = 0
      const n = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (let k = 0; k < n.length; k += 1) {
        const nx = x + n[k][0]
        const ny = y + n[k][1]
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const ni = (ny * width + nx) * 4
        if (data[ni + 3] < 12) {
          edge = Math.max(edge, luma)
          continue
        }
        edge = Math.max(edge, Math.abs(luma - pixelLuma(data[ni], data[ni + 1], data[ni + 2])))
      }
      if (!ink && edge < 34) continue
      if (edge < 16 && luma > 108 && luma < 188) continue
      raw[y * width + x] = 1
    }
  }
  for (let y = y0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      if (!raw[p]) continue
      let cluster = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          if (raw[ny * width + nx]) cluster += 1
        }
      }
      const i = p * 4
      const luma = pixelLuma(data[i], data[i + 1], data[i + 2])
      if (cluster >= 2 || luma <= 48 || luma >= 230) mask[p] = 1
    }
  }
  return { mask, y0, width, height }
}

export function applyTextTone(imageData, mode = 'original', customHex = '#111111', { bandStart = TEXT_BAND_RATIO } = {}) {
  if (!imageData?.data || mode === 'original') return imageData
  const { data, width, height } = imageData
  const [tr, tg, tb] = parseHexColor(customHex)
  const { mask, y0 } = buildTextGlyphMask(imageData, bandStart)
  for (let y = y0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      const i = (y * width + x) * 4
      const luma = pixelLuma(data[i], data[i + 1], data[i + 2]) / 255
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      if (mode === 'black') {
        const t = 0.88 * (1 - luma)
        r = r * (1 - t)
        g = g * (1 - t)
        b = b * (1 - t)
      } else if (mode === 'white') {
        const t = 0.86
        r = r + (255 - r) * t
        g = g + (255 - g) * t
        b = b + (255 - b) * t
      } else if (mode === 'custom') {
        const t = 0.92
        r = r + (tr - r) * t
        g = g + (tg - g) * t
        b = b + (tb - b) * t
      }
      data[i] = Math.max(0, Math.min(255, Math.round(r)))
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)))
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)))
    }
  }
  return imageData
}

export function applyOutlineAssist(imageData, hex = '#111111', { bandStart = TEXT_BAND_RATIO } = {}) {
  if (!imageData?.data) return imageData
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)
  const [sr, sg, sb] = parseHexColor(hex, [12, 12, 14])
  const { mask, y0 } = buildTextGlyphMask({ data: src, width, height }, bandStart)
  const n = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (let y = y0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      if (src[i + 3] >= 18) continue
      const hit = n.some(([dx, dy]) => {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false
        return mask[ny * width + nx] === 1
      })
      if (!hit) continue
      data[i] = sr
      data[i + 1] = sg
      data[i + 2] = sb
      data[i + 3] = 220
    }
  }
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

export function fitToKakaoCanvas(source, box, {
  size = KAKAO_STICKER_SIZE,
  pad = KAKAO_SAFE_PAD,
  fitRatio = KAKAO_FIT_RATIO,
  transparent = true,
  background,
  textMode = 'original',
  customColor = '#111111',
  outline = false,
  lockFrame = false,
} = {}) {
  const sx = Math.max(0, Math.floor(box.x + 1e-9))
  const sy = Math.max(0, Math.floor(box.y + 1e-9))
  const sw = Math.max(1, Math.min(source.width - sx, Math.max(1, Math.round(box.w))))
  const sh = Math.max(1, Math.min(source.height - sy, Math.max(1, Math.round(box.h))))
  const { canvas: crop, ctx: cropCtx } = makeAlphaCanvas(sw, sh)
  cropCtx.imageSmoothingEnabled = true
  cropCtx.imageSmoothingQuality = 'high'
  cropCtx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  let dx = 0
  let dy = 0
  let dwSrc = sw
  let dhSrc = sh
  if (transparent) {
    const img = cropCtx.getImageData(0, 0, sw, sh)
    const bg = background || sampleBackground(img.data, sw, sh)
    knockoutImageData(img, bg)
    flattenTransparentPixels(img)
    cropCtx.putImageData(img, 0, 0)
    if (!lockFrame) {
      const trimmed = opaqueBounds(img)
      dx = trimmed.x
      dy = trimmed.y
      dwSrc = trimmed.w
      dhSrc = trimmed.h
    }
  }
  const { canvas, ctx } = makeAlphaCanvas(size, size)
  if (transparent) {
    ctx.clearRect(0, 0, size, size)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
  }
  const innerRatio = lockFrame ? fitRatio : (1 - pad * 2)
  const fit = containFitRect(dwSrc, dhSrc, size, innerRatio)
  const factor = 3
  const { canvas: hi, ctx: hiCtx } = makeAlphaCanvas(Math.max(2, fit.renderW * factor), Math.max(2, fit.renderH * factor))
  hiCtx.imageSmoothingEnabled = true
  hiCtx.imageSmoothingQuality = 'high'
  hiCtx.drawImage(crop, dx, dy, dwSrc, dhSrc, 0, 0, hi.width, hi.height)
  const scaled = downsampleStepped(hi, fit.renderW, fit.renderH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(scaled, fit.renderX, fit.renderY)
  const enhanced = ctx.getImageData(0, 0, size, size)
  enhanceSliceImageData(enhanced)
  applyTextTone(enhanced, textMode, customColor)
  if (outline) {
    const stroke = textMode === 'white' ? '#ffffff' : textMode === 'custom' ? customColor : '#111111'
    applyOutlineAssist(enhanced, stroke)
  }
  flattenTransparentPixels(enhanced)
  ctx.putImageData(enhanced, 0, 0)
  return canvas
}

export async function fileToSheetCanvas(file) {
  const image = await loadImage(file)
  return imageToCanvas(image)
}

export function sliceSheet(source, {
  mode = 'smart',
  cols = 6,
  rows = 5,
  transparent = true,
  verticalGuides,
  horizontalGuides,
  bounds,
  textMode = 'original',
  customColor = '#111111',
  outline = false,
} = {}) {
  const analyzed = analyzeSheet(source)
  const bg = sampleBackground(analyzed.data.data, analyzed.data.width, analyzed.data.height)
  const crop = normalizeBounds(bounds)
  const raw = mode === 'grid'
    ? splitGridBoxes(source.width, source.height, cols, rows, verticalGuides, horizontalGuides, crop)
    : findContentBoxes(analyzed.data).map((box) => ({
      x: box.x / analyzed.scale,
      y: box.y / analyzed.scale,
      w: box.w / analyzed.scale,
      h: box.h / analyzed.scale,
      count: box.count,
    }))
  const boxes = mode === 'grid'
    ? raw.map((box) => {
      const nextY = raw
        .map((item) => item.y)
        .filter((item) => item > box.y + 1)
        .sort((a, b) => a - b)[0]
      const bleed = Math.round(Math.max(8, box.h * 0.18))
      const limitY = nextY != null ? Math.min(source.height, nextY + bleed) : source.height
      return expandBoxFooter(source, box, limitY)
    })
    : raw
  return boxes.map((box, index) => {
    const canvas = fitToKakaoCanvas(source, box, {
      transparent,
      background: bg,
      textMode,
      customColor,
      outline,
      lockFrame: mode === 'grid',
      pad: mode === 'grid' ? KAKAO_SAFE_PAD : MODE_A_SAFE_PAD,
    })
    return {
      id: `emo-${index + 1}`,
      index,
      name: `kakao-360-${String(index + 1).padStart(2, '0')}.png`,
      canvas,
      preview: canvas.toDataURL('image/png'),
    }
  })
}
