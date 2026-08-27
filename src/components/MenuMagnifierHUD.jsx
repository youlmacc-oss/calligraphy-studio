import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SKIP = '[data-no-magnifier], .font-picker-panel, .font-acc-body, .font-picker-item, .font-preview-card, .menu-magnifier-hud'

export function magnify(title, desc = '') {
  return {
    'data-tooltip-title': title,
    'data-tooltip-desc': desc,
  }
}

function findHost(node) {
  if (!node || node.nodeType !== 1) {
    const parent = node?.parentElement
    return parent ? findHost(parent) : null
  }
  if (node.closest(SKIP)) return null
  return node.closest('[data-tooltip-title]')
}

export default function MenuMagnifierHUD() {
  const hudRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)
  const [tip, setTip] = useState(null)

  useEffect(() => {
    const place = () => {
      const el = hudRef.current
      if (!el) return
      const { x, y } = posRef.current
      const w = el.offsetWidth || 300
      const h = el.offsetHeight || 84
      let left = x + 18
      let top = y - h - 16
      if (left + w > window.innerWidth - 10) left = x - w - 18
      if (left < 10) left = 10
      if (top < 10) top = y + 22
      if (top + h > window.innerHeight - 10) top = Math.max(10, window.innerHeight - h - 10)
      el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`
    }

    const hide = () => {
      setTip(null)
    }

    const showFrom = (event) => {
      if (document.querySelector('.studio-shell.is-resizing')) {
        hide()
        return
      }
      const host = findHost(event.target)
      if (!host) {
        hide()
        return
      }
      const title = host.getAttribute('data-tooltip-title')?.trim()
      if (!title) {
        hide()
        return
      }
      posRef.current = { x: event.clientX, y: event.clientY }
      setTip({
        title,
        desc: host.getAttribute('data-tooltip-desc')?.trim() || '',
      })
      frameRef.current = requestAnimationFrame(place)
    }

    const onOver = (event) => {
      const next = findHost(event.target)
      const prev = findHost(event.relatedTarget)
      if (next === prev) return
      showFrom(event)
    }

    const onMove = (event) => {
      if (document.querySelector('.studio-shell.is-resizing')) {
        setTip(null)
        return
      }
      posRef.current = { x: event.clientX, y: event.clientY }
      if (!hudRef.current) return
      if (frameRef.current) return
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0
        place()
      })
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      cancelAnimationFrame(frameRef.current)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  useEffect(() => {
    const el = hudRef.current
    if (!el || !tip) return undefined
    el.classList.remove('is-in')
    void el.offsetWidth
    el.classList.add('is-in')
    const { x, y } = posRef.current
    const w = el.offsetWidth || 300
    const h = el.offsetHeight || 84
    let left = x + 18
    let top = y - h - 16
    if (left + w > window.innerWidth - 10) left = x - w - 18
    if (left < 10) left = 10
    if (top < 10) top = y + 22
    el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`
    return undefined
  }, [tip])

  if (typeof document === 'undefined' || !tip) return null

  return createPortal(
    <div ref={hudRef} className="menu-magnifier-hud is-in" role="tooltip">
      <p className="menu-magnifier-title">{tip.title}</p>
      {tip.desc ? <p className="menu-magnifier-desc">{tip.desc}</p> : null}
    </div>,
    document.body,
  )
}
