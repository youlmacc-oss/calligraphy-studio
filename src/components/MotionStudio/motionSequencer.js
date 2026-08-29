export const SEQUENCE_FPS_MIN = 4
export const SEQUENCE_FPS_MAX = 24
export const SEQUENCE_FPS_DEFAULT = 8
export const SEQUENCE_VIEW_SIZE = 360

export function clampSequenceFps(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return SEQUENCE_FPS_DEFAULT
  return Math.min(SEQUENCE_FPS_MAX, Math.max(SEQUENCE_FPS_MIN, n))
}

export function cutFrameUrl(cut) {
  return cut?.preview || cut?.url || cut?.dataUrl || ''
}

export function makeSequenceItem(cut, index = 0, slot = 0) {
  const url = cutFrameUrl(cut)
  const cutId = cut?.id || `cut-${index + 1}`
  return {
    id: `${cutId}-seq-${slot}-${Date.now().toString(36)}`,
    cutId,
    cutIndex: index,
    url,
    label: `${index + 1}`,
  }
}

export function moveSequenceItem(items, index, delta) {
  const list = Array.isArray(items) ? items.slice() : []
  const from = Math.round(Number(index))
  const to = from + Math.round(Number(delta) || 0)
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
  return list
}

export function removeSequenceItem(items, id) {
  return (Array.isArray(items) ? items : []).filter((item) => item.id !== id)
}

export function pingPongCycleLength(count) {
  const n = Math.max(0, Math.round(Number(count) || 0))
  if (n < 2) return n
  return n * 2 - 2
}

export function pingPongPlayIndex(step, count, enabled) {
  const n = Math.max(0, Math.round(Number(count) || 0))
  if (n <= 0) return 0
  if (!enabled || n < 2) return ((Math.round(Number(step) || 0) % n) + n) % n
  const cycle = pingPongCycleLength(n)
  const u = ((Math.round(Number(step) || 0) % cycle) + cycle) % cycle
  return u < n ? u : cycle - u
}

export function expandPingPong(frames, enabled = true) {
  const list = Array.isArray(frames) ? frames.slice() : []
  if (!enabled || list.length < 2) return list
  return list.concat(list.slice(1, -1).reverse())
}

export function clampStillLoopSeconds(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 2
  return Math.min(2, Math.max(1, n))
}

export function stillLoopFrameCount(fps = SEQUENCE_FPS_DEFAULT, loopSeconds = 2, speed = 1) {
  const rate = Math.max(1, clampSequenceFps(fps) * (Number(speed) || 1))
  const seconds = clampStillLoopSeconds(loopSeconds)
  return Math.max(8, Math.round(rate * seconds))
}

export function captionLoopIndex(time01, fps = SEQUENCE_FPS_DEFAULT, loopSeconds = 2, speed = 1) {
  const total = stillLoopFrameCount(fps, loopSeconds, speed)
  const raw = Number(time01)
  const t = Number.isFinite(raw) ? ((raw % 1) + 1) % 1 : 0
  return { index: Math.min(total - 1, Math.floor(t * total)), total }
}

export function resolvePlaybackFrames(sequence = [], sourceUrl = '') {
  const frames = (Array.isArray(sequence) ? sequence : []).filter((item) => item?.url)
  if (frames.length) return { frames, stillLoop: false }
  const url = String(sourceUrl || '')
  if (!url) return { frames: [], stillLoop: false }
  return {
    frames: [{ id: 'virtual-still', url, virtual: true, label: '1' }],
    stillLoop: true,
  }
}
