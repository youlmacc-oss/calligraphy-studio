import { encodeGifFromCanvases as encodeGifSimple } from './gifEncode.js'
import { primeHqContext } from '../utils/hqRender.js'

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function canvasToPngBlob(canvas) {
  return canvasToBlob(canvas, 'image/png')
}

export async function canvasToJpegBlob(canvas, quality = 0.95) {
  const sheet = document.createElement('canvas')
  sheet.width = canvas.width
  sheet.height = canvas.height
  const ctx = sheet.getContext('2d')
  primeHqContext(ctx)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  ctx.drawImage(canvas, 0, 0)
  return canvasToBlob(sheet, 'image/jpeg', quality)
}

export async function blobToArrayBuffer(blob) {
  return blob.arrayBuffer()
}

export function resizeCanvas(source, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  primeHqContext(ctx)
  const scale = Math.min(size / source.width, size / source.height)
  const w = source.width * scale
  const h = source.height * scale
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h)
  return canvas
}

export async function encodeIcoFromCanvas(source, sizes = [32, 64, 256]) {
  const pngs = []
  for (const size of sizes) {
    const blob = await canvasToPngBlob(resizeCanvas(source, size))
    pngs.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) })
  }
  const count = pngs.length
  const header = 6 + count * 16
  let offset = header
  const entries = pngs.map((item) => {
    const entry = { ...item, offset }
    offset += item.bytes.length
    return entry
  })
  const out = new Uint8Array(offset)
  const view = new DataView(out.buffer)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, count, true)
  entries.forEach((entry, index) => {
    const at = 6 + index * 16
    out[at] = entry.size >= 256 ? 0 : entry.size
    out[at + 1] = entry.size >= 256 ? 0 : entry.size
    out[at + 2] = 0
    out[at + 3] = 0
    view.setUint16(at + 4, 1, true)
    view.setUint16(at + 6, 32, true)
    view.setUint32(at + 8, entry.bytes.length, true)
    view.setUint32(at + 12, entry.offset, true)
    out.set(entry.bytes, entry.offset)
  })
  return new Blob([out], { type: 'image/x-icon' })
}

function crc32(bytes) {
  let crc = ~0
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc
}

function zipStore(files) {
  const encoder = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  files.forEach((file) => {
    const name = encoder.encode(file.name)
    const data = file.bytes
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(8, 0, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  })
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + 22)
  let cursor = 0
  locals.forEach((item) => {
    out.set(item, cursor)
    cursor += item.length
  })
  centrals.forEach((item) => {
    out.set(item, cursor)
    cursor += item.length
  })
  out.set(end, cursor)
  return new Blob([out], { type: 'application/zip' })
}

export async function iconPackageFromCanvas(source) {
  const sizes = [32, 64, 256]
  const files = []
  for (const size of sizes) {
    const blob = await canvasToPngBlob(resizeCanvas(source, size))
    files.push({ name: `favicon-${size}.png`, bytes: new Uint8Array(await blob.arrayBuffer()) })
  }
  const ico = await encodeIcoFromCanvas(source, sizes)
  files.push({ name: 'favicon.ico', bytes: new Uint8Array(await ico.arrayBuffer()) })
  return zipStore(files)
}

export function scaleCanvasToMax(source, maxEdge = 480) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#07070c'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  primeHqContext(ctx)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function encodeGifFromCanvases(canvases, delay = 100) {
  return encodeGifSimple(canvases, delay)
}
