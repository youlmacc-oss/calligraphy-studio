import { createPortal } from 'react-dom'
import { magnify } from '../MenuMagnifierHUD.jsx'
import './motionStudio.css'

function blockGauge(percent) {
  const packed = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  const filled = Math.max(0, Math.min(10, Math.round(packed / 10)))
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${packed}%`
}

export default function EncodeProgressModal({
  open,
  state = 'run',
  message = '',
  percent = 0,
  current = 0,
  total = 0,
  previewUrl = '',
  error = '',
  onDownload,
  onPreview,
  onClose,
}) {
  if (!open || typeof document === 'undefined') return null
  const packed = state === 'done' ? 100 : Math.max(0, Math.min(99, Math.round(Number(percent) || 0)))
  const gauge = blockGauge(state === 'done' ? 100 : packed)
  return createPortal(
    (
      <div
        className="ms-enc-overlay"
        data-encode-progress="1"
        data-encode-state={state}
        data-encode-pct={packed}
        role="dialog"
        aria-modal="true"
        aria-label="인코딩 진행"
      >
        <div className="ms-enc-card">
          <p className="ms-enc-msg">{error || message || '🎬 GIF 생성 중...'}</p>
          <div className="ms-enc-track" aria-hidden="true">
            <i style={{ width: `${packed}%` }} />
          </div>
          <p className="ms-enc-gauge" data-encode-gauge="1">{gauge}</p>
          {total > 0 ? (
            <p className="ms-enc-pct">{current} / {total} 프레임</p>
          ) : (
            <p className="ms-enc-pct">{packed}%</p>
          )}
          <div className="ms-enc-preview checkerboard-bg">{previewUrl ? <img src={previewUrl} alt="인코딩 미리보기" width="360" height="360" /> : null}</div>
          {state !== 'run' ? (
            <div className="ms-enc-actions">
              {state === 'done' ? (
                <>
                  {onDownload ? (
                    <button type="button" className="ms-btn" onClick={onDownload} {...magnify('다운로드', '생성한 파일을 바로 저장합니다')}>
                      다운로드
                    </button>
                  ) : null}
                  {onPreview ? (
                    <button type="button" className="ms-btn" onClick={onPreview} {...magnify('새 창', '체커보드 배경의 새 창에서 미리봅니다')}>
                      새 창
                    </button>
                  ) : null}
                </>
              ) : null}
              <button
                type="button"
                className="ms-btn"
                onClick={onClose}
                {...magnify('닫기', '인코딩 창을 닫습니다')}
              >
                닫기
              </button>
            </div>
          ) : null}
        </div>
      </div>
    ),
    document.body,
  )
}

export { EncodeProgressModal as EncodingProgressModal }
