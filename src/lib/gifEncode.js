function lzwEncode(minCodeSize, pixels) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  const dict = new Map()
  const out = []
  let buffer = 0
  let bits = 0

  const write = (code) => {
    buffer |= code << bits
    bits += codeSize
    while (bits >= 8) {
      out.push(buffer & 255)
      buffer >>= 8
      bits -= 8
    }
  }

  write(clearCode)
  let prefix = pixels[0]
  for (let i = 1; i < pixels.length; i += 1) {
    const key = (prefix << 8) | pixels[i]
    if (dict.has(key)) {
      prefix = dict.get(key)
      continue
    }
    write(prefix)
    if (nextCode < 4096) {
      dict.set(key, nextCode)
      if (nextCode === 1 << codeSize && codeSize < 12) codeSize += 1
      nextCode += 1
    } else {
      write(clearCode)
      dict.clear()
      codeSize = minCodeSize + 1
      nextCode = endCode + 1
    }
    prefix = pixels[i]
  }
  write(prefix)
  write(endCode)
  if (bits > 0) out.push(buffer & 255)
  return new Uint8Array(out)
}

function packBlocks(bytes) {
  const chunks = []
  for (let i = 0; i < bytes.length; i += 255) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + 255))
    chunks.push(Uint8Array.of(slice.length), slice)
  }
  chunks.push(Uint8Array.of(0))
  const total = chunks.reduce((sum, item) => sum + item.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  chunks.forEach((item) => {
    out.set(item, offset)
    offset += item.length
  })
  return out
}

function toCubeIndex(r, g, b) {
  return Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51)
}

function buildCubePalette() {
  const palette = []
  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 6; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        palette.push([r * 51, g * 51, b * 51])
      }
    }
  }
  return palette
}

export function encodeGifFromCanvases(canvases, delayMs = 100) {
  if (!canvases.length) return null
  const width = canvases[0].width
  const height = canvases[0].height
  const palette = buildCubePalette()
  const delay = Math.max(2, Math.round(delayMs / 10))
  const parts = [new TextEncoder().encode('GIF89a')]
  const header = new Uint8Array(7)
  const headerView = new DataView(header.buffer)
  headerView.setUint16(0, width, true)
  headerView.setUint16(2, height, true)
  header[4] = 0xf6
  header[5] = 0
  header[6] = 0
  parts.push(header)
  const table = new Uint8Array(216 * 3)
  palette.forEach((color, index) => {
    table[index * 3] = color[0]
    table[index * 3 + 1] = color[1]
    table[index * 3 + 2] = color[2]
  })
  parts.push(table)
  parts.push(Uint8Array.of(0x21, 0xff, 11))
  parts.push(new TextEncoder().encode('NETSCAPE2.0'))
  parts.push(Uint8Array.of(3, 1, 0, 0, 0))

  canvases.forEach((canvas) => {
    const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data
    const index = new Uint8Array(width * height)
    for (let i = 0, p = 0; i < index.length; i += 1, p += 4) {
      index[i] = toCubeIndex(data[p], data[p + 1], data[p + 2])
    }
    const gce = new Uint8Array(8)
    gce[0] = 0x21
    gce[1] = 0xf9
    gce[2] = 4
    gce[4] = delay & 255
    gce[5] = delay >> 8
    parts.push(gce)
    const desc = new Uint8Array(10)
    desc[0] = 0x2c
    const descView = new DataView(desc.buffer)
    descView.setUint16(5, width, true)
    descView.setUint16(7, height, true)
    parts.push(desc)
    parts.push(Uint8Array.of(8))
    parts.push(packBlocks(lzwEncode(8, index)))
  })
  parts.push(Uint8Array.of(0x3b))
  const total = parts.reduce((sum, item) => sum + item.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach((item) => {
    out.set(item, offset)
    offset += item.length
  })
  return new Blob([out], { type: 'image/gif' })
}
