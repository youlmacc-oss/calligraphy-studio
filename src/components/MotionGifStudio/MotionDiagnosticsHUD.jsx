import { useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { MOTION_DIAG_STEPS } from './diagnosticsEngine.js'

function toneClass(status) {
  if (status === 'FAIL') return 'is-fail'
  if (status === 'WARN') return 'is-warn'
  return 'is-pass'
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('복사 실패')
}

export default function MotionDiagnosticsHUD({
  report,
  open,
  onToggle,
}) {
  const [copied, setCopied] = useState('')
  const metrics = report?.metrics || {}
  const checks = report?.checks || []
  const pass = report?.passCount || 0
  const total = report?.total || MOTION_DIAG_STEPS.length
  const overall = report?.overall || 'WARN'

  const copyLog = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    const text = report?.logText || '{}'
    try {
      await writeClipboard(text)
      setCopied('진단 로그를 클립보드에 복사했습니다')
      window.setTimeout(() => setCopied(''), 1600)
    } catch (error) {
      setCopied(error.message || '복사 실패')
    }
  }

  return (
    <>
      <button
        type="button"
        className={clsx('mgs-diag-launch allow-long-text', toneClass(overall), open && 'is-on')}
        onClick={onToggle}
        aria-expanded={open}
        data-diag-hud="1"
        data-diag-overall={overall}
        data-diag-pass={pass}
        data-diag-total={total}
        data-tooltip="실시간 자가진단 HUD 열기"
        data-mgs-place="up"
      >
        📋 {pass}/{total} {overall} 자가진단 HUD
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
          <div className="mgs-diag-pop" role="dialog" aria-modal="true" aria-label="모션 GIF 자가진단">
            <button type="button" className="mgs-diag-pop-backdrop" aria-label="닫기" onClick={onToggle} />
            <div className="mgs-diag-pop-card">
              <div className="mgs-diag-pop-head">
                <strong>자가진단 텔레메트리 · {total} STEP · {report?.baselineVersion || metrics.baselineVersion || 'baseline'}</strong>
                <button
                  type="button"
                  className="mgs-diag-copy"
                  onClick={copyLog}
                  data-tooltip="진단 JSON을 클립보드에 복사"
                >
                  📋 진단 로그 복사
                </button>
                <button
                  type="button"
                  className="studio-modal-close"
                  onClick={onToggle}
                  aria-label="닫기"
                  data-tooltip="자가진단 창을 닫습니다"
                >
                  ✕ 닫기
                </button>
              </div>
              <div className="mgs-diag-metrics">
                <span>FPS {metrics.fps || 0}/{metrics.targetFps || 24}</span>
                <span>SRC {metrics.source}</span>
                <span>OUT {metrics.output}</span>
                <span>{metrics.frames || 0}f</span>
                <span>≈{metrics.estimateKb || 0} KB</span>
                <span>{metrics.elapsedMs || 0}ms</span>
                <span>{metrics.baselineOk === false ? 'BASELINE DRIFT' : 'BASELINE LOCK'}</span>
              </div>
              {copied ? <p className="mgs-diag-copied">{copied}</p> : null}
              <ol className="mgs-diag-grid">
                {checks.map((item) => (
                  <li key={item.id} className={clsx('mgs-diag-item', toneClass(item.status))} data-diag-step={item.id} data-diag-status={item.status}>
                    <div className="mgs-diag-item-top">
                      <span className={clsx('mgs-diag-badge', toneClass(item.status))}>{item.status}</span>
                      <strong>{item.id}</strong>
                      <em>{item.title || item.name}</em>
                    </div>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  )
}
