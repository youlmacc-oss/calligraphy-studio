function fourCC(tag) {
  return [tag.charCodeAt(0), tag.charCodeAt(1), tag.charCodeAt(2), tag.charCodeAt(3)]
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach((part) => {
    out.set(part, offset)
    offset += part.length
  })
  return out
}

function le32(value) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true)
  return bytes
}

function le24(value) {
  const n = Math.max(0, Math.round(Number(value) || 0))
  return Uint8Array.of(n & 255, (n >> 8) & 255, (n >> 16) & 255)
}

export function riffChunk(tag, payload) {
  const size = payload.length
  const pad = size % 2
  const out = new Uint8Array(8 + size + pad)
  out.set(fourCC(tag), 0)
  out.set(le32(size), 4)
  out.set(payload, 8)
  return out
}

export function parseWebpChunks(bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  if (src.length < 12) return []
  const riff = String.fromCharCode(src[0], src[1], src[2], src[3])
  const webp = String.fromCharCode(src[8], src[9], src[10], src[11])
  if (riff !== 'RIFF' || webp !== 'WEBP') return []
  const chunks = []
  let offset = 12
  while (offset + 8 <= src.length) {
    const tag = String.fromCharCode(src[offset], src[offset + 1], src[offset + 2], src[offset + 3])
    const size = new DataView(src.buffer, src.byteOffset + offset + 4, 4).getUint32(0, true)
    const start = offset + 8
    const end = Math.min(src.length, start + size)
    chunks.push({ tag, data: src.subarray(start, end) })
    offset = start + size + (size % 2)
  }
  return chunks
}

export function stillWebpFramePayload(bytes) {
  const chunks = parseWebpChunks(bytes)
  const parts = []
  chunks.forEach((item) => {
    if (item.tag === 'ALPH' || item.tag === 'VP8 ' || item.tag === 'VP8L') {
      parts.push(riffChunk(item.tag, item.data))
    }
  })
  return concatBytes(parts)
}

export function makeUncompressedAlphChunk(imageData) {
  const { width, height, data } = imageData
  const payload = new Uint8Array(1 + width * height)
  payload[0] = 0
  for (let i = 0, p = 3; i < width * height; i += 1, p += 4) {
    payload[1 + i] = data[p]
  }
  return riffChunk('ALPH', payload)
}

function vp8xChunk(width, height, flags) {
  const payload = new Uint8Array(10)
  payload[0] = flags
  payload.set(le24(Math.max(0, width - 1)), 4)
  payload.set(le24(Math.max(0, height - 1)), 7)
  return riffChunk('VP8X', payload)
}

function animChunk(loopCount = 0) {
  const payload = new Uint8Array(6)
  payload[0] = 0
  payload[1] = 0
  payload[2] = 0
  payload[3] = 0
  payload[4] = loopCount & 255
  payload[5] = (loopCount >> 8) & 255
  return riffChunk('ANIM', payload)
}

function anmfChunk(payload, width, height, delayMs) {
  const body = concatBytes([
    le24(0),
    le24(0),
    le24(Math.max(0, width - 1)),
    le24(Math.max(0, height - 1)),
    le24(Math.max(1, Math.round(Number(delayMs) || 100))),
    Uint8Array.of(3),
    payload,
  ])
  return riffChunk('ANMF', body)
}

export function muxAnimatedWebp(framePayloads, options = {}) {
  const list = (Array.isArray(framePayloads) ? framePayloads : []).filter((item) => item?.length)
  if (!list.length) throw new Error('WebP 프레임이 없습니다.')
  const width = Math.max(1, Math.round(Number(options.width) || 360))
  const height = Math.max(1, Math.round(Number(options.height) || 360))
  const delay = Math.max(20, Math.round(Number(options.delay) || 125))
  const vp8xFlags = 0x12
  const parts = [
    vp8xChunk(width, height, vp8xFlags),
    animChunk(0),
    ...list.map((payload) => anmfChunk(payload, width, height, delay)),
  ]
  const payload = concatBytes(parts)
  const riff = concatBytes([
    Uint8Array.from(fourCC('RIFF')),
    le32(4 + payload.length),
    Uint8Array.from(fourCC('WEBP')),
    payload,
  ])
  return riff
}

export function isAnimatedWebp(bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  if (src.length < 20) return false
  const header = String.fromCharCode(...src.subarray(0, 4)) + String.fromCharCode(...src.subarray(8, 12))
  if (header !== 'RIFFWEBP') return false
  const chunks = parseWebpChunks(src)
  return chunks.some((item) => item.tag === 'ANIM') && chunks.some((item) => item.tag === 'ANMF')
}
