export const STUDIO_FIT_WIDTH = 1600
export const STUDIO_FIT_HEIGHT = 1000

export function applyStudioFit() {
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
    return 1
  }
  html.setAttribute('data-studio-fit', '1')
  html.style.setProperty('--studio-scale', String(scale))
  html.style.setProperty('--studio-layout-h', `${Math.round(vh / scale)}px`)
  return scale
}

export function bindStudioFit() {
  applyStudioFit()
  window.addEventListener('resize', applyStudioFit)
  window.visualViewport?.addEventListener('resize', applyStudioFit)
}
