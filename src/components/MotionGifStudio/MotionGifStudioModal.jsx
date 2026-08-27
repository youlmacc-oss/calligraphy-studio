import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { MOTION_PRESETS, clampIntensity, clampLoopSeconds } from './motionPresets.js'
import './motionGifStudio.css'

const VIEW_BG = [
  { id: 'checker', label: '🏁 체커보드' },
  { id: 'dark', label: '⬛ 다크' },
  { id: 'light', label: '⬜ 라이트' },
]

const SIZE_OPTIONS = [
  { id: '360', label: '카카오 360×360' },
  { id: '500', label: '500×500' },
  { id: 'original', label: '원본 비율' },
]

function parseInitialSource(initialSource) {
  if (!initialSource) return { dataUrl: null, cuts: [] }
  if (typeof initialSource === 'string') return { dataUrl: initialSource, cuts: [] }
  if (initialSource.kind === 'emoticonCuts') {
    return { dataUrl: initialSource.dataUrl || null, cuts: initialSource.cuts || [] }
  }
  if (initialSource.dataUrl) return { dataUrl: initialSource.dataUrl, cuts: initialSource.cuts || [] }
  return { dataUrl: null, cuts: [] }
}

function isImageFile(file) {
  const name = String(file?.name || '').toLowerCase()
  return /\.(png|jpe?g)$/.test(name) || ['image/png', 'image/jpeg'].includes(file?.type)
}

export default function MotionGifStudioModal({ isOpen, onClose, initialSource = null }) {
  const fileRef = useRef(null)
  const objectUrlsRef = useRef([])
  const parsed = useMemo(() => parseInitialSource(initialSource), [initialSource])

  const [sourceTab, setSourceTab] = useState('canvas')
  const [localUrl, setLocalUrl] = useState(null)
  const [dropOver, setDropOver] = useState(false)
  const [dropNote, setDropNote] = useState('')
  const [viewBg, setViewBg] = useState('checker')
  const [playing, setPlaying] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [preset, setPreset] = useState('jellyBounce')
  const [loopSeconds, setLoopSeconds] = useState(2)
  const [intensity, setIntensity] = useState(70)
  const [fps, setFps] = useState(12)
  const [sizeId, setSizeId] = useState('360')

  const previewUrl = sourceTab === 'drop' ? localUrl : parsed.dataUrl
  const loop = clampLoopSeconds(loopSeconds)

  const releaseObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setSourceTab('canvas')
      setLocalUrl(null)
      setDropNote('')
      setPlaying(true)
      setZoom(100)
      releaseObjectUrls()
      return undefined
    }
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, releaseObjectUrls])

  const ingestFile = useCallback((file) => {
    if (!file) return
    if (!isImageFile(file)) {
      setDropNote('PNG 또는 JPG만 올릴 수 있습니다.')
      return
    }
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    setLocalUrl(url)
    setSourceTab('drop')
    setDropNote(file.name || '로컬 이미지')
  }, [])

  const onDownloadClick = useCallback(() => {
    console.info('개별 엔진 테스트 단계입니다')
    window.alert('개별 엔진 테스트 단계입니다')
  }, [])

  if (!isOpen) return null

  return (
    <div className="studio-modal-root mgs-root" role="dialog" aria-modal="true" aria-labelledby="mgs-title">
      <div className="studio-modal-backdrop" onClick={() => onClose?.()} />
      <div className="studio-modal-card mgs-card">
        <header className="mgs-head">
          <h2 id="mgs-title">🎬 AI 모션 GIF 스튜디오 PRO</h2>
          <div className="mgs-head-actions">
            {VIEW_BG.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={clsx('mgs-icon-btn', viewBg === mode.id && 'is-on')}
                onClick={() => setViewBg(mode.id)}
              >
                {mode.label}
              </button>
            ))}
            <button type="button" className="studio-modal-close" onClick={() => onClose?.()} aria-label="닫기" {...magnify('닫기', '모션 GIF 스튜디오를 닫습니다')}>
              <X className="h-4 w-4" /> ✕ 닫기
            </button>
          </div>
        </header>

        <div className="mgs-body">
          <aside className="mgs-pane">
            <h3>소스 인풋</h3>
            <div className="mgs-tabs">
              <button type="button" className={clsx('mgs-tab', sourceTab === 'canvas' && 'is-on')} onClick={() => setSourceTab('canvas')}>
                본체 그래픽 수신
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'cuts' && 'is-on')} onClick={() => setSourceTab('cuts')}>
                이모티콘 컷 픽업
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'drop' && 'is-on')} onClick={() => setSourceTab('drop')}>
                내 PC 이미지 드래그 앤 드롭
              </button>
            </div>

            {sourceTab === 'canvas' ? (
              parsed.dataUrl ? (
                <img className="mgs-thumb" src={parsed.dataUrl} alt="본체 캔버스 스냅샷" />
              ) : (
                <p className="mgs-hint">본 프로그램에서 열면 캔버스가 여기에 들어옵니다.</p>
              )
            ) : null}

            {sourceTab === 'cuts' ? (
              parsed.cuts.length ? (
                <div className="mgs-cuts">
                  {parsed.cuts.map((cut, index) => (
                    <button key={cut.id || index} type="button" className="mgs-icon-btn">
                      <img src={cut.url || cut.dataUrl} alt={`컷 ${index + 1}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mgs-hint">이모티콘 컷 픽업은 다음 단계에서 연동됩니다.</p>
              )
            ) : null}

            {sourceTab === 'drop' ? (
              <>
                <label
                  className={clsx('mgs-drop', dropOver && 'is-over')}
                  onDragOver={(event) => { event.preventDefault(); setDropOver(true) }}
                  onDragLeave={() => setDropOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDropOver(false)
                    ingestFile(event.dataTransfer.files?.[0])
                  }}
                >
                  PNG/JPG를 놓거나 클릭해서 올리기
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    hidden
                    onChange={(event) => {
                      ingestFile(event.target.files?.[0])
                      event.target.value = ''
                    }}
                  />
                </label>
                {dropNote ? <p className="mgs-hint">{dropNote}</p> : null}
              </>
            ) : null}
          </aside>

          <section className="mgs-pane mgs-center">
            <div className={clsx('mgs-viewport', `is-${viewBg}`)}>
              {previewUrl ? (
                <img
                  className={clsx('mgs-preview-img', playing && 'is-playing')}
                  src={previewUrl}
                  alt="모션 GIF 프리뷰"
                  style={{ transform: `scale(${zoom / 100})` }}
                />
              ) : (
                <p className="mgs-empty">왼쪽에서 이미지를 고르거나 파일을 놓으세요.</p>
              )}
            </div>
            <div className="mgs-view-bar">
              <button type="button" className={clsx('mgs-icon-btn', playing && 'is-on')} onClick={() => setPlaying((value) => !value)}>
                {playing ? '일시정지' : '재생'}
              </button>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button>
              <span className="mgs-zoom">{zoom}%</span>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => Math.min(200, value + 10))}>+</button>
            </div>
          </section>

          <aside className="mgs-pane">
            <h3>모션 프리셋 & 파라미터</h3>
            {MOTION_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx('mgs-preset', preset === item.id && 'is-on')}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
                <div className="mgs-hint">{item.hint}</div>
              </button>
            ))}
            <label className="mgs-slider">
              루프 시간 {loop.toFixed(1)}s
              <input type="range" min="0.5" max="3" step="0.1" value={loop} onChange={(event) => setLoopSeconds(Number(event.target.value))} />
            </label>
            <label className="mgs-slider">
              강도 {clampIntensity(intensity)}%
              <input type="range" min="1" max="100" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
            </label>
            <p className="mgs-hint">FPS</p>
            <div className="mgs-seg">
              {[12, 24].map((value) => (
                <button key={value} type="button" className={clsx(fps === value && 'is-on')} onClick={() => setFps(value)}>
                  {value}fps
                </button>
              ))}
            </div>
            <label className="mgs-slider">
              캔버스 규격
              <select className="mgs-select" value={sizeId} onChange={(event) => setSizeId(event.target.value)}>
                {SIZE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </aside>
        </div>

        <footer className="mgs-foot">
          <p className="mgs-status">엔진 대기 중 (Ready)</p>
          <button
            type="button"
            className="tool-btn is-on mgs-download"
            onClick={onDownloadClick}
            {...magnify('초고화질 GIF', '다음 단계에서 gifenc 엔진을 연결합니다')}
          >
            🚀 초고화질 무한루프 GIF 다운로드
          </button>
        </footer>
      </div>
    </div>
  )
}
