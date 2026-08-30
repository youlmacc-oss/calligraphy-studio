import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { ENCODER_SIZE } from './MotionEncoderEngine.js'

export function padMotionIndex(index) {
  return String(Math.max(1, Math.round(Number(index) || 0) + 1)).padStart(2, '0')
}

export function motionClipFileName(index, ext = 'gif') {
  const kind = String(ext || 'gif').toLowerCase() === 'webp' ? 'webp' : 'gif'
  return `motion-${padMotionIndex(index)}.${kind}`
}

export function assertClipSize(clip) {
  const width = Math.round(Number(clip?.width) || ENCODER_SIZE)
  const height = Math.round(Number(clip?.height) || ENCODER_SIZE)
  if (width !== ENCODER_SIZE || height !== ENCODER_SIZE) {
    throw new Error('ZIP 항목 해상도는 360×360만 허용합니다.')
  }
}

export function createSequenceClip(meta = {}, index = 0) {
  const frames = Array.isArray(meta.frames) ? meta.frames.map((item) => ({ ...item })) : []
  const thumb = frames.find((item) => item?.url)?.url || ''
  const slot = Math.max(1, Math.round(Number(index) || 0) + 1)
  return {
    id: `clip-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    fileName: `클립 ${slot}`,
    blob: null,
    url: thumb,
    sharedUrl: true,
    ext: 'seq',
    mime: '',
    width: ENCODER_SIZE,
    height: ENCODER_SIZE,
    fps: meta.fps,
    speed: meta.speed,
    effect: meta.effect,
    pingPong: Boolean(meta.pingPong),
    particles: Array.isArray(meta.particles) ? meta.particles : [],
    captionOn: Boolean(meta.captionOn),
    captionText: String(meta.captionText || ''),
    captionSize: meta.captionSize || 'md',
    captionStroke: meta.captionStroke || 'black',
    captionFont: meta.captionFont || '',
    captionTail: meta.captionTail || null,
    frames,
    isPermanent: true,
  }
}

export function createMotionClip(packed, meta = {}, index = 0) {
  const ext = packed?.ext === 'webp' ? 'webp' : 'gif'
  const blob = packed?.blob
  if (!blob) throw new Error('클립 Blob이 없습니다.')
  return {
    id: `clip-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    fileName: motionClipFileName(index, ext),
    blob,
    url: typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(blob) : '',
    ext,
    mime: packed.mime || (ext === 'webp' ? 'image/webp' : 'image/gif'),
    width: packed.width || ENCODER_SIZE,
    height: packed.height || ENCODER_SIZE,
    fps: meta.fps,
    speed: meta.speed,
    effect: meta.effect,
    pingPong: Boolean(meta.pingPong),
    particles: Array.isArray(meta.particles) ? meta.particles : [],
    captionOn: Boolean(meta.captionOn),
    captionText: String(meta.captionText || ''),
    captionSize: meta.captionSize || 'md',
    captionStroke: meta.captionStroke || 'black',
    captionFont: meta.captionFont || '',
    captionTail: meta.captionTail || null,
    frames: Array.isArray(meta.frames) ? meta.frames.map((item) => ({ ...item })) : [],
    isPermanent: false,
  }
}

export function isPermanentClip(clip) {
  if (!clip) return false
  if (clip.isPermanent === true) return true
  if (clip.isPermanent === false) return false
  return clip.ext === 'seq'
}

export async function zipMotionClips(clips, options = {}) {
  const list = (Array.isArray(clips) ? clips : []).filter((item) => item?.blob && isPermanentClip(item))
  if (!list.length) throw new Error('보관된 클립이 없습니다.')
  const zip = new JSZip()
  list.forEach((clip, index) => {
    assertClipSize(clip)
    zip.file(motionClipFileName(index, clip.ext), clip.blob)
  })
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      const percent = Math.max(0, Math.min(100, Math.round(Number(meta?.percent) || 0)))
      options.onProgress?.({
        percent,
        message: `ZIP 압축 중... ${percent}%`,
      })
    },
  )
  const fileName = options.fileName || 'motion-clips.zip'
  if (typeof saveAs === 'function') saveAs(blob, fileName)
  options.onProgress?.({ percent: 100, message: 'ZIP 압축 중... 100%' })
  return blob
}
