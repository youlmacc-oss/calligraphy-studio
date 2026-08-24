import clsx from 'clsx'
import { useEffect, useRef } from 'react'
import { constrainCrop } from '../lib/viewEdit.js'

const HANDLES = ['tl', 'tr', 'bl', 'br', 't', 'r', 'b', 'l']

export default function CropOverlay({ rect, aspectId, onChange }) {
  const dragRef = useRef(null)
  const overlayRef = useRef(null)

  const start = (handle, event) => {
    event.preventDefault()
    event.stopPropagation()
    overlayRef.current?.setPointerCapture?.(event.pointerId)
    const box = overlayRef.current?.getBoundingClientRect()
    if (!box) return
    dragRef.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      box,
      origin: { ...rect },
    }
  }

  useEffect(() => {
    const move = (event) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = (event.clientX - drag.startX) / drag.box.width
      const dy = (event.clientY - drag.startY) / drag.box.height
      const next = { ...drag.origin }
      if (drag.handle === 'move') {
        next.x += dx
        next.y += dy
      }
      if (drag.handle.includes('l')) {
        next.x += dx
        next.w -= dx
      }
      if (drag.handle.includes('r')) next.w += dx
      if (drag.handle.includes('t')) {
        next.y += dy
        next.h -= dy
      }
      if (drag.handle.includes('b')) next.h += dy
      onChange(constrainCrop(next, aspectId))
    }
    const end = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [aspectId, onChange])

  return (
    <div ref={overlayRef} className="crop-overlay">
      <div
        className="crop-box"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.w * 100}%`,
          height: `${rect.h * 100}%`,
        }}
        onPointerDown={(event) => start('move', event)}
      >
        <span className="crop-ratio">{aspectId === 'free' ? '자유 비율' : aspectId}</span>
        {HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            className={clsx('crop-handle', handle)}
            aria-label={`${handle} 크기 조절`}
            onPointerDown={(event) => start(handle, event)}
          />
        ))}
      </div>
    </div>
  )
}
