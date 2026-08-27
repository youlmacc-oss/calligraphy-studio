import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { encodeMotionGif, formatEta, revokeGifUrl } from './gifEngine.js'
import {
  MOTION_PRESETS,
  clampIntensity,
  clampLoopSeconds,
  paintMotionFrame,
} from './motionPresets.js'
import { PLATFORM_PRESETS, resolvePlatformSize } from './platformPresets.js'
import { getEmoticonCuts, subscribeEmoticonCuts } from './cutSnapshot.js'
import './motionGifStudio.css'

const VIEW_BG = [
  { id: 'checker', label: '🏁 체커보드' },
  { id: 'dark', label: '⬛ 다크' },
  { id: 'light', label: '⬜ 라이트' },
]

const SIZE_OPTIONS = PLATFORM_PRESETS

function parseInitialSource(initialSource) {
  if (!initialSource) return { dataUrl: null, cuts: [] }
  if (typeof initialSource === 'string') return { dataUrl: initialSource, cuts: [] }
  if (initialSource.kind === 'emoticonCuts') {
    return {
      dataUrl: initialSource.dataUrl || null,
      cuts: (initialSource.cuts || []).map((cut, index) => ({
        id: cut.id || `cut-${index}`,
        url: cut.preview || cut.url || cut.dataUrl,
      })).filter((cut) => cut.url),
    }
  }
  if (initialSource.dataUrl) {
    return { dataUrl: initialSource.dataUrl, cuts: initialSource.cuts || [] }
  }
  return { dataUrl: null, cuts: [] }
}

function isImageFile(file) {
  const name = String(file?.name || '').toLowerCase()
  return /\.(png|jpe?g)$/.test(name) || ['image/png', 'image/jpeg'].includes(file?.type)
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    image.src = url
  })
}

function sourceSize(image) {
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1,
  }
}

function outputSize(sizeId, image) {
  const resolved = resolvePlatformSize(sizeId, image)
  return { width: resolved.width, height: resolved.height, fps: resolved.fps }
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

function releaseCanvas(canvas) {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

function cutUrl(cut) {
  return cut?.preview || cut?.url || cut?.dataUrl || ''
}

export default function MotionGifStudioModal({ isOpen, onClose, initialSource = null }) {
  const viewRef = useRef(null)
  const virtualRef = useRef(null)
  const fittedRef = useRef(null)
  const imageRef = useRef(null)
  const rafRef = useRef(0)
  const playRef = useRef({ playing: true, startedAt: 0, pausedT: 0 })
  const abortRef = useRef(false)
  const objectUrlsRef = useRef([])
  const paramsRef = useRef({})
  const encodeStartedRef = useRef(0)
  const fileRef = useRef(null)
  const cutsFileRef = useRef(null)

  const parsed = useMemo(() => parseInitialSource(initialSource), [initialSource])
  const [sourceTab, setSourceTab] = useState('canvas')
  const [localUrl, setLocalUrl] = useState(null)
  const [cuts, setCuts] = useState(() => getEmoticonCuts())
  const [selectedCut, setSelectedCut] = useState('')
  const [dropOver, setDropOver] = useState(false)
  const [dropNote, setDropNote] = useState('')
  const [viewBg, setViewBg] = useState('checker')
  const [playing, setPlaying] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [preset, setPreset] = useState('jellyBounce')
  const [loopSeconds, setLoopSeconds] = useState(2)
  const [intensity, setIntensity] = useState(70)
  const [fps, setFps] = useState(24)
  const [sizeId, setSizeId] = useState('kakao')
  const [eta, setEta] = useState('')
  const [hasSource, setHasSource] = useState(false)
  const [loading, setLoading] = useState(false)
  const [encoding, setEncoding] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('엔진 대기 중 (Ready)')
  const [statusKind, setStatusKind] = useState('ok')
  const [frameHint, setFrameHint] = useState('')

  const loop = clampLoopSeconds(loopSeconds)
  paramsRef.current = { preset, intensity, loopSeconds: loop, fps, sizeId, playing }

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const paintNow = useCallback((time01) => {
    const source = fittedRef.current
    const view = viewRef.current
    if (!source || !view) return
    const size = { width: source.width, height: source.height }
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
    paintMotionFrame(virtual.getContext('2d', { willReadFrequently: true }), source, {
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
    const seconds = clampLoopSeconds(paramsRef.current.loopSeconds)
    if (!playRef.current.startedAt) {
      playRef.current.startedAt = now - playRef.current.pausedT * seconds * 1000
    }
    const elapsed = ((now - playRef.current.startedAt) / 1000) % seconds
    const time01 = elapsed / seconds
    playRef.current.pausedT = time01
    paintNow(time01)
    rafRef.current = requestAnimationFrame(tick)
  }, [paintNow])

  const startLoop = useCallback(() => {
    stopLoop()
    playRef.current.playing = true
    playRef.current.startedAt = 0
    rafRef.current = requestAnimationFrame(tick)
  }, [stopLoop, tick])

  const teardown = useCallback(() => {
    abortRef.current = true
    stopLoop()
    releaseCanvas(virtualRef.current)
    releaseCanvas(fittedRef.current)
    fittedRef.current = null
    imageRef.current = null
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }, [stopLoop])

  const applyImage = useCallback(async (image) => {
    imageRef.current = image
    const size = outputSize(paramsRef.current.sizeId, image)
    const fitted = fitSource(image, size.width, size.height)
    releaseCanvas(fittedRef.current)
    fittedRef.current = fitted
    setHasSource(true)
    paintNow(playRef.current.pausedT || 0)
    if (playRef.current.playing) startLoop()
  }, [paintNow, startLoop])

  const ingestUrl = useCallback(async (url) => {
    if (!url) {
      setHasSource(false)
      return
    }
    setLoading(true)
    try {
      const image = await loadImage(url)
      await applyImage(image)
      setStatusKind('ok')
      setStatus('엔진 대기 중 (Ready)')
    } catch (error) {
      setHasSource(false)
      setStatusKind('error')
      setStatus(error.message || '이미지를 읽지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [applyImage])

  const ingestFile = useCallback((file) => {
    if (!file) return
    if (!isImageFile(file)) {
      setDropNote('PNG 또는 JPG만 올릴 수 있습니다.')
      setStatusKind('error')
      setStatus('PNG 또는 JPG만 올릴 수 있습니다.')
      return
    }
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.push(url)
    setLocalUrl(url)
    setSourceTab('drop')
    setDropNote(file.name || '로컬 이미지')
  }, [])

  const ingestCutFiles = useCallback((fileList) => {
    const files = [...(fileList || [])].filter(isImageFile).slice(0, 28)
    if (!files.length) {
      setStatusKind('error')
      setStatus('PNG 또는 JPG 컷만 올릴 수 있습니다.')
      return
    }
    const next = files.map((file, index) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      return { id: `local-cut-${index}`, url }
    })
    setCuts(next)
    setSelectedCut(next[0].url)
    setSourceTab('cuts')
  }, [])

  useEffect(() => {
    if (!isOpen) {
      teardown()
      setHasSource(false)
      setEncoding(false)
      setProgress(0)
      setPlaying(true)
      setLocalUrl(null)
      setSelectedCut('')
      setDropNote('')
      setSourceTab('canvas')
      setEta('')
      setStatus('엔진 대기 중 (Ready)')
      playRef.current = { playing: true, startedAt: 0, pausedT: 0 }
      return undefined
    }
    abortRef.current = false
    const snapshotCuts = getEmoticonCuts()
    const nextCuts = parsed.cuts.length ? parsed.cuts : snapshotCuts
    setCuts(nextCuts)
    if (nextCuts[0]) setSelectedCut(cutUrl(nextCuts[0]))
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, parsed.dataUrl])

  useEffect(() => subscribeEmoticonCuts((next) => {
    setCuts((current) => {
      if (current.some((item) => String(item.id || '').startsWith('local-cut-'))) return current
      return next
    })
  }), [])

  useEffect(() => {
    if (!isOpen || !hasSource || !imageRef.current) return undefined
    const size = outputSize(sizeId, imageRef.current)
    if (!fittedRef.current || fittedRef.current.width !== size.width || fittedRef.current.height !== size.height) {
      const refit = fitSource(imageRef.current, size.width, size.height)
      releaseCanvas(fittedRef.current)
      fittedRef.current = refit
    }
    paintNow(playRef.current.pausedT || 0)
    if (playing) {
      if (!rafRef.current) startLoop()
    } else {
      stopLoop()
    }
    return undefined
  }, [isOpen, hasSource, preset, intensity, loopSeconds, sizeId, playing, paintNow, startLoop, stopLoop])

  useEffect(() => {
    if (!isOpen) return
    if (sourceTab === 'canvas') ingestUrl(parsed.dataUrl)
    else if (sourceTab === 'cuts') ingestUrl(selectedCut)
    else ingestUrl(localUrl)
  }, [sourceTab, selectedCut, localUrl, parsed.dataUrl, isOpen, ingestUrl])

  useEffect(() => {
    if (sourceTab !== 'cuts' || selectedCut) return
    const first = cutUrl(cuts[0] || parsed.cuts[0])
    if (first) setSelectedCut(first)
  }, [sourceTab, selectedCut, cuts, parsed.cuts])

  const requestClose = useCallback(() => {
    if (encoding) {
      abortRef.current = true
      setEncoding(false)
    }
    onClose?.()
  }, [encoding, onClose])

  const handleDownload = useCallback(async () => {
    const source = fittedRef.current
    if (!source || encoding) return
    abortRef.current = false
    encodeStartedRef.current = performance.now()
    setEncoding(true)
    setProgress(0)
    setEta('')
    setStatusKind('ok')
    setFrameHint('')
    const size = outputSize(sizeId, imageRef.current || source)
    const exportFps = size.fps || fps
    try {
      const result = await encodeMotionGif({
        source,
        width: size.width,
        height: size.height,
        fps: exportFps,
        loopSeconds: loop,
        preset,
        intensity,
        signal: { get aborted() { return abortRef.current } },
        onProgress: (pct, index, total) => {
          setProgress(pct)
          setEta(formatEta(encodeStartedRef.current, pct))
          setFrameHint(total ? `프레임 ${index} / ${total}` : '')
          setStatus(`인코딩 중 ${pct}%`)
        },
      })
      setProgress(100)
      setEta('')
      setStatus(`완료 ${Math.round(result.byteLength / 1024)} KB`)
      saveAs(result.blob, `motion-studio-${size.width}x${size.height}.gif`)
      revokeGifUrl(result.url)
    } catch (error) {
      setStatusKind(abortRef.current ? 'ok' : 'error')
      setStatus(error.message || 'GIF 인코딩에 실패했습니다.')
    } finally {
      setEncoding(false)
      if (!abortRef.current && hasSource && playing) startLoop()
    }
  }, [encoding, fps, hasSource, intensity, loop, playing, preset, sizeId, startLoop])

  const handleBatchExport = useCallback(async () => {
    const list = (cuts.length ? cuts : parsed.cuts).filter((cut) => cutUrl(cut))
    if (!list.length || encoding) return
    abortRef.current = false
    encodeStartedRef.current = performance.now()
    setEncoding(true)
    setProgress(0)
    setEta('')
    setStatusKind('ok')
    const size = outputSize(sizeId, imageRef.current)
    const exportFps = size.fps || fps
    const zip = new JSZip()
    const folder = zip.folder('motion-studio-batch')
    try {
      for (let i = 0; i < list.length; i += 1) {
        if (abortRef.current) throw new Error('내보내기를 취소했습니다.')
        const url = cutUrl(list[i])
        const image = await loadImage(url)
        const fitted = fitSource(image, size.width, size.height)
        const result = await encodeMotionGif({
          source: fitted,
          width: size.width,
          height: size.height,
          fps: exportFps,
          loopSeconds: loop,
          preset,
          intensity,
          signal: { get aborted() { return abortRef.current } },
          onProgress: (pct) => {
            const overall = Math.round(((i + pct / 100) / list.length) * 100)
            setProgress(overall)
            setEta(formatEta(encodeStartedRef.current, overall))
            setFrameHint(`컷 ${i + 1} / ${list.length}`)
            setStatus(`일괄 변환 중 ${overall}%`)
          },
        })
        const name = String(list[i].name || `cut-${String(i + 1).padStart(2, '0')}`).replace(/\.(png|jpe?g)$/i, '')
        folder.file(`${name}.gif`, result.uint8)
        revokeGifUrl(result.url)
        releaseCanvas(fitted)
      }
      const packed = await zip.generateAsync({ type: 'blob' })
      setProgress(100)
      setEta('')
      setStatus(`배치 완료 ${list.length}개`)
      saveAs(packed, 'motion-studio-batch.zip')
    } catch (error) {
      setStatusKind(abortRef.current ? 'ok' : 'error')
      setStatus(error.message || '일괄 변환에 실패했습니다.')
    } finally {
      setEncoding(false)
      if (!abortRef.current && hasSource && playing) startLoop()
    }
  }, [cuts, encoding, fps, hasSource, intensity, loop, parsed.cuts, playing, preset, sizeId, startLoop])

  if (!isOpen) return null

  const visibleCuts = cuts.length ? cuts : parsed.cuts

  return (
    <div className="studio-modal-root mgs-root" role="dialog" aria-modal="true" aria-labelledby="mgs-title">
      <div className="studio-modal-backdrop" onClick={requestClose} />
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
            <button type="button" className="studio-modal-close" onClick={requestClose} aria-label="닫기" {...magnify('닫기', '모션 GIF 스튜디오를 닫습니다')}>
              <X className="h-4 w-4" /> ✕ 닫기
            </button>
          </div>
        </header>

        <div className="mgs-body">
          <aside className="mgs-pane">
            <h3>소스 인풋</h3>
            <div className="mgs-tabs">
              <button type="button" className={clsx('mgs-tab', sourceTab === 'canvas' && 'is-on')} disabled={encoding} onClick={() => setSourceTab('canvas')}>
                본체 그래픽 수신
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'cuts' && 'is-on')} disabled={encoding} onClick={() => setSourceTab('cuts')}>
                이모티콘 컷 픽업
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'drop' && 'is-on')} disabled={encoding} onClick={() => setSourceTab('drop')}>
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
              <>
                {visibleCuts.length ? (
                  <div className="mgs-cuts">
                    {visibleCuts.map((cut, index) => {
                      const url = cutUrl(cut)
                      return (
                        <button
                          key={cut.id || index}
                          type="button"
                          className={clsx('mgs-icon-btn', selectedCut === url && 'is-on')}
                          disabled={encoding || !url}
                          onClick={() => {
                            setSelectedCut(url)
                            ingestUrl(url)
                          }}
                        >
                          <img src={url} alt={`컷 ${index + 1}`} />
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mgs-hint">분할기에서 시트를 나누면 여기에 컷이 나타납니다. PNG/JPG를 여러 장 올려도 됩니다.</p>
                )}
                <button
                  type="button"
                  className="mgs-tab mgs-batch"
                  disabled={encoding || !visibleCuts.length}
                  onClick={handleBatchExport}
                  {...magnify('전체 컷 GIF', '선택된 모션을 모든 컷에 적용해 ZIP으로 받습니다')}
                >
                  전체 28컷 일괄 변환 (Batch Export)
                </button>
                <label className="mgs-drop">
                  컷 이미지 여러 장 올리기 (최대 28)
                  <input
                    ref={cutsFileRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    multiple
                    hidden
                    onChange={(event) => {
                      ingestCutFiles(event.target.files)
                      event.target.value = ''
                    }}
                  />
                </label>
              </>
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
              <canvas
                ref={viewRef}
                className="mgs-preview-canvas"
                hidden={!hasSource}
                style={{ transform: `scale(${zoom / 100})` }}
              />
              {!hasSource && !loading ? <p className="mgs-empty">왼쪽에서 이미지를 고르거나 파일을 놓으세요.</p> : null}
              {loading ? <p className="mgs-empty">소스 읽는 중…</p> : null}
            </div>
            <div className="mgs-view-bar">
              <button
                type="button"
                className={clsx('mgs-icon-btn', playing && 'is-on')}
                disabled={!hasSource || encoding}
                onClick={() => {
                  const next = !playing
                  playRef.current.playing = next
                  setPlaying(next)
                }}
              >
                {playing ? '일시정지' : '재생'}
              </button>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</button>
              <span className="mgs-zoom">{zoom}%</span>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => Math.min(200, value + 10))}>+</button>
              <span className="mgs-hint">프리뷰 60 FPS</span>
            </div>
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
              루프 시간 {loop.toFixed(1)}s
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
            <label className="mgs-slider">
              캔버스 규격
              <select
                className="mgs-select"
                value={sizeId}
                disabled={encoding}
                onChange={(event) => {
                  const nextId = event.target.value
                  setSizeId(nextId)
                  const resolved = resolvePlatformSize(nextId, imageRef.current)
                  if (resolved.fps) setFps(resolved.fps)
                }}
              >
                {SIZE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
          </aside>
        </div>

        <footer className="mgs-foot">
          <div className={clsx('mgs-status', statusKind === 'error' && 'is-error')}>
            {status}{frameHint ? ` · ${frameHint}` : ''}{eta ? ` · ${eta}` : ''}
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
