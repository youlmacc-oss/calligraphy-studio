import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { renderFramesToGif, revokeGifUrl } from './gifEngine.js'
import { MOTION_PRESETS, clampIntensity, clampLoopSeconds, paintMotionFrame } from './motionPresets.js'
import './motionGifStudio.css'

const VIEW_BG = [
  { id: 'checker', label: '🏁 체커보드' },
  { id: 'dark', label: '⬛ 다크' },
  { id: 'light', label: '⬜ 라이트' },
]

const SIZE_MODES = [
  { id: '360', label: '360×360', width: 360, height: 360 },
  { id: '500', label: '500×500', width: 500, height: 500 },
  { id: 'original', label: '원본' },
]

function yieldFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function sourceSize(image) {
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1,
  }
}

function outputSize(sizeId, image) {
  if (sizeId === '500') return { width: 500, height: 500 }
  if (sizeId === 'original' && image) {
    const { width, height } = sourceSize(image)
    const scale = Math.min(1, 1024 / Math.max(width, height, 1))
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    }
  }
  return { width: 360, height: 360 }
}

function fitSource(image, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { width: sw, height: sh } = sourceSize(image)
  const scale = Math.min(width / sw, height / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh)
  return canvas
}

function drawSelfText(base, text, color) {
  if (!text.trim()) return base
  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(base, 0, 0)
  ctx.fillStyle = color || '#f8fafc'
  ctx.font = `700 ${Math.max(16, Math.round(base.width * 0.08))}px "Pretendard", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  const y = base.height - Math.round(base.height * 0.08)
  ctx.strokeText(text, base.width / 2, y)
  ctx.fillText(text, base.width / 2, y)
  return canvas
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    image.src = url
  })
}

function parseInitialSource(initialSource) {
  if (!initialSource) return { dataUrl: null, cuts: [] }
  if (typeof initialSource === 'string') return { dataUrl: initialSource, cuts: [] }
  if (initialSource.kind === 'emoticonCuts') {
    return { dataUrl: initialSource.dataUrl || null, cuts: initialSource.cuts || [] }
  }
  if (initialSource.dataUrl) return { dataUrl: initialSource.dataUrl, cuts: initialSource.cuts || [] }
  return { dataUrl: null, cuts: [] }
}

function releaseCanvas(canvas) {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

export default function MotionGifStudioModal({ isOpen, onClose, initialSource = null }) {
  const viewRef = useRef(null)
  const virtualRef = useRef(null)
  const sourceRef = useRef(null)
  const rafRef = useRef(0)
  const playRef = useRef({ playing: true, startedAt: 0, pausedT: 0 })
  const abortRef = useRef(false)
  const objectUrlsRef = useRef([])
  const imageRef = useRef(null)
  const composedRef = useRef(null)
  const lastUiRef = useRef(0)
  const fileRef = useRef(null)
  const paramsRef = useRef({})

  const parsed = useMemo(() => parseInitialSource(initialSource), [initialSource])
  const [sourceTab, setSourceTab] = useState('canvas')
  const [viewBg, setViewBg] = useState('checker')
  const [zoom, setZoom] = useState(100)
  const [playing, setPlaying] = useState(true)
  const [preset, setPreset] = useState('jellyBounce')
  const [loopSeconds, setLoopSeconds] = useState(2)
  const [intensity, setIntensity] = useState(70)
  const [fps, setFps] = useState(12)
  const [sizeId, setSizeId] = useState('360')
  const [selfText, setSelfText] = useState('')
  const [selfColor, setSelfColor] = useState('#f8fafc')
  const [hasSource, setHasSource] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const [scrub, setScrub] = useState(0)
  const [clock, setClock] = useState('0.00')
  const [status, setStatus] = useState('이미지를 먼저 고르세요.')
  const [statusKind, setStatusKind] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [encoding, setEncoding] = useState(false)
  const [frameHint, setFrameHint] = useState('')

  const out = outputSize(sizeId, sourceRef.current)
  paramsRef.current = { preset, intensity, loopSeconds, fps, sizeId, selfText, selfColor, zoom, playing }

  const estimatedKb = useMemo(() => {
    const frames = Math.max(2, Math.round(fps * clampLoopSeconds(loopSeconds)))
    const bytes = out.width * out.height * frames * 0.45
    return Math.max(1, Math.round(bytes / 1024))
  }, [fps, loopSeconds, out.width, out.height])

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const teardown = useCallback(() => {
    abortRef.current = true
    stopLoop()
    releaseCanvas(virtualRef.current)
    releaseCanvas(sourceRef.current)
    releaseCanvas(composedRef.current)
    sourceRef.current = null
    imageRef.current = null
    composedRef.current = null
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }, [stopLoop])

  const paintNow = useCallback((time01) => {
    const source = sourceRef.current
    const view = viewRef.current
    if (!source || !view) return
    const size = outputSize(paramsRef.current.sizeId, source)
    let virtual = virtualRef.current
    if (!virtual) {
      virtual = document.createElement('canvas')
      virtualRef.current = virtual
    }
    if (virtual.width !== size.width || virtual.height !== size.height) {
      virtual.width = size.width
      virtual.height = size.height
    }
    if (view.width !== size.width || view.height !== size.height) {
      view.width = size.width
      view.height = size.height
    }
    const vctx = virtual.getContext('2d', { willReadFrequently: true })
    const text = paramsRef.current.selfText || ''
    const color = paramsRef.current.selfColor
    const composeKey = `${source.width}x${source.height}:${text}:${color}`
    let composed = source
    if (text.trim()) {
      if (!composedRef.current || composedRef.current._key !== composeKey) {
        releaseCanvas(composedRef.current)
        composedRef.current = drawSelfText(source, text, color)
        composedRef.current._key = composeKey
      }
      composed = composedRef.current
    }
    paintMotionFrame(vctx, composed, {
      width: size.width,
      height: size.height,
      time01,
      preset: paramsRef.current.preset,
      intensity: paramsRef.current.intensity,
    })
    const viewCtx = view.getContext('2d')
    viewCtx.clearRect(0, 0, size.width, size.height)
    viewCtx.drawImage(virtual, 0, 0)
  }, [])

  const tick = useCallback((now) => {
    const loop = clampLoopSeconds(paramsRef.current.loopSeconds)
    if (!playRef.current.startedAt) playRef.current.startedAt = now - playRef.current.pausedT * loop * 1000
    const elapsed = ((now - playRef.current.startedAt) / 1000) % loop
    const time01 = elapsed / loop
    playRef.current.pausedT = time01
    paintNow(time01)
    if (now - lastUiRef.current > 120) {
      lastUiRef.current = now
      setScrub(Math.round(time01 * 100))
      setClock(elapsed.toFixed(2))
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [paintNow])

  const startLoop = useCallback(() => {
    stopLoop()
    playRef.current.playing = true
    playRef.current.startedAt = 0
    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop, tick])

  const applyBitmap = useCallback(async (image, label) => {
    imageRef.current = image
    const size = outputSize(paramsRef.current.sizeId, image)
    const fitted = fitSource(image, size.width, size.height)
    releaseCanvas(sourceRef.current)
    sourceRef.current = fitted
    setHasSource(true)
    setStatusKind('ok')
    setStatus(`${label} · ${size.width}×${size.height}`)
    paintNow(playRef.current.pausedT || 0)
    if (playRef.current.playing) startLoop()
  }, [paintNow, startLoop])

  const ingestUrl = useCallback(async (url, label) => {
    setLoading(true)
    setStatusKind('idle')
    setStatus('소스 읽는 중…')
    try {
      const image = await loadImageFromUrl(url)
      await applyBitmap(image, label)
    } catch (error) {
      setHasSource(false)
      setStatusKind('error')
      setStatus(error.message || '이미지를 읽지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [applyBitmap])

  const ingestFile = useCallback(async (file) => {
    const name = String(file?.name || '').toLowerCase()
    if (!/\.(png|jpe?g)$/.test(name) && !['image/png', 'image/jpeg'].includes(file.type)) {
      setStatusKind('error')
      setStatus('PNG 또는 JPG만 올릴 수 있습니다.')
      return
    }
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    setSourceTab('drop')
    await ingestUrl(url, file.name || '로컬 이미지')
  }, [ingestUrl])

  useEffect(() => {
    if (!isOpen) {
      teardown()
      setHasSource(false)
      setEncoding(false)
      setProgress(0)
      setPlaying(true)
      playRef.current = { playing: true, startedAt: 0, pausedT: 0 }
      return undefined
    }
    abortRef.current = false
    if (parsed.dataUrl) {
      setSourceTab('canvas')
      ingestUrl(parsed.dataUrl, '본체 캔버스')
    } else {
      setStatus('왼쪽에서 이미지를 고르거나 파일을 놓으세요.')
      setStatusKind('idle')
    }
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      teardown()
    }
    // ingestUrl/teardown are stable enough for open/close; avoid re-ingest on slider ticks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, parsed.dataUrl])

  useEffect(() => {
    if (!isOpen || !hasSource || !sourceRef.current) return undefined
    const size = outputSize(sizeId, sourceRef.current)
    if (imageRef.current && (sourceRef.current.width !== size.width || sourceRef.current.height !== size.height)) {
      const refit = fitSource(imageRef.current, size.width, size.height)
      releaseCanvas(sourceRef.current)
      sourceRef.current = refit
    }
    paintNow(playRef.current.pausedT || 0)
    if (playing) {
      if (!rafRef.current) startLoop()
    } else {
      stopLoop()
    }
    return undefined
  }, [isOpen, hasSource, preset, intensity, loopSeconds, sizeId, selfText, selfColor, playing, paintNow, startLoop, stopLoop])

  const requestClose = useCallback(() => {
    if (encoding) {
      abortRef.current = true
      setEncoding(false)
      setProgress(0)
      setStatusKind('warn')
      setStatus('내보내기를 취소했습니다.')
    }
    onClose?.()
  }, [encoding, onClose])

  const handleDownload = useCallback(async () => {
    const source = sourceRef.current
    if (!source || encoding) return
    abortRef.current = false
    setEncoding(true)
    setProgress(0)
    setStatusKind('ok')
    setFrameHint('')
    const size = outputSize(sizeId, source)
    const seconds = clampLoopSeconds(loopSeconds)
    const frameCount = Math.max(2, Math.round(fps * seconds))
    const frames = []
    setStatus('양자화 준비 중…')
    try {
      const composed = drawSelfText(source, selfText, selfColor)
      for (let i = 0; i < frameCount; i += 1) {
        if (abortRef.current) throw new Error('내보내기를 취소했습니다.')
        const canvas = document.createElement('canvas')
        canvas.width = size.width
        canvas.height = size.height
        paintMotionFrame(canvas.getContext('2d', { willReadFrequently: true }), composed, {
          width: size.width,
          height: size.height,
          time01: i / frameCount,
          preset,
          intensity: clampIntensity(intensity),
        })
        frames.push(canvas)
        const pct = Math.max(1, Math.round(((i + 1) / frameCount) * 90))
        setProgress(pct)
        setFrameHint(`프레임 ${i + 1} / ${frameCount}`)
        setStatus(`인코딩 중 ${pct}%`)
        if (i % 2 === 0) await yieldFrame()
      }
      if (composed !== source) releaseCanvas(composed)
      const result = await renderFramesToGif(frames, {
        width: size.width,
        height: size.height,
        fps,
        transparent: true,
        onProgress: (pct) => {
          setProgress(Math.max(90, pct))
          setStatus(`인코딩 중 ${Math.max(90, pct)}%`)
        },
      })
      setProgress(100)
      setStatus(`완료 ${Math.round(result.byteLength / 1024)} KB`)
      saveAs(result.blob, `motion-gif-${size.width}.gif`)
      revokeGifUrl(result.url)
    } catch (error) {
      setStatusKind(abortRef.current ? 'warn' : 'error')
      setStatus(error.message || 'GIF 인코딩에 실패했습니다.')
    } finally {
      frames.forEach(releaseCanvas)
      setEncoding(false)
      if (!abortRef.current && hasSource && playing) startLoop()
    }
  }, [encoding, fps, hasSource, intensity, loopSeconds, playing, preset, selfColor, selfText, sizeId, startLoop])

  if (!isOpen) return null

  const loop = clampLoopSeconds(loopSeconds)
  const frameCount = Math.max(2, Math.round(fps * loop))

  return (
    <div className="studio-modal-root mgs-root" role="dialog" aria-modal="true" aria-labelledby="mgs-title">
      <div className="studio-modal-backdrop" onClick={requestClose} />
      <div className="studio-modal-card mgs-card">
        <header className="mgs-head">
          <div>
            <p className="mgs-kicker">Standalone sandbox</p>
            <h2 id="mgs-title">독립형 AI 모션 GIF 스튜디오 PRO</h2>
          </div>
          <button type="button" className="studio-modal-close" onClick={requestClose} aria-label="닫기" {...magnify('닫기', '모션 GIF 스튜디오를 닫습니다')}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="mgs-body">
          <aside className="mgs-pane">
            <h3>소스 선택</h3>
            <div className="mgs-tabs">
              <button type="button" className={clsx('mgs-tab', sourceTab === 'canvas' && 'is-on')} onClick={() => setSourceTab('canvas')} disabled={encoding}>
                본체 캔버스 그래픽 불러오기
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'cuts' && 'is-on')} onClick={() => setSourceTab('cuts')} disabled={encoding}>
                이모티콘 시트 컷 선택기
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'drop' && 'is-on')} onClick={() => setSourceTab('drop')} disabled={encoding}>
                내 PC 이미지 드래그 앤 드롭
              </button>
            </div>

            {sourceTab === 'canvas' ? (
              <div>
                {parsed.dataUrl ? (
                  <>
                    <img src={parsed.dataUrl} alt="본체 캔버스 스냅샷" style={{ width: '100%', marginTop: '0.55rem', borderRadius: '0.55rem', background: '#0b1220' }} />
                    <button type="button" className="mgs-tab" style={{ marginTop: '0.45rem' }} disabled={encoding} onClick={() => ingestUrl(parsed.dataUrl, '본체 캔버스')}>
                      다시 받기
                    </button>
                  </>
                ) : (
                  <p className="mgs-hint">본 프로그램에서 열면 캔버스가 여기에 들어옵니다.</p>
                )}
              </div>
            ) : null}

            {sourceTab === 'cuts' ? (
              parsed.cuts.length ? (
                <div className="mgs-cuts">
                  {parsed.cuts.map((cut, index) => (
                    <button
                      key={cut.id || index}
                      type="button"
                      className="mgs-icon-btn"
                      disabled={encoding}
                      onClick={() => ingestUrl(cut.url || cut.dataUrl, `이모티콘 컷 ${index + 1}`)}
                    >
                      <img src={cut.url || cut.dataUrl} alt={`컷 ${index + 1}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mgs-hint">이모티콘 컷이 없습니다. 파일을 놓거나 본체 캔버스를 불러오세요.</p>
              )
            ) : null}

            {sourceTab === 'drop' ? (
              <label
                className={clsx('mgs-drop', dropOver && 'is-over')}
                onDragOver={(event) => { event.preventDefault(); setDropOver(true) }}
                onDragLeave={() => setDropOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDropOver(false)
                  const file = event.dataTransfer.files?.[0]
                  if (file) ingestFile(file)
                }}
              >
                PNG/JPG를 놓거나 클릭해서 올리기
                <input
                  ref={fileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) ingestFile(file)
                    event.target.value = ''
                  }}
                />
              </label>
            ) : null}

            <label className="mgs-self">
              Self Text
              <input type="text" value={selfText} maxLength={24} disabled={encoding} onChange={(event) => setSelfText(event.target.value)} placeholder="스튜디오 전용 문구" />
              <input type="color" value={selfColor} disabled={encoding} onChange={(event) => setSelfColor(event.target.value)} />
            </label>
          </aside>

          <section className="mgs-pane mgs-center">
            <div className={clsx('mgs-viewport', `is-${viewBg}`)}>
              <canvas ref={viewRef} style={{ transform: `scale(${zoom / 100})` }} />
              {!hasSource && !loading ? <p className="mgs-empty">왼쪽에서 이미지를 고르거나 파일을 놓으세요.</p> : null}
              {loading ? <p className="mgs-empty">소스 읽는 중…</p> : null}
            </div>
            <div className="mgs-view-bar">
              {VIEW_BG.map((mode) => (
                <button key={mode.id} type="button" className={clsx('mgs-icon-btn', viewBg === mode.id && 'is-on')} onClick={() => setViewBg(mode.id)}>
                  {mode.label}
                </button>
              ))}
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button>
              <span className="mgs-hint">{zoom}%</span>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => Math.min(200, value + 10))}>+</button>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom(100)}>맞춤</button>
              <button
                type="button"
                className={clsx('mgs-icon-btn', playing && 'is-on')}
                onClick={() => {
                  const next = !playing
                  playRef.current.playing = next
                  setPlaying(next)
                }}
              >
                {playing ? '일시정지' : '재생'}
              </button>
              <span className="mgs-hint">{clock}s / {loop.toFixed(1)}s · 프리뷰 60 FPS</span>
            </div>
            <label className="mgs-slider">
              루프 {scrub}%
              <input
                type="range"
                min="0"
                max="100"
                value={scrub}
                disabled={encoding}
                onChange={(event) => {
                  const next = Number(event.target.value) / 100
                  playRef.current.pausedT = next
                  playRef.current.startedAt = 0
                  setPlaying(false)
                  playRef.current.playing = false
                  paintNow(next)
                  setScrub(Number(event.target.value))
                }}
              />
            </label>
          </section>

          <aside className="mgs-pane">
            <h3>모션 프리셋 & 파라미터</h3>
            {MOTION_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx('mgs-preset', preset === item.id && 'is-on')}
                disabled={encoding}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
                <div className="mgs-hint">{item.hint}</div>
              </button>
            ))}
            <label className="mgs-slider">
              속도 {loop.toFixed(1)}s
              <input type="range" min="0.5" max="3" step="0.1" value={loop} disabled={encoding} onChange={(event) => setLoopSeconds(Number(event.target.value))} />
            </label>
            <label className="mgs-slider">
              강도 {clampIntensity(intensity)}%
              <input type="range" min="1" max="100" value={intensity} disabled={encoding} onChange={(event) => setIntensity(Number(event.target.value))} />
            </label>
            <p className="mgs-hint">FPS</p>
            <div className="mgs-seg">
              {[12, 24].map((value) => (
                <button key={value} type="button" className={clsx(fps === value && 'is-on')} disabled={encoding} onClick={() => setFps(value)}>
                  {value}fps
                </button>
              ))}
            </div>
            <p className="mgs-hint">캔버스 규격</p>
            <div className="mgs-seg">
              {SIZE_MODES.map((mode) => (
                <button key={mode.id} type="button" className={clsx(sizeId === mode.id && 'is-on')} disabled={encoding} onClick={() => setSizeId(mode.id)}>
                  {mode.label}
                </button>
              ))}
            </div>
          </aside>
        </div>

        <footer className="mgs-foot">
          <div className={clsx('mgs-status', statusKind === 'error' && 'is-error')}>
            {status} · 추정 약 {estimatedKb} KB · {frameCount}프레임 {frameHint ? `· ${frameHint}` : ''}
            <div className="mgs-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="tool-btn is-on mgs-download"
            disabled={!hasSource || encoding}
            onClick={handleDownload}
            {...magnify('초고화질 GIF', '투명 배경 무한루프 GIF를 인코딩해 저장합니다')}
          >
            {encoding ? `인코딩 중 ${progress}%` : '🚀 초고화질 무한루프 GIF 다운로드'}
          </button>
        </footer>
      </div>
    </div>
  )
}
