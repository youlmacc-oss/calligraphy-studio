export const LEFT_PANEL_KEY = 'styler-left-panel-width-v2'
export const RIGHT_PANEL_KEY = 'styler-right-panel-width'
export const LEFT_PANEL_DEFAULT = 480
export const RIGHT_PANEL_DEFAULT = 340
export const LEFT_PANEL_MIN = 220
export const LEFT_PANEL_MAX = 1100
export const RIGHT_PANEL_MIN = 220
export const RIGHT_PANEL_MAX = 1100
export const CENTER_COL_MIN = 360
export const PANEL_SPLIT_CHROME = 64

function clampPanelWidth(width, min, max, fallback) {
  return Math.round(Math.max(min, Math.min(max, Number(width) || fallback)))
}

export function clampLeftPanelWidth(width) {
  return clampPanelWidth(width, LEFT_PANEL_MIN, LEFT_PANEL_MAX, LEFT_PANEL_DEFAULT)
}

export function clampRightPanelWidth(width) {
  return clampPanelWidth(width, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX, RIGHT_PANEL_DEFAULT)
}

export function fitPanelPair(left, right, viewport = typeof window === 'undefined' ? 1440 : window.innerWidth) {
  const budget = Math.max(
    LEFT_PANEL_MIN + RIGHT_PANEL_MIN,
    Math.round(viewport - PANEL_SPLIT_CHROME - CENTER_COL_MIN),
  )
  let nextLeft = clampLeftPanelWidth(left, viewport)
  let nextRight = clampRightPanelWidth(right, viewport)
  const used = nextLeft + nextRight
  if (used <= budget) return { left: nextLeft, right: nextRight }
  const scale = budget / used
  return {
    left: Math.max(LEFT_PANEL_MIN, Math.round(nextLeft * scale)),
    right: Math.max(RIGHT_PANEL_MIN, Math.round(nextRight * scale)),
  }
}

export function clampLeftEdgeVisible(width, rightWidth, viewport = typeof window === 'undefined' ? 1440 : window.innerWidth) {
  const right = clampRightPanelWidth(rightWidth)
  const liveMax = Math.max(LEFT_PANEL_MIN, Math.min(LEFT_PANEL_MAX, viewport - PANEL_SPLIT_CHROME - CENTER_COL_MIN - right))
  return Math.round(Math.max(LEFT_PANEL_MIN, Math.min(liveMax, Number(width) || LEFT_PANEL_DEFAULT)))
}

export function clampRightEdgeVisible(width, leftWidth, viewport = typeof window === 'undefined' ? 1440 : window.innerWidth) {
  const left = clampLeftPanelWidth(leftWidth)
  const liveMax = Math.max(RIGHT_PANEL_MIN, Math.min(RIGHT_PANEL_MAX, viewport - PANEL_SPLIT_CHROME - CENTER_COL_MIN - left))
  return Math.round(Math.max(RIGHT_PANEL_MIN, Math.min(liveMax, Number(width) || RIGHT_PANEL_DEFAULT)))
}

export const PANEL_RESIZER_PX = 8

export function sideSplitStyle(collapsed, panelWidth) {
  if (collapsed) {
    return { width: 0, minWidth: 0, maxWidth: 0, flex: '0 0 0px', overflow: 'hidden' }
  }
  const split = Math.max(0, Number(panelWidth) || LEFT_PANEL_DEFAULT) + PANEL_RESIZER_PX
  return { width: split, minWidth: split, maxWidth: split, flex: `0 0 ${split}px` }
}

export function sideAsideStyle(collapsed, panelWidth) {
  if (collapsed) {
    return { width: 0, minWidth: 0, maxWidth: 0, flex: '0 0 0px' }
  }
  const width = Math.max(0, Number(panelWidth) || LEFT_PANEL_DEFAULT)
  return { width, minWidth: width, maxWidth: width, flex: `0 0 ${width}px` }
}
