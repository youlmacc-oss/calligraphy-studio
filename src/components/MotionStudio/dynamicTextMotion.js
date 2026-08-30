export const TEXT_MOTION_NONE = 'none'
export const TEXT_MOTION_BOUNCE = 'bounce'
export const TEXT_MOTION_SHAKE = 'shake'
export const TEXT_MOTION_PULSE = 'pulse'
export const TEXT_MOTION_TYPEWRITER = 'typewriter'

export const TEXT_MOTION_EFFECTS = [
  {
    id: TEXT_MOTION_NONE,
    label: '없음',
    tooltip: 'None · 고정 텍스트. 모션 변환 없이 현재 프레임만 보여 줍니다',
  },
  {
    id: TEXT_MOTION_BOUNCE,
    label: '바운스',
    tooltip: 'Bounce · Y축 탄성 바운스. 상하 진폭과 이징으로 통통 튑니다',
  },
  {
    id: TEXT_MOTION_SHAKE,
    label: '쉐이크',
    tooltip: 'Shake · X/Y 미세 무작위 흔들림으로 감정을 표현합니다',
  },
  {
    id: TEXT_MOTION_PULSE,
    label: '펄스',
    tooltip: 'Pulse / Pop · Scale 0.9에서 1.15로 확대 축소하는 강조 쿵쾅 효과입니다',
  },
  {
    id: TEXT_MOTION_TYPEWRITER,
    label: '타이핑',
    tooltip: 'Typewriter · 프레임 순서에 맞춰 글자가 한 글자씩 출력됩니다',
  },
]

export function normalizeTextMotionEffect(id) {
  const key = String(id || '').trim().toLowerCase().replace(/[\s/_-]+/g, '')
  if (key === TEXT_MOTION_BOUNCE) return TEXT_MOTION_BOUNCE
  if (key === TEXT_MOTION_SHAKE) return TEXT_MOTION_SHAKE
  if (key === TEXT_MOTION_PULSE || key === 'pulsepop' || key === 'pop') return TEXT_MOTION_PULSE
  if (key === TEXT_MOTION_TYPEWRITER || key === 'type') return TEXT_MOTION_TYPEWRITER
  return TEXT_MOTION_NONE
}

function readCustomCaption(source) {
  if (!source || typeof source !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(source, 'customText')) return source.customText
  if (Object.prototype.hasOwnProperty.call(source, 'captionText')) return source.captionText
  if (Object.prototype.hasOwnProperty.call(source, 'caption')) return source.caption
  return undefined
}

export function captionForSequenceItem(item) {
  const custom = readCustomCaption(item)
  if (custom !== undefined) return String(custom || '').trim()
  return ''
}

export function resolveCaption(enabled, text, extra) {
  if (!enabled) return ''
  const custom = readCustomCaption(extra)
  if (custom !== undefined) return String(custom || '').trim()
  return String(text ?? '').trim()
}

export const CAPTION_SIZE_PRESETS = [
  { id: 'sm', label: '작게', fontPx: 22 },
  { id: 'md', label: '보통', fontPx: 30 },
  { id: 'lg', label: '크게', fontPx: 40 },
]

export const CAPTION_STROKE_PRESETS = [
  { id: 'black', label: '검정', color: '#111111' },
  { id: 'yellow', label: '노랑', color: '#facc15' },
  { id: 'pink', label: '분홍', color: '#fb7185' },
]

export function captionFontPx(sizeId, edge = 360) {
  const preset = CAPTION_SIZE_PRESETS.find((item) => item.id === sizeId) || CAPTION_SIZE_PRESETS[1]
  const scale = Math.max(2, Number(edge) || 360) / 360
  return Math.max(12, Math.round(preset.fontPx * scale))
}

export function captionStrokeColor(strokeId) {
  const preset = CAPTION_STROKE_PRESETS.find((item) => item.id === strokeId) || CAPTION_STROKE_PRESETS[0]
  return preset.color
}

export function buildCaptionPose({
  enabled,
  text,
  customText,
  captionText,
  caption,
  effect,
  index = 0,
  total = 1,
  sizeId = 'md',
  strokeId = 'black',
  fontId,
  captionFont,
  edge = 360,
  posX = 0,
  posY = 0,
} = {}) {
  const label = resolveCaption(enabled, text, { customText, captionText, caption })
  if (!label) return null
  const pose = sampleTextMotion(effect, index, total, label)
  pose.fontPx = captionFontPx(sizeId, edge)
  pose.strokeStyle = captionStrokeColor(strokeId)
  pose.fontId = fontId || captionFont
  pose.posX = Number(posX) || 0
  pose.posY = Number(posY) || 0
  return pose
}

function unitProgress(frameIndex, frameCount) {
  const n = Math.max(1, Math.round(Number(frameCount) || 1))
  const t = ((Math.round(Number(frameIndex) || 0) % n) + n) % n
  return { t, n, u: t / n }
}

function hashUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

function bounceEaseY(u) {
  const wave = Math.abs(Math.sin(u * Math.PI * 2))
  return -20 * Math.pow(wave, 0.72)
}

export function sampleTextMotion(effectId, frameIndex, frameCount, text) {
  const source = String(text || '')
  const { t, n, u } = unitProgress(frameIndex, frameCount)
  const pose = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    text: source,
  }
  const effect = normalizeTextMotionEffect(effectId)
  if (effect === TEXT_MOTION_BOUNCE) {
    pose.y = bounceEaseY(u)
    return pose
  }
  if (effect === TEXT_MOTION_SHAKE) {
    pose.x = hashUnit((t + 1) * 3.17) * 4.2
    pose.y = hashUnit((t + 1) * 7.91 + 1.3) * 3.4
    pose.rotation = hashUnit((t + 1) * 5.33 + 2.1) * 0.055
    return pose
  }
  if (effect === TEXT_MOTION_PULSE) {
    const wave = 0.5 + 0.5 * Math.sin(u * Math.PI * 2)
    pose.scale = 0.9 + 0.25 * wave
    pose.opacity = 0.88 + 0.12 * wave
    return pose
  }
  if (effect === TEXT_MOTION_TYPEWRITER) {
    const chars = Math.max(0, Math.ceil(((t + 1) / n) * source.length))
    pose.text = source.slice(0, chars)
    return pose
  }
  return pose
}
