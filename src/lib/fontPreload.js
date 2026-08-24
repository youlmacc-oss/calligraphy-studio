import { FONTS } from '../presets.js'

const CUSTOM_FONT_FILES = [
  { family: 'EbsHunminjeongeum', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/EBSHunminjeongeum.woff', type: 'font/woff' },
  { family: 'Jalnan', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.2/JalnanOTF00.woff', type: 'font/woff' },
  { family: 'CookieRun', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/CookieRun-Regular.woff', type: 'font/woff' },
  { family: 'CookieRunBold', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/CookieRunOTF-Bold00.woff', type: 'font/woff' },
  { family: 'GyeonggiBatang', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/GyeonggiBatang.woff', type: 'font/woff' },
  { family: 'GabiaBombaram', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/GabiaBombaram.woff', type: 'font/woff' },
  { family: 'FlowerRoad', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_three@1.0/SangSangFlowerRoad.woff', type: 'font/woff' },
  { family: 'SangSangShin', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_three@1.0/SangSangShin.woff', type: 'font/woff' },
  { family: 'PyeongChangPeace', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2206-02@1.0/PyeongChangPeace-Bold.woff2', type: 'font/woff2' },
  { family: 'Uiyeun', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105@1.1/Uiyeun.woff', type: 'font/woff' },
  { family: 'VitroCore', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_20-10-21@1.0/Vitro_corea.woff', type: 'font/woff' },
  { family: 'BareHippie', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/naverfont_01@1.0/Bareun_hipi.woff', type: 'font/woff' },
  { family: 'Cafe24Surround', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff', type: 'font/woff' },
  { family: 'GMarketSans', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff', type: 'font/woff' },
  { family: 'GMarketSansBold', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansBold.woff', type: 'font/woff' },
  { family: 'Monosori', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/Monosori.woff', type: 'font/woff' },
  { family: 'MaruBuri', href: 'https://hangeul.pstatic.net/hangeul_static/webfont/MaruBuri/MaruBuri-Regular.woff2', type: 'font/woff2' },
  { family: 'MaruBuriBold', href: 'https://hangeul.pstatic.net/hangeul_static/webfont/MaruBuri/MaruBuri-Bold.woff2', type: 'font/woff2' },
  { family: 'ChosunMyungjo', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/Chosunilbo_myungjo.woff', type: 'font/woff' },
  { family: 'KoPubBatang', href: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.0/KoPubBatangMedium.woff', type: 'font/woff' },
]

export function primaryFamily(font) {
  const raw = String(font?.family || 'sans-serif').split(',')[0].trim()
  return raw.replace(/^['"]|['"]$/g, '')
}

function fontLoadSpec(family, weight, size = 72) {
  const quoted = /\s/.test(family) ? `"${family}"` : family
  return `${weight} ${size}px ${quoted}`
}

function injectPreloadLinks() {
  CUSTOM_FONT_FILES.forEach((item) => {
    if (document.querySelector(`link[data-font-preload="${item.family}"]`)) return
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.type = item.type
    link.href = item.href
    link.crossOrigin = 'anonymous'
    link.dataset.fontPreload = item.family
    document.head.appendChild(link)
  })
}

function injectWarmupNode() {
  if (document.getElementById('font-preload-warmup')) return
  const box = document.createElement('div')
  box.id = 'font-preload-warmup'
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText = 'position:absolute;left:-9999px;top:0;height:0;overflow:hidden;opacity:0;pointer-events:none;'
  FONTS.forEach((font) => {
    font.weights.forEach((weight) => {
      const span = document.createElement('span')
      span.style.fontFamily = font.family
      span.style.fontWeight = String(weight)
      span.style.fontSize = '72px'
      span.textContent = '가나다 Aa 龍 Dragon'
      box.appendChild(span)
    })
  })
  document.body.appendChild(box)
}

export { fontLoadSpec }

export async function preloadStudioFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return
  injectPreloadLinks()
  injectWarmupNode()
  const jobs = FONTS.flatMap((font) => {
    const family = primaryFamily(font)
    return font.weights.map((weight) => document.fonts.load(fontLoadSpec(family, weight)).catch(() => null))
  })
  await Promise.allSettled(jobs)
}

export async function inspectStudioFonts() {
  if (typeof document === 'undefined' || !document.fonts) {
    return { total: FONTS.length, ready: 0, missing: FONTS.map((item) => item.label) }
  }
  const missing = []
  let ready = 0
  for (const font of FONTS) {
    const spec = fontLoadSpec(primaryFamily(font), font.weights[0], 48)
    const ok = document.fonts.check(spec)
    if (ok) {
      ready += 1
      continue
    }
    await document.fonts.load(spec).catch(() => null)
    if (document.fonts.check(spec)) ready += 1
    else missing.push(font.label)
  }
  return { total: FONTS.length, ready, missing }
}
