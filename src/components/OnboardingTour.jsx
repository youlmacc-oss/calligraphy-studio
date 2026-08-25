import { useEffect, useState } from 'react'
import { ONBOARD_STEPS } from '../lib/onboarding.js'

function measure(selector) {
  const el = typeof document !== 'undefined' ? document.querySelector(selector) : null
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top,
    left: rect.left,
    width: Math.max(8, rect.width),
    height: Math.max(8, rect.height),
  }
}

export default function OnboardingTour({ open, stepIndex, onNext, onPrev, onClose }) {
  const step = ONBOARD_STEPS[stepIndex] || ONBOARD_STEPS[0]
  const [spot, setSpot] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const sync = () => setSpot(measure(step.target))
    sync()
    const timer = window.setTimeout(sync, 80)
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [open, step.target, stepIndex])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === 'Enter') onNext()
      if (event.key === 'ArrowLeft') onPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, onNext, onPrev])

  if (!open || !step) return null

  const cardTop = spot ? Math.min(window.innerHeight - 220, spot.top + spot.height + 12) : 120
  const cardLeft = spot ? Math.max(16, Math.min(window.innerWidth - 360, spot.left)) : 24
  const last = stepIndex >= ONBOARD_STEPS.length - 1

  return (
    <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-dim" onClick={onClose} />
      {spot ? (
        <div
          className="tour-spot"
          style={{
            top: spot.top - 8,
            left: spot.left - 8,
            width: spot.width + 16,
            height: spot.height + 16,
          }}
        />
      ) : null}
      <div className="tour-card" style={{ top: cardTop, left: cardLeft }}>
        <p className="tour-kicker">{stepIndex + 1} / {ONBOARD_STEPS.length}</p>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="mini-btn" onClick={onClose}>건너뛰기</button>
          {stepIndex > 0 ? (
            <button type="button" className="mini-btn" onClick={onPrev}>이전</button>
          ) : null}
          <button type="button" className="tour-next" onClick={last ? onClose : onNext}>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
