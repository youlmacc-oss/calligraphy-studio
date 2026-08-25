import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  Copy,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  KeyRound,
  Lock,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Scissors,
  SlidersHorizontal,
  Undo2,
  Unlock,
  WandSparkles,
} from 'lucide-react'
import AiGenerateModal from './components/AiGenerateModal.jsx'
import CropOverlay from './components/CropOverlay.jsx'
import GuidebookModal from './components/GuidebookModal.jsx'
import LayerEditCard from './components/LayerEditCard.jsx'
import MenuMagnifierHUD, { magnify } from './components/MenuMagnifierHUD.jsx'
import ProgressModal from './components/ProgressModal.jsx'
import SelfDiagnosticModal from './components/SelfDiagnosticModal.jsx'
import { runRemoteAi, simulateAiResult } from './lib/aiProviders.js'
import {
  canvasToJpegBlob,
  canvasToPngBlob,
  downloadBlob,
  encodeGifFromCanvases,
  iconPackageFromCanvas,
  scaleCanvasToMax,
} from './lib/exportFormats.js'
import {
  drawLivePreview,
  hitTestStudio,
  renderStyledText,
  resolveWeight,
} from './lib/renderStyle.js'
import {
  createLayer,
  loadApiKeys,
  loadStudioState,
  saveApiKeys,
  saveStudioState,
  snapshotOf,
} from './lib/studioModel.js'
import { loadFavoriteFonts, saveFavoriteFonts, toggleFavoriteId } from './lib/fontFavorites.js'
import { DIAG_STEPS } from './lib/featureRegistry.js'
import { liveStatusFromLayer } from './lib/liveStatus.js'
import { preloadStudioFonts } from './lib/fontPreload.js'
import {
  animateViewEdit,
  applyViewEdit,
  defaultViewEdit,
  gifStyleFromPreset,
  makeCropRect,
} from './lib/viewEdit.js'
import {
  ASPECTS,
  buildAiPromptPack,
  CALLIGRAPHY_PRESET_IDS,
  ESTIMATED_DURATION_MS,
  FONTS,
  getAspect,
  PRESETS,
  STUDIO_TABS,
  THEMES,
  WOODCUT_PRESETS,
  WOODCUT_STUDIO_IDS,
} from './presets.js'

function slugify(value) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 32) || 'styler'
}

const FONTS_BY_ID = Object.fromEntries(FONTS.map((item) => [item.id, item]))
const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((item) => [item.id, item]))
const BLEND_MODES = [
  { id: 'source-over', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'soft-light', label: 'Soft-Light' },
]
const CROP_ASPECTS = [
  { id: '1:1', label: '1:1 정사각형' },
  { id: '16:9', label: '16:9 썸네일' },
  { id: '4:3', label: '4:3' },
  { id: 'free', label: '자유 비율' },
]
const GIF_STYLE_LABEL = {
  pulse: '네온 숨쉬기 Pulse',
  glitch: '사이버 글리치',
  chrome: '크롬 반사광',
}
const LEFT_PANEL_KEY = 'styler-left-panel-width'
const LEFT_PANEL_DEFAULT = 360
const LEFT_PANEL_MIN = 280
const LEFT_PANEL_MAX = 550

function clampLeftPanelWidth(width, viewport = typeof window === 'undefined' ? 1440 : window.innerWidth) {
  const max = Math.min(LEFT_PANEL_MAX, Math.round(viewport * 0.45))
  return Math.round(Math.max(LEFT_PANEL_MIN, Math.min(max, Number(width) || LEFT_PANEL_DEFAULT)))
}

function loadLeftPanelWidth() {
  try {
    const raw = Number(localStorage.getItem(LEFT_PANEL_KEY))
    if (Number.isFinite(raw) && raw > 0) return clampLeftPanelWidth(raw)
  } catch {
    /* ignore quota / private mode */
  }
  return LEFT_PANEL_DEFAULT
}

function saveLeftPanelWidth(width) {
  try {
    localStorage.setItem(LEFT_PANEL_KEY, String(clampLeftPanelWidth(width)))
  } catch {
    /* ignore quota / private mode */
  }
}

export default function App() {
  const initial = useMemo(() => loadStudioState(), [])
  const [studio, setStudio] = useState(initial)
  const [hoverPreview, setHoverPreview] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [sessionId, setSessionId] = useState(0)
  const [jobReady, setJobReady] = useState(false)
  const [transparentUrl, setTransparentUrl] = useState(null)
  const [maskUrl, setMaskUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [promptCopied, setPromptCopied] = useState('')
  const [apiKeys, setApiKeys] = useState(() => loadApiKeys())
  const [aiNote, setAiNote] = useState('마스크 + 프롬프트를 Fal / Replicate / Grok로 보내거나, 키 없이 로컬 시뮬레이션합니다.')
  const [aiResultUrl, setAiResultUrl] = useState(null)
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [cropAspect, setCropAspect] = useState('free')
  const [cropDraft, setCropDraft] = useState(() => makeCropRect('free'))
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportNote, setExportNote] = useState('PNG · JPEG · GIF · ICO를 지금 바로 다운로드할 수 있습니다.')
  const [diagOpen, setDiagOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [favoriteFonts, setFavoriteFonts] = useState(() => loadFavoriteFonts())
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => loadLeftPanelWidth())
  const [isResizing, setIsResizing] = useState(false)
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const leftSplitRef = useRef(null)
  const leftPanelWidthRef = useRef(leftPanelWidth)
  const resizingRef = useRef(false)
  const urlsRef = useRef({ transparentUrl: null, maskUrl: null })
  const bgImageRef = useRef(null)
  const studioRef = useRef(studio)
  const historyRef = useRef({ past: [], future: [] })
  const dragRef = useRef(null)
  const paintRaf = useRef(0)

  studioRef.current = studio
  leftPanelWidthRef.current = leftPanelWidth

  const mainLayer = studio.layers.find((layer) => layer.role === 'main') ?? studio.layers[0]
  const subLayer = studio.layers.find((layer) => layer.role === 'sub')
  const extraLayers = studio.layers.filter((layer) => layer.role !== 'main' && layer.role !== 'sub')
  const preset = PRESETS_BY_ID[mainLayer?.presetId] ?? PRESETS_BY_ID[studio.presetId] ?? PRESETS[0]
  const aspect = getAspect(studio.aspectId)
  const activeLayer = studio.layers.find((item) => item.id === studio.activeLayerId) ?? studio.layers[0]
  const font = FONTS_BY_ID[activeLayer?.fontId] ?? FONTS[0]
  const themeLabel = THEMES.find((theme) => theme.id === preset.theme)?.name ?? '26종 프리셋'
  const liveLayers = useMemo(() => {
    if (!hoverPreview?.fontId || !hoverPreview.layerId) return studio.layers
    return studio.layers.map((layer) => (
      layer.id === hoverPreview.layerId ? { ...layer, fontId: hoverPreview.fontId } : layer
    ))
  }, [studio.layers, hoverPreview])
  const liveStatus = useMemo(() => {
    const layer = liveLayers.find((item) => item.id === studio.activeLayerId) ?? liveLayers[0] ?? activeLayer
    return liveStatusFromLayer(layer, {
      fontsById: FONTS_BY_ID,
      presetsById: PRESETS_BY_ID,
      studioPreset: preset,
    })
  }, [liveLayers, studio.activeLayerId, activeLayer, preset])

  const promptPack = useMemo(() => {
    const text = studio.layers.find((layer) => layer.role === 'main')?.text
      || studio.layers.map((layer) => layer.text).filter(Boolean).join(' / ')
    return buildAiPromptPack({
      text,
      layers: studio.layers,
      preset,
      font,
      aspect,
      background: studio.background,
    })
  }, [studio.layers, studio.background, preset, font, aspect])
  const exportPrompt = promptPack.full

  const renderOptions = useMemo(
    () => ({
      layers: liveLayers,
      fontsById: FONTS_BY_ID,
      font,
      preset,
      viewMode: studio.viewMode,
      aspectId: studio.aspectId,
      stickerOn: studio.stickerOn,
      stickerTheme: studio.stickerTheme,
      chiselDepth: studio.chiselDepth,
      roughness: studio.roughness,
      inkDensity: studio.inkDensity,
      dryBrush: studio.dryBrush,
      bgImage: bgImageRef.current,
      background: {
        ...studio.background,
        blend: studio.background.blend === 'source-over' ? 'source-over' : studio.background.blend,
      },
      gridOn: studio.gridOn,
      selectedId: studio.activeLayerId,
      showOverlay: true,
      exportW: aspect.w,
      exportH: aspect.h,
      presetsById: PRESETS_BY_ID,
      viewEdit: studio.viewEdit ?? defaultViewEdit(),
      skipCrop: cropMode,
    }),
    [liveLayers, font, preset, studio, aspect, cropMode],
  )

  const capture = useCallback(() => {
    historyRef.current.past.push(snapshotOf(studioRef.current))
    if (historyRef.current.past.length > 50) historyRef.current.past.shift()
    historyRef.current.future = []
  }, [])

  const toggleFavoriteFont = useCallback((fontId) => {
    setFavoriteFonts((prev) => saveFavoriteFonts(toggleFavoriteId(prev, fontId)))
  }, [])

  const patchStudio = useCallback((updater, record = true) => {
    if (record) capture()
    setStudio((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }))
  }, [capture])

  const patchLayer = useCallback((id, patch, record = true) => {
    patchStudio((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    }), record)
  }, [patchStudio])

  const patchViewEdit = useCallback((patch, record = true) => {
    patchStudio((prev) => ({
      ...prev,
      viewEdit: { ...defaultViewEdit(), ...prev.viewEdit, ...patch },
    }), record)
  }, [patchStudio])

  const revokeUrls = useCallback(() => {
    const { transparentUrl: prevPng, maskUrl: prevMask } = urlsRef.current
    if (prevPng) URL.revokeObjectURL(prevPng)
    if (prevMask) URL.revokeObjectURL(prevMask)
    urlsRef.current = { transparentUrl: null, maskUrl: null }
  }, [])

  useEffect(() => {
    preloadStudioFonts()
  }, [])

  useEffect(() => () => revokeUrls(), [revokeUrls])

  useEffect(() => {
    const dataUrl = studio.background.dataUrl
    if (!dataUrl) {
      bgImageRef.current = null
      return undefined
    }
    const image = new Image()
    image.onload = () => {
      bgImageRef.current = image
      if (canvasRef.current) drawLivePreview(canvasRef.current, { ...renderOptions, bgImage: image })
    }
    image.src = dataUrl
    return undefined
  }, [studio.background.dataUrl])

  useEffect(() => {
    const timer = window.setTimeout(() => saveStudioState(studio), 360)
    return () => window.clearTimeout(timer)
  }, [studio])

  useEffect(() => {
    const onUp = () => {
      if (!resizingRef.current) return
      resizingRef.current = false
      setIsResizing(false)
      saveLeftPanelWidth(leftPanelWidthRef.current)
    }
    const onMove = (event) => {
      if (!resizingRef.current) return
      if (!event.buttons) {
        onUp()
        return
      }
      const origin = leftSplitRef.current?.getBoundingClientRect().left ?? 12
      const next = clampLeftPanelWidth(event.clientX - origin)
      leftPanelWidthRef.current = next
      setLeftPanelWidth(next)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('blur', onUp)
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      setLeftPanelWidth((current) => {
        const next = clampLeftPanelWidth(current)
        if (next !== current) saveLeftPanelWidth(next)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (canvasRef.current) drawLivePreview(canvasRef.current, renderOptions)
    })
    return () => cancelAnimationFrame(frame)
  }, [renderOptions])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const redraw = () => {
      if (canvasRef.current) drawLivePreview(canvasRef.current, renderOptions)
    }
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    const frame = canvas.parentElement
    if (frame) observer.observe(frame)
    if (stageRef.current && stageRef.current !== frame) observer.observe(stageRef.current)
    window.visualViewport?.addEventListener('resize', redraw)
    window.visualViewport?.addEventListener('scroll', redraw)
    return () => {
      observer.disconnect()
      window.visualViewport?.removeEventListener('resize', redraw)
      window.visualViewport?.removeEventListener('scroll', redraw)
    }
  }, [renderOptions])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const card = document.querySelector(`[data-layer-card="${studio.activeLayerId}"]`)
      card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [studio.activeLayerId])

  useEffect(() => {
    if (!filterOpen) return undefined
    const close = (event) => {
      if (event.target.closest?.('.filter-popover-wrap')) return
      setFilterOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [filterOpen])

  const undo = useCallback(() => {
    const prev = historyRef.current.past.pop()
    if (!prev) return
    historyRef.current.future.push(snapshotOf(studioRef.current))
    const parsed = JSON.parse(prev)
    setStudio((current) => ({ ...current, ...parsed }))
  }, [])

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop()
    if (!next) return
    historyRef.current.past.push(snapshotOf(studioRef.current))
    const parsed = JSON.parse(next)
    setStudio((current) => ({ ...current, ...parsed }))
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      }
      if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const handleHoverFont = useCallback((layerId, fontId) => {
    setHoverPreview(fontId ? { layerId, fontId } : null)
  }, [])

  const selectLayer = useCallback((id) => {
    patchStudio({ activeLayerId: id }, false)
  }, [patchStudio])

  const selectFontFor = (layerId, nextId) => {
    const target = studioRef.current.layers.find((layer) => layer.id === layerId)
    if (!target) return
    const nextFont = FONTS_BY_ID[nextId] ?? FONTS[0]
    const patch = {
      fontId: nextId,
      fontWeight: resolveWeight(nextFont, target.fontWeight),
    }
    const woodcut = WOODCUT_PRESETS.find((item) => item.fontId === nextId)
    if (woodcut) patch.presetId = woodcut.id
    patchStudio((prev) => ({
      ...prev,
      presetId: target.role === 'main' && woodcut ? woodcut.id : prev.presetId,
      layers: prev.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    }))
  }

  const selectPresetFor = (layerId, item) => {
    patchStudio((prev) => {
      const target = prev.layers.find((layer) => layer.id === layerId)
      const nextPresetId = item?.id ?? ''
      return {
        ...prev,
        presetId: target?.role === 'main' ? (nextPresetId || prev.presetId) : prev.presetId,
        layers: prev.layers.map((layer) => (
          layer.id === layerId
            ? {
              ...layer,
              presetId: nextPresetId,
              fontId: item?.fontId || layer.fontId,
            }
            : layer
        )),
      }
    })
  }

  const handleStudioTab = (id) => {
    patchStudio((prev) => {
      const layers = prev.layers.map((layer) => {
        if (layer.role !== 'main') return layer
        if (id === 'calligraphy' && !CALLIGRAPHY_PRESET_IDS.includes(layer.presetId || prev.presetId)) {
          const next = PRESETS.find((item) => item.id === 'traditional-calligraphy')
          return { ...layer, presetId: next.id, fontId: next.fontId }
        }
        if (id === 'woodcut' && !WOODCUT_STUDIO_IDS.includes(layer.presetId || prev.presetId)) {
          const next = WOODCUT_PRESETS[0]
          return { ...layer, presetId: next.id, fontId: next.fontId }
        }
        return layer
      })
      const main = layers.find((layer) => layer.role === 'main')
      return { ...prev, studioTab: id, layers, presetId: main?.presetId || prev.presetId }
    })
  }

  const addLayer = (kind) => {
    const next = kind === 'seal'
      ? createLayer({
        type: 'seal',
        name: '낙관 / 인장',
        text: '印',
        fontSize: 48,
        ox: 0.28,
        oy: 0.3,
        role: 'extra',
      })
      : createLayer({
        name: `텍스트 레이어 ${studio.layers.filter((layer) => layer.role === 'extra').length + 1}`,
        role: 'extra',
        presetId: '',
        fontSize: 36,
        oy: 0.32,
      })
    patchStudio((prev) => ({ ...prev, layers: [...prev.layers, next], activeLayerId: next.id }))
  }

  const removeLayer = (id) => {
    const target = studio.layers.find((layer) => layer.id === id)
    if (!target || target.role === 'main' || target.role === 'sub') return
    patchStudio((prev) => {
      const layers = prev.layers.filter((layer) => layer.id !== id)
      return { ...prev, layers, activeLayerId: layers[0]?.id ?? null }
    })
  }

  const resetActive = () => {
    patchStudio((prev) => ({
      ...prev,
      layers: prev.layers.map((layer, index) => ({
        ...layer,
        ox: 0,
        oy: layer.role === 'main' ? 0 : Math.min(0.34, 0.16 + (index - 1) * 0.12),
        rotation: 0,
      })),
    }))
  }

  const moveLayer = (id, direction) => {
    patchStudio((prev) => {
      const index = prev.layers.findIndex((layer) => layer.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.layers.length) return prev
      const layers = [...prev.layers]
      const current = layers[index]
      layers[index] = layers[nextIndex]
      layers[nextIndex] = current
      return { ...prev, layers }
    })
  }

  const reorderLayer = (id, action) => {
    patchStudio((prev) => {
      const layers = [...prev.layers]
      const index = layers.findIndex((layer) => layer.id === id)
      if (index < 0) return prev
      if ((action === 'up' || action === 'front') && index >= layers.length - 1) return prev
      if ((action === 'down' || action === 'back') && index <= 0) return prev
      const [item] = layers.splice(index, 1)
      if (action === 'up') layers.splice(index + 1, 0, item)
      else if (action === 'down') layers.splice(index - 1, 0, item)
      else if (action === 'front') layers.push(item)
      else if (action === 'back') layers.unshift(item)
      else layers.splice(index, 0, item)
      return { ...prev, layers }
    })
  }

  const handleBgUpload = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      patchStudio((prev) => ({
        ...prev,
        background: { ...prev.background, dataUrl: String(reader.result || '') },
      }))
    }
    reader.readAsDataURL(file)
  }

  const pointerToCanvas = (event) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const boundsW = rect.width || canvas.clientWidth || 1
    const boundsH = rect.height || canvas.clientHeight || 1
    const cssW = Math.max(1, canvas.clientWidth || boundsW)
    const cssH = Math.max(1, canvas.clientHeight || boundsH)
    const x = ((event.clientX - rect.left) / boundsW) * cssW
    const y = ((event.clientY - rect.top) / boundsH) * cssH
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return {
      x,
      y,
      w: cssW,
      h: cssH,
      scale: Math.min(cssW, cssH) / 512,
    }
  }

  const onCanvasPointerDown = (event) => {
    if (cropMode) return
    const point = pointerToCanvas(event)
    if (!point) return
    const hit = hitTestStudio(studio.layers, point.x, point.y, point.w, point.h, point.scale, {
      fontsById: FONTS_BY_ID,
      presetsById: PRESETS_BY_ID,
      stickerOn: studio.stickerOn,
      preset,
    })
    if (!hit) {
      if (!studio.bgLocked) patchStudio({ activeLayerId: studio.layers[0]?.id }, false)
      return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    patchStudio({ activeLayerId: hit.layer.id }, false)
    if (studio.layerLocked && hit.handle === 'move') return
    dragRef.current = {
      handle: hit.handle,
      startX: point.x,
      startY: point.y,
      origin: { ...hit.layer },
    }
    capture()
  }

  const onCanvasPointerMove = (event) => {
    const drag = dragRef.current
    const point = pointerToCanvas(event)
    if (!drag || !point) return
    const dx = (point.x - drag.startX) / point.w
    const dy = (point.y - drag.startY) / point.h
    const origin = drag.origin
    let patch = {}
    if (drag.handle === 'rotate') {
      const angle = Math.atan2(point.y - point.h / 2 - origin.oy * point.h, point.x - point.w / 2 - origin.ox * point.w)
      patch = { rotation: Math.round((angle * 180) / Math.PI + 90) }
    } else if (drag.handle === 'scale') {
      patch = { fontSize: Math.max(20, Math.min(350, origin.fontSize + (point.x - drag.startX) * 0.35)) }
    } else {
      patch = {
        ox: Math.max(-0.45, Math.min(0.45, origin.ox + dx)),
        oy: Math.max(-0.45, Math.min(0.45, origin.oy + dy)),
      }
    }
    if (paintRaf.current) cancelAnimationFrame(paintRaf.current)
    paintRaf.current = requestAnimationFrame(() => {
      setStudio((prev) => ({
        ...prev,
        layers: prev.layers.map((layer) => (layer.id === origin.id ? { ...layer, ...patch } : layer)),
      }))
    })
  }

  const onCanvasPointerUp = () => {
    dragRef.current = null
  }

  const viewEdit = studio.viewEdit ?? defaultViewEdit()
  const gifStyle = gifStyleFromPreset(preset)

  const beginCrop = () => {
    setFilterOpen(false)
    const nextAspect = cropAspect || 'free'
    setCropDraft(viewEdit.crop || makeCropRect(nextAspect))
    setCropMode(true)
  }

  const applyCrop = () => {
    patchViewEdit({ crop: cropDraft })
    setCropMode(false)
  }

  const cancelCrop = () => {
    setCropMode(false)
  }

  const clearCrop = () => {
    patchViewEdit({ crop: null })
    setCropDraft(makeCropRect(cropAspect))
    setCropMode(false)
  }

  const changeCropAspect = (id) => {
    setCropAspect(id)
    setCropDraft(makeCropRect(id))
  }

  const rotateCanvas90 = () => {
    patchViewEdit({ rotation90: ((viewEdit.rotation90 || 0) + 90) % 360 })
  }

  const exportName = (kind, ext) => (
    `${preset.id}-${aspect.id.replace(':', 'x')}-${slugify(activeLayer?.text || 'styler')}-${kind}.${ext}`
  )

  const ensureExport = async () => {
    const result = await renderStyledText({
      ...renderOptions,
      layers: studio.layers,
      showOverlay: false,
      gridOn: false,
      skipCrop: false,
      viewEdit,
    })
    revokeUrls()
    urlsRef.current = { transparentUrl: result.transparentUrl, maskUrl: result.maskUrl }
    setTransparentUrl(result.transparentUrl)
    setMaskUrl(result.maskUrl)
    if (!result.graphic) throw new Error('그래픽 캔버스를 만들지 못했습니다')
    return result
  }

  const runExport = async (kind, work) => {
    if (exportBusy) return
    setExportBusy(true)
    setExportNote(`${kind} 렌더링 중…`)
    try {
      await work()
      setExportNote(`${kind} 다운로드 완료`)
    } catch (error) {
      console.error(error)
      setExportNote(`${kind} 실패: ${error.message || '알 수 없는 오류'}`)
    } finally {
      setExportBusy(false)
    }
  }

  const downloadPng = () => runExport('투명 PNG', async () => {
    const result = await ensureExport()
    const blob = await canvasToPngBlob(result.graphic)
    downloadBlob(blob, exportName('transparent', 'png'))
  })

  const downloadJpeg = () => runExport('JPEG', async () => {
    const result = await ensureExport()
    const blob = await canvasToJpegBlob(result.graphic, 0.95)
    downloadBlob(blob, exportName('photo', 'jpg'))
  })

  const downloadGif = () => runExport('GIF 애니메이션', async () => {
    const geometry = {
      ...viewEdit,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      vignette: 0,
      ink: 0,
    }
    const result = await renderStyledText({
      ...renderOptions,
      layers: studio.layers,
      showOverlay: false,
      gridOn: false,
      skipCrop: false,
      viewEdit: geometry,
    })
    revokeUrls()
    urlsRef.current = { transparentUrl: result.transparentUrl, maskUrl: result.maskUrl }
    setTransparentUrl(result.transparentUrl)
    setMaskUrl(result.maskUrl)
    const frames = []
    const count = 20
    for (let i = 0; i < count; i += 1) {
      const animated = animateViewEdit(viewEdit, gifStyle, i / count)
      const filtered = applyViewEdit(result.graphic, {
        ...defaultViewEdit(),
        brightness: animated.brightness,
        contrast: animated.contrast,
        saturation: animated.saturation,
        vignette: animated.vignette,
        ink: animated.ink,
      }, { letterbox: false, skipCrop: true })
      frames.push(scaleCanvasToMax(filtered, 480))
    }
    const blob = await encodeGifFromCanvases(frames, 120)
    downloadBlob(blob, exportName(`${gifStyle}-loop`, 'gif'))
  })

  const downloadIcons = () => runExport('파비콘 패키지', async () => {
    const result = await ensureExport()
    const blob = await iconPackageFromCanvas(result.graphic)
    downloadBlob(blob, exportName('favicon', 'zip'))
  })

  const downloadMaskNow = () => runExport('AI 마스크', async () => {
    const result = await ensureExport()
    const blob = await canvasToPngBlob(result.maskCanvas || result.graphic)
    downloadBlob(blob, exportName('mask', 'png'))
  })

  const persistKeys = (keys) => {
    setApiKeys(keys)
    saveApiKeys(keys)
  }

  const handleConvert = async (overrideKeys = apiKeys) => {
    if (busy) return
    setBusy(true)
    setJobReady(false)
    setFallbackUsed(false)
    setAiResultUrl(null)
    setSessionId((id) => id + 1)
    persistKeys(overrideKeys)
    setAiNote(overrideKeys.provider === 'local' ? '로컬 고화질 시뮬레이션 렌더 중' : `${overrideKeys.provider}에 마스크 + 프롬프트 전송 중`)

    try {
      const result = await renderStyledText({
        ...renderOptions,
        layers: studio.layers,
        showOverlay: false,
        gridOn: false,
        skipCrop: false,
        viewEdit,
      })
      revokeUrls()
      urlsRef.current = result
      setTransparentUrl(result.transparentUrl)
      setMaskUrl(result.maskUrl)

      let remoteUrl = null
      if (overrideKeys.provider !== 'local') {
        try {
          remoteUrl = await runRemoteAi({
            provider: overrideKeys.provider,
            keys: overrideKeys,
            prompt: promptPack.positive,
            negative: promptPack.negative,
            maskUrl: result.maskUrl,
            aspect,
          })
        } catch (error) {
          setAiNote(`원격 API 실패 → 로컬 폴백 (${error.message})`)
        }
      }

      if (remoteUrl) {
        setAiResultUrl(remoteUrl)
        setFallbackUsed(false)
        setAiNote('원격 AI 결과 수신 완료')
      } else {
        const simulated = await simulateAiResult(result.transparentUrl)
        setAiResultUrl(simulated || result.transparentUrl)
        setFallbackUsed(true)
        setAiNote('키 없음 또는 원격 실패 → 로컬 고화질 시뮬레이션 완료')
      }
      setJobReady(true)
    } catch (error) {
      console.error(error)
      setJobReady(true)
    } finally {
      setBusy(false)
    }
  }

  const downloadFile = (url, kind) => {
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `${preset.id}-${aspect.id.replace(':', 'x')}-${slugify(activeLayer?.text || 'styler')}-${kind}.png`
    link.click()
  }

  const copyPrompt = async (kind = 'full') => {
    const payload = {
      full: promptPack.full,
      positive: promptPack.positive,
      negative: promptPack.negative,
      mj: promptPack.midjourney,
    }[kind] ?? promptPack.full
    try {
      await navigator.clipboard.writeText(payload)
      setPromptCopied(kind)
      window.setTimeout(() => setPromptCopied(''), 2000)
    } catch {
      setPromptCopied('')
    }
  }

  const startLeftResize = (event) => {
    event.preventDefault()
    resizingRef.current = true
    setIsResizing(true)
  }

  const resetLeftPanelWidth = () => {
    resizingRef.current = false
    setIsResizing(false)
    setLeftPanelWidth(LEFT_PANEL_DEFAULT)
    saveLeftPanelWidth(LEFT_PANEL_DEFAULT)
  }

  return (
    <div className={clsx('studio-shell', isResizing && 'is-resizing')} style={{ '--left-panel-width': `${leftPanelWidth}px` }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.08),transparent_45%),radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.08),transparent_40%)]" />

      <header className="app-nav">
        <div className="app-nav-inner">
          <h1 className="app-logo">🎨 AI Text Styler Studio Pro</h1>
          <div className="mode-tabs" role="tablist" aria-label="스튜디오 모드">
            {STUDIO_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={studio.studioTab === tab.id}
                onClick={() => handleStudioTab(tab.id)}
                className={clsx('mode-tab', studio.studioTab === tab.id && 'is-on')}
                {...magnify(tab.label, tab.hint)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="aspect-toggle" role="group" aria-label="화면비">
            {ASPECTS.map((item) => (
              <button
                key={item.id}
                type="button"
                {...magnify(item.id, item.hint)}
                onClick={() => patchStudio({ aspectId: item.id })}
                className={clsx('view-btn', studio.aspectId === item.id && 'is-on')}
              >
                {item.id}
              </button>
            ))}
          </div>
          <div className="view-toggle" role="group" aria-label="뷰 모드">
            <button
              type="button"
              onClick={() => patchStudio({ viewMode: 'graphic' }, false)}
              className={clsx('view-btn', studio.viewMode === 'graphic' && 'is-on')}
              {...magnify('일반 그래픽 뷰', '색과 효과가 들어간 완성 미리보기를 봅니다')}
            >
              일반 그래픽 뷰
            </button>
            <button
              type="button"
              onClick={() => patchStudio({ viewMode: 'mask' }, false)}
              className={clsx('view-btn', studio.viewMode === 'mask' && 'is-on')}
              {...magnify('AI 흑백 마스크 뷰', 'AI 생성용 흑백 실루엣을 확인합니다')}
            >
              AI 흑백 마스크 뷰
            </button>
          </div>
          <div className="nav-utility">
            <button
              type="button"
              className="nav-utility-btn"
              onClick={() => setDiagOpen(true)}
              {...magnify('시스템 정밀 자가진단', `${DIAG_STEPS.length}단계 Live HUD로 캔버스·폰트·즐겨찾기·인포 바·익스포트·AI 마스크를 실시간 점검합니다`)}
            >
              🩺 시스템 정밀 자가진단
            </button>
            <button
              type="button"
              className="nav-utility-btn is-guide"
              onClick={() => setGuideOpen(true)}
              {...magnify('인터랙티브 가이드북', '간단 설정부터 크롭·블렌드·Grok 프로 마스크 파이프라인까지 실전 조작법을 안내합니다')}
            >
              📖 인터랙티브 가이드북
            </button>
          </div>
        </div>
      </header>

      <div className="studio-3col" style={{ '--left-panel-width': `${leftPanelWidth}px` }}>
        <div className="studio-left-split" ref={leftSplitRef}>
        <aside className="studio-left">
          <section className="title-split">
            <p className="panel-title title-split-kicker">👑✨ 상시 분할 제어 패널</p>
            {mainLayer ? (
              <LayerEditCard
                key={mainLayer.id}
                layer={mainLayer}
                index={studio.layers.findIndex((item) => item.id === mainLayer.id)}
                total={studio.layers.length}
                expanded={studio.activeLayerId === mainLayer.id}
                studioTab={studio.studioTab}
                studio={studio}
                onSelect={() => selectLayer(mainLayer.id)}
                onPatch={patchLayer}
                onCommit={capture}
                onRemove={removeLayer}
                onReorder={reorderLayer}
                onHoverFont={(fontId) => handleHoverFont(mainLayer.id, fontId)}
                onSelectFont={selectFontFor}
                onSelectPreset={selectPresetFor}
                onPatchStudio={patchStudio}
                favoriteIds={favoriteFonts}
                onToggleFavorite={toggleFavoriteFont}
              />
            ) : null}
            {subLayer ? (
              <LayerEditCard
                key={subLayer.id}
                layer={subLayer}
                index={studio.layers.findIndex((item) => item.id === subLayer.id)}
                total={studio.layers.length}
                expanded={studio.activeLayerId === subLayer.id}
                studioTab={studio.studioTab}
                studio={studio}
                onSelect={() => selectLayer(subLayer.id)}
                onPatch={patchLayer}
                onCommit={capture}
                onRemove={removeLayer}
                onReorder={reorderLayer}
                onHoverFont={(fontId) => handleHoverFont(subLayer.id, fontId)}
                onSelectFont={selectFontFor}
                onSelectPreset={selectPresetFor}
                onPatchStudio={patchStudio}
                favoriteIds={favoriteFonts}
                onToggleFavorite={toggleFavoriteFont}
              />
            ) : null}
          </section>

          <section className="panel-block">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="panel-title">🏷️ 추가 레이어</h2>
              <div className="flex gap-1">
                <button type="button" className="mini-btn" onClick={() => addLayer('text')} {...magnify('텍스트 레이어 추가', '메인/서브 외에 글자를 하나 더 올립니다')}>
                  <Plus className="h-3 w-3" /> 텍스트
                </button>
                <button type="button" className="mini-btn" onClick={() => addLayer('seal')} {...magnify('낙관 추가', '도장·인장 레이어를 붙입니다')}>
                  <Plus className="h-3 w-3" /> 낙관
                </button>
              </div>
            </div>
            {extraLayers.length ? (
              <div className="layer-list">
                {extraLayers.map((layer) => (
                  <LayerEditCard
                    key={layer.id}
                    layer={layer}
                    index={studio.layers.findIndex((item) => item.id === layer.id)}
                    total={studio.layers.length}
                    expanded={studio.activeLayerId === layer.id}
                    studioTab={studio.studioTab}
                    studio={studio}
                    onSelect={() => selectLayer(layer.id)}
                    onPatch={patchLayer}
                    onCommit={capture}
                    onRemove={removeLayer}
                    onReorder={reorderLayer}
                    onHoverFont={(fontId) => handleHoverFont(layer.id, fontId)}
                    onSelectFont={selectFontFor}
                    onSelectPreset={selectPresetFor}
                    onPatchStudio={patchStudio}
                    favoriteIds={favoriteFonts}
                    onToggleFavorite={toggleFavoriteFont}
                  />
                ))}
              </div>
            ) : (
              <p className="ui-hint">메인/서브 타이틀은 위에 항상 열려 있습니다. 낙관이나 추가 텍스트는 여기서 붙입니다.</p>
            )}
          </section>

          <section className="panel-block">
            <h2 className="panel-title">📁 배경 이미지 업로드</h2>
            <label className="file-btn mt-2" {...magnify('배경 이미지 업로드', '캔버스 뒤에 사진을 올립니다')}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleBgUpload(event.target.files?.[0])}
              />
              배경 이미지 선택
            </label>
            <label className="mt-2 block text-[11px] text-zinc-400" {...magnify('배경 불투명도', '배경 사진이 얼마나 진하게 보일지 조절합니다')}>
              배경 불투명도 {Math.round(studio.background.opacity * 100)}%
              <input type="range" min="0" max="100" className="ctrl-slider mt-1" value={studio.background.opacity * 100} onChange={(event) => patchStudio({ background: { ...studio.background, opacity: Number(event.target.value) / 100 } }, false)} />
            </label>
            <label className="mt-2 block text-[11px] text-zinc-400" {...magnify('배경 블러', '배경 사진을 흐리게 만들어 글자를 돋보이게 합니다')}>
              배경 블러 {studio.background.blur}px
              <input type="range" min="0" max="20" className="ctrl-slider mt-1" value={studio.background.blur} onChange={(event) => patchStudio({ background: { ...studio.background, blur: Number(event.target.value) } }, false)} />
            </label>
            <label className="mt-2 block text-[11px] text-zinc-400" {...magnify('블렌드 모드', '배경과 글자가 섞이는 방식을 고릅니다')}>
              블렌드 모드
              <select
                className="ctrl-select mt-1.5"
                value={studio.background.blend}
                onChange={(event) => patchStudio({ background: { ...studio.background, blend: event.target.value } })}
              >
                {BLEND_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
            </label>
            {studio.background.dataUrl ? (
              <button type="button" className="mini-btn mt-2" onClick={() => patchStudio({ background: { ...studio.background, dataUrl: '' } })} {...magnify('배경 이미지 삭제', '올린 배경 사진을 지웁니다')}>
                🗑️ 배경 이미지 삭제
              </button>
            ) : null}
          </section>
        </aside>
        <div
          className={clsx('panel-resizer', isResizing && 'is-on')}
          role="separator"
          aria-orientation="vertical"
          aria-label="왼쪽 패널 너비 조절"
          aria-valuemin={LEFT_PANEL_MIN}
          aria-valuemax={LEFT_PANEL_MAX}
          aria-valuenow={leftPanelWidth}
          {...magnify('패널 너비 조절', '드래그로 왼쪽 폭을 바꾸고, 더블클릭하면 360px로 돌아갑니다')}
          onMouseDown={startLeftResize}
          onDoubleClick={resetLeftPanelWidth}
        />
        </div>

        <main className="studio-center">
          <div className="canvas-toolbar">
            <button type="button" className="tool-btn" onClick={undo} {...magnify('Undo 실행 취소', '바로 이전 작업으로 되돌립니다 (Ctrl+Z)')}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
            <button type="button" className="tool-btn" onClick={redo} {...magnify('Redo 다시 실행', '취소한 작업을 다시 적용합니다 (Ctrl+Y)')}><Redo2 className="h-3.5 w-3.5" /> Redo</button>
            <button type="button" className="tool-btn" onClick={resetActive} {...magnify('정중앙 정렬', '선택한 글자를 캔버스 한가운데로 되돌립니다')}><RotateCcw className="h-3.5 w-3.5" /> 🎯 정중앙 정렬</button>
            <button type="button" className={clsx('tool-btn', studio.gridOn && 'is-on')} onClick={() => patchStudio({ gridOn: !studio.gridOn }, false)} {...magnify('격자 / 눈금', '배치를 돕기 위한 안내선을 켜거나 끕니다')}>
              <Grid3x3 className="h-3.5 w-3.5" /> 📐 격자/눈금
            </button>
            <button type="button" className={clsx('tool-btn', studio.layerLocked && 'is-on')} onClick={() => patchStudio({ layerLocked: !studio.layerLocked }, false)} {...magnify('위치 잠금', '실수로 글자를 드래그하지 않도록 고정합니다')}>
              {studio.layerLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              {studio.layerLocked ? '🔒 위치 잠금' : '위치 잠금 해제'}
            </button>
            <span className="ml-auto text-[11px] text-zinc-500">
              {aspect.label} · {preset.name} · {activeLayer?.name}
              {hoverPreview ? ' · 호버 프리뷰' : ''}
            </span>
          </div>
          <div className="edit-toolbar">
            <button
              type="button"
              className={clsx('edit-tool', cropMode && 'is-on')}
              onClick={() => (cropMode ? cancelCrop() : beginCrop())}
              {...magnify('자유 자르기 / 크롭', '원하는 영역만 남기고 캔버스를 자릅니다')}
            >
              <Scissors className="h-4 w-4" /> ✂️ 자유 자르기 / 크롭
            </button>
            <button type="button" className="edit-tool" onClick={rotateCanvas90} {...magnify('90° 시계방향 회전', '화면 전체를 오른쪽으로 한 번 돌립니다')}>
              <RotateCw className="h-4 w-4" /> 🔄 90° 시계방향
            </button>
            <button
              type="button"
              className={clsx('edit-tool', viewEdit.flipH && 'is-on')}
              onClick={() => patchViewEdit({ flipH: !viewEdit.flipH })}
              {...magnify('좌우 반전', '이미지를 거울처럼 가로로 뒤집습니다')}
            >
              <FlipHorizontal2 className="h-4 w-4" /> ↔ 좌우 반전
            </button>
            <button
              type="button"
              className={clsx('edit-tool', viewEdit.flipV && 'is-on')}
              onClick={() => patchViewEdit({ flipV: !viewEdit.flipV })}
              {...magnify('상하 반전', '이미지를 세로로 뒤집습니다')}
            >
              <FlipVertical2 className="h-4 w-4" /> ↕ 상하 반전
            </button>
            <div className="filter-popover-wrap">
              <button
                type="button"
                className={clsx('edit-tool', filterOpen && 'is-on')}
                onClick={() => {
                  setCropMode(false)
                  setFilterOpen((open) => !open)
                }}
                {...magnify('그래픽 필터', '밝기·대비·채도·비네팅·수묵 흑백을 조절합니다')}
              >
                <SlidersHorizontal className="h-4 w-4" /> 🎨 그래픽 필터
              </button>
              {filterOpen ? (
                <div className="filter-popover">
                  <p className="filter-popover-title">그래픽 필터</p>
                  {[
                    { key: 'brightness', label: '밝기 Brightness', min: 40, max: 160, tip: '화면 전체를 더 밝거나 어둡게 합니다' },
                    { key: 'contrast', label: '대비 Contrast', min: 40, max: 180, tip: '밝은 부분과 어두운 부분의 차이를 키웁니다' },
                    { key: 'saturation', label: '채도 Saturation', min: 0, max: 200, tip: '색을 더 선명하거나 흐리게 만듭니다' },
                    { key: 'vignette', label: '비네팅 Vignette', min: 0, max: 100, tip: '가장자리를 어둡게 해 가운데를 강조합니다' },
                    { key: 'ink', label: '수묵 흑백화', min: 0, max: 100, tip: '수묵화처럼 흑백으로 바꿉니다' },
                  ].map((item) => (
                    <label key={item.key} className="filter-row" {...magnify(item.label, item.tip)}>
                      {item.label} {Math.round(viewEdit[item.key] ?? 0)}
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        className="ctrl-slider mt-1"
                        value={viewEdit[item.key] ?? 0}
                        onPointerDown={capture}
                        onChange={(event) => patchViewEdit({ [item.key]: Number(event.target.value) }, false)}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    className="mini-btn mt-2"
                    onClick={() => patchViewEdit({
                      brightness: 100,
                      contrast: 100,
                      saturation: 100,
                      vignette: 0,
                      ink: 0,
                    })}
                    {...magnify('필터 초기화', '밝기·대비·채도를 원래 값으로 되돌립니다')}
                  >
                    필터 초기화
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {cropMode ? (
            <div className="crop-toolbar">
              {CROP_ASPECTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx('crop-aspect', cropAspect === item.id && 'is-on')}
                  onClick={() => changeCropAspect(item.id)}
                  {...magnify(item.label, '자를 영역의 가로세로 비율을 고정합니다')}
                >
                  {item.label}
                </button>
              ))}
              <button type="button" className="crop-apply" onClick={applyCrop} {...magnify('크롭 적용', '선택한 영역만 남기고 자릅니다')}>✓ 크롭 적용</button>
              <button type="button" className="crop-cancel" onClick={cancelCrop} {...magnify('크롭 취소', '자르기를 그만두고 이전 화면으로 돌아갑니다')}>✕ 취소</button>
              {viewEdit.crop ? (
                <button type="button" className="crop-cancel" onClick={clearCrop} {...magnify('크롭 해제', '이미 적용한 자르기를 없앱니다')}>크롭 해제</button>
              ) : null}
            </div>
          ) : null}
          <div className="canvas-stage" ref={stageRef} style={{ '--studio-ar': `${aspect.w} / ${aspect.h}` }}>
            <div
              id="main-canvas-area"
              className={clsx('preview-frame', studio.viewMode === 'mask' && 'is-mask-view', hoverPreview && 'is-hover-preview', cropMode && 'is-cropping')}
            >
              <canvas
                ref={canvasRef}
                className={clsx('h-full w-full', cropMode ? 'cursor-crosshair' : (studio.layerLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'))}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerCancel={onCanvasPointerUp}
              />
              {cropMode ? (
                <CropOverlay rect={cropDraft} aspectId={cropAspect} onChange={setCropDraft} />
              ) : null}
            </div>
          </div>
          {liveStatus ? (
            <div
              className="live-status-hud"
              role="status"
              aria-live="polite"
              aria-label="실시간 텍스트 인포 바"
              {...magnify('실시간 텍스트 인포 바', '선택한 레이어의 글자 수, 폰트, 좌표, 프리셋이 캔버스 아래에 바로 반영됩니다')}
            >
              <span className={clsx('live-status-hud__badge', `is-${liveStatus.badge.tone}`)}>
                [{liveStatus.badge.text}]
              </span>
              <span className="live-status-hud__chip">
                <span className="live-status-hud__label">글자</span>
                <span className="live-status-hud__value">{liveStatus.stats}</span>
              </span>
              <span className="live-status-hud__chip">
                <span className="live-status-hud__label">폰트</span>
                <span className="live-status-hud__value">
                  {liveStatus.fontName}
                  <span className="live-status-hud__dot">·</span>
                  {liveStatus.fontSize}px
                  <span className="live-status-hud__dot">·</span>
                  자간 {liveStatus.tracking}px
                  <span className="live-status-hud__dot">·</span>
                  행간 {liveStatus.leading}배
                </span>
              </span>
              <span className="live-status-hud__chip">
                <span className="live-status-hud__label">캔버스</span>
                <span className="live-status-hud__value">
                  좌표(X: {liveStatus.x}, Y: {liveStatus.y})
                  <span className="live-status-hud__dot">·</span>
                  회전({liveStatus.rotation}°)
                  <span className="live-status-hud__dot">·</span>
                  투명도({liveStatus.opacity}%)
                </span>
              </span>
              <span className="live-status-hud__chip">
                <span className="live-status-hud__label">프리셋</span>
                <span className="live-status-hud__value">{liveStatus.presetName}</span>
              </span>
            </div>
          ) : null}
          <p className="mt-3 text-center text-[11px] text-zinc-500">
            {cropMode
              ? '크롭 박스를 드래그해 영역을 잡고 ✓ 적용 / ✕ 취소를 누르세요'
              : '드래그로 이동 · 모서리 핸들로 크기 · 위쪽 핸들로 회전 · Ctrl+Z / Ctrl+Y'}
          </p>
        </main>

        <aside className="studio-right">
          <section className="ai-card">
            <p className="text-[11px] tracking-[0.16em] text-cyan-300/80 uppercase">AI Engine</p>
            <h2 className="mt-1 text-base font-semibold text-white">실제 렌더링 생성</h2>
            <p className="mt-1 text-[11px] leading-5 text-zinc-400">{aiNote}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setJobReady(false)
                setApiOpen(true)
              }}
              className="convert-btn mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 px-3 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-70"
              {...magnify('AI 실제 렌더링 생성', '마스크와 프롬프트를 보내 고화질 이미지를 만듭니다')}
            >
              <WandSparkles className="h-4 w-4" />
              🚀 AI 실제 렌더링 생성하기
            </button>
            <button type="button" className="mini-btn mt-2" onClick={() => setApiOpen(true)} {...magnify('API 설정 열기', 'Fal / Replicate / Grok 키를 입력합니다')}>
              <KeyRound className="h-3.5 w-3.5" /> API 설정 열기
            </button>
          </section>

          <section className="export-hub">
            <h2 className="panel-title">다양한 포맷 익스포트 & 변환 허브</h2>
            <p className="export-hub-note">{exportBusy ? '렌더링 중…' : exportNote}</p>
            <button type="button" disabled={exportBusy} className="export-btn export-btn-png mt-3 w-full" onClick={downloadPng} {...magnify('투명 배경 PNG', '배경 없이 글자만 깨끗하게 저장합니다')}>
              <Download className="h-4 w-4" /> 🖼️ 투명 배경 PNG 다운로드
            </button>
            <button type="button" disabled={exportBusy} className="export-btn export-btn-jpeg mt-2 w-full" onClick={downloadJpeg} {...magnify('고품질 JPEG', '흰 배경으로 합성해 용량을 줄여 저장합니다')}>
              <Download className="h-4 w-4" /> 📷 고품질 JPEG 다운로드
            </button>
            <button type="button" disabled={exportBusy} className="export-btn export-btn-gif mt-2 w-full" onClick={downloadGif} {...magnify('움직이는 GIF', '네온 숨쉬기·글리치·크롬 효과가 반복되는 짧은 영상을 만듭니다')}>
              <Download className="h-4 w-4" /> 🎞️ 움직이는 GIF 애니메이션 생성
            </button>
            <p className="export-hub-sub">루프 스타일: {GIF_STYLE_LABEL[gifStyle]} · 약 2.4초</p>
            <button type="button" disabled={exportBusy} className="export-btn export-btn-ico mt-2 w-full" onClick={downloadIcons} {...magnify('파비콘 / 앱 아이콘', '32·64·256 PNG와 ICO 파일을 한 번에 받습니다')}>
              <Download className="h-4 w-4" /> 🔷 파비콘 / 앱 아이콘 (.ICO & Multi-size PNG)
            </button>
            <button type="button" disabled={exportBusy} className="export-btn mt-2 w-full" onClick={downloadMaskNow} {...magnify('AI 흑백 마스크', 'AI 이미지 생성에 넣을 흑백 실루엣을 저장합니다')}>
              <Download className="h-4 w-4" /> 🎭 1024×1024 AI 흑백 마스크 ({aspect.w}×{aspect.h})
            </button>
            <button type="button" className="export-btn mt-2 w-full" onClick={() => copyPrompt('full')} {...magnify('AI 프롬프트 복사', '생성용 설명을 클립보드에 복사합니다')}>
              <Copy className="h-4 w-4" /> {promptCopied === 'full' ? '✅ 복사 완료!' : '📋 AI 프롬프트 원클릭 복사'}
            </button>
          </section>

          <section className="prompt-engine">
            <p className="text-[11px] tracking-[0.16em] text-fuchsia-300/80 uppercase">Prompt Builder</p>
            <h2 className="mt-1 text-sm font-semibold text-white">✨ AI 생성 최적화 프롬프트</h2>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500">
              {preset.name} · {font.label} · {aspect.id} · Grok / Flux / Midjourney / ControlNet
            </p>
            <div className="prompt-live" aria-live="polite">
              <pre className="prompt-pre">{promptPack.full}</pre>
            </div>
            <button
              type="button"
              className={clsx('prompt-copy-main', promptCopied === 'full' && 'is-copied')}
              onClick={() => copyPrompt('full')}
              {...magnify('프롬프트 전체 복사', 'AI에 넣을 설명을 모두 복사합니다')}
            >
              {promptCopied === 'full' ? '✅ 복사 완료! (Copied!)' : '📋 프롬프트 전체 복사'}
            </button>
            <div className="prompt-quick">
              <button type="button" className={clsx('prompt-chip', promptCopied === 'positive' && 'is-copied')} onClick={() => copyPrompt('positive')} {...magnify('Positive 복사', '넣고 싶은 요소만 복사합니다')}>
                {promptCopied === 'positive' ? '✅ Positive' : 'Positive만 복사'}
              </button>
              <button type="button" className={clsx('prompt-chip', promptCopied === 'negative' && 'is-copied')} onClick={() => copyPrompt('negative')} {...magnify('Negative 복사', '빼고 싶은 요소만 복사합니다')}>
                {promptCopied === 'negative' ? '✅ Negative' : 'Negative만 복사'}
              </button>
              <button type="button" className={clsx('prompt-chip', promptCopied === 'mj' && 'is-copied')} onClick={() => copyPrompt('mj')} {...magnify('Midjourney용 복사', '화면비 옵션이 붙은 프롬프트를 복사합니다')}>
                {promptCopied === 'mj' ? '✅ Midjourney' : `Midjourney용 (--ar ${promptPack.ar})`}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-zinc-500">{promptPack.guide}</p>
          </section>
        </aside>
      </div>

      <ProgressModal
        key={sessionId}
        open={modalOpen}
        sessionId={sessionId}
        preset={{ ...preset, themeLabel }}
        isReady={jobReady}
        estimatedMs={ESTIMATED_DURATION_MS}
        promptText={exportPrompt}
        onClose={() => setModalOpen(false)}
        onDownloadMask={() => downloadFile(maskUrl, 'mask')}
        onDownloadPng={() => downloadFile(transparentUrl, 'transparent')}
      />

      <AiGenerateModal
        open={apiOpen}
        keys={apiKeys}
        onChangeKeys={persistKeys}
        onClose={() => setApiOpen(false)}
        onGenerate={handleConvert}
        busy={busy}
        isReady={jobReady}
        sessionId={sessionId}
        resultUrl={aiResultUrl}
        fallbackUsed={fallbackUsed}
        promptPreview={promptPack.positive}
        onDownloadResult={() => downloadFile(aiResultUrl, 'ai-final')}
      />
      <MenuMagnifierHUD />
      <SelfDiagnosticModal
        open={diagOpen}
        onClose={() => setDiagOpen(false)}
        promptPack={promptPack}
        apiKeys={apiKeys}
        studio={studio}
        history={historyRef.current}
        favoriteFonts={favoriteFonts}
        onRevoke={revokeUrls}
      />
      <GuidebookModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
