export const KAKAO_STICKER_SIZE = 360
export const KAKAO_SAFE_PAD = 0.08

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
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, image.naturalWidth || image.width)
  canvas.height = Math.max(1, image.naturalHeight || image.height)
  canvas.getContext('2d').drawImage(image, 0, 0)
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
      data[i + 3] = 0
      continue
    }
    if (bg[3] < 18) continue
    const dist = colorDist(data[i], data[i + 1], data[i + 2], bg)
    if (dist <= threshold) {
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

export function splitGridBoxes(width, height, cols, rows) {
  const safeCols = Math.max(1, Math.min(12, Math.round(cols) || 1))
  const safeRows = Math.max(1, Math.min(12, Math.round(rows) || 1))
  const cellW = width / safeCols
  const cellH = height / safeRows
  const boxes = []
  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      boxes.push({
        x: Math.round(col * cellW),
        y: Math.round(row * cellH),
        w: Math.round(cellW),
        h: Math.round(cellH),
      })
    }
  }
  return boxes
}

export function fitToKakaoCanvas(source, box, {
  size = KAKAO_STICKER_SIZE,
  pad = KAKAO_SAFE_PAD,
  transparent = true,
  background,
} = {}) {
  const sx = Math.max(0, Math.floor(box.x))
  const sy = Math.max(0, Math.floor(box.y))
  const sw = Math.max(1, Math.min(source.width - sx, Math.ceil(box.w)))
  const sh = Math.max(1, Math.min(source.height - sy, Math.ceil(box.h)))
  const crop = document.createElement('canvas')
  crop.width = sw
  crop.height = sh
  const cropCtx = crop.getContext('2d')
  cropCtx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  let dx = 0
  let dy = 0
  let dwSrc = sw
  let dhSrc = sh
  if (transparent) {
    const img = cropCtx.getImageData(0, 0, sw, sh)
    const bg = background || sampleBackground(img.data, sw, sh)
    knockoutImageData(img, bg)
    cropCtx.putImageData(img, 0, 0)
    const trimmed = opaqueBounds(img)
    dx = trimmed.x
    dy = trimmed.y
    dwSrc = trimmed.w
    dhSrc = trimmed.h
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (transparent) {
    ctx.clearRect(0, 0, size, size)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
  }
  const inner = size * (1 - pad * 2)
  const scale = Math.min(inner / dwSrc, inner / dhSrc)
  const dw = dwSrc * scale
  const dh = dhSrc * scale
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(crop, dx, dy, dwSrc, dhSrc, (size - dw) / 2, (size - dh) / 2, dw, dh)
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
} = {}) {
  const analyzed = analyzeSheet(source)
  const bg = sampleBackground(analyzed.data.data, analyzed.data.width, analyzed.data.height)
  const boxes = mode === 'grid'
    ? splitGridBoxes(source.width, source.height, cols, rows)
    : findContentBoxes(analyzed.data).map((box) => ({
      x: box.x / analyzed.scale,
      y: box.y / analyzed.scale,
      w: box.w / analyzed.scale,
      h: box.h / analyzed.scale,
      count: box.count,
    }))
  return boxes.map((box, index) => {
    const canvas = fitToKakaoCanvas(source, box, { transparent, background: bg })
    return {
      id: `emo-${index + 1}`,
      index,
      name: `kakao-360-${String(index + 1).padStart(2, '0')}.png`,
      canvas,
      preview: canvas.toDataURL('image/png'),
    }
  })
}
