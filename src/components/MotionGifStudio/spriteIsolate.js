const ALPHA_KEEP = 15
const cropCache = new WeakMap()

function readRgba(source, width, height) {
  if (typeof source?.getContext === 'function') {
    try {
      const direct = source.getContext('2d', { willReadFrequently: true })
      if (direct) return { data: direct.getImageData(0, 0, width, height).data, scratch: null }
    } catch {
      /* ImageBitmap / tainted canvas */
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { data: null, scratch: canvas }
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0)
  return { data: ctx.getImageData(0, 0, width, height).data, scratch: canvas }
}

export function extractCharacterBoundingBox(source, alphaCut = ALPHA_KEEP) {
  const width = Math.max(1, Math.round(source?.naturalWidth || source?.width || 0))
  const height = Math.max(1, Math.round(source?.naturalHeight || source?.height || 0))
  if (width < 2 || height < 2) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, found: false, width, height }
  }
  const { data, scratch } = readRgba(source, width, height)
  if (scratch) {
    scratch.width = 0
    scratch.height = 0
  }
  if (!data) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, found: false, width, height }
  }
  const cut = Math.max(1, Number(alphaCut) || ALPHA_KEEP)
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= cut) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, found: false, width, height }
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    found: true,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

export function cropTransparentSprite(img, alphaCut = ALPHA_KEEP) {
  if (!img) return img
  const cached = cropCache.get(img)
  if (cached) return cached
  const box = extractCharacterBoundingBox(img, alphaCut)
  if (!box.found) {
    cropCache.set(img, img)
    return img
  }
  const cropped = document.createElement('canvas')
  cropped.width = box.width
  cropped.height = box.height
  const ctx = cropped.getContext('2d', { alpha: true })
  if (!ctx) {
    cropCache.set(img, img)
    return img
  }
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, box.width, box.height)
  ctx.drawImage(img, box.minX, box.minY, box.width, box.height, 0, 0, box.width, box.height)
  cropCache.set(img, cropped)
  return cropped
}

export function forgetCroppedSprite(img) {
  if (img && cropCache.has(img)) cropCache.delete(img)
}

export function resolveMotionSprite(source, isolate = true) {
  if (!source) return source
  return isolate === false ? source : cropTransparentSprite(source)
}

export function cropSpriteWithFeedback(img, alphaCut = ALPHA_KEEP) {
  if (!img) return { croppedCanvas: img, bounds: null }
  const box = extractCharacterBoundingBox(img, alphaCut)
  const croppedCanvas = cropTransparentSprite(img, alphaCut)
  if (!box.found) return { croppedCanvas: img, bounds: null }
  const origW = Math.max(1, Math.round(img.naturalWidth || img.width || box.width))
  const origH = Math.max(1, Math.round(img.naturalHeight || img.height || box.height))
  return {
    croppedCanvas,
    bounds: {
      minX: box.minX,
      minY: box.minY,
      maxX: box.maxX,
      maxY: box.maxY,
      width: box.width,
      height: box.height,
      origW,
      origH,
    },
  }
}

export function detectionHighlightRect(bounds, width = 360, height = 360, fit = 0.8) {
  if (!bounds?.width || !bounds?.height) return null
  const maxDim = Math.min(width * fit, height * fit)
  const aspect = bounds.width / Math.max(1, bounds.height)
  const drawW = aspect > 1 ? maxDim : maxDim * aspect
  const drawH = aspect > 1 ? maxDim / aspect : maxDim
  return {
    left: width / 2 - drawW / 2,
    top: height / 2 - drawH / 2,
    drawW,
    drawH,
  }
}

export function drawDetectionOutline(ctx, bounds, width = 360, height = 360) {
  if (!ctx || !bounds) return false
  const box = detectionHighlightRect(bounds, width, height, 0.8)
  if (!box) return false
  const { left, top, drawW, drawH } = box
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.strokeStyle = '#06b6d4'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.strokeRect(left, top, drawW, drawH)
  ctx.setLineDash([])
  ctx.fillStyle = '#06b6d4'
  const corner = 6
  ctx.fillRect(left - corner / 2, top - corner / 2, corner, corner)
  ctx.fillRect(left + drawW - corner / 2, top - corner / 2, corner, corner)
  ctx.fillRect(left - corner / 2, top + drawH - corner / 2, corner, corner)
  ctx.fillRect(left + drawW - corner / 2, top + drawH - corner / 2, corner, corner)
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`추출 영역: ${bounds.width}×${bounds.height}px`, left, top - 6)
  ctx.restore()
  return true
}
