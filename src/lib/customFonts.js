export const CUSTOM_FONT_GROUP = {
  id: 'custom',
  tag: '📂 내 글꼴',
  label: '📂 내 글꼴',
  hint: '이 브라우저에 올린 TTF/OTF/WOFF 모음',
  tooltip: '이 브라우저에 올린 TTF/OTF/WOFF 모음',
}

const faces = new Map()

function familyFromFileName(name) {
  const base = String(name || 'Custom').replace(/\.[^.]+$/, '')
  const safe = base.replace(/[^a-zA-Z0-9가-힣_-]/g, '').slice(0, 36) || 'Custom'
  return `UserFont_${safe}_${Date.now().toString(36)}`
}

export function isFontFile(file) {
  if (!file) return false
  if (/\.(ttf|otf|woff2?)$/i.test(file.name || '')) return true
  return /font|truetype|opentype|woff/i.test(file.type || '')
}

export async function registerCustomFontFile(file) {
  if (!file || !isFontFile(file)) {
    throw new Error('TTF, OTF, WOFF, WOFF2 파일만 올릴 수 있습니다.')
  }
  if (typeof FontFace !== 'function') {
    throw new Error('이 브라우저는 FontFace API를 지원하지 않습니다.')
  }
  const buffer = await file.arrayBuffer()
  const familyName = familyFromFileName(file.name)
  const face = new FontFace(familyName, buffer)
  await face.load()
  document.fonts.add(face)
  const id = `custom-${familyName}`
  faces.set(id, face)
  return {
    id,
    label: String(file.name || 'Custom').replace(/\.[^.]+$/, ''),
    family: `"${familyName}"`,
    familyName,
    group: 'custom',
    weights: [400, 700],
    custom: true,
  }
}

export function customFontReady(id) {
  return faces.has(id) || (typeof document !== 'undefined' && document.fonts?.size >= 0)
}
