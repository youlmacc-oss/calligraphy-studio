import { coverBitmapSync } from '../utils/gifOptimizer.js'

export const BG_TRANSPARENT = 'transparent'
export const BG_CUSTOM_IMAGE = 'custom_img'

export const BACKGROUND_PRESETS = [
  { id: BG_TRANSPARENT, type: 'transparent', label: '🏁 투명 (기본값)' },
  { id: 'white_studio', type: 'solid', label: '💡 화이트 스튜디오', color: '#f7f4ef', vignette: 'warm' },
  { id: 'dark_studio', type: 'solid', label: '🎬 다크 스튜디오', color: '#18181b', vignette: 'dark' },
  { id: 'sunset', type: 'gradient', label: '🌅 노을 그라데이션', angle: 135, stops: [[0, '#ff7e5f'], [0.55, '#feb47b'], [1, '#ffecd2']] },
  { id: 'cyberpunk', type: 'gradient', label: '🌃 사이버 네온', angle: 120, stops: [[0, '#0f0c29'], [0.45, '#302b63'], [1, '#ff00cc']] },
  { id: 'aurora', type: 'gradient', label: '🌌 오로라 블루', angle: 160, stops: [[0, '#0b3d4a'], [0.5, '#1b6b93'], [1, '#7ef9c0']] },
  { id: 'pastel_sky', type: 'gradient', label: '☁️ 파스텔 스카이', angle: 180, stops: [[0, '#a1c4fd'], [1, '#c2e9fb']] },
  { id: 'comic_pop', type: 'gradient', label: '💥 코믹 팝 옐로우', angle: 90, stops: [[0, '#f6d365'], [1, '#fda085']] },
  { id: BG_CUSTOM_IMAGE, type: 'image', label: '📁 내 이미지 배경...' },
]

const PRESET_MAP = Object.fromEntries(BACKGROUND_PRESETS.map((item) => [item.id, item]))

export function defaultBgConfig() {
  return { type: BG_TRANSPARENT, gradientId: '', imageUrl: '', image: null }
}

export function isTransparentBackground(bgConfig) {
  const type = bgConfig?.type || BG_TRANSPARENT
  return type === BG_TRANSPARENT || type === 'none' || !type
}

export function backgroundSelectValue(bgConfig) {
  if (!bgConfig || isTransparentBackground(bgConfig)) return BG_TRANSPARENT
  if (bgConfig.type === 'image' || bgConfig.type === BG_CUSTOM_IMAGE) return BG_CUSTOM_IMAGE
  return bgConfig.gradientId || bgConfig.type || BG_TRANSPARENT
}

function presetOf(raw) {
  if (!raw) return null
  return PRESET_MAP[raw.gradientId] || PRESET_MAP[raw.type] || null
}

export function normalizeBgConfig(raw) {
  const fallback = defaultBgConfig()
  if (!raw || typeof raw !== 'object') return fallback
  const type = String(raw.type || fallback.type)
  if (type === 'image' || type === BG_CUSTOM_IMAGE) {
    return {
      type: 'image',
      gradientId: '',
      imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : '',
      image: raw.optimizedCanvas || raw.image || null,
      optimizedCanvas: raw.optimizedCanvas || null,
    }
  }
  const preset = presetOf(raw) || PRESET_MAP[type]
  if (preset?.type === 'solid') {
    return { type: 'solid', gradientId: preset.id, imageUrl: '', image: null }
  }
  if (type === 'gradient' || preset?.type === 'gradient') {
    const gradientId = raw.gradientId && PRESET_MAP[raw.gradientId]?.type === 'gradient'
      ? raw.gradientId
      : (PRESET_MAP[type]?.type === 'gradient' ? type : 'sunset')
    return { type: 'gradient', gradientId, imageUrl: '', image: null }
  }
  return fallback
}

export function bgConfigFromSelect(value) {
  if (value === BG_CUSTOM_IMAGE) return { type: 'image', gradientId: '', imageUrl: '', image: null }
  if (!value || value === BG_TRANSPARENT) return defaultBgConfig()
  const preset = PRESET_MAP[value]
  if (preset?.type === 'solid') return { type: 'solid', gradientId: value, imageUrl: '', image: null }
  if (preset?.type === 'gradient') return { type: 'gradient', gradientId: value, imageUrl: '', image: null }
  return defaultBgConfig()
}

function gradientLine(width, height, angleDeg) {
  const rad = ((Number(angleDeg) || 180) * Math.PI) / 180
  const cx = width / 2
  const cy = height / 2
  const len = Math.hypot(width, height) / 2
  return {
    x0: cx - Math.cos(rad) * len,
    y0: cy - Math.sin(rad) * len,
    x1: cx + Math.cos(rad) * len,
    y1: cy + Math.sin(rad) * len,
  }
}

export function drawBackgroundLayer(ctx, width, height, bgConfig) {
  const config = normalizeBgConfig(bgConfig)
  if (isTransparentBackground(config) || !ctx) return false
  const w = Math.max(1, Math.round(width || ctx.canvas?.width || 360))
  const h = Math.max(1, Math.round(height || ctx.canvas?.height || 360))
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (config.type === 'image') {
    const image = config.optimizedCanvas || config.image
    if (image && (image.naturalWidth || image.width)) {
      const fitted = coverBitmapSync(image, w, h) || image
      ctx.drawImage(fitted, 0, 0, w, h)
      ctx.restore()
      return true
    }
    ctx.restore()
    return false
  }
  const preset = PRESET_MAP[config.gradientId] || PRESET_MAP[config.type]
  if (preset?.type === 'solid') {
    ctx.fillStyle = preset.color || '#ffffff'
    ctx.fillRect(0, 0, w, h)
    if (preset.vignette) {
      const inner = Math.min(w, h) * 0.38
      const outer = Math.hypot(w, h) * 0.52
      const wash = ctx.createRadialGradient(w / 2, h / 2, inner, w / 2, h / 2, outer)
      if (preset.vignette === 'warm') {
        wash.addColorStop(0, 'rgba(255, 255, 255, 0)')
        wash.addColorStop(1, 'rgba(196, 176, 150, 0.28)')
      } else {
        wash.addColorStop(0, 'rgba(0, 0, 0, 0)')
        wash.addColorStop(1, 'rgba(0, 0, 0, 0.42)')
      }
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, w, h)
    }
    ctx.restore()
    return true
  }
  if (!preset || preset.type !== 'gradient') {
    ctx.restore()
    return false
  }
  const line = gradientLine(w, h, preset.angle)
  const fill = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1)
  preset.stops.forEach(([stop, color]) => fill.addColorStop(stop, color))
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
  return true
}

export function applyBackgroundUnder(ctx, width, height, bgConfig) {
  if (!ctx || isTransparentBackground(bgConfig)) return false
  ctx.save()
  ctx.globalCompositeOperation = 'destination-over'
  const painted = drawBackgroundLayer(ctx, width, height, bgConfig)
  ctx.restore()
  return painted
}

export function renderCompositeFrame(ctx, width, height, currentFrameIdx, motionFrames, bgConfig, subtitleConfig) {
  const w = Math.max(1, Math.round(width || ctx.canvas?.width || 360))
  const h = Math.max(1, Math.round(height || ctx.canvas?.height || 360))
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  if (!isTransparentBackground(bgConfig)) {
    drawBackgroundLayer(ctx, w, h, bgConfig)
  }
  if (motionFrames && motionFrames.length > 0) {
    const activeFrame = motionFrames[currentFrameIdx % motionFrames.length]
    if (activeFrame) ctx.drawImage(activeFrame, 0, 0, w, h)
  }
  if (subtitleConfig && subtitleConfig.text && typeof subtitleConfig.draw === 'function') {
    subtitleConfig.draw(ctx, w, h, subtitleConfig)
  }
  return true
}
