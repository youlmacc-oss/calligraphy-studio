export const DEFAULT_EMOTICON_FONT_ID = 'Jua'

export const EMOTICON_FONTS = [
  { id: 'Jua', name: '주아체 (귀여움)', family: '"Jua", sans-serif', weight: 400, loadFamily: 'Jua' },
  { id: 'Do Hyeon', name: '도현체 (굵은 강조)', family: '"Do Hyeon", sans-serif', weight: 400, loadFamily: 'Do Hyeon' },
  { id: 'CookieRun', name: '쿠키런체 (통통발랄)', family: '"CookieRun", sans-serif', weight: 700, loadFamily: 'CookieRun' },
  { id: 'TmonMonsori', name: '몬소리체 (임팩트)', family: '"TmonMonsori", "Monosori", sans-serif', weight: 400, loadFamily: 'TmonMonsori' },
  { id: 'GmarketSansBold', name: 'G마켓 산스 (모던)', family: '"GMarketSans", sans-serif', weight: 700, loadFamily: 'GMarketSans' },
  { id: 'Binggrae', name: '빙그레체 (부드러움)', family: '"Binggrae", sans-serif', weight: 400, loadFamily: 'Binggrae' },
  { id: 'Yeon Sung', name: '연성체 (손글씨)', family: '"Yeon Sung", cursive', weight: 400, loadFamily: 'Yeon Sung' },
  { id: 'GabiaBombaram', name: '봄바람체 (발랄)', family: '"GabiaBombaram", cursive', weight: 400, loadFamily: 'GabiaBombaram' },
  { id: 'NEXONLv1GothicBold', name: '배찌체 (아기자기)', family: '"NEXONLv1GothicBold", sans-serif', weight: 700, loadFamily: 'NEXONLv1GothicBold' },
  { id: 'Pretendard', name: '프리텐다드 (깔끔)', family: '"Pretendard", sans-serif', weight: 900, loadFamily: 'Pretendard' },
]

const FONTS_BY_ID = Object.fromEntries(EMOTICON_FONTS.map((item) => [item.id, item]))

export function resolveEmoticonFont(id) {
  return FONTS_BY_ID[id] || FONTS_BY_ID[DEFAULT_EMOTICON_FONT_ID]
}

export function normalizeEmoticonFontId(id) {
  return resolveEmoticonFont(id).id
}

export function captionCanvasFont(fontPx, fontId) {
  const font = resolveEmoticonFont(fontId)
  const size = Math.max(12, Math.round(Number(fontPx) || 30))
  return `${font.weight} ${size}px ${font.family}`
}

export async function ensureEmoticonFontsReady(fontId) {
  if (typeof document === 'undefined' || !document.fonts?.load) {
    return resolveEmoticonFont(fontId)
  }
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }
  const list = fontId ? [resolveEmoticonFont(fontId)] : EMOTICON_FONTS
  await Promise.all(list.map((font) => {
    const quoted = /\s/.test(font.loadFamily) ? `"${font.loadFamily}"` : font.loadFamily
    return document.fonts.load(`${font.weight} 48px ${quoted}`).catch(() => null)
  }))
  return resolveEmoticonFont(fontId)
}
