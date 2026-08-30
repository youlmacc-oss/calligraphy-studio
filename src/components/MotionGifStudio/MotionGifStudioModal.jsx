import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import clsx from 'clsx'
import { encodeMotionGif, formatEta, revokeGifUrl, countGifFrames } from './gifEngine.js'
import { hasNetscapeLoop } from './gifEncodeCore.js'
import {
  inspectAlpha,
  inspectPalette,
  idleMotionDiagnostics,
  readGifHeader,
  runMotionDiagnostics,
} from './diagnosticsEngine.js'
import MotionDiagnosticsHUD from './MotionDiagnosticsHUD.jsx'
import {
  MOTION_NONE,
  MOTION_PRESETS,
  INTENSITY_MIN,
  LOOP_MAX,
  LOOP_MIN,
  clampFps,
  clampIntensity,
  clampLoopSeconds,
  clampZoom,
  paintMotionFrame,
  quantizeLoopTime,
} from './motionPresets.js'
import { PLATFORM_PRESETS, resolvePlatformSize } from './platformPresets.js'
import { getEmoticonCuts, subscribeEmoticonCuts } from './cutSnapshot.js'
import {
  PC_IMAGE_ACCEPT,
  PC_IMAGE_MAX,
  createPcDragGuard,
  isPcImageFile,
  listPcImageFiles,
} from './motionPcUpload.js'
import { blitToHiDpiCanvas, primeHqContext } from '../../utils/hqRender.js'
import { MotionSequencerPanel } from '../MotionStudio/index.js'
import { MotionStudioProvider, useMotionStudio } from '../MotionStudio/motionStudioContext.jsx'
import {
  canvasToPngDataUrl,
  hydrateSavedSession,
  peekFreshSession,
  persistMotionStudioSession,
  urlToDataUrl,
} from '../../lib/sessionManager.js'
import MotionZipToolbarButton from '../MotionStudio/MotionZipToolbarButton.jsx'
import { paintParticleOverlay, normalizeParticleLayers } from '../MotionStudio/particleOverlayEngine.js'
import { paintLiveCaptionLayer } from '../MotionStudio/DynamicTextMotionRenderer.js'
import { setupSpeechBubbleDragger } from '../MotionStudio/speechBubbleDrag.js'
import { cropSpriteWithFeedback, drawDetectionOutline, forgetCroppedSprite } from './spriteIsolate.js'
import PixelSelectionModal from './PixelSelectionModal.jsx'
import TransparencyCheckModal from '../TransparencyCheckModal.jsx'
import { canvasFromUrl, enforceTransparencyPurge, sourceToCanvas } from '../../lib/fakeBackgroundPurge.js'
import { useTransparencyGate } from '../../hooks/useTransparencyGate.js'
import './motionGifStudio.css'

const VIEW_BG = [
  { id: 'checker', label: '🏁 체커보드', tip: '체커보드 배경: 투명 여백 및 알파 채널 확인' },
  { id: 'dark', label: '⬛ 다크', tip: '다크 모드: 어두운 배경에서의 발광 및 색감 검증' },
  { id: 'light', label: '⬜ 라이트', tip: '라이트 모드: 밝은 배경에서의 가독성 및 외곽선 검증' },
]

const PRESET_UI = {
  jellyBounce: { name: '젤리 바운스', icon: '🍮' },
  neonPulse: { name: '네온 펄스', icon: '💡' },
  cuteWiggle: { name: '큐트 위글', icon: '🎀' },
  cinematicGlitch: { name: '글리치', icon: '📺' },
  softFloating: { name: '소프트 플로팅', icon: '☁️' },
  angryShake: { name: '앵그리 셰이크', icon: '💢' },
  rollingTilt: { name: '롤링 틸트', icon: '💫' },
  squashStretch: { name: '스쿼시 스트레치', icon: '💥' },
  heartbeat: { name: '하트 비트', icon: '💓' },
  zoomPunch: { name: '줌 앤 펀치', icon: '💨' },
}

const PRESET_TIPS = {
  jellyBounce: '젤리 바운스: 상하 압축(Squash)과 도약 탄성 물리 모션',
  neonPulse: '네온 펄스: 빛이 은은하게 차오르고 맥동하는 발광 루프',
  cuteWiggle: '큐트 위글: 좌우 ±8도 리듬 틸트와 갸우뚱 모션',
  cinematicGlitch: '시네마틱 글리치: 순간 RGB 채널 분리 및 디지털 노이즈',
  softFloating: '소프트 플로팅: 무중력처럼 부드럽게 오르내리는 사인파 부유',
  angryShake: '앵그리 셰이크: 고주파 X/Y 무작위형 진동과 분노 지터',
  rollingTilt: '롤링 틸트: 좌우 진자처럼 -12도에서 +12도로 부드럽게 기울입니다',
  squashStretch: '스쿼시 & 스트레치: 착지 때 납작, 도약 때 길쭉한 찹쌀떡 탄성',
  heartbeat: '하트 비트: 쿵-쾅 2박자 심장 박동 스케일 펄스',
  zoomPunch: '줌 앤 펀치: 화면 앞으로 튀어나오는 돌출 팝업 줌',
}

const FPS_TIP = '12fps: 카카오톡 최적화 / 24fps: 고화질 부드러운 모션'

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
  return isPcImageFile(file)
}

function gifStem(name, index) {
  const base = String(name || `image-${index + 1}`).replace(/\.(png|jpe?g|webp)$/i, '').replace(/[\\/:*?"<>|]+/g, '_').trim()
  return base || `image-${String(index + 1).padStart(2, '0')}`
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
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true })
  primeHqContext(ctx)
  ctx.clearRect(0, 0, width, height)
  const { width: sw, height: sh } = sourceSize(image)
  const scale = Math.min(width / sw, height / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh)
  return enforceTransparencyPurge(canvas)
}

function releaseCanvas(canvas) {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

function cutUrl(cut) {
  return cut?.preview || cut?.url || cut?.dataUrl || ''
}

function cutKey(cut, index = 0) {
  return cut?.id || `cut-${index}`
}

function StudioSessionBridge({ apiRef, children }) {
  const studio = useMotionStudio()
  apiRef.current = studio
  return children
}

function snapshotCanvas(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return null
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const ctx = copy.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(canvas, 0, 0)
  return copy
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
  const dropDepthRef = useRef(0)
  const sourceTabRef = useRef('canvas')
  const cutsRef = useRef([])
  const fpsProbeRef = useRef({ last: 0, frames: 0, hz: 0 })
  const lastBlobRef = useRef(null)
  const encodePhaseRef = useRef('idle')
  const encodeErrorRef = useRef('')
  const diagSnapRef = useRef({})
  const overlayRef = useRef([])
  const detectRef = useRef({ until: 0, bounds: null })
  const pixelSpriteRef = useRef(null)
  const captionLiveRef = useRef({
    enabled: false,
    isTextEnabled: false,
    captionOn: false,
    text: '',
    customText: '',
    captionText: '',
    effect: 'none',
    sizeId: 'md',
    strokeId: 'black',
    fps: 8,
    speed: 1,
    loopSeconds: 2,
  })

  const parsed = useMemo(() => parseInitialSource(initialSource), [initialSource])
  const [sourceTab, setSourceTab] = useState('canvas')
  const [localUrl, setLocalUrl] = useState(null)
  const [uploadedImages, setUploadedImages] = useState([])
  const [selectedUpload, setSelectedUpload] = useState('')
  const [cuts, setCuts] = useState(() => getEmoticonCuts())
  const [selectedCut, setSelectedCut] = useState('')
  const [dropOver, setDropOver] = useState(false)
  const [dropNote, setDropNote] = useState('')
  const [viewBg, setViewBg] = useState('checker')
  const [playing, setPlaying] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [preset, setPreset] = useState(MOTION_NONE)
  const [isolateOn, setIsolateOn] = useState(true)
  const [detectOn, setDetectOn] = useState(false)
  const [pixelOpen, setPixelOpen] = useState(false)
  const [pixelSource, setPixelSource] = useState(null)
  const alphaGate = useTransparencyGate()
  const detectTimerRef = useRef(0)
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
  const [sourceMeta, setSourceMeta] = useState({ width: 360, height: 360 })
  const [diagOpen, setDiagOpen] = useState(false)
  const [diagReport, setDiagReport] = useState(() => idleMotionDiagnostics())
  const [sessionSaved, setSessionSaved] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [resumeAsk, setResumeAsk] = useState(false)
  const sessionSnapRef = useRef(null)
  const studioApiRef = useRef(null)
  const skipSourceSyncRef = useRef(false)
  const saveTimerRef = useRef(0)
  const persistBusyRef = useRef(false)

  const loop = clampLoopSeconds(loopSeconds)

  useEffect(() => {
    paramsRef.current = { preset, intensity, loopSeconds: loop, fps, sizeId, playing, zoom, isolate: isolateOn }
    sourceTabRef.current = sourceTab
    cutsRef.current = cuts
    diagSnapRef.current = {
      hasSource,
      loading,
      sourceMeta,
      preset,
      intensity,
      targetFps: clampFps(fps),
      playing,
      sizeId,
      encoding,
      progress,
      frameHint,
      loopSeconds: loop,
      encodeError: statusKind === 'error' ? status : '',
    }
  })

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const paintNow = useCallback((time01) => {
    const sprite = pixelSpriteRef.current || imageRef.current
    const fitted = fittedRef.current
    const view = viewRef.current
    if (!sprite || !fitted || !view) return
    const size = { width: fitted.width, height: fitted.height }
    let virtual = virtualRef.current
    if (!virtual) {
      virtual = document.createElement('canvas')
      virtualRef.current = virtual
    }
    if (virtual.width !== size.width || virtual.height !== size.height) {
      virtual.width = size.width
      virtual.height = size.height
    }
    const virtualCtx = virtual.getContext('2d', { alpha: true })
    primeHqContext(virtualCtx)
    paintMotionFrame(virtualCtx, sprite, {
      width: size.width,
      height: size.height,
      time01,
      preset: paramsRef.current.preset,
      intensity: paramsRef.current.intensity,
      isolate: paramsRef.current.isolate !== false,
    })
    const detect = detectRef.current
    if (detect.until > performance.now() && detect.bounds && Math.floor(performance.now() / 180) % 2 === 0) {
      drawDetectionOutline(virtualCtx, detect.bounds, size.width, size.height)
    }
    const edge = Math.min(size.width, size.height)
    paintLiveCaptionLayer(virtualCtx, captionLiveRef.current, time01, edge)
    const layers = normalizeParticleLayers(overlayRef.current)
    if (layers.length) {
      paintParticleOverlay(virtualCtx, {
        size: edge,
        time01,
        layers,
      })
    }
    blitToHiDpiCanvas(view, virtual, {
      cssWidth: size.width,
      cssHeight: size.height,
      zoomPercent: 100,
      live: true,
      edgePreserve: false,
    })
  }, [])

  const syncStageCaption = useCallback(() => {
    paintNow(playRef.current.pausedT || 0)
  }, [paintNow])

  const stageDrag = useMemo(() => setupSpeechBubbleDragger(
    viewRef,
    () => captionLiveRef.current?.bubble,
    (x, y) => {
      captionLiveRef.current?.setPos?.(x, y)
      paintNow(playRef.current.pausedT || 0)
    },
    () => {
      const fitted = fittedRef.current
      return { width: fitted?.width || 360, height: fitted?.height || 360 }
    },
    {
      getTail: () => captionLiveRef.current?.tail || captionLiveRef.current?.captionTail,
      updateTail: (key, rel) => {
        const prev = captionLiveRef.current?.tail || captionLiveRef.current?.captionTail
        captionLiveRef.current?.setTail?.({ ...prev, [key]: rel, enabled: true })
        paintNow(playRef.current.pausedT || 0)
      },
    },
  ), [paintNow])

  const startLoop = useCallback(() => {
    stopLoop()
    if (!playRef.current.playing) return
    playRef.current.startedAt = 0
    const step = (now) => {
      if (!playRef.current.playing) {
        rafRef.current = 0
        return
      }
      const seconds = clampLoopSeconds(paramsRef.current.loopSeconds)
      if (!playRef.current.startedAt) {
        playRef.current.startedAt = now - playRef.current.pausedT * seconds * 1000
      }
      const elapsed = ((now - playRef.current.startedAt) / 1000) % seconds
      const raw = elapsed / seconds
      playRef.current.pausedT = raw
      paintNow(quantizeLoopTime(raw, paramsRef.current.fps, seconds))
      const probe = fpsProbeRef.current
      probe.frames += 1
      if (!probe.last) probe.last = now
      const span = now - probe.last
      if (span >= 400) {
        probe.hz = (probe.frames * 1000) / span
        probe.frames = 0
        probe.last = now
      }
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [stopLoop, paintNow])

  const teardown = useCallback(() => {
    abortRef.current = true
    stopLoop()
    releaseCanvas(virtualRef.current)
    releaseCanvas(fittedRef.current)
    releaseCanvas(pixelSpriteRef.current)
    fittedRef.current = null
    pixelSpriteRef.current = null
    imageRef.current = null
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }, [stopLoop])

  const applyImage = useCallback(async (image) => {
    releaseCanvas(pixelSpriteRef.current)
    pixelSpriteRef.current = null
    const cleaned = sourceToCanvas(image)
    if (cleaned) enforceTransparencyPurge(cleaned)
    imageRef.current = cleaned || image
    setSourceMeta(sourceSize(imageRef.current))
    const size = outputSize(paramsRef.current.sizeId, imageRef.current)
    const fitted = fitSource(imageRef.current, size.width, size.height)
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

  const collectSessionPayload = useCallback(async () => {
    const live = captionLiveRef.current || {}
    const seq = sessionSnapRef.current || {}
    const sourceCanvas = imageRef.current
    const pixelCanvas = pixelSpriteRef.current
    const seqItems = Array.isArray(seq.sequence) ? seq.sequence : []
    const customFrames = []
    const sequenceMeta = []
    for (const item of seqItems.slice(0, 12)) {
      const dataUrl = await urlToDataUrl(item.url)
      if (!dataUrl) continue
      customFrames.push(dataUrl)
      sequenceMeta.push({
        cutId: item.cutId,
        cutIndex: item.cutIndex,
        label: item.label,
      })
    }
    return {
      version: '1.0',
      sourceImage: canvasToPngDataUrl(sourceCanvas),
      pixelSprite: pixelCanvas && pixelCanvas !== sourceCanvas ? canvasToPngDataUrl(pixelCanvas) : null,
      activeSourceTab: sourceTab,
      selectedPreset: preset,
      motionParams: {
        loopDuration: loop,
        motionIntensity: intensity,
        fps,
        canvasSpec: sizeId,
      },
      subtitleConfig: {
        text: live.captionText || live.text || '',
        fontFamily: live.captionFont || live.fontId || 'Jua',
        fontSize: live.captionSize || live.sizeId || 'md',
        color: live.captionStroke || live.strokeId || 'black',
        bubbleEnabled: Boolean(live.captionOn || live.enabled),
        posX: live.posX || 0,
        posY: live.posY || 0,
        effect: live.effect || 'none',
        tail: live.captionTail || live.tail || { enabled: false, tip: { x: -18, y: 56 }, baseStart: { x: -14, y: 20 }, baseEnd: { x: 14, y: 20 } },
      },
      customFrames,
      sequenceMeta,
      particles: Array.isArray(seq.particles) ? seq.particles : [],
      pingPong: Boolean(seq.pingPong),
      seqFps: seq.fps,
      isolateOn,
      viewBg,
      zoom,
    }
  }, [sourceTab, preset, loop, intensity, fps, sizeId, isolateOn, viewBg, zoom])

  const persistSessionNow = useCallback(async () => {
    if (!isOpen || encoding || persistBusyRef.current) return false
    persistBusyRef.current = true
    setSessionBusy(true)
    try {
      const payload = await collectSessionPayload()
      const ok = await persistMotionStudioSession(payload)
      setSessionSaved(ok)
      return ok
    } finally {
      persistBusyRef.current = false
      setSessionBusy(false)
    }
  }, [collectSessionPayload, encoding, isOpen])

  const applySavedSession = useCallback(async (session) => {
    if (!session) return false
    skipSourceSyncRef.current = Date.now() + 900
    setSourceTab(session.activeSourceTab || 'canvas')
    setPreset(session.selectedPreset || MOTION_NONE)
    setLoopSeconds(session.motionParams?.loopDuration ?? 2)
    setIntensity(session.motionParams?.motionIntensity ?? 70)
    setFps(session.motionParams?.fps ?? 24)
    setSizeId(session.motionParams?.canvasSpec || 'kakao')
    setIsolateOn(session.isolateOn !== false)
    setViewBg(session.viewBg || 'checker')
    setZoom(session.zoom || 100)
    if (session.sourceImage) {
      if (session.activeSourceTab === 'drop') {
        const item = {
          id: `session-restore-${Date.now()}`,
          name: '이전 작업',
          url: session.sourceImage,
          preview: session.sourceImage,
        }
        setUploadedImages([item])
        setSelectedUpload(item.id)
        setLocalUrl(item.url)
      }
      await ingestUrl(session.sourceImage)
    }
    if (session.pixelSprite) {
      try {
        const image = await loadImage(session.pixelSprite)
        const canvas = sourceToCanvas(image)
        if (canvas) {
          enforceTransparencyPurge(canvas)
          releaseCanvas(pixelSpriteRef.current)
          pixelSpriteRef.current = canvas
          setPixelSource(canvas)
        }
      } catch {
        /* keep restored source */
      }
    }
    const frames = (session.customFrames || []).map((url, index) => ({
      id: `session-seq-${index}`,
      url,
      cutId: session.sequenceMeta?.[index]?.cutId || `cut-${index + 1}`,
      cutIndex: session.sequenceMeta?.[index]?.cutIndex ?? index,
      label: session.sequenceMeta?.[index]?.label || `${index + 1}`,
    }))
    const sub = session.subtitleConfig || {}
    studioApiRef.current?.applyClip?.({
      token: Date.now(),
      frames,
      fps: session.seqFps,
      effect: sub.effect,
      pingPong: session.pingPong,
      particles: session.particles,
      captionOn: sub.bubbleEnabled,
      captionText: sub.text,
      captionSize: sub.fontSize,
      captionStroke: sub.color,
      captionFont: sub.fontFamily,
      posX: sub.posX,
      posY: sub.posY,
      captionTail: sub.tail,
    })
    setResumeAsk(false)
    setSessionSaved(true)
    setStatusKind('ok')
    setStatus('이전 작업을 복원했습니다')
    paintNow(playRef.current.pausedT || 0)
    return true
  }, [ingestUrl, paintNow])

  const ingestLocalFiles = useCallback((fileList) => {
    const files = listPcImageFiles(fileList, PC_IMAGE_MAX)
    if (!files.length) {
      setDropNote('PNG, JPG, WebP만 올릴 수 있습니다.')
      setStatusKind('error')
      setStatus('PNG, JPG, WebP만 올릴 수 있습니다.')
      return
    }
    void (async () => {
      setLoading(true)
      const added = []
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        const url = URL.createObjectURL(file)
        objectUrlsRef.current.push(url)
        try {
          const image = await loadImage(url)
          added.push({
            id: `upload-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
            name: file.name || `image-${index + 1}`,
            url,
            preview: url,
            width: image.naturalWidth || image.width || 0,
            height: image.naturalHeight || image.height || 0,
          })
        } catch {
          URL.revokeObjectURL(url)
          objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url)
        }
      }
      if (!added.length) {
        setLoading(false)
        setDropNote('이미지를 읽지 못했습니다.')
        setStatusKind('error')
        setStatus('이미지를 읽지 못했습니다.')
        return
      }
      setUploadedImages((current) => [...current, ...added].slice(0, PC_IMAGE_MAX))
      setSelectedUpload(added[0].id)
      setLocalUrl(added[0].url)
      setSourceTab('drop')
      setDropNote(`${added.length}장 추가됨`)
      setStatusKind('ok')
      setStatus(`업로드 ${added.length}장 Ready`)
      setLoading(false)
    })()
  }, [])

  const openPcFilePicker = useCallback(() => {
    const input = fileRef.current
    if (!input || encoding) return
    input.value = ''
    input.click()
  }, [encoding])

  const pcDrag = useMemo(
    () => createPcDragGuard(dropDepthRef, setDropOver),
    [],
  )

  const onPcDrop = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    pcDrag.reset()
    ingestLocalFiles(event.dataTransfer?.files)
  }, [ingestLocalFiles, pcDrag])

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
      return { id: `local-cut-${index}`, url, preview: url }
    })
    setCuts(next)
    setSelectedCut(cutKey(next[0], 0))
    setSourceTab('cuts')
  }, [])

  const pickUpload = useCallback((item) => {
    setSelectedUpload(item.id)
    setLocalUrl(item.url)
    playRef.current.playing = true
    setPlaying(true)
  }, [])

  const removeUpload = useCallback((id) => {
    setUploadedImages((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item?.url) {
        URL.revokeObjectURL(item.url)
        objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== item.url)
      }
      const next = current.filter((entry) => entry.id !== id)
      if (selectedUpload === id) {
        setSelectedUpload(next[0]?.id || '')
        setLocalUrl(next[0]?.url || null)
      }
      return next
    })
  }, [selectedUpload])

  useEffect(() => {
    if (!isOpen) {
      teardown()
      playRef.current = { playing: true, startedAt: 0, pausedT: 0 }
      const timer = window.setTimeout(() => {
        setHasSource(false)
        setEncoding(false)
        setProgress(0)
        setPlaying(true)
        setLocalUrl(null)
        setUploadedImages([])
        setSelectedUpload('')
        setSelectedCut('')
        setDropNote('')
        setSourceTab('canvas')
        setEta('')
        setStatus('엔진 대기 중 (Ready)')
      }, 0)
      return () => window.clearTimeout(timer)
    }
    abortRef.current = false
    const snapshotCuts = getEmoticonCuts()
    const nextCuts = parsed.cuts.length ? parsed.cuts : snapshotCuts
    const timer = window.setTimeout(() => {
      setCuts(nextCuts)
      if (nextCuts[0]) setSelectedCut(cutKey(nextCuts[0], 0))
      ingestUrl(parsed.dataUrl)
    }, 0)
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, parsed.dataUrl])

  useEffect(() => {
    if (!isOpen) {
      setResumeAsk(false)
      return undefined
    }
    setResumeAsk(Boolean(peekFreshSession()))
    return undefined
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || encoding || !hasSource) return undefined
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void persistSessionNow()
    }, 1000)
    return () => window.clearTimeout(saveTimerRef.current)
  }, [isOpen, encoding, hasSource, sourceTab, preset, loop, intensity, fps, sizeId, isolateOn, viewBg, zoom, persistSessionNow])

  useEffect(() => {
    if (!isOpen || encoding) return undefined
    const tick = window.setInterval(() => {
      if (hasSource) void persistSessionNow()
    }, 4000)
    const flush = () => {
      if (hasSource) void persistSessionNow()
    }
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [isOpen, encoding, hasSource, persistSessionNow])

  useEffect(() => {
    if (!isOpen) return undefined
    const blockNav = (event) => {
      const types = event.dataTransfer?.types
      if (!types || ![...types].includes('Files')) return
      event.preventDefault()
    }
    window.addEventListener('dragover', blockNav)
    window.addEventListener('drop', blockNav)
    return () => {
      window.removeEventListener('dragover', blockNav)
      window.removeEventListener('drop', blockNav)
    }
  }, [isOpen])

  useEffect(() => subscribeEmoticonCuts((next) => {
    setCuts((current) => {
      if (current.some((item) => String(item.id || '').startsWith('local-cut-'))) return current
      return next
    })
    if (sourceTabRef.current === 'cuts' && next[0]) {
      setSelectedCut((id) => id || cutKey(next[0], 0))
    }
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
  }, [isOpen, hasSource, preset, intensity, loopSeconds, sizeId, playing, zoom, isolateOn, paintNow, startLoop, stopLoop])

  useEffect(() => {
    if (!isOpen) return undefined
    const timer = window.setTimeout(() => {
      if (Number(skipSourceSyncRef.current) > Date.now()) return
      if (sourceTab === 'canvas') {
        ingestUrl(parsed.dataUrl)
        return
      }
      if (sourceTab === 'drop') {
        ingestUrl(localUrl)
        return
      }
      const list = cutsRef.current.length ? cutsRef.current : parsed.cuts
      const active = list.find((item, index) => cutKey(item, index) === selectedCut) || list[0]
      ingestUrl(cutUrl(active))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [sourceTab, selectedCut, localUrl, parsed.dataUrl, parsed.cuts, isOpen, ingestUrl])

  useEffect(() => {
    if (sourceTab !== 'cuts' || selectedCut) return undefined
    const first = cuts[0] || parsed.cuts[0]
    if (!first) return undefined
    const timer = window.setTimeout(() => setSelectedCut(cutKey(first, 0)), 0)
    return () => window.clearTimeout(timer)
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
        source: pixelSpriteRef.current || imageRef.current || source,
        width: size.width,
        height: size.height,
        fps: exportFps,
        loopSeconds: loop,
        preset,
        intensity,
        signal: { get aborted() { return abortRef.current } },
        onProgress: (pct, index, total, phase) => {
          encodePhaseRef.current = phase || 'encode'
          encodeErrorRef.current = ''
          setProgress(pct)
          setEta(formatEta(encodeStartedRef.current, pct))
          setFrameHint(total ? `프레임 ${index} / ${total}` : '')
          setStatus(`인코딩 중 ${pct}%`)
        },
      })
      lastBlobRef.current = {
        bytes: result.byteLength,
        header: readGifHeader(result.uint8),
        netscape: hasNetscapeLoop(result.uint8),
        elapsedMs: Math.round(performance.now() - encodeStartedRef.current),
        width: result.width,
        height: result.height,
        frames: result.frames,
      }
      encodePhaseRef.current = 'done'
      setProgress(100)
      setEta('')
      setStatus(`완료 ${Math.round(result.byteLength / 1024)} KB`)
      saveAs(result.blob, `motion-studio-${size.width}x${size.height}.gif`)
      revokeGifUrl(result.url)
    } catch (error) {
      encodeErrorRef.current = error.message || 'GIF 인코딩에 실패했습니다.'
      encodePhaseRef.current = 'idle'
      setStatusKind(abortRef.current ? 'ok' : 'error')
      setStatus(error.message || 'GIF 인코딩에 실패했습니다.')
    } finally {
      setEncoding(false)
      if (!abortRef.current && hasSource && playing) startLoop()
    }
  }, [encoding, fps, hasSource, intensity, loop, playing, preset, sizeId, startLoop])

  const runBatchEncode = useCallback(async (list, zipName, folderName) => {
    if (!list.length || encoding) return
    abortRef.current = false
    encodeStartedRef.current = performance.now()
    setEncoding(true)
    setProgress(0)
    setEta('')
    setStatusKind('ok')
    const sizeHint = outputSize(sizeId, imageRef.current)
    const exportFps = sizeHint.fps || fps
    const zip = new JSZip()
    const folder = zip.folder(folderName)
    try {
      for (let i = 0; i < list.length; i += 1) {
        if (abortRef.current) throw new Error('내보내기를 취소했습니다.')
        const url = cutUrl(list[i]) || list[i].url
        const image = await loadImage(url)
        const size = outputSize(sizeId, image)
        const fitted = fitSource(image, size.width, size.height)
        const result = await encodeMotionGif({
          source: image,
          width: size.width,
          height: size.height,
          fps: exportFps,
          loopSeconds: loop,
          preset,
          intensity,
          signal: { get aborted() { return abortRef.current } },
          onProgress: (pct, _index, _total, phase) => {
            encodePhaseRef.current = phase || 'encode'
            const overall = Math.round(((i + pct / 100) / list.length) * 100)
            setProgress(overall)
            setEta(formatEta(encodeStartedRef.current, overall))
            setFrameHint(`${i + 1}/${list.length} 처리 중`)
            setStatus(`${i + 1}/${list.length} 처리 중... ${overall}%`)
          },
        })
        lastBlobRef.current = {
          bytes: result.byteLength,
          header: readGifHeader(result.uint8),
          netscape: hasNetscapeLoop(result.uint8),
          elapsedMs: Math.round(performance.now() - encodeStartedRef.current),
          width: result.width,
          height: result.height,
          frames: result.frames,
        }
        encodePhaseRef.current = 'done'
        folder.file(`${gifStem(list[i].name, i)}.gif`, result.uint8)
        revokeGifUrl(result.url)
        releaseCanvas(fitted)
      }
      const packed = await zip.generateAsync({ type: 'blob' })
      setProgress(100)
      setEta('')
      setStatus(`배치 완료 ${list.length}개`)
      saveAs(packed, zipName)
    } catch (error) {
      encodeErrorRef.current = error.message || '일괄 변환에 실패했습니다.'
      encodePhaseRef.current = 'idle'
      setStatusKind(abortRef.current ? 'ok' : 'error')
      setStatus(error.message || '일괄 변환에 실패했습니다.')
    } finally {
      setEncoding(false)
      if (!abortRef.current && hasSource && playing) startLoop()
    }
  }, [encoding, fps, hasSource, intensity, loop, playing, preset, sizeId, startLoop])

  const handleBatchExport = useCallback(() => {
    const list = (cuts.length ? cuts : parsed.cuts).filter((cut) => cutUrl(cut)).slice(0, 28)
    return runBatchEncode(list, 'motion-studio-batch.zip', 'motion-studio-batch')
  }, [cuts, parsed.cuts, runBatchEncode])

  const handleUploadBatchExport = useCallback(() => {
    const list = uploadedImages.filter((item) => item.url)
    return runBatchEncode(list, 'custom_images_motion_gif.zip', 'custom_images_motion_gif')
  }, [runBatchEncode, uploadedImages])

  const requestDownload = useCallback(() => {
    const canvas = sourceToCanvas(pixelSpriteRef.current || imageRef.current || fittedRef.current)
    if (!canvas) return
    void alphaGate.runOrAsk([canvas], async ({ purged, canvases }) => {
      if (purged && canvases[0]) pixelSpriteRef.current = canvases[0]
      await handleDownload()
    })
  }, [alphaGate, handleDownload])

  const requestUploadBatchExport = useCallback(async () => {
    const list = uploadedImages.filter((item) => item.url)
    const canvases = []
    for (const item of list) canvases.push(await canvasFromUrl(item.url))
    await alphaGate.runOrAsk(canvases, async ({ purged, canvases: next }) => {
      if (purged) {
        next.forEach((canvas, index) => {
          if (list[index] && canvas) list[index].url = canvas.toDataURL('image/png')
        })
      }
      await runBatchEncode(list, 'custom_images_motion_gif.zip', 'custom_images_motion_gif')
    })
  }, [alphaGate, runBatchEncode, uploadedImages])

  useEffect(() => {
    if (!isOpen) return undefined
    let alphaCache = null
    let paletteCache = null
    const tick = () => {
      const snap = diagSnapRef.current
      const fitted = fittedRef.current
      const painted = virtualRef.current || fitted
      if (!snap.encoding) {
        const nextAlpha = inspectAlpha(fitted)
        const nextPalette = inspectPalette(painted)
        if (nextAlpha) alphaCache = nextAlpha
        if (nextPalette) paletteCache = nextPalette
      }
      const resolved = resolvePlatformSize(snap.sizeId, {
        naturalWidth: snap.sourceMeta?.width,
        naturalHeight: snap.sourceMeta?.height,
        width: snap.sourceMeta?.width,
        height: snap.sourceMeta?.height,
      })
      const frames = countGifFrames(resolved.fps || snap.targetFps, snap.loopSeconds)
      const outW = fitted?.width || resolved.width || 1
      const outH = fitted?.height || resolved.height || 1
      const estimateKb = Math.max(1, Math.round(outW * outH * frames * 0.45 / 1024))
      setDiagReport(runMotionDiagnostics({
        ...snap,
        actualFps: fpsProbeRef.current.hz,
        fittedSize: fitted ? { width: fitted.width, height: fitted.height } : null,
        alpha: alphaCache,
        palette: paletteCache,
        lastBlob: lastBlobRef.current,
        encodePhase: encodePhaseRef.current,
        frameCount: frames,
        estimateKb,
        encodeError: snap.encodeError || encodeErrorRef.current,
        encodeElapsedMs: snap.encoding && encodeStartedRef.current
          ? performance.now() - encodeStartedRef.current
          : 0,
      }))
    }
    const start = window.setTimeout(tick, 0)
    const timer = window.setInterval(tick, 450)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(timer)
    }
  }, [isOpen])

  const togglePlaying = useCallback(() => {
    const next = !playRef.current.playing
    playRef.current.playing = next
    if (!next) {
      playRef.current.startedAt = 0
      paintNow(playRef.current.pausedT || 0)
      stopLoop()
    }
    setPlaying(next)
  }, [paintNow, stopLoop])

  if (!isOpen) return null

  const visibleCuts = cuts.length ? cuts : parsed.cuts
  const liveSourceUrl = sourceTab === 'drop'
    ? (localUrl || '')
    : sourceTab === 'cuts'
      ? cutUrl(visibleCuts.find((item, index) => cutKey(item, index) === selectedCut) || visibleCuts[0])
      : (parsed.dataUrl || '')

  const handlePixelApply = (sprite) => {
    if (!sprite) return
    releaseCanvas(pixelSpriteRef.current)
    pixelSpriteRef.current = sprite
    setIsolateOn(true)
    paramsRef.current.isolate = true
    forgetCroppedSprite(sprite)
    const extracted = cropSpriteWithFeedback(sprite)
    if (extracted.bounds) {
      detectRef.current = { until: performance.now() + 1500, bounds: extracted.bounds }
      setDetectOn(true)
      if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current)
      detectTimerRef.current = window.setTimeout(() => setDetectOn(false), 1500)
      setStatusKind('ok')
      setStatus('✨ 캐릭터 영역이 성공적으로 분리되었습니다!')
    }
    setPixelOpen(false)
    setPixelSource(sprite)
    paintNow(playRef.current.pausedT || 0)
  }

  return (
    <>
    <div
      className="studio-modal-root mgs-root"
      data-no-magnifier
      role="dialog"
      aria-modal="true"
      aria-labelledby="mgs-title"
    >
      <div className="studio-modal-backdrop" onClick={requestClose} />
      <div className="studio-modal-card mgs-card">
        <MotionStudioProvider>
        <StudioSessionBridge apiRef={studioApiRef}>
        <header className="mgs-head">
          <h2 id="mgs-title">🎬 AI 모션 GIF 스튜디오 PRO</h2>
          <div className="mgs-head-actions">
            <span
              className={clsx('mgs-session-ind', sessionSaved && 'is-ok')}
              data-session-ind={sessionSaved ? '1' : '0'}
              data-tooltip="이 브라우저에 작업이 자동 저장됩니다"
              data-mgs-place="down"
            >
              {sessionSaved ? '💾 저장 완료' : '💾 자동 저장'}
            </span>
            <button
              type="button"
              className="mgs-icon-btn"
              data-session-save="1"
              disabled={encoding || sessionBusy}
              data-tooltip="지금 작업(이미지·프리셋·자막·꼬리)을 이 브라우저에 저장합니다"
              data-mgs-place="down"
              onClick={() => {
                void persistSessionNow().then((ok) => {
                  setStatusKind(ok ? 'ok' : 'error')
                  setStatus(ok ? '작업이 저장되었습니다' : '저장에 실패했습니다')
                })
              }}
            >
              💾 작업 저장
            </button>
            <button
              type="button"
              className="mgs-icon-btn"
              data-session-load="1"
              disabled={encoding || sessionBusy}
              data-tooltip="이 브라우저에 저장된 이전 작업을 1초 만에 복원합니다"
              data-mgs-place="down"
              onClick={() => {
                void hydrateSavedSession().then((session) => {
                  if (!session) {
                    setStatusKind('error')
                    setStatus('저장된 작업이 없습니다')
                    return
                  }
                  return applySavedSession(session)
                })
              }}
            >
              📂 작업 불러오기
            </button>
            {VIEW_BG.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={clsx('mgs-icon-btn mgs-tip', viewBg === mode.id && 'is-on')}
                data-tooltip={mode.tip}
                data-mgs-place="down"
                onClick={() => setViewBg(mode.id)}
              >
                {mode.label}
              </button>
            ))}
            <MotionZipToolbarButton />
            <button type="button" className="studio-modal-close" onClick={requestClose} aria-label="닫기" data-tooltip="스튜디오 닫기 (메인 에디터로 복귀)" data-mgs-place="down">
              ✕ 닫기
            </button>
          </div>
        </header>
        {resumeAsk ? (
          <div className="mgs-session-banner" data-session-resume="1" role="status">
            <p>이전에 작업하던 내용이 있습니다. 이어서 작업하시겠습니까?</p>
            <div className="mgs-session-banner-actions">
              <button
                type="button"
                className="mgs-icon-btn is-on"
                data-session-resume-yes="1"
                onClick={() => {
                  void hydrateSavedSession().then((session) => applySavedSession(session))
                }}
              >
                이어하기
              </button>
              <button
                type="button"
                className="mgs-icon-btn"
                data-session-fresh="1"
                onClick={() => setResumeAsk(false)}
              >
                새로 시작
              </button>
            </div>
          </div>
        ) : null}

        <div className="mgs-body">
          <aside className="mgs-pane mgs-sources" data-source-tab={sourceTab}>
            <input
              id="mgs-pc-upload"
              ref={fileRef}
              type="file"
              accept={PC_IMAGE_ACCEPT}
              multiple
              className="mgs-file-input"
              data-pc-upload="1"
              tabIndex={-1}
              onChange={(event) => {
                ingestLocalFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <h3>SOURCES</h3>
            <div className="mgs-tabs">
              <button type="button" className={clsx('mgs-tab', sourceTab === 'canvas' && 'is-on')} disabled={encoding} onClick={() => setSourceTab('canvas')} data-tooltip="메인 에디터에서 편집 중인 현재 그래픽 가져오기" data-mgs-place="right">
                본체 그래픽
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'cuts' && 'is-on')} disabled={encoding} onClick={() => {
                const latest = getEmoticonCuts()
                if (latest.length) setCuts(latest)
                setSourceTab('cuts')
              }} data-tooltip="이모티콘 시트 분할기에서 생성된 개별 컷 선택" data-mgs-place="right">
                이모티콘 컷
              </button>
              <button type="button" className={clsx('mgs-tab', sourceTab === 'drop' && 'is-on')} disabled={encoding} onClick={() => {
                setSourceTab('drop')
                openPcFilePicker()
              }} data-tooltip="내 컴퓨터의 PNG/JPG/WebP를 여러 장 고르거나 드래그하여 로드" data-mgs-place="right">
                내 PC 업로드
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
                          className={clsx('mgs-icon-btn', selectedCut === cutKey(cut, index) && 'is-on')}
                          disabled={encoding || !url}
                          data-tooltip={`컷 ${index + 1}을 모션 GIF 소스로 선택`}
                          data-mgs-place="right"
                          onClick={() => {
                            setSelectedCut(cutKey(cut, index))
                            playRef.current.playing = true
                            setPlaying(true)
                          }}
                        >
                          <img src={url} alt={`컷 ${index + 1}`} />
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mgs-hint">메인 화면에서 이모티콘 시트를 먼저 분할해 주세요</p>
                )}
                <button
                  type="button"
                  className="mgs-tab mgs-batch allow-long-text"
                  disabled={encoding || !visibleCuts.length}
                  onClick={() => {
                    const list = (cuts.length ? cuts : parsed.cuts).filter((cut) => cutUrl(cut)).slice(0, 28)
                    void (async () => {
                      const probe = list[0] ? await canvasFromUrl(cutUrl(list[0])) : null
                      await alphaGate.runOrAsk(probe ? [probe] : [], () => runBatchEncode(list, 'motion-studio-batch.zip', 'motion-studio-batch'))
                    })()
                  }}
                  data-tooltip="선택된 모션을 모든 컷에 적용해 ZIP으로 받습니다"
                  data-mgs-place="right"
                >
                  전체 28컷 일괄 변환 (Batch Export)
                </button>
                <label className="mgs-drop" data-tooltip="여러 컷 PNG/JPG를 한 번에 올립니다 (최대 28장)" data-mgs-place="right">
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
                  htmlFor="mgs-pc-upload"
                  className={clsx('mgs-drop', dropOver && 'is-over')}
                  data-pc-dropzone="1"
                  data-pc-dragging={dropOver ? '1' : '0'}
                  data-tooltip="PNG/JPG/WebP를 여러 장 한 번에 드래그하거나 클릭해서 올립니다"
                  data-mgs-place="right"
                  onClick={(event) => {
                    if (encoding) event.preventDefault()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openPcFilePicker()
                    }
                  }}
                  onDragEnter={pcDrag.onDragEnter}
                  onDragOver={pcDrag.onDragOver}
                  onDragLeave={pcDrag.onDragLeave}
                  onDrop={onPcDrop}
                >
                  PNG/JPG/WebP 여러 장을 놓거나
                  <br />
                  클릭해서 올리기
                </label>
                {uploadedImages.length ? (
                  <>
                    <div className="mgs-uploads">
                      {uploadedImages.map((item, index) => (
                        <div
                          key={item.id}
                          className={clsx('mgs-upload-card', selectedUpload === item.id && 'is-on')}
                        >
                          <button
                            type="button"
                            className="mgs-upload-pick"
                            disabled={encoding || !item.url}
                            data-tooltip={`${item.name}을 모션 GIF 소스로 선택`}
                            data-mgs-place="right"
                            onClick={() => pickUpload(item)}
                          >
                            <img src={item.url} alt={item.name} />
                            <span className="mgs-upload-name">{item.name || `이미지 ${index + 1}`}</span>
                          </button>
                          <button
                            type="button"
                            className="mgs-upload-del"
                            disabled={encoding}
                            data-tooltip="이 이미지를 업로드 목록에서 삭제"
                            data-mgs-place="right"
                            aria-label={`${item.name} 삭제`}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              removeUpload(item.id)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mgs-tab mgs-batch allow-long-text"
                      disabled={encoding || !uploadedImages.length}
                      onClick={requestUploadBatchExport}
                      data-tooltip="올린 모든 이미지에 현재 모션을 적용해 ZIP으로 받습니다"
                      data-mgs-place="right"
                    >
                      전체 업로드 이미지 일괄 변환 (ZIP)
                    </button>
                  </>
                ) : (
                  <p className="mgs-hint">{dropNote || '여러 장을 한 번에 올리면 썸네일 목록이 생깁니다.'}</p>
                )}
              </>
            ) : null}
          </aside>

          <section className="mgs-pane mgs-center overflow-hidden">
            <div
              className={clsx('mgs-viewport', `is-${viewBg}`, viewBg === 'checker' && 'checkerboard-bg', dropOver && 'is-drop-over')}
              data-mgs-stage="1"
              data-pc-stage-drop="1"
              data-pc-dragging={dropOver ? '1' : '0'}
              onDragEnter={pcDrag.onDragEnter}
              onDragOver={pcDrag.onDragOver}
              onDragLeave={pcDrag.onDragLeave}
              onDrop={onPcDrop}
              onClick={() => {
                if (!hasSource && !loading && !encoding) {
                  setSourceTab('drop')
                  openPcFilePicker()
                }
              }}
            >
              <canvas
                ref={viewRef}
                className="mgs-preview-canvas"
                hidden={!hasSource}
                data-caption-drag="1"
                data-detect-outline={detectOn ? '1' : '0'}
                onMouseDown={(event) => stageDrag.handleMouseDown(event)}
                onMouseMove={(event) => stageDrag.handleMouseMove(event)}
                onMouseUp={() => stageDrag.handleMouseUp()}
                onMouseLeave={() => stageDrag.handleMouseUp()}
                onTouchStart={(event) => stageDrag.handleMouseDown(event)}
                onTouchMove={(event) => stageDrag.handleMouseMove(event)}
                onTouchEnd={() => stageDrag.handleMouseUp()}
              />
              {!hasSource && !loading ? <p className="mgs-empty">왼쪽에서 이미지를 고르거나 파일을 놓으세요.</p> : null}
              {loading ? <p className="mgs-empty">소스 읽는 중…</p> : null}
            </div>
            <div className="mgs-view-bar">
              <button
                type="button"
                className={clsx('mgs-icon-btn', playing && 'is-on')}
                disabled={!hasSource || encoding}
                data-tooltip="모션 프리뷰 일시정지 / 재생"
                data-mgs-place="down"
                data-play-toggle="stage"
                data-playing={playing ? 'run' : 'pause'}
                onClick={togglePlaying}
              >
                {playing ? '일시정지' : '재생'}
              </button>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => clampZoom(value - 10))} data-tooltip="프리뷰 화면 축소" data-mgs-place="down">−</button>
              <button
                type="button"
                className={clsx('mgs-icon-btn', zoom === 100 && 'is-on')}
                onClick={() => setZoom(100)}
                data-tooltip="기본 100% 배율로 리셋"
                data-mgs-place="down"
              >
                {zoom}%
              </button>
              <button type="button" className="mgs-icon-btn" onClick={() => setZoom((value) => clampZoom(value + 10))} data-tooltip="프리뷰 화면 확대" data-mgs-place="down">+</button>
              <span className="mgs-hint">프리뷰 {clampFps(fps)} FPS</span>
            </div>
            <MotionSequencerPanel
              cuts={sourceTab === 'cuts' ? visibleCuts : sourceTab === 'drop' ? uploadedImages : []}
              injectFrames={null}
              showCutBank={sourceTab === 'cuts' || sourceTab === 'drop'}
              cutBankEmpty={sourceTab === 'drop' ? '왼쪽에서 PNG를 올리거나 가운데에 놓으세요.' : '분할기에서 28컷을 먼저 만드세요.'}
              sourceUrl={liveSourceUrl}
              playing={playing}
              onPlayingChange={(next) => {
                playRef.current.playing = next
                if (!next) {
                  playRef.current.startedAt = 0
                  paintNow(playRef.current.pausedT || 0)
                  stopLoop()
                }
                setPlaying(next)
              }}
              motionPreset={preset}
              isolateSprite={isolateOn}
              intensity={intensity}
              loopSeconds={loop}
              overlayRef={overlayRef}
              captionLiveRef={captionLiveRef}
              onCaptionLive={syncStageCaption}
              sessionSnapRef={sessionSnapRef}
            />
          </section>

          <aside className="mgs-pane mgs-controls">
            <h3>MOTION PRESETS & CONTROLS</h3>
            <button
              type="button"
              className={clsx('mgs-tab', 'allow-long-text', isolateOn && 'is-on')}
              data-sprite-isolate={isolateOn ? '1' : '0'}
              disabled={encoding || !hasSource}
              data-tooltip="투명 여백을 잘라 순수 캐릭터만 모션합니다"
              data-mgs-place="left"
              onClick={() => {
                setIsolateOn(true)
                paramsRef.current.isolate = true
                const source = imageRef.current
                if (!source) return
                forgetCroppedSprite(source)
                const extracted = cropSpriteWithFeedback(source)
                if (extracted.bounds) {
                  detectRef.current = { until: performance.now() + 1500, bounds: extracted.bounds }
                  setDetectOn(true)
                  if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current)
                  detectTimerRef.current = window.setTimeout(() => setDetectOn(false), 1500)
                  setStatusKind('ok')
                  setStatus('✨ 캐릭터 영역이 성공적으로 분리되었습니다!')
                } else {
                  detectRef.current = { until: 0, bounds: null }
                  setDetectOn(false)
                  setStatusKind('error')
                  setStatus('캐릭터 영역을 찾지 못했습니다.')
                }
                paintNow(playRef.current.pausedT || 0)
              }}
            >
              🪄 캐릭터 영역 자동 추출
            </button>
            <button
              type="button"
              className="mgs-tab allow-long-text"
              data-pixel-studio-open="1"
              data-tooltip="확대 팝업에서 픽셀을 칠해 캐릭터만 추출합니다"
              data-mgs-place="left"
              onClick={() => {
                const activeImg = imageRef.current
                  || fittedRef.current
                  || virtualRef.current
                  || snapshotCanvas(viewRef.current)
                setPixelOpen(true)
                if (!activeImg) {
                  setPixelSource(null)
                  setStatusKind('error')
                  setStatus('편집할 캐릭터 이미지를 먼저 선택해 주세요.')
                  window.alert('편집할 캐릭터 이미지를 먼저 선택해 주세요.')
                  return
                }
                setPixelSource(activeImg)
              }}
            >
              ✨ 초정밀 픽셀 추출
            </button>
            <button
              type="button"
              className="mgs-tab allow-long-text"
              data-pixel-restore="1"
              data-tooltip="픽셀 추출을 지우고 원본 프레임으로 되돌립니다"
              data-mgs-place="left"
              onClick={() => {
                releaseCanvas(pixelSpriteRef.current)
                pixelSpriteRef.current = null
                setPixelSource(null)
                if (imageRef.current) forgetCroppedSprite(imageRef.current)
                detectRef.current = { until: 0, bounds: null }
                setDetectOn(false)
                setStatusKind('ok')
                setStatus('원본 이미지로 복원했습니다.')
                paintNow(playRef.current.pausedT || 0)
              }}
            >
              🔄 원본 복원
            </button>
            <div className="mgs-preset-grid max-h-[340px] overflow-y-auto pr-1" data-preset-list="1">
            <button
              type="button"
              className={clsx('mgs-preset', 'mgs-preset-none', 'mgs-tip', preset === MOTION_NONE && 'is-on')}
              data-motion-preset={MOTION_NONE}
              data-tooltip="모션 없음(기본): 원본 1:1 고정. 파티클과 텍스트 모션은 그대로 둡니다"
              data-mgs-place="left"
              disabled={encoding}
              onClick={() => {
                paramsRef.current.preset = MOTION_NONE
                setPreset(MOTION_NONE)
              }}
            >
              <span className="mgs-preset-icon" aria-hidden="true">🚫</span>
              <span className="mgs-preset-name">모션 없음</span>
            </button>
            {MOTION_PRESETS.map((item) => {
              const ui = PRESET_UI[item.id] || { name: item.label, icon: '🎬' }
              return (
              <button
                key={item.id}
                type="button"
                className={clsx('mgs-preset mgs-tip', preset === item.id && 'is-on')}
                data-motion-preset={item.id}
                data-tooltip={PRESET_TIPS[item.id] || item.hint}
                data-mgs-place="left"
                disabled={encoding}
                onClick={() => {
                  const next = preset === item.id ? MOTION_NONE : item.id
                  paramsRef.current.preset = next
                  setPreset(next)
                }}
              >
                <span className="mgs-preset-icon" aria-hidden="true">{ui.icon}</span>
                <span className="mgs-preset-name">{ui.name}</span>
              </button>
              )
            })}
            </div>
            <label
              className="mgs-slider mgs-tip slider-control"
              data-tooltip="루프 주기: 한 번 반복되는 시간 조절 (0.5초 ~ 4.0초)"
              data-mgs-place="left"
            >
              <span className="mgs-slider-head">
                루프 주기
                <span className="mgs-badge">{loop.toFixed(1)}s</span>
              </span>
              <input
                type="range"
                min={LOOP_MIN}
                max={LOOP_MAX}
                step="0.1"
                value={loop}
                disabled={encoding}
                onChange={(event) => {
                  const next = clampLoopSeconds(Number(event.target.value))
                  paramsRef.current.loopSeconds = next
                  if (playRef.current.startedAt) {
                    playRef.current.startedAt = performance.now() - playRef.current.pausedT * next * 1000
                  }
                  setLoopSeconds(next)
                }}
              />
            </label>
            <label
              className="mgs-slider mgs-tip slider-control"
              data-tooltip="모션 강도: 모션의 흔들림 크기 및 왜곡 강도 조절 (10% ~ 100%)"
              data-mgs-place="left"
            >
              <span className="mgs-slider-head">
                모션 강도
                <span className="mgs-badge">{clampIntensity(intensity)}%</span>
              </span>
              <input
                type="range"
                min={INTENSITY_MIN}
                max={100}
                value={clampIntensity(intensity)}
                disabled={encoding}
                onChange={(event) => {
                  const next = clampIntensity(Number(event.target.value))
                  paramsRef.current.intensity = next
                  setIntensity(next)
                  if (!playRef.current.playing) paintNow(0)
                }}
              />
            </label>
            <div className="mgs-slider mgs-tip slider-control" data-tooltip={FPS_TIP} data-mgs-place="left">
              <span className="mgs-slider-head">
                프레임 레이트
                <span className="mgs-badge">{clampFps(fps)} FPS</span>
              </span>
              <div className="mgs-seg">
                {[12, 24].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={clsx('mgs-tip', clampFps(fps) === value && 'is-on')}
                    data-tooltip={FPS_TIP}
                    data-mgs-place="left"
                    disabled={encoding}
                    onClick={() => {
                      paramsRef.current.fps = value
                      setFps(value)
                    }}
                  >
                    {value} FPS
                  </button>
                ))}
              </div>
            </div>
            <label className="mgs-slider mgs-tip slider-control" data-tooltip="내보낼 플랫폼별 최적 해상도 및 여백 자동 규격 선택" data-mgs-place="left">
              <span className="mgs-slider-head">캔버스 규격</span>
              <select
                className="mgs-select"
                value={sizeId}
                disabled={encoding}
                onChange={(event) => {
                  const nextId = event.target.value
                  setSizeId(nextId)
                  const resolved = resolvePlatformSize(nextId, imageRef.current)
                  if (resolved.fps) {
                    paramsRef.current.fps = resolved.fps
                    setFps(resolved.fps)
                  }
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
          {statusKind === 'error' ? <p className="mgs-foot-error">{status}</p> : null}
          {detectOn && statusKind === 'ok' ? <p className="mgs-hint" data-isolate-toast="1">{status}</p> : null}
          {!detectOn && statusKind === 'ok' && String(status).includes('원본') ? <p className="mgs-hint" data-restore-toast="1">{status}</p> : null}
          <div className="mgs-foot-actions">
            {encoding ? (
              <button
                type="button"
                className="mgs-icon-btn"
                onClick={() => { abortRef.current = true }}
                data-tooltip="진행 중인 GIF 작업을 중단합니다"
                data-mgs-place="up"
              >
                취소
              </button>
            ) : null}
            <MotionDiagnosticsHUD
              report={diagReport}
              open={diagOpen}
              onToggle={() => setDiagOpen((value) => !value)}
            />
            <button
              type="button"
              className="tool-btn is-on mgs-download mgs-tip allow-long-text"
              data-tooltip="투명 배경 무손실 GIF 생성 및 PC 즉시 다운로드"
              data-mgs-place="up"
              disabled={!hasSource || encoding}
              onClick={requestDownload}
            >
              {encoding ? `인코딩 중 ${progress}%` : '🚀 초고화질 무한루프 GIF 다운로드'}
            </button>
          </div>
        </footer>
        </StudioSessionBridge>
        </MotionStudioProvider>
      </div>
    </div>
    <TransparencyCheckModal
      open={alphaGate.open}
      onPurgeAndExport={alphaGate.confirmPurge}
      onExportAsIs={alphaGate.confirmAsIs}
      onCancel={alphaGate.cancel}
    />
    {pixelOpen ? (
      <PixelSelectionModal
        open={pixelOpen}
        isOpen={pixelOpen}
        source={pixelSource}
        sourceImage={pixelSource}
        image={pixelSource}
        onClose={() => setPixelOpen(false)}
        onApply={handlePixelApply}
      />
    ) : null}
    </>
  )
}
