import { hitTestTailHandle, resolveTailAbs, TAIL_HANDLE_RADIUS } from './speechBubbleTail.js'

export function canvasEventPoint(canvas, event, logicalW, logicalH) {
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const touch = event.touches?.[0] || event.changedTouches?.[0]
  const clientX = touch ? touch.clientX : event.clientX
  const clientY = touch ? touch.clientY : event.clientY
  const width = Math.max(1, Number(logicalW) || canvas.width || 1)
  const height = Math.max(1, Number(logicalH) || canvas.height || 1)
  return {
    x: (clientX - rect.left) * (width / Math.max(1, rect.width)),
    y: (clientY - rect.top) * (height / Math.max(1, rect.height)),
  }
}

export function hitTestSpeechBubble(bubble, x, y) {
  if (!bubble?.visible) return false
  const bW = Number(bubble.width) || 120
  const bH = Number(bubble.height) || 60
  const bX = Number(bubble.x)
  const bY = Number(bubble.y)
  if (!Number.isFinite(bX) || !Number.isFinite(bY)) return false
  return x >= bX - bW / 2 && x <= bX + bW / 2 && y >= bY - bH / 2 && y <= bY + bH / 2
}

function clampPoint(x, y, w, h) {
  return {
    x: Math.min(w, Math.max(0, x)),
    y: Math.min(h, Math.max(0, y)),
  }
}

export function setupSpeechBubbleDragger(canvasRef, getBubble, updateBubblePos, logicalSize, options = {}) {
  let isDragging = false
  let dragKind = null
  let startX = 0
  let startY = 0
  let initialBubbleX = 0
  let initialBubbleY = 0
  let initialHandle = { x: 0, y: 0 }

  const sizeOf = (canvas) => {
    const logical = typeof logicalSize === 'function' ? logicalSize() : logicalSize
    return {
      w: logical?.width || canvas?.width || 360,
      h: logical?.height || canvas?.height || 360,
    }
  }

  const point = (event) => {
    const canvas = canvasRef.current
    const size = sizeOf(canvas)
    return canvasEventPoint(canvas, event, size.w, size.h)
  }

  const handleMouseDown = (event) => {
    const bubble = getBubble?.()
    if (!bubble?.visible) return false
    const { x, y } = point(event)
    const tail = options.getTail?.()
    const abs = resolveTailAbs(bubble, tail)
    const handle = hitTestTailHandle(abs, x, y, TAIL_HANDLE_RADIUS)
    if (handle) {
      isDragging = true
      dragKind = handle
      startX = x
      startY = y
      initialHandle = { x: abs[handle].x, y: abs[handle].y }
      event.preventDefault?.()
      event.stopPropagation?.()
      return true
    }
    if (!hitTestSpeechBubble(bubble, x, y)) return false
    isDragging = true
    dragKind = 'bubble'
    startX = x
    startY = y
    initialBubbleX = Number(bubble.posX) || 0
    initialBubbleY = Number(bubble.posY) || 0
    event.preventDefault?.()
    event.stopPropagation?.()
    return true
  }

  const handleMouseMove = (event) => {
    const canvas = canvasRef.current
    const bubble = getBubble?.()
    const size = sizeOf(canvas)
    if (!isDragging) {
      if (canvas && bubble?.visible) {
        const { x, y } = point(event)
        const tail = options.getTail?.()
        const abs = resolveTailAbs(bubble, tail)
        const handle = hitTestTailHandle(abs, x, y, TAIL_HANDLE_RADIUS)
        canvas.style.cursor = handle ? 'pointer' : (hitTestSpeechBubble(bubble, x, y) ? 'grab' : '')
      }
      return false
    }
    const { x, y } = point(event)
    if (dragKind && dragKind !== 'bubble') {
      if (canvas) canvas.style.cursor = 'pointer'
      const next = clampPoint(initialHandle.x + (x - startX), initialHandle.y + (y - startY), size.w, size.h)
      options.updateTail?.(dragKind, { x: next.x - bubble.x, y: next.y - bubble.y })
      event.preventDefault?.()
      return true
    }
    if (canvas) canvas.style.cursor = 'grabbing'
    updateBubblePos?.(initialBubbleX + (x - startX), initialBubbleY + (y - startY))
    event.preventDefault?.()
    return true
  }

  const handleMouseUp = () => {
    const was = isDragging
    isDragging = false
    dragKind = null
    const canvas = canvasRef.current
    if (canvas && !was) return was
    if (canvas) canvas.style.cursor = ''
    return was
  }

  return { handleMouseDown, handleMouseMove, handleMouseUp }
}
