export const STUDIO_FIT_WIDTH = 1600
export const STUDIO_FIT_HEIGHT = 1000

let studioFitPaused = false

export function pauseStudioFit(paused) {
  studioFitPaused = Boolean(paused)
  if (typeof document === 'undefined') return
  if (!studioFitPaused) {
    applyStudioFit()
    return
  }
  const html = document.documentElement
  html.removeAttribute('data-studio-fit')
  html.style.removeProperty('--studio-scale')
  html.style.removeProperty('--studio-layout-h')
  html.style.removeProperty('--studio-layout-w')
  html.style.removeProperty('--studio-fit-x')
}

export function readRenderedScale() {
  if (typeof document === 'undefined') return 1
  const body = document.body
  const layout = Number(body?.offsetWidth) || 0
  const visual = Number(body?.getBoundingClientRect?.().width) || 0
  if (layout < 2 || visual < 2) {
    const raw = Number.parseFloat(document.documentElement.style.getPropertyValue('--studio-scale'))
    return Number.isFinite(raw) && raw > 0.05 ? raw : 1
  }
  const scale = visual / layout
  return scale > 0.99 ? 1 : scale
}

export function readStudioScale() {
  return readRenderedScale()
}

export function readStudioLayoutWidth() {
  if (typeof window === 'undefined') return STUDIO_FIT_WIDTH
  if (typeof document !== 'undefined') {
    const layout = Number(document.body?.offsetWidth) || 0
    if (layout > 2) return Math.round(layout)
  }
  const view = window.visualViewport
  const vw = Math.max(1, Number(view?.width) || window.innerWidth || STUDIO_FIT_WIDTH)
  const scale = readRenderedScale()
  return scale < 0.999 ? Math.round(vw / scale) : Math.round(vw)
}

export function layoutPxFromClientPx(clientPx, scale = readRenderedScale()) {
  const safe = scale > 0.05 ? scale : 1
  return clientPx / safe
}

export function applyStudioFit() {
  if (studioFitPaused) return readRenderedScale()
  if (typeof document === 'undefined' || typeof window === 'undefined') return 1
  const html = document.documentElement
  const view = window.visualViewport
  const vw = Math.max(1, Number(view?.width) || window.innerWidth || STUDIO_FIT_WIDTH)
  const vh = Math.max(1, Number(view?.height) || window.innerHeight || STUDIO_FIT_HEIGHT)
  const scale = Math.min(1, vw / STUDIO_FIT_WIDTH, vh / STUDIO_FIT_HEIGHT)
  if (scale >= 0.999) {
    html.removeAttribute('data-studio-fit')
    html.style.removeProperty('--studio-scale')
    html.style.removeProperty('--studio-layout-h')
    html.style.removeProperty('--studio-layout-w')
    html.style.removeProperty('--studio-fit-x')
    return 1
  }
  html.setAttribute('data-studio-fit', '1')
  html.style.setProperty('--studio-scale', String(scale))
  html.style.setProperty('--studio-layout-h', `${Math.round(vh / scale)}px`)
  html.style.setProperty('--studio-layout-w', `${Math.round(vw / scale)}px`)
  html.style.removeProperty('--studio-fit-x')
  return scale
}

export function bindStudioFit() {
  applyStudioFit()
  window.addEventListener('resize', applyStudioFit)
  window.visualViewport?.addEventListener('resize', applyStudioFit)
}
