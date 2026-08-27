const PAPER_LUMA = 226
const PAPER_CHROMA = 28

function pixelLuma(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114
}

function pixelChroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function sampleAlpha(data, width, x, y) {
  return data[(y * width + x) * 4 + 3]
}

function readCornerAlpha(imageData) {
  const { data, width, height } = imageData
  const tl = sampleAlpha(data, width, 0, 0)
  const tr = sampleAlpha(data, width, width - 1, 0)
  const bl = sampleAlpha(data, width, 0, height - 1)
  const br = sampleAlpha(data, width, width - 1, height - 1)
  return {
    tl,
    tr,
    bl,
    br,
    ok: tl <= 12 && tr <= 12 && bl <= 12 && br <= 12,
  }
}

function textZoneStartY(height, textZonePercent = 20) {
  const pct = Math.min(50, Math.max(5, Math.round(Number(textZonePercent) || 20)))
  return Math.max(0, Math.min(height, Math.floor(height * (1 - pct / 100)) + 1))
}

function detectBoundingBoxArtifact(imageData, textZonePercent = 20) {
  const { data, width, height } = imageData
  const y0 = textZoneStartY(height, textZonePercent)
  let count = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = y0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < 40) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r < 80 && g < 80 && b < 80) continue
      const luma = pixelLuma(r, g, b)
      const chroma = pixelChroma(r, g, b)
      if (luma < PAPER_LUMA || chroma >= PAPER_CHROMA) continue
      count += 1
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (count < 48 || maxX < 0) {
    return { hasBoundingBoxArtifact: false, boundingBoxScore: 0, platePixels: count }
  }
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  const fill = count / Math.max(1, bw * bh)
  const rectLike = bw >= 18 && bh >= 6 && fill >= 0.42
  return {
    hasBoundingBoxArtifact: rectLike,
    boundingBoxScore: Math.round(fill * 1000) / 1000,
    platePixels: count,
    plateBox: { x: minX, y: minY, w: bw, h: bh },
  }
}

function bandInkRatio(source, x, y, w, h) {
  if (!source?.getContext || w < 1 || h < 1) return 0
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  const sx = Math.max(0, Math.floor(x))
  const sy = Math.max(0, Math.floor(y))
  const sw = Math.max(1, Math.min(source.width - sx, Math.round(w)))
  const sh = Math.max(1, Math.min(source.height - sy, Math.round(h)))
  if (sx >= source.width || sy >= source.height || sw < 1 || sh < 1) return 0
  const { data } = ctx.getImageData(sx, sy, sw, sh)
  let ink = 0
  const total = sw * sh
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue
    if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) ink += 1
  }
  return total ? ink / total : 0
}

function detectAdjacentRowOverlap(source, box) {
  if (!source || !box) return { adjacentRowOverlap: 0, above: 0, below: 0 }
  const band = 4
  const above = bandInkRatio(source, box.x, box.y - band, box.w, band)
  const below = bandInkRatio(source, box.x, box.y + box.h, box.w, band)
  const adjacentRowOverlap = Math.round(Math.max(above, below) * 1000) / 1000
  return { adjacentRowOverlap, above: Math.round(above * 1000) / 1000, below: Math.round(below * 1000) / 1000 }
}

function detectHighlightProtection(imageData) {
  const { data, width, height } = imageData
  const yMax = Math.floor(height * 0.62)
  let opaque = 0
  let bright = 0
  for (let y = 0; y < yMax; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a < 40) continue
      opaque += 1
      const luma = pixelLuma(data[i], data[i + 1], data[i + 2])
      const chroma = pixelChroma(data[i], data[i + 1], data[i + 2])
      if (luma >= 198 && chroma >= 18) bright += 1
    }
  }
  if (opaque < 80) {
    return { characterHighlightProtected: true, highlightPixels: bright, bodyPixels: opaque }
  }
  return {
    characterHighlightProtected: bright > 0,
    highlightPixels: bright,
    bodyPixels: opaque,
  }
}

export function inspectRenderedSlice({
  canvas,
  source,
  box,
  index = 0,
  name = '',
  mode = 'smart',
  textMode = 'original',
  outline = false,
  customScale = 100,
  textZonePercent = 20,
  transparent = true,
} = {}) {
  const width = canvas?.width || 0
  const height = canvas?.height || 0
  const ctx = canvas?.getContext?.('2d', { willReadFrequently: true })
  if (!ctx || !width || !height) {
    return {
      id: `emo-${index + 1}`,
      index,
      name,
      suspects: ['canvas-unreadable'],
    }
  }
  const imageData = ctx.getImageData(0, 0, width, height)
  const cornerAlpha = readCornerAlpha(imageData)
  const plate = detectBoundingBoxArtifact(imageData, textZonePercent)
  const overlap = detectAdjacentRowOverlap(source, box)
  const highlight = detectHighlightProtection(imageData)
  const suspects = []
  if (transparent && !cornerAlpha.ok) suspects.push('corner-alpha')
  if (plate.hasBoundingBoxArtifact) suspects.push('text-bounding-box')
  if (overlap.adjacentRowOverlap >= 0.12) suspects.push('adjacent-row-overlap')
  if (!highlight.characterHighlightProtected) suspects.push('highlight-clipped')
  return {
    id: `emo-${index + 1}`,
    index,
    name,
    box: box
      ? {
        x: Math.round(Number(box.x) || 0),
        y: Math.round(Number(box.y) || 0),
        w: Math.round(Number(box.w) || 0),
        h: Math.round(Number(box.h) || 0),
      }
      : null,
    canvasSize: { width, height },
    mode,
    textMode,
    outline,
    customScale,
    textZonePercent,
    transparent,
    cornerAlpha,
    hasBoundingBoxArtifact: plate.hasBoundingBoxArtifact,
    boundingBoxScore: plate.boundingBoxScore,
    platePixels: plate.platePixels,
    adjacentRowOverlap: overlap.adjacentRowOverlap,
    characterHighlightProtected: highlight.characterHighlightProtected,
    suspects,
  }
}

export function buildDiagnosticReport(slices = [], context = {}) {
  const rows = (Array.isArray(slices) ? slices : []).map((item) => item?.diagnostics).filter(Boolean)
  const suspectCount = rows.filter((row) => row.suspects?.length).length
  return {
    generatedAt: new Date().toISOString(),
    pipeline: 'crop → flood-fill-alpha(T=18) → pixel-text-recolor',
    context: {
      mode: context.mode ?? null,
      textMode: context.textMode ?? null,
      outline: context.outline ?? null,
      customScale: context.customScale ?? null,
      textZonePercent: context.textZonePercent ?? null,
      transparent: context.transparent ?? null,
      previewZoomPercent: context.previewZoomPercent ?? null,
      sliceCount: rows.length,
    },
    summary: {
      suspectCount,
      cornerFail: rows.filter((row) => row.suspects?.includes('corner-alpha')).length,
      boundingBoxFail: rows.filter((row) => row.suspects?.includes('text-bounding-box')).length,
      overlapFail: rows.filter((row) => row.suspects?.includes('adjacent-row-overlap')).length,
      highlightFail: rows.filter((row) => row.suspects?.includes('highlight-clipped')).length,
    },
    slices: rows,
  }
}

export function diagnosticTableRows(report) {
  return (report?.slices || []).map((row) => ({
    id: row.id,
    box: row.box ? `${row.box.x},${row.box.y} ${row.box.w}×${row.box.h}` : '',
    cornerOk: row.cornerAlpha?.ok,
    boundingBox: row.hasBoundingBoxArtifact,
    overlap: row.adjacentRowOverlap,
    highlight: row.characterHighlightProtected,
    suspects: (row.suspects || []).join('|') || 'ok',
  }))
}

export function printDiagnosticTable(report) {
  const rows = diagnosticTableRows(report)
  if (typeof console !== 'undefined' && typeof console.table === 'function') {
    console.table(rows)
  }
  return rows
}

export async function copyDiagnosticLog(report) {
  const text = JSON.stringify(report, null, 2)
  printDiagnosticTable(report)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return text
  }
  if (typeof document === 'undefined') return text
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
  return text
}
