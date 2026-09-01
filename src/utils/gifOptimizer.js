const DEFAULT_SIZE = 360
const cache = new WeakMap()

function sizeKey(width, height) {
  return `${Math.max(1, Math.round(width))}x${Math.max(1, Math.round(height))}`
}

function sourceSize(image) {
  return {
    width: Math.max(1, image?.naturalWidth || image?.width || 1),
    height: Math.max(1, image?.naturalHeight || image?.height || 1),
  }
}

export function coverCropRect(srcW, srcH, destW, destH) {
  const sw = Math.max(1, Number(srcW) || 1)
  const sh = Math.max(1, Number(srcH) || 1)
  const tw = Math.max(1, Number(destW) || 1)
  const th = Math.max(1, Number(destH) || 1)
  const srcAspect = sw / sh
  const dstAspect = tw / th
  if (srcAspect > dstAspect) {
    const cw = sh * dstAspect
    return { sx: (sw - cw) / 2, sy: 0, sw: cw, sh }
  }
  const ch = sw / dstAspect
  return { sx: 0, sy: (sh - ch) / 2, sw, sh: ch }
}

function makeCanvas(width, height, alpha = false) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha, willReadFrequently: false })
  if (!ctx) throw new Error('배경 최적화 캔버스를 만들 수 없습니다.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  return { canvas, ctx }
}

function remember(source, key, canvas) {
  if (!source || typeof source !== 'object') return canvas
  let bucket = cache.get(source)
  if (!bucket) {
    bucket = new Map()
    cache.set(source, bucket)
  }
  bucket.set(key, canvas)
  return canvas
}

export function getCachedBackground(source, width = DEFAULT_SIZE, height = DEFAULT_SIZE) {
  if (!source) return null
  const key = sizeKey(width, height)
  const iw = source.naturalWidth || source.width || 0
  const ih = source.naturalHeight || source.height || 0
  if (source.getContext && iw === width && ih === height) return source
  return cache.get(source)?.get(key) || null
}

export function coverBitmapSync(image, targetWidth = DEFAULT_SIZE, targetHeight = DEFAULT_SIZE) {
  if (!image) return null
  const width = Math.max(1, Math.round(targetWidth))
  const height = Math.max(1, Math.round(targetHeight))
  const hit = getCachedBackground(image, width, height)
  if (hit) return hit
  const { width: sw, height: sh } = sourceSize(image)
  const { canvas, ctx } = makeCanvas(width, height, false)
  const crop = coverCropRect(sw, sh, width, height)
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
  remember(image, sizeKey(width, height), canvas)
  remember(canvas, sizeKey(width, height), canvas)
  return canvas
}

function loadImageSource(fileOrUrl) {
  return new Promise((resolve, reject) => {
    if (!fileOrUrl) {
      reject(new Error('배경 이미지가 없습니다.'))
      return
    }
    if (typeof HTMLCanvasElement !== 'undefined' && fileOrUrl instanceof HTMLCanvasElement) {
      resolve(fileOrUrl)
      return
    }
    if (typeof Image !== 'undefined' && fileOrUrl instanceof Image) {
      if ((fileOrUrl.naturalWidth || fileOrUrl.width) > 0) {
        resolve(fileOrUrl)
        return
      }
      fileOrUrl.onload = () => resolve(fileOrUrl)
      fileOrUrl.onerror = () => reject(new Error('배경 이미지를 읽지 못했습니다.'))
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('배경 이미지를 읽지 못했습니다.'))
    if (typeof File !== 'undefined' && fileOrUrl instanceof File) {
      img.src = URL.createObjectURL(fileOrUrl)
      return
    }
    img.src = String(fileOrUrl)
  })
}

export async function optimizeBackgroundImage(fileOrUrl, targetWidth = DEFAULT_SIZE, targetHeight = DEFAULT_SIZE) {
  const width = Math.max(1, Math.round(targetWidth))
  const height = Math.max(1, Math.round(targetHeight))
  const image = await loadImageSource(fileOrUrl)
  const cached = getCachedBackground(image, width, height)
  if (cached) return cached
  const { width: sw, height: sh } = sourceSize(image)
  const crop = coverCropRect(sw, sh, width, height)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(image, Math.round(crop.sx), Math.round(crop.sy), Math.max(1, Math.round(crop.sw)), Math.max(1, Math.round(crop.sh)), {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'medium',
      })
      const { canvas, ctx } = makeCanvas(width, height, false)
      ctx.drawImage(bitmap, 0, 0, width, height)
      if (typeof bitmap.close === 'function') bitmap.close()
      remember(image, sizeKey(width, height), canvas)
      remember(canvas, sizeKey(width, height), canvas)
      return canvas
    } catch {
      /* fall through to canvas cover */
    }
  }
  return coverBitmapSync(image, width, height)
}

export async function prepareEncodeBackground(bgConfig, targetWidth = DEFAULT_SIZE, targetHeight = DEFAULT_SIZE) {
  const type = bgConfig?.type
  if (!bgConfig || type === 'transparent' || type === 'none' || !type || type === 'gradient' || type === 'solid') {
    return bgConfig || { type: 'transparent' }
  }
  const source = bgConfig.optimizedCanvas || bgConfig.image
  if (!source) return bgConfig
  const optimized = await optimizeBackgroundImage(source, targetWidth, targetHeight)
  return {
    ...bgConfig,
    type: 'image',
    image: optimized,
    optimizedCanvas: optimized,
  }
}

export function yieldEncoderTick() {
  if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
    return scheduler.yield()
  }
  return new Promise((resolve) => {
    const kick = () => setTimeout(resolve, 0)
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(kick)
      return
    }
    kick()
  })
}
