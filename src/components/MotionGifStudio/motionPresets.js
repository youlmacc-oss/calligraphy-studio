export const MOTION_PRESETS = [
  { id: 'jellyBounce', label: '① 젤리 바운스', hint: '탄성 상하 압축/도약' },
  { id: 'neonPulse', label: '② 네온 브리딩', hint: '글로우 반경·투명도 순환' },
  { id: 'cuteWiggle', label: '③ 큐트 위글', hint: '±8° 틸트 + 바운스' },
  { id: 'rgbGlitch', label: '④ 시네마틱 글리치', hint: 'RGB 스플릿·디지털 스냅' },
  { id: 'softFloating', label: '⑤ 소프트 플로팅', hint: '사인파 상하 루프' },
]

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

export function paintMotionFrame(ctx, source, {
  width,
  height,
  time01,
  preset = 'jellyBounce',
  intensity = 70,
} = {}) {
  const w = width || ctx.canvas.width
  const h = height || ctx.canvas.height
  const amp = clampIntensity(intensity) / 100
  const t = ((Number(time01) % 1) + 1) % 1
  const wave = Math.sin(t * Math.PI * 2)
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)

  if (preset === 'jellyBounce') {
    const squash = 1 - amp * 0.22 * Math.max(0, -wave)
    const stretch = 1 + amp * 0.16 * Math.max(0, wave)
    ctx.translate(0, wave * amp * h * 0.06)
    ctx.scale(1 / squash, squash * stretch)
  } else if (preset === 'neonPulse') {
    const glow = 8 + amp * 22 * (0.5 + 0.5 * wave)
    ctx.globalAlpha = 0.72 + amp * 0.28 * (0.5 + 0.5 * wave)
    ctx.shadowColor = 'rgba(34, 211, 238, 0.85)'
    ctx.shadowBlur = glow
  } else if (preset === 'cuteWiggle') {
    ctx.rotate(((8 * amp * wave) * Math.PI) / 180)
    ctx.translate(0, Math.abs(wave) * amp * h * 0.04)
  } else if (preset === 'rgbGlitch') {
    const snap = Math.abs(wave) > 0.72 ? amp * 6 : amp * 1.2
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.85
    ctx.drawImage(source, -w / 2 - snap, -h / 2, w, h)
    ctx.globalAlpha = 0.55
    ctx.drawImage(source, -w / 2 + snap, -h / 2, w, h)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  } else {
    ctx.translate(0, wave * amp * h * 0.07)
  }

  ctx.drawImage(source, -w / 2, -h / 2, w, h)
  ctx.restore()
}
