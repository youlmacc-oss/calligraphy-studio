export const FONT_SIZE_MIN = 10
export const FONT_SIZE_MAX = 130
export const FONT_SIZE_MAIN_DEFAULT = 70
export const FONT_SIZE_SUB_DEFAULT = 40
export const FONT_SIZE_EXTRA_DEFAULT = 36
export const FONT_SIZE_SEAL_DEFAULT = 48

export function clampFontSize(value) {
  const next = Number(value)
  if (!Number.isFinite(next)) return FONT_SIZE_MAIN_DEFAULT
  return Math.round(Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, next)))
}

export function fontSizeSliderRange() {
  return { min: FONT_SIZE_MIN, max: FONT_SIZE_MAX }
}
