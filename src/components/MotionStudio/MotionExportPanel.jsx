import { useState } from 'react'
import TransparencyCheckModal from '../TransparencyCheckModal.jsx'
import { canvasFromUrl } from '../../lib/fakeBackgroundPurge.js'
import { useTransparencyGate } from '../../hooks/useTransparencyGate.js'
import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import EncodeProgressModal from './EncodeProgressModal.jsx'
import {
  encodeMotionExport,
  openCheckerboardPreview,
  triggerBlobDownload,
  yieldToMain,
} from '../../utils/encoder/MotionEncoderEngine.js'
import { useMotionStudio } from './motionStudioContext.jsx'
import { isPermanentClip } from '../../utils/encoder/BatchExportEngine.js'
import { expandPingPong } from './motionSequencer.js'

const BUSY_LABEL = '⏳ 변환 중...'

function fileName(ext) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
  return `motion-seq-${stamp}.${ext}`
}

function encodeFps(fps, speed) {
  return Math.max(4, Math.min(24, Math.round((Number(fps) || 8) * (Number(speed) || 1))))
}

export default function MotionExportPanel({
  frames = [],
  sequence = [],
  fps = 8,
  speed = 1,
  effect = 'none',
  pingPong = false,
  particles = [],
  stillLoop = false,
  motionPreset = 'none',
  isolateSprite = true,
  intensity = 70,
  loopSeconds = 2,
  captionOn = false,
  captionText = '',
  captionSize = 'md',
  captionStroke = 'black',
  captionFont,
  captionPos = { posX: 0, posY: 0 },
  captionTail,
}) {
  const studio = useMotionStudio()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('run')
  const [percent, setPercent] = useState(0)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [toast, setToast] = useState('')
  const alphaGate = useTransparencyGate()
  const ready = frames.length > 0 && !busy

  const flashToast = (text) => {
    setToast(text)
    window.setTimeout(() => setToast(''), 1800)
  }

  const saveClip = () => {
    if (!ready) return
    const saved = (studio?.clips || []).filter(isPermanentClip)
    const slot = saved.length + 1
    studio?.saveSequenceClip?.({
      fps,
      speed,
      effect,
      pingPong,
      particles,
      frames: sequence,
      captionOn,
      captionText,
      captionSize,
      captionStroke,
      captionFont,
      posX: captionPos.posX,
      posY: captionPos.posY,
      captionTail,
    })
    flashToast(`클립 ${slot} 저장됨`)
  }

  const requestExport = async (format) => {
    if (!ready) return
    const probe = await canvasFromUrl(frames[0]?.url || '')
    await alphaGate.runOrAsk(probe ? [probe] : [], () => runExport(format))
  }

  const runExport = async (format) => {
    if (!ready) return
    setBusy(true)
    setOpen(true)
    setState('run')
    setPercent(0)
    setCurrent(0)
    setTotal(0)
    setError('')
    setResult(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setMessage(format === 'webp' ? '🎬 WebP 생성 중...' : '🎬 GIF 생성 중...')
    await yieldToMain()
    try {
      const packed = await encodeMotionExport(expandPingPong(frames, pingPong), {
        format,
        fps: encodeFps(fps, speed),
        effect,
        particles,
        stillLoop,
        preset: motionPreset,
        isolate: isolateSprite,
        intensity,
        loopSeconds,
        captionOn,
        captionText,
        captionSize,
        captionStroke,
        captionFont,
        posX: captionPos.posX,
        posY: captionPos.posY,
        captionTail,
        onProgress: (info) => {
          setPercent(info.percent || 0)
          setCurrent(info.current || 0)
          setTotal(info.total || 0)
          setMessage(info.message || '')
        },
      })
      const url = URL.createObjectURL(packed.blob)
      setResult(packed)
      setPreviewUrl(url)
      setPercent(100)
      setState('done')
      setMessage('내보내기 완료')
      triggerBlobDownload(packed.blob, fileName(packed.ext))
      studio?.purgeTempClips?.()
      flashToast('내보내기 완료')
      window.setTimeout(() => setOpen(false), 900)
    } catch (err) {
      setState('error')
      setError(err?.message || '인코딩에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ms-export" data-motion-export="1">
      <div className="ms-export-row">
        <button
          type="button"
          className={clsx('ms-btn', 'ms-export-btn', 'ms-export-save')}
          disabled={!frames.length || busy}
          data-clip-save="1"
          onClick={saveClip}
          {...magnify('클립 저장', '현재 모션 클립으로 저장. 타임라인·텍스트 모션·FPS를 보관함 새 슬롯에 등록합니다')}
        >
          💾 클립 저장
        </button>
        <button
          type="button"
          className={clsx('ms-btn', 'ms-export-btn')}
          disabled={!frames.length || busy}
          data-encode-fmt="gif"
          onClick={() => requestExport('gif')}
          {...magnify('GIF로 내보내기', '타임라인과 텍스트 모션을 360×360 GIF로 인코딩해 바로 저장합니다')}
        >
          {busy ? BUSY_LABEL : '🎬 GIF로 내보내기'}
        </button>
        <button
          type="button"
          className={clsx('ms-btn', 'ms-export-btn')}
          disabled={!frames.length || busy}
          data-encode-fmt="webp"
          onClick={() => requestExport('webp')}
          {...magnify('WebP 내보내기', '알파 투명 Animated WebP로 인코딩해 카카오 최신 규격으로 저장합니다')}
        >
          {busy ? BUSY_LABEL : '✨ WebP(투명) 내보내기'}
        </button>
      </div>
      {toast ? (
        <p className="ms-toast" role="status" data-clip-toast="1">{toast}</p>
      ) : null}
      <TransparencyCheckModal
        open={alphaGate.open}
        onPurgeAndExport={alphaGate.confirmPurge}
        onExportAsIs={alphaGate.confirmAsIs}
        onCancel={alphaGate.cancel}
      />
      <EncodeProgressModal
        open={open}
        state={state}
        message={message}
        percent={percent}
        current={current}
        total={total}
        previewUrl={previewUrl}
        error={error}
        onDownload={() => result?.blob && triggerBlobDownload(result.blob, fileName(result.ext))}
        onPreview={() => result?.blob && openCheckerboardPreview(result.blob)}
        onClose={() => {
          if (state === 'run') return
          setOpen(false)
        }}
      />
    </div>
  )
}
