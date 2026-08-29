const ALPHA_CUT = 16

export function nearestPaletteIndex(palette, r, g, b) {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i += 1) {
    const swatch = palette[i]
    const dr = r - swatch[0]
    const dg = g - swatch[1]
    const db = b - swatch[2]
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = i
      if (dist === 0) break
    }
  }
  return best
}

export function makeRgb565Lut(palette) {
  const lut = new Uint8Array(65536)
  for (let key = 0; key < 65536; key += 1) {
    const r = Math.round((((key >> 11) & 31) * 255) / 31)
    const g = Math.round((((key >> 5) & 63) * 255) / 63)
    const b = Math.round(((key & 31) * 255) / 31)
    lut[key] = nearestPaletteIndex(palette, r, g, b)
  }
  return lut
}

function rgb565Key(r, g, b) {
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)
}

function clampByte(value) {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}

function addError(buffer, width, height, x, y, er, eg, eb, factor) {
  if (x < 0 || y < 0 || x >= width || y >= height) return
  const p = (y * width + x) * 4
  buffer[p] += er * factor
  buffer[p + 1] += eg * factor
  buffer[p + 2] += eb * factor
}

export function floydSteinbergIndex(imageData, palette, transparentIndex, alphaCut = ALPHA_CUT) {
  const { width, height, data } = imageData
  const work = new Float32Array(data.length)
  for (let i = 0; i < data.length; i += 1) work[i] = data[i]
  const index = new Uint8Array(width * height)
  const lut = makeRgb565Lut(palette)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      const p = i * 4
      if (data[p + 3] < alphaCut) {
        index[i] = transparentIndex
        continue
      }
      const r = clampByte(work[p])
      const g = clampByte(work[p + 1])
      const b = clampByte(work[p + 2])
      const mapped = lut[rgb565Key(r, g, b)]
      index[i] = mapped
      const swatch = palette[mapped]
      const er = r - swatch[0]
      const eg = g - swatch[1]
      const eb = b - swatch[2]
      addError(work, width, height, x + 1, y, er, eg, eb, 7 / 16)
      addError(work, width, height, x - 1, y + 1, er, eg, eb, 3 / 16)
      addError(work, width, height, x, y + 1, er, eg, eb, 5 / 16)
      addError(work, width, height, x + 1, y + 1, er, eg, eb, 1 / 16)
    }
  }
  return index
}
