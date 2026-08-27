export const MOTION_PRESETS = [
  { id: 'jellyBounce', label: '① Jelly Bounce', hint: '쫀득한 젤리 탄성' },
  { id: 'neonPulse', label: '② Neon Pulse', hint: '네온 맥동 발광' },
  { id: 'cuteWiggle', label: '③ Cute Wiggle', hint: '리듬 갸우뚱 틸트' },
  { id: 'cinematicGlitch', label: '④ Cinematic Glitch', hint: 'RGB 채널 분리 노이즈' },
  { id: 'softFloating', label: '⑤ Soft Floating', hint: '무중력 부유 루프' },
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

export function clampLoopSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 2
  return Math.min(3, Math.max(0.5, n))
}

export function clampIntensity(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 70
  return Math.min(100, Math.max(1, n))
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
  const hop = Math.sin(u * TAU)
  const land = (1 + Math.cos(u * TAU * 2)) / 2
  const k = 0.22 * i
  return {
    ...identityPose(),
    dy: hop * -22 * i,
    scaleX: 1 + land * k,
    scaleY: 1 - land * k,
  }
}

export function neonPulse(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const wave = Math.sin(u * TAU)
  return {
    ...identityPose(),
    alpha: 0.7 + 0.3 * wave,
    glowRadius: 8 + (10 + 18 * i) * (0.5 + 0.5 * wave),
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
    rgbShift: (10 + 14 * i),
    sliceShift: (16 + 10 * i),
    dx: 2 * i,
  }
}

export function softFloating(t, intensity) {
  const u = wrap01(t)
  const i = clamp01(intensity)
  const wave = Math.sin(u * TAU)
  return {
    ...identityPose(),
    dy: wave * 15 * i,
    rotateDeg: wave * 2 * i,
  }
}

const PRESET_FNS = {
  jellyBounce,
  neonPulse,
  cuteWiggle,
  cinematicGlitch,
  rgbGlitch: cinematicGlitch,
  softFloating,
}

export function sampleMotion(presetId, t, intensity) {
  const fn = PRESET_FNS[presetId] || jellyBounce
  return fn(t, intensity)
}

export function poseAtLoopSeam(presetId, intensity = 0.7) {
  const a = sampleMotion(presetId, 0, intensity)
  const b = sampleMotion(presetId, 1, intensity)
  return { start: a, end: b }
}

function drawContained(ctx, source, dx, dy, width, height) {
  const sw = source.naturalWidth || source.width || width
  const sh = source.naturalHeight || source.height || height
  const scale = Math.min(width / sw, height / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.drawImage(source, dx - dw / 2, dy - dh / 2, dw, dh)
}

export function paintMotionFrame(ctx, source, {
  width,
  height,
  time01,
  preset = 'jellyBounce',
  intensity = 70,
} = {}) {
  const w = width || ctx.canvas.width
  const h = height || ctx.canvas.height
  const amp = typeof intensity === 'number' && intensity > 1 ? intensity / 100 : clamp01(intensity)
  const motion = sampleMotion(preset, time01, amp)

  ctx.save()
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
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.55 * motion.alpha
    drawContained(ctx, source, -shift, motion.dy, w, h)
    ctx.globalAlpha = 0.4 * motion.alpha
    drawContained(ctx, source, shift, motion.dy, w, h)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = motion.alpha
    drawContained(ctx, source, 0, motion.dy, w, h)
    const bandH = Math.max(8, h * 0.1)
    const bandY = h * 0.38 + motion.dy
    ctx.drawImage(
      source,
      0,
      Math.max(0, (source.height || h) * 0.38),
      source.width || w,
      Math.max(1, (source.height || h) * 0.1),
      -w / 2 + motion.sliceShift,
      -h / 2 + bandY - bandH / 2,
      w,
      bandH,
    )
  } else {
    drawContained(ctx, source, 0, motion.dy, w, h)
  }

  ctx.restore()
}
