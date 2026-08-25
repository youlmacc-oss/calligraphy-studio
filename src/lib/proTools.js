export const SNAP_THRESHOLD = 0.018
export const NUDGE_PX = 1
export const NUDGE_SHIFT_PX = 10
export const PROJECT_KIND = 'calligraphy-studio-project'

export const EXPORT_SCALES = [
  { id: 1, label: '1x 기본', hint: '화면비 원본 해상도' },
  { id: 2, label: '2x FHD', hint: '가로·세로 2배' },
  { id: 4, label: '4x 4K', hint: '가로·세로 4배' },
]

export const PREVIEW_BG_MODES = [
  { id: 'checker', label: '투명', title: '체커보드' },
  { id: 'dark', label: '다크', title: '다크 플레이트' },
  { id: 'light', label: '라이트', title: '라이트 플레이트' },
]

export function isEditableTarget(target) {
  if (!target) return false
  if (target.isContentEditable) return true
  const el = typeof target.closest === 'function'
    ? target.closest('input, textarea, select, [contenteditable="true"]')
    : target
  const tag = el?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el?.isContentEditable)
}

export function applyCenterSnap(ox, oy, threshold = SNAP_THRESHOLD) {
  const snapX = Math.abs(Number(ox) || 0) <= threshold
  const snapY = Math.abs(Number(oy) || 0) <= threshold
  return {
    ox: snapX ? 0 : Math.max(-0.45, Math.min(0.45, Number(ox) || 0)),
    oy: snapY ? 0 : Math.max(-0.45, Math.min(0.45, Number(oy) || 0)),
    snapX,
    snapY,
  }
}

export function nudgeOffset(ox, oy, key, { viewW = 512, viewH = 512, shift = false, locked = false } = {}) {
  if (locked) return { ox, oy, moved: false }
  const step = shift ? NUDGE_SHIFT_PX : NUDGE_PX
  const w = Math.max(1, Number(viewW) || 512)
  const h = Math.max(1, Number(viewH) || 512)
  let nx = Number(ox) || 0
  let ny = Number(oy) || 0
  if (key === 'ArrowLeft') nx -= step / w
  else if (key === 'ArrowRight') nx += step / w
  else if (key === 'ArrowUp') ny -= step / h
  else if (key === 'ArrowDown') ny += step / h
  else return { ox, oy, moved: false }
  return {
    ox: Math.max(-0.45, Math.min(0.45, nx)),
    oy: Math.max(-0.45, Math.min(0.45, ny)),
    moved: true,
  }
}

export function scaledExportSize(aspect, scale = 1) {
  const s = [1, 2, 4].includes(Number(scale)) ? Number(scale) : 1
  return {
    exportW: Math.round((aspect?.w || 1024) * s),
    exportH: Math.round((aspect?.h || 1024) * s),
    scale: s,
  }
}

export function curveExtraPad(fontSize, curveAmount) {
  const curve = Math.abs(Number(curveAmount) || 0)
  if (curve < 2) return 0
  return Math.max(0, (Number(fontSize) || 0) * (curve / 180) * 1.35)
}

export function serializeStudioProject(studio) {
  const dataUrl = studio?.background?.dataUrl || ''
  return JSON.stringify({
    version: 1,
    kind: PROJECT_KIND,
    savedAt: new Date().toISOString(),
    studio: {
      ...studio,
      background: {
        ...(studio?.background || {}),
        dataUrl: dataUrl.length > 1_200_000 ? '' : dataUrl,
      },
    },
  }, null, 2)
}

export function parseStudioProject(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text
  if (!data || typeof data !== 'object') throw new Error('스튜디오 프로젝트 JSON이 아닙니다.')
  const studio = data.studio && typeof data.studio === 'object' ? data.studio : data
  if (data.kind && data.kind !== PROJECT_KIND && !Array.isArray(studio.layers)) {
    throw new Error('스튜디오 프로젝트 JSON이 아닙니다.')
  }
  if (!Array.isArray(studio.layers) || !studio.layers.length) {
    throw new Error('레이어가 없는 프로젝트입니다.')
  }
  return studio
}

export function buildStylePrompt({ layer, font, preset, studio } = {}) {
  const curve = Number(layer?.curveAmount) || 0
  const dual = Number(layer?.strokeWidth2) || 0
  const mood = [
    preset?.name ? `${preset.name} title treatment` : 'custom typography',
    font?.label ? `${font.label} typeface` : '',
    layer?.color ? `fill ${layer.color}` : '',
    Number(layer?.strokeWidth) > 0
      ? `primary outline ${layer.strokeColor || '#22d3ee'} ${layer.strokeWidth}px`
      : 'no primary outline',
    dual > 0
      ? `secondary outline ${layer.strokeColor2 || '#0f172a'} ${dual}px, youtube thumbnail dual-stroke`
      : '',
    curve ? `arc / curved text ${curve} degrees` : 'straight baseline',
    `letter-spacing ${layer?.letterSpacing ?? 0}px`,
    `weight ${layer?.fontWeight ?? 400}`,
  ].filter(Boolean).join(', ')
  const grok = `High-end typography poster, ${mood}, cinematic contrast, crisp glyph edges, no extra letters, follow the uploaded black-and-white mask.`
  const midjourney = `${grok} --ar ${studio?.aspectId || '1:1'} --stylize 200 --v 6.1`
  return {
    mood,
    grok,
    midjourney,
    full: `[Grok]\n${grok}\n\n[Midjourney]\n${midjourney}`,
  }
}
