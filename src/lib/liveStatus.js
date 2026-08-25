export function formatHudNumber(value, digits = 2) {
  const rounded = Number(Number(value || 0).toFixed(digits))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export function liveStatusFromLayer(layer, { fontsById, presetsById, studioPreset } = {}) {
  if (!layer) return null
  const raw = String(layer.text ?? '').replace(/\r\n/g, '\n')
  const chars = [...raw].length
  const lines = raw.length ? raw.split('\n').length : 1
  const font = fontsById?.[layer.fontId]
  const layerPreset = presetsById?.[layer.presetId] ?? (layer.role === 'main' ? studioPreset : null)
  const badge = layer.role === 'main'
    ? { tone: 'main', text: '👑 메인' }
    : layer.role === 'sub'
      ? { tone: 'sub', text: '✨ 서브' }
      : { tone: 'extra', text: '✦ 추가' }
  return {
    badge,
    stats: `${chars}자 / ${lines}줄`,
    fontName: font?.label ?? layer.fontId ?? '폰트',
    fontSize: Math.round(Number(layer.fontSize) || 0),
    tracking: formatHudNumber(layer.letterSpacing),
    leading: formatHudNumber(layer.lineHeight || 1.2),
    x: formatHudNumber(layer.ox),
    y: formatHudNumber(layer.oy),
    rotation: Math.round(Number(layer.rotation) || 0),
    opacity: Math.round(Math.max(0, Math.min(1, Number(layer.opacity) ?? 1)) * 100),
    presetName: layerPreset?.name ?? '직접 설정',
  }
}
