import { FONTS } from '../presets.js'

export const FAVORITES_KEY = 'styler-favorite-fonts-v1'

const FONT_ID_SET = new Set(FONTS.map((item) => item.id))

export function normalizeFavoriteIds(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const next = []
  value.forEach((id) => {
    if (typeof id !== 'string' || !FONT_ID_SET.has(id) || seen.has(id)) return
    seen.add(id)
    next.push(id)
  })
  return next
}

export function loadFavoriteFonts() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    return normalizeFavoriteIds(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveFavoriteFonts(ids) {
  const next = normalizeFavoriteIds(ids)
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  } catch {
    /* quota or private mode */
  }
  return next
}

export function toggleFavoriteId(ids, fontId) {
  if (!FONT_ID_SET.has(fontId)) return normalizeFavoriteIds(ids)
  const list = normalizeFavoriteIds(ids)
  return list.includes(fontId)
    ? list.filter((id) => id !== fontId)
    : [...list, fontId]
}

export function inspectFavoriteStore(memoryIds) {
  let raw = null
  let parseError = false
  let parsed = null
  try {
    raw = localStorage.getItem(FAVORITES_KEY)
    if (raw != null && raw !== '') parsed = JSON.parse(raw)
  } catch {
    parseError = true
  }
  const stored = normalizeFavoriteIds(parsed)
  const memory = normalizeFavoriteIds(memoryIds ?? stored)
  const unknown = Array.isArray(parsed)
    ? parsed.filter((id) => typeof id === 'string' && !FONT_ID_SET.has(id))
    : []
  const duplicates = Array.isArray(parsed)
    ? parsed.length - new Set(parsed.filter((id) => typeof id === 'string')).size
    : 0
  return {
    raw,
    parseError,
    isArray: Array.isArray(parsed) || raw == null || raw === '',
    stored,
    memory,
    unknown,
    duplicates,
    catalogSize: FONTS.length,
  }
}
