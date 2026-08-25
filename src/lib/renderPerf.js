const frameDeltas = []
let lastFrame = 0
let lastPaintMs = 16.7

export function noteFrame(now) {
  if (lastFrame) {
    const delta = Math.max(1, now - lastFrame)
    frameDeltas.push(delta)
    if (frameDeltas.length > 48) frameDeltas.shift()
  }
  lastFrame = now
}

export function notePaint(ms) {
  if (!Number.isFinite(ms) || ms < 0) return
  lastPaintMs = ms
}

export function readRenderPerf() {
  const avg = frameDeltas.length
    ? frameDeltas.reduce((sum, item) => sum + item, 0) / frameDeltas.length
    : 16.67
  const fps = Math.min(60, 1000 / Math.max(1, avg))
  const ms = lastPaintMs
  const status = fps >= 50 && ms <= 24 ? 'ok' : fps >= 30 && ms <= 42 ? 'warn' : 'error'
  const label = status === 'ok' ? '안정적' : status === 'warn' ? '주의' : '지연'
  return {
    fps: Math.round(fps),
    ms: Math.round(ms * 10) / 10,
    samples: frameDeltas.length,
    status,
    label,
    text: `캔버스 렌더링 엔진: ${Math.round(fps)} FPS / 지연시간 ${Math.round(ms)}ms (${label})`,
  }
}

export function resetRenderPerf() {
  frameDeltas.length = 0
  lastFrame = 0
  lastPaintMs = 16.7
}
