const DRAFT_KEY = 'styler-pixel-draft-v1'
const HISTORY_MAX = 30

export function sourceSize(source) {
  return {
    width: Math.max(1, Math.round(source?.naturalWidth || source?.width || 360)),
    height: Math.max(1, Math.round(source?.naturalHeight || source?.height || 360)),
  }
}

export function readSourceImageData(source) {
  const { width, height } = sourceSize(source)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)
  if (source) ctx.drawImage(source, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)
  canvas.width = 0
  canvas.height = 0
  return imageData
}

export function renderLoupeGrid(loupeCanvas, sourceCanvas, maskArray, centerX, centerY) {
  if (!loupeCanvas?.getContext || !sourceCanvas) return { startX: 0, startY: 0, size: 50 }
  const ctx = loupeCanvas.getContext('2d')
  const size = 50
  const half = Math.floor(size / 2)
  const pixelScale = Math.max(6, Math.floor((loupeCanvas.width || 350) / size))
  const srcW = Math.max(1, Math.round(sourceCanvas.width || sourceCanvas.naturalWidth || 1))
  const srcH = Math.max(1, Math.round(sourceCanvas.height || sourceCanvas.naturalHeight || 1))
  const startX = Math.max(0, Math.min(srcW - size, Math.round(centerX) - half))
  const startY = Math.max(0, Math.min(srcH - size, Math.round(centerY) - half))
  const scratch = document.createElement('canvas')
  scratch.width = srcW
  scratch.height = srcH
  const scratchCtx = scratch.getContext('2d', { willReadFrequently: true })
  if (!ctx || !scratchCtx) return { startX, startY, size }
  scratchCtx.imageSmoothingEnabled = false
  scratchCtx.drawImage(sourceCanvas, 0, 0)
  const cropW = Math.min(size, srcW - startX)
  const cropH = Math.min(size, srcH - startY)
  const imgData = scratchCtx.getImageData(startX, startY, cropW, cropH)
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x >= cropW || y >= cropH) continue
      const srcIdx = (y * cropW + x) * 4
      const maskIdx = (startY + y) * srcW + (startX + x)
      const r = imgData.data[srcIdx] || 0
      const g = imgData.data[srcIdx + 1] || 0
      const b = imgData.data[srcIdx + 2] || 0
      const a = imgData.data[srcIdx + 3] || 0
      ctx.fillStyle = a === 0 ? 'rgba(200,200,200,0.2)' : `rgba(${r},${g},${b},${a / 255})`
      ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale)
      if (maskArray?.[maskIdx]) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.55)'
        ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale)
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.strokeRect(x * pixelScale + 0.5, y * pixelScale + 0.5, pixelScale - 1, pixelScale - 1)
    }
  }
  scratch.width = 0
  scratch.height = 0
  return { startX, startY, size, pixelScale }
}

export function extractSpriteFromMask(source, mask) {
  const { width, height } = sourceSize(source)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { alpha: true })
  if (!ctx || !source) return source
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0)
  const image = ctx.getImageData(0, 0, width, height)
  const { data } = image
  const limit = Math.min(mask?.length || 0, width * height)
  for (let i = 0; i < limit; i += 1) {
    if (!mask[i]) data[i * 4 + 3] = 0
  }
  ctx.putImageData(image, 0, 0)
  return out
}

function packMask(mask) {
  let bits = ''
  for (let i = 0; i < mask.length; i += 1) bits += mask[i] ? '1' : '0'
  return bits
}

function unpackMask(packed, length) {
  const mask = new Uint8Array(length)
  const text = String(packed || '')
  for (let i = 0; i < length; i += 1) mask[i] = text[i] === '1' ? 255 : 0
  return mask
}

export class PurePixelSelectionEngine {
  constructor(width, height) {
    this.width = Math.max(1, Math.round(width) || 1)
    this.height = Math.max(1, Math.round(height) || 1)
    this.mask = new Uint8Array(this.width * this.height)
    this.history = []
    this.redoStack = []
    this.saveHistory()
  }

  selectedCount() {
    let count = 0
    for (let i = 0; i < this.mask.length; i += 1) {
      if (this.mask[i]) count += 1
    }
    return count
  }

  saveHistory() {
    this.history.push(new Uint8Array(this.mask))
    if (this.history.length > HISTORY_MAX) this.history.shift()
    this.redoStack = []
  }

  undo() {
    if (this.history.length <= 1) return false
    this.redoStack.push(this.history.pop())
    this.mask = new Uint8Array(this.history[this.history.length - 1])
    return true
  }

  redo() {
    if (!this.redoStack.length) return false
    const state = this.redoStack.pop()
    this.history.push(state)
    this.mask = new Uint8Array(state)
    return true
  }

  clear() {
    this.mask.fill(0)
    this.saveHistory()
  }

  paint(cx, cy, brushSize = 1, isErase = false) {
    const radius = Math.max(0, Math.floor(brushSize / 2))
    const value = isErase ? 0 : 255
    const x0 = Math.round(cx)
    const y0 = Math.round(cy)
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const px = x0 + dx
        const py = y0 + dy
        if (px < 0 || py < 0 || px >= this.width || py >= this.height) continue
        this.mask[py * this.width + px] = value
      }
    }
  }

  paintStroke(x0, y0, x1, y1, brushSize = 1, isErase = false) {
    const dist = Math.hypot(x1 - x0, y1 - y0)
    const steps = Math.max(1, Math.ceil(dist))
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      this.paint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, brushSize, isErase)
    }
  }

  magicWand(srcData, startX, startY, tolerance = 15) {
    const width = this.width
    const height = this.height
    const sx = Math.round(startX)
    const sy = Math.round(startY)
    if (sx < 0 || sy < 0 || sx >= width || sy >= height || !srcData) return
    const tIdx = (sy * width + sx) * 4
    const tR = srcData[tIdx]
    const tG = srcData[tIdx + 1]
    const tB = srcData[tIdx + 2]
    const tA = srcData[tIdx + 3]
    const visited = new Uint8Array(width * height)
    const queue = [sx, sy]
    while (queue.length) {
      const cy = queue.pop()
      const cx = queue.pop()
      const idx = cy * width + cx
      if (visited[idx]) continue
      visited[idx] = 1
      const p = idx * 4
      const match = Math.abs(srcData[p] - tR) <= tolerance
        && Math.abs(srcData[p + 1] - tG) <= tolerance
        && Math.abs(srcData[p + 2] - tB) <= tolerance
        && Math.abs(srcData[p + 3] - tA) <= tolerance
      if (!match) continue
      this.mask[idx] = 255
      if (cx > 0 && !visited[idx - 1]) queue.push(cx - 1, cy)
      if (cx < width - 1 && !visited[idx + 1]) queue.push(cx + 1, cy)
      if (cy > 0 && !visited[idx - width]) queue.push(cx, cy - 1)
      if (cy < height - 1 && !visited[idx + width]) queue.push(cx, cy + 1)
    }
    this.saveHistory()
  }

  grow() {
    const next = new Uint8Array(this.mask)
    const { width, height, mask } = this
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!mask[y * width + x]) continue
        if (x > 0) next[y * width + x - 1] = 255
        if (x < width - 1) next[y * width + x + 1] = 255
        if (y > 0) next[(y - 1) * width + x] = 255
        if (y < height - 1) next[(y + 1) * width + x] = 255
      }
    }
    this.mask = next
    this.saveHistory()
  }

  shrink() {
    const next = new Uint8Array(this.mask.length)
    const { width, height, mask } = this
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x
        if (!mask[idx]) continue
        const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
          || !mask[idx - 1] || !mask[idx + 1] || !mask[idx - width] || !mask[idx + width]
        if (!edge) next[idx] = 255
      }
    }
    this.mask = next
    this.saveHistory()
  }

  invert() {
    for (let i = 0; i < this.mask.length; i += 1) this.mask[i] = this.mask[i] ? 0 : 255
    this.saveHistory()
  }

  saveDraft() {
    const payload = JSON.stringify({
      width: this.width,
      height: this.height,
      mask: packMask(this.mask),
    })
    try {
      window.localStorage.setItem(DRAFT_KEY, payload)
      return payload
    } catch {
      return JSON.stringify(Array.from(this.mask))
    }
  }

  loadDraft(jsonStr) {
    try {
      const raw = jsonStr || window.localStorage.getItem(DRAFT_KEY)
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed)) {
        if (parsed.length !== this.mask.length) return false
        this.mask = new Uint8Array(parsed)
        this.saveHistory()
        return true
      }
      if (!parsed || Number(parsed.width) !== this.width || Number(parsed.height) !== this.height) return false
      this.mask = unpackMask(parsed.mask, this.width * this.height)
      this.saveHistory()
      return true
    } catch {
      return false
    }
  }
}
