import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'

export function mirrorPreviewFrame(source, dest) {
  if (!source || !dest || source === dest) return false
  const sw = Math.max(0, Number(source.width) || 0)
  const sh = Math.max(0, Number(source.height) || 0)
  if (sw < 2 || sh < 2) return false
  let ctx = null
  try {
    ctx = dest.getContext('2d', { alpha: true })
  } catch {
    return false
  }
  if (!ctx) return false
  try {
    if (dest.width !== sw) dest.width = sw
    if (dest.height !== sh) dest.height = sh
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, dest.width, dest.height)
    ctx.drawImage(source, 0, 0, dest.width, dest.height)
    return true
  } catch {
    return false
  }
}

export default function ChatRoomSimulator({
  frameUrl = '',
  theme = 'light',
  onTheme,
  canvasRef,
}) {
  const dark = theme === 'dark'
  const bindCanvas = (node) => {
    if (canvasRef) canvasRef.current = node
  }

  return (
    <div
      className={clsx('ms-chat', dark ? 'is-dark' : 'is-light')}
      data-chat-sim="1"
      data-chat-theme={dark ? 'dark' : 'light'}
    >
      <div className="ms-chat-head">
        <p className="ms-kicker">채팅 미리보기</p>
        <div className="ms-speed" role="group" aria-label="채팅 테마">
          <button
            type="button"
            className={clsx('ms-btn', !dark && 'is-on')}
            data-chat-theme-btn="light"
            onClick={() => onTheme?.('light')}
            {...magnify('라이트', '카카오톡 라이트 말풍선으로 노출을 미리봅니다')}
          >
            라이트
          </button>
          <button
            type="button"
            className={clsx('ms-btn', dark && 'is-on')}
            data-chat-theme-btn="dark"
            onClick={() => onTheme?.('dark')}
            {...magnify('다크', '카카오톡 다크 말풍선으로 노출을 미리봅니다')}
          >
            다크
          </button>
        </div>
      </div>
      <div className="ms-chat-row is-in">
        <span className="ms-chat-bubble is-in">이거 봐</span>
      </div>
      <div className="ms-chat-row is-out">
        <div className={clsx('ms-chat-sticker', !frameUrl && 'checkerboard-bg')}>
          <canvas
            ref={bindCanvas}
            className="ms-chat-mirror"
            data-chat-mirror="1"
            width="360"
            height="360"
            aria-label="채팅 스티커 미리보기"
          />
        </div>
      </div>
    </div>
  )
}
