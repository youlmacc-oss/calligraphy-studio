import { applyViewEdit, defaultViewEdit } from './viewEdit.js'

export const GIF_MOTIONS = [
  {
    id: 'pulse',
    name: '네온 펄스',
    hint: '외곽선 글로우가 숨쉬듯 빛나는 루프',
    use: '유튜브 쇼츠 썸네일 · 네온 간판',
  },
  {
    id: 'float',
    name: '소프트 플로팅',
    hint: '글자가 상하로 부드럽게 떠오르는 모션',
    use: '배너 · 인트로 타이틀',
  },
  {
    id: 'fade',
    name: '시네마틱 페이드',
    hint: '투명도와 스케일이 자연스럽게 순환',
    use: 'SNS 인트로 · 오프닝 카드',
  },
]

export const GIF_MOTION_IDS = GIF_MOTIONS.map((item) => item.id)

export function resolveGifMotion(requested, preset) {
  if (GIF_MOTION_IDS.includes(requested)) return requested
  return gifMotionFromPreset(preset)
}

export function gifMotionFromPreset(preset) {
  const shader = String(preset?.shader || '')
  if (shader.includes('wave') || shader.includes('calli') || shader.includes('kinetic')) return 'float'
  if (shader.includes('chrome') || shader.includes('glass') || shader.includes('hologram') || shader.includes('crystal')) return 'fade'
  return 'pulse'
}

export function composeGifFrame(source, motionId, t) {
  const canvas = document.createElement('canvas')
  const width = Math.max(1, source.width)
  const height = Math.max(1, source.height)
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#07070c'
  ctx.fillRect(0, 0, width, height)
  const wave = 0.5 - Math.cos(t * Math.PI * 2) / 2
  const motion = GIF_MOTION_IDS.includes(motionId) ? motionId : 'pulse'

  if (motion === 'float') {
    const lift = Math.sin(t * Math.PI * 2) * height * 0.038
    ctx.drawImage(source, 0, lift)
    return canvas
  }

  if (motion === 'fade') {
    const scale = 0.9 + wave * 0.14
    ctx.save()
    ctx.globalAlpha = 0.28 + wave * 0.72
    ctx.translate(width / 2, height / 2)
    ctx.scale(scale, scale)
    ctx.drawImage(source, -width / 2, -height / 2)
    ctx.restore()
    return canvas
  }

  const glowed = applyViewEdit(source, {
    ...defaultViewEdit(),
    brightness: 90 + wave * 28,
    contrast: 102 + wave * 14,
    saturation: 108 + wave * 16,
    vignette: 8 + wave * 22,
  }, { letterbox: false, skipCrop: true })
  ctx.drawImage(glowed === source ? source : glowed, 0, 0)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.12 + wave * 0.22
  const glow = ctx.createRadialGradient(width / 2, height / 2, 8, width / 2, height / 2, Math.max(width, height) * 0.55)
  glow.addColorStop(0, 'rgba(103, 232, 249, 0.55)')
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  return canvas
}
