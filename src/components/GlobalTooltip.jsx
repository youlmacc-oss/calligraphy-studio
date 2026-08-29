import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function hostFrom(node) {
  const el = !node ? null : node.nodeType === 1 ? node : node.parentElement
  return el?.closest?.('[data-tooltip]') || null
}

export default function GlobalTooltip() {
  const [tooltip, setTooltip] = useState({ visible: false, text: '', x: 0, y: 0, below: false })
  const hostRef = useRef(null)

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
      let x = rect.left + rect.width / 2
      let y = rect.top - 10
      let below = false
      if (y < 40) {
        y = rect.bottom + 10
        below = true
      }
      const pad = 12
      x = Math.min(window.innerWidth - pad, Math.max(pad, x))
      hostRef.current = host
      setTooltip({ visible: true, text, x, y, below })
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
    document.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
      window.removeEventListener('resize', hide)
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      id="global-floating-tooltip"
      role="tooltip"
      style={{
        position: 'fixed',
        left: tooltip.visible ? `${tooltip.x}px` : '-9999px',
        top: tooltip.visible ? `${tooltip.y}px` : '0px',
        transform: tooltip.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
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
    document.body,
  )
}
