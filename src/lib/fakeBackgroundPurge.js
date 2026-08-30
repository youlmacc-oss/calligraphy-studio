export async function canvasFromUrl(url) {
  if (!url) return null
  const image = await new Promise((resolve, reject) => {
    const node = new Image()
    node.crossOrigin = 'anonymous'
    node.onload = () => resolve(node)
    node.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    node.src = url
  })
  return sourceToCanvas(image)
}

export function sourceToCanvas(source) {
  if (!source) return null
  if (source.getContext && source.width && source.height) return source
  const width = Math.max(1, Math.round(source.naturalWidth || source.width || 0))
  const height = Math.max(1, Math.round(source.naturalHeight || source.height || 0))
  if (!width || !height) return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0)
  return canvas
}

export function isFakeCheckerPixel(r, g, b, a) {
  if (a < 15) return true
  const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
  const isNeutral = maxDiff <= 18
  const isBright = r > 175 && g > 175 && b > 175
  if (isNeutral && isBright) return true
  const isDarkPlate = (
    (Math.abs(r - 42) <= 14 && Math.abs(g - 42) <= 14 && Math.abs(b - 54) <= 16)
    || (Math.abs(r - 26) <= 14 && Math.abs(g - 26) <= 14 && Math.abs(b - 36) <= 16)
  )
  if (isDarkPlate) return true
  return r < 90 && g > 155 && b > 175 && ((g + b) / 2 - r) > 70
}

export function enforceTransparencyPurge(canvas) {
  return purgeFakeBackground(canvas)
}

export function purgeFakeBackground(canvas) {
  if (!canvas?.getContext) return canvas
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return canvas
  const width = canvas.width
  const height = canvas.height
  if (width < 2 || height < 2) return canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const visited = new Uint8Array(width * height)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    stack.push(x, y)
  }
  for (let x = 0; x < width; x += 1) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y)
    push(width - 1, y)
  }
  while (stack.length) {
    const y = stack.pop()
    const x = stack.pop()
    const index = y * width + x
    if (visited[index]) continue
    visited[index] = 1
    const pixel = index * 4
    if (!isFakeCheckerPixel(data[pixel], data[pixel + 1], data[pixel + 2], data[pixel + 3])) continue
    data[pixel + 3] = 0
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function checkTransparencyHealth(canvas) {
  if (!canvas?.getContext) return { isHealthy: true, opaqueRatio: 0 }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { isHealthy: true, opaqueRatio: 0 }
  const width = canvas.width
  const height = canvas.height
  if (width < 4 || height < 4) return { isHealthy: true, opaqueRatio: 0 }
  const { data } = ctx.getImageData(0, 0, width, height)
  const band = Math.min(10, Math.floor(Math.min(width, height) / 2))
  let opaque = 0
  let total = 0
  const sample = (x, y) => {
    total += 1
    if (data[(y * width + x) * 4 + 3] >= 250) opaque += 1
  }
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < band; y += 1) sample(x, y)
    for (let y = height - band; y < height; y += 1) sample(x, y)
  }
  for (let y = band; y < height - band; y += 1) {
    for (let x = 0; x < band; x += 1) sample(x, y)
    for (let x = width - band; x < width; x += 1) sample(x, y)
  }
  const opaqueRatio = total ? opaque / total : 0
  return { isHealthy: opaqueRatio < 0.15, opaqueRatio }
}
