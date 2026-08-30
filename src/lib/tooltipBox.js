export const TOOLTIP_VIEW_PAD = 12

export function tooltipPlacement(rect, viewW) {
  const mid = rect.left + rect.width / 2
  if (rect.left < 240 || mid < viewW * 0.3) {
    return {
      x: Math.round(rect.right + 10),
      y: Math.round(rect.top + rect.height / 2),
      place: 'right',
    }
  }
  if (rect.top < 48) {
    return { x: Math.round(mid), y: Math.round(rect.bottom + 10), place: 'below' }
  }
  return { x: Math.round(mid), y: Math.round(rect.top - 10), place: 'above' }
}

export function shiftBoxIntoView(left, top, width, height, viewW, viewH, pad = TOOLTIP_VIEW_PAD) {
  let dx = 0
  let dy = 0
  if (left < pad) dx = pad - left
  if (left + width + dx > viewW - pad) dx = viewW - pad - (left + width)
  if (top < pad) dy = pad - top
  if (top + height + dy > viewH - pad) dy = viewH - pad - (top + height)
  return { dx, dy }
}

export function tooltipTransform(place, dx = 0, dy = 0) {
  const base = {
    above: 'translate(-50%, -100%)',
    below: 'translate(-50%, 0)',
    right: 'translate(0, -50%)',
  }[place] || 'translate(-50%, -100%)'
  if (!dx && !dy) return base
  return `${base} translate(${dx}px, ${dy}px)`
}
