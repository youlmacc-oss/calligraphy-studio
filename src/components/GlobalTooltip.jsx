import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { shiftBoxIntoView, tooltipPlacement, tooltipTransform } from '../lib/tooltipBox.js'

function hostFrom(node) {
  const el = !node ? null : node.nodeType === 1 ? node : node.parentElement
  return el?.closest?.('[data-tooltip]') || null
}

export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0, place: 'above', dx: 0, dy: 0 })
  const hostRef = useRef(null)
  const boxRef = useRef(null)

  useEffect(() => {
    const hide = () => {
      hostRef.current = null
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    }

    const showFrom = (host) => {
      const text = host.getAttribute('data-tooltip')?.trim()
      if (!text) {
        hide()
        return
      }
      const rect = host.getBoundingClientRect()
      const next = tooltipPlacement(rect, window.innerWidth)
      hostRef.current = host
      setTooltip({ visible: true, text, x: next.x, y: next.y, place: next.place, dx: 0, dy: 0 })
    }

    const handleMouseOver = (event) => {
      const host = hostFrom(event.target)
      if (!host) return
      if (hostRef.current === host) return
      showFrom(host)
    }

    const handleMouseOut = (event) => {
      const host = hostFrom(event.target)
      if (!host) return
      const next = hostFrom(event.relatedTarget)
      if (next === host) return
      if (next) {
        showFrom(next)
        return
      }
      hide()
    }

    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
      window.removeEventListener('resize', hide)
    }
  }, [])

  useLayoutEffect(() => {
    const node = boxRef.current
    if (!node || !tooltip.visible) return
    const box = node.getBoundingClientRect()
    const { dx, dy } = shiftBoxIntoView(box.left, box.top, box.width, box.height, window.innerWidth, window.innerHeight)
    if (dx || dy) setTooltip((prev) => (prev.dx === dx && prev.dy === dy ? prev : { ...prev, dx, dy }))
  }, [tooltip.visible, tooltip.text, tooltip.x, tooltip.y, tooltip.place])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={boxRef}
      id="global-floating-tooltip"
      role="tooltip"
      style={{
        position: 'fixed',
        left: tooltip.visible ? `${tooltip.x}px` : '-9999px',
        top: tooltip.visible ? `${tooltip.y}px` : '0px',
        transform: tooltipTransform(tooltip.place, tooltip.dx, tooltip.dy),
        backgroundColor: 'rgba(10, 15, 29, 0.98)',
        color: '#ffffff',
        border: '2px solid #38bdf8',
        borderRadius: '8px',
        padding: '8px 14px',
        fontSize: '16px',
        fontWeight: '700',
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
        maxWidth: 'min(360px, calc(100vw - 24px))',
        textAlign: 'center',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8), 0 0 12px rgba(56, 189, 248, 0.4)',
        zIndex: 9999999,
        pointerEvents: 'none',
        opacity: tooltip.visible && tooltip.text ? 1 : 0,
        visibility: tooltip.visible && tooltip.text ? 'visible' : 'hidden',
        transition: 'opacity 0.1s ease',
      }}
    >
      {tooltip.text}
    </div>,
    document.documentElement,
  )
}
