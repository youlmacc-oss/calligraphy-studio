import { useEffect, useRef } from 'react'
import { blitToHiDpiCanvas } from '../utils/hqRender.js'

const VIEW_SIZE = 640

export default function PreviewLightboxModal({
  open,
  slices = [],
  index = 0,
  viewBg: _viewBg = 'checker',
  onClose,
  onIndexChange,
}) {
  const canvasRef = useRef(null)
  const total = slices.length
  const safeIndex = total ? ((index % total) + total) % total : 0
  const item = total ? slices[safeIndex] : null

  useEffect(() => {
    if (!open || !item?.canvas || !canvasRef.current) return undefined
    blitToHiDpiCanvas(canvasRef.current, item.canvas, {
      cssWidth: VIEW_SIZE,
      cssHeight: VIEW_SIZE,
      zoomPercent: 100,
      live: true,
      edgePreserve: false,
    })
    return undefined
  }, [open, item])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose?.()
        return
      }
      if (!total) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onIndexChange?.((safeIndex - 1 + total) % total)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onIndexChange?.((safeIndex + 1) % total)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, safeIndex, total, onClose, onIndexChange])

  if (!open || !item) return null

  return (
    <div className="emo-lightbox-root" role="dialog" aria-modal="true" aria-labelledby="emo-lightbox-title">
      <div
        className="emo-lightbox-backdrop"
        onClick={onClose}
        data-tooltip="어두운 배경을 누르면 미리보기를 닫습니다"
      />
      <div className="emo-lightbox-card">
        <header className="emo-lightbox-head">
          <div>
            <h3 id="emo-lightbox-title">{safeIndex + 1} / {total}</h3>
            <p className="emo-lightbox-caption">{item.name}</p>
          </div>
          <button
            type="button"
            className="emo-lightbox-x"
            onClick={onClose}
            aria-label="닫기"
            data-tooltip="미리보기 팝업을 닫습니다"
          >
            ✕
          </button>
        </header>
        <div className="emo-lightbox-stage checkerboard-bg">
          <canvas
            ref={canvasRef}
            className="emo-lightbox-canvas checkerboard-bg"
            width={VIEW_SIZE}
            height={VIEW_SIZE}
            aria-label={`${safeIndex + 1}번 확대 미리보기`}
          />
        </div>
        <footer className="emo-lightbox-nav">
          <button
            type="button"
            onClick={() => onIndexChange?.((safeIndex - 1 + total) % total)}
            aria-label="이전"
            data-tooltip="이전 컷을 봅니다"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onClose}
            data-tooltip="미리보기 팝업을 닫습니다"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => onIndexChange?.((safeIndex + 1) % total)}
            aria-label="다음"
            data-tooltip="다음 컷을 봅니다"
          >
            ▶
          </button>
        </footer>
      </div>
    </div>
  )
}
