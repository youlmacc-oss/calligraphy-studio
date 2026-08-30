import { primeHqContext } from '../../utils/hqRender.js'
import { resolveMotionSprite } from './spriteIsolate.js'

export const MOTION_NONE = 'none'

export function isMotionNone(presetId) {
  const id = String(presetId ?? '').trim().toLowerCase()
  return !id || id === MOTION_NONE || id === 'null' || id === 'off'
}

export const MOTION_PRESETS = [
  { id: 'jellyBounce', label: '① Jelly Bounce', hint: '수직 점프 + 착지 Squash & Stretch' },
  { id: 'neonPulse', label: '② Neon Pulse', hint: '사인파 발광 · 알파 블렌딩' },
  { id: 'cuteWiggle', label: '③ Cute Wiggle', hint: '좌우 ±8° 갸우뚱 + 리듬 틸트' },
  { id: 'cinematicGlitch', label: '④ Cinematic Glitch', hint: '순간 RGB 분리 수평 시프트' },
  { id: 'softFloating', label: '⑤ Soft Floating', hint: '무중력 상하 사인파 부유' },
  { id: 'angryShake', label: '⑥ Angry Shake', hint: '고주파 X/Y 진동 + 분노 지터' },
  { id: 'rollingTilt', label: '⑦ Rolling Tilt', hint: '좌우 진자 -12°~+12° 보간' },
  { id: 'squashStretch', label: '⑧ Squash Stretch', hint: '착지 납작 · 도약 길쭉 탄성' },
  { id: 'heartbeat', label: '⑨ Heartbeat', hint: '쿵-쾅 2박자 심장 펄스' },
  { id: 'zoomPunch', label: '⑩ Zoom Punch', hint: '화면 앞으로 튀는 팝업 줌' },
]

const TAU = Math.PI * 2
const GLITCH_WINDOWS = [
  [0.2, 0.25],
  [0.7, 0.73],
]

export function wrap01(t) {
  const n = Number(t)
  if (!Number.isFinite(n)) return 0
  return ((n % 1) + 1) % 1
}

export function clamp01(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0.7
  return Math.min(1, Math.max(0, n))
}

export const LOOP_MIN = 0.5
export const LOOP_MAX = 4
export const INTENSITY_MIN = 10
export const INTENSITY_MAX = 100
export const ZOOM_MIN = 50
export const ZOOM_MAX = 200

export function clampLoopSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 2
  return Math.min(LOOP_MAX, Math.max(LOOP_MIN, n))
}

export function clampIntensity(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 70
  return Math.min(INTENSITY_MAX, Math.max(INTENSITY_MIN, n))
}

export function clampZoom(value) {
  const n = Math.round(Number(value) / 10) * 10
  if (!Number.isFinite(n)) return 100
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n))
}

export function clampFps(value) {
  return Number(value) >= 24 ? 24 : 12
}

export function quantizeLoopTime(time01, fps, loopSeconds) {
  const seconds = clampLoopSeconds(loopSeconds)
  const rate = clampFps(fps)
  const steps = Math.max(2, Math.round(rate * seconds))
  const u = wrap01(time01)
  return Math.floor(u * steps) / steps
}

function identityPose() {
  return {
    dx: 0,
    dy: 0,
    scaleX: 1,
    scaleY: 1,
    rotateDeg: 0,
    alpha: 1,
    glowRadius: 0,
    rgbShift: 0,
    sliceShift: 0,
  }
}

function inWindow(t, start, end) {
  return t >= start && t < end
}

export function jellyBounce(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const air = Math.sin(u * Math.PI)
  const land = (1 - air) ** 2
  const k = 0.2 * i
  return {
    ...identityPose(),
    dy: air * -28 * i,
    scaleX: 1 + land * k - air * 0.07 * i,
    scaleY: 1 - land * k + air * 0.12 * i,
  }
}

export function neonPulse(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const wave = 0.5 + 0.5 * Math.sin(u * TAU)
  return {
    ...identityPose(),
    alpha: 1 - 0.18 * i * (1 - wave),
    glowRadius: (6 + 28 * i) * wave,
  }
}

export function cuteWiggle(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  return {
    ...identityPose(),
    rotateDeg: Math.sin(u * TAU * 2) * 8 * i,
    dy: Math.sin(u * TAU) * -8 * i,
  }
}

export function cinematicGlitch(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const pose = identityPose()
  const burst = GLITCH_WINDOWS.some(([start, end]) => inWindow(u, start, end))
  if (!burst) return pose
  return {
    ...pose,
    rgbShift: 24 * i,
    sliceShift: 26 * i,
  }
}

export function softFloating(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  return {
    ...identityPose(),
    dy: Math.sin(u * TAU) * 16 * i,
  }
}

export function angryShake(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const buzzX = Math.sin(u * TAU * 16)
  const buzzY = Math.cos(u * TAU * 21)
  return {
    ...identityPose(),
    dx: buzzX * 7 * i,
    dy: buzzY * 6 * i,
    rotateDeg: Math.sin(u * TAU * 14) * 3.2 * i,
    scaleX: 1 + Math.abs(buzzX) * 0.045 * i,
    scaleY: 1 + Math.abs(buzzY) * 0.045 * i,
  }
}

export function rollingTilt(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  return {
    ...identityPose(),
    rotateDeg: Math.sin(u * TAU) * 12 * i,
    dx: Math.sin(u * TAU) * 4 * i,
  }
}

export function squashStretch(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const hop = Math.sin(u * TAU)
  const squash = Math.max(0, -hop)
  const stretch = Math.max(0, hop)
  return {
    ...identityPose(),
    dy: hop * -18 * i,
    scaleX: 1 + squash * 0.32 * i - stretch * 0.14 * i,
    scaleY: 1 - squash * 0.32 * i + stretch * 0.26 * i,
  }
}

function heartPulse(u, center, sharpness) {
  const d = (u - center) * sharpness
  return Math.exp(-(d * d))
}

export function heartbeat(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const beat = heartPulse(u, 0.18, 18) + heartPulse(u, 0.38, 16) * 0.72
  const pop = beat * 0.22 * i
  return {
    ...identityPose(),
    scaleX: 1 + pop,
    scaleY: 1 + pop,
  }
}

export function zoomPunch(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const punch = Math.sin(u * Math.PI) ** 1.35
  const k = punch * 0.42 * i
  return {
    ...identityPose(),
    scaleX: 1 + k,
    scaleY: 1 + k,
    dy: punch * -8 * i,
  }
}

const PRESET_FNS = {
  jellyBounce,
  neonPulse,
  cuteWiggle,
  cinematicGlitch,
  rgbGlitch: cinematicGlitch,
  softFloating,
  angryShake,
  rollingTilt,
  squashStretch,
  heartbeat,
  zoomPunch,
}

export function sampleMotion(presetId, t, intensity) {
  if (isMotionNone(presetId)) return identityPose()
  const fn = PRESET_FNS[presetId] || jellyBounce
  return fn(t, intensity)
}

export function poseAtLoopSeam(presetId, intensity = 0.7) {
  const a = sampleMotion(presetId, 0, intensity)
  const b = sampleMotion(presetId, 1, intensity)
  return { start: a, end: b }
}

const SPRITE_FIT = 0.8

export function spriteDrawSize(image, width, height, fit = SPRITE_FIT) {
  const sw = image?.naturalWidth || image?.width || 1
  const sh = image?.naturalHeight || image?.height || 1
  const maxDim = Math.min(width * fit, height * fit)
  const aspect = sw / Math.max(1, sh)
  if (aspect > 1) return { drawW: maxDim, drawH: maxDim / aspect }
  return { drawW: maxDim * aspect, drawH: maxDim }
}

function drawContained(ctx, source, dx, dy, width, height) {
  const { drawW, drawH } = spriteDrawSize(source, width, height, SPRITE_FIT)
  ctx.drawImage(source, dx - drawW / 2, dy - drawH / 2, drawW, drawH)
}

export function renderIsolatedSpriteMotion(ctx, croppedSprite, motionParams = {}, width = 360, height = 360) {
  return renderIsolatedCharacterMotion(ctx, croppedSprite, motionParams, width, height)
}

export function renderIsolatedCharacterMotion(ctx, characterImg, motionParams = {}, width = 360, height = 360) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!characterImg) return
  const {
    offsetX = 0,
    offsetY = 0,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    opacity = 1,
  } = motionParams
  const { drawW, drawH } = spriteDrawSize(characterImg, width, height, SPRITE_FIT)
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(width / 2 + Number(offsetX), height / 2 + Number(offsetY))
  ctx.rotate((Number(rotation) * Math.PI) / 180)
  ctx.scale(Number(scaleX) || 1, Number(scaleY) || 1)
  ctx.drawImage(characterImg, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
}

export function paintMotionFrame(ctx, source, {
  width,
  height,
  time01,
  preset = MOTION_NONE,
  intensity = 70,
  isolate = true,
} = {}) {
  const w = width || ctx.canvas.width
  const h = height || ctx.canvas.height
  const sprite = resolveMotionSprite(source, isolate)

  if (isMotionNone(preset)) {
    primeHqContext(ctx)
    renderIsolatedCharacterMotion(ctx, sprite, {}, w, h)
    return
  }

  const amp = typeof intensity === 'number' && intensity > 1 ? intensity / 100 : clamp01(intensity)
  const motion = sampleMotion(preset, time01, amp)

  primeHqContext(ctx)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  ctx.translate(w / 2 + motion.dx, h / 2)
  ctx.rotate((motion.rotateDeg * Math.PI) / 180)
  ctx.scale(motion.scaleX, motion.scaleY)
  ctx.globalAlpha = motion.alpha
  if (motion.glowRadius > 0) {
    ctx.shadowColor = 'rgba(34, 211, 238, 0.9)'
    ctx.shadowBlur = motion.glowRadius
  }

  if (motion.rgbShift > 0) {
    const shift = motion.rgbShift
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 0.42 * motion.alpha
    ctx.shadowColor = 'rgba(255, 56, 88, 0.95)'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = -shift
    ctx.shadowOffsetY = 0
    drawContained(ctx, sprite, 0, motion.dy, w, h)
    ctx.shadowColor = 'rgba(40, 210, 255, 0.95)'
    ctx.shadowOffsetX = shift
    drawContained(ctx, sprite, 0, motion.dy, w, h)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = motion.alpha
    ctx.shadowColor = 'transparent'
    ctx.shadowOffsetX = 0
    drawContained(ctx, sprite, 0, motion.dy, w, h)
    const bandH = Math.max(8, h * 0.1)
    const bandY = h * 0.38 + motion.dy
    ctx.drawImage(
      sprite,
      0,
      Math.max(0, (sprite.height || h) * 0.38),
      sprite.width || w,
      Math.max(1, (sprite.height || h) * 0.1),
      -w / 2 + motion.sliceShift,
      -h / 2 + bandY - bandH / 2,
      w,
      bandH,
    )
  } else {
    drawContained(ctx, sprite, 0, motion.dy, w, h)
  }

  ctx.restore()
}
