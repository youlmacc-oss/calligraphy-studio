import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Download, Maximize2, Minus, Plus, RotateCcw, Upload } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { magnify } from './MenuMagnifierHUD.jsx'
import PreviewLightboxModal from './PreviewLightboxModal.jsx'
import { canvasToPngBlob } from '../lib/exportFormats.js'
import {
  DEFAULT_CROP_BOUNDS,
  EMO_SIDE_DEFAULT,
  EMO_SIDE_MAX,
  EMO_SIDE_MIN,
  KAKAO_STICKER_SIZE,
  SLICE_SCALE_DEFAULT,
  SLICE_SCALE_MAX,
  SLICE_SCALE_MIN,
  TEXT_ZONE_DEFAULT,
  TEXT_ZONE_MAX,
  TEXT_ZONE_MIN,
  TEXT_ZONE_ANCHOR_DEFAULT,
  OUTLINE_DEFAULT,
  PUNCH_HOLES_DEFAULT,
  VIEW_BG_DEFAULT,
  clampEmoSideWidth,
  clampPreviewZoomPercent,
  clampSliceScale,
  clampTextZonePercent,
  equalSplitGuides,
  fileToSheetCanvas,
  insertGuide,
  moveGuide,
  normalizeBounds,
  PREVIEW_ZOOM_DEFAULT,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_STEP,
  removeGuide,
  sliceSheet,
  SPLITTER_LIVE_REV,
  TEXT_ENGINE_DEFAULT,
  TEXT_ENGINE_MODES,
  TEXT_ENGINE_SMART_RECOLOR,
  stepPreviewZoomPercent,
  cycleViewBgMode,
  normalizeTextEngineMode,
  hidePngGuideToday,
  isPngGuideHiddenToday,
  PNG_GUIDE_BODY,
  PNG_GUIDE_FOOT,
  PNG_GUIDE_HIDE_LABEL,
  PNG_GUIDE_OK_LABEL,
  PNG_GUIDE_TITLE,
  sniffCanvasHasAlpha,
  formatSmartGridLabel,
  handleDefaultSheetUpload,
  isAcceptedSheetFile,
  DEFAULT_SHEET_COLS,
  DEFAULT_SHEET_ROWS,
  SHEET_ACCEPT,
  SHEET_GRID_PRESETS,
} from '../lib/emoticonSplit.js'
import { buildDiagnosticReport, copyDiagnosticLog, publishInspectorHud } from '../utils/debugger.js'
import { evaluateSystemDiagnostics, mergeDiagnosticReport } from '../lib/systemDiagnostics.js'
import { publishEmoticonCuts } from './MotionGifStudio/cutSnapshot.js'
import { purgeFakeBackground } from '../lib/fakeBackgroundPurge.js'
import { useTransparencyGate } from '../hooks/useTransparencyGate.js'
import TransparencyCheckModal from './TransparencyCheckModal.jsx'
import { blitToHiDpiCanvas } from '../utils/hqRender.js'

const liveSheetMemory = {
  canvas: null,
  url: '',
  fileName: '',
}

const TEXT_MODES = [
  { id: 'black', label: '블랙', hint: '하단 ROI 글자만 검게 바꿉니다. 캐릭터는 읽기 전용입니다' },
  { id: 'white', label: '화이트', hint: '하단 ROI 글자만 흰색으로 바꿉니다. 캐릭터는 읽기 전용입니다' },
  { id: 'custom', label: '커스텀', hint: '하단 ROI 글자만 고른 색으로 바꿉니다. 캐릭터는 읽기 전용입니다' },
]

const VIEW_BG_LABELS = {
  checker: '🏁 체커보드',
  dark: '⬛ 다크',
  light: '⬜ 라이트',
}

function clampZoom(value) {
  return clampPreviewZoomPercent(Math.round(Number(value) * 100)) / 100
}

function defaultZoomRatio() {
  return clampZoom(PREVIEW_ZOOM_DEFAULT / 100)
}

function HqCutThumb({ canvas, alt }) {
  const viewRef = useRef(null)
  useEffect(() => {
    const view = viewRef.current
    if (!view || !canvas) return undefined
    const paint = () => {
      const css = Math.max(1, Math.round(view.parentElement?.clientWidth || view.clientWidth || 72))
      blitToHiDpiCanvas(view, canvas, { cssWidth: css, cssHeight: css, zoomPercent: 100, live: true, edgePreserve: false })
    }
    paint()
    const host = view.parentElement
    if (!host || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(paint)
    observer.observe(host)
    return () => observer.disconnect()
  }, [canvas])
  return <canvas ref={viewRef} className="emo-thumb-canvas" role="img" aria-label={alt} />
}

function SplitEmptyState() {
  return (
    <div
      className="emo-thumbs-empty"
      data-split-empty="1"
      {...magnify('시트 분할 대기 중', '시트 이미지를 업로드하면 개별 컷 썸네일이 이곳에 정렬됩니다.')}
    >
      <div className="emo-empty-icon" aria-hidden="true">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </div>
      <strong className="emo-empty-title">시트 분할 대기 중</strong>
      <p className="emo-empty-sub">시트 이미지를 업로드하면 개별 컷 썸네일이 이곳에 정렬됩니다.</p>
    </div>
  )
}

function TransparencyGuideModal({ open, onContinue, onHideToday }) {
  if (!open) return null
  return (
    <div className="emo-png-guide-root" data-png-guide="1" role="dialog" aria-modal="true" aria-labelledby="emo-png-guide-title">
      <div className="emo-png-guide-backdrop" />
      <div className="emo-png-guide-card">
        <h3 id="emo-png-guide-title">💡 {PNG_GUIDE_TITLE}</h3>
        <div className="emo-png-guide-preview checkerboard-bg" aria-hidden="true">
          <span className="emo-png-guide-sample">안녕!</span>
        </div>
        <p className="emo-png-guide-body">
          💡
          {' '}
          <strong>4행 × 5열 (20개) 투명 PNG 시트</strong>
          를 기본 규격으로 권장합니다.
        </p>
        <p className="emo-png-guide-foot">{PNG_GUIDE_BODY}</p>
        <p className="emo-png-guide-foot">{PNG_GUIDE_FOOT}</p>
        <div className="emo-png-guide-actions">
          <button
            type="button"
            data-png-guide-ok="1"
            onClick={onContinue}
            {...magnify(PNG_GUIDE_OK_LABEL, PNG_GUIDE_BODY)}
          >
            {PNG_GUIDE_OK_LABEL}
          </button>
          <button
            type="button"
            data-png-guide-hide="1"
            onClick={onHideToday}
            {...magnify(PNG_GUIDE_HIDE_LABEL, PNG_GUIDE_FOOT)}
          >
            {PNG_GUIDE_HIDE_LABEL}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EmoticonSplitterModal({ open, onClose }) {
  const inputRef = useRef(null)
  const stageRef = useRef(null)
  const viewportRef = useRef(null)
  const sheetRef = useRef(null)
  const dragRef = useRef(null)
  const sliceGen = useRef(0)
  const scaleTimer = useRef(null)
  const zoneTimer = useRef(null)
  const [mode, setMode] = useState('smart')
  const [cols, setCols] = useState(6)
  const [rows, setRows] = useState(5)
  const [verticalGuides, setVerticalGuides] = useState(() => equalSplitGuides(6))
  const [horizontalGuides, setHorizontalGuides] = useState(() => equalSplitGuides(5))
  const [bounds, setBounds] = useState(DEFAULT_CROP_BOUNDS)
  const [activeGuide, setActiveGuide] = useState(null)
  const [transparent, setTransparent] = useState(true)
  const [textMode, setTextMode] = useState('original')
  const [textEngineMode, setTextEngineMode] = useState(TEXT_ENGINE_DEFAULT)
  const [customColor, setCustomColor] = useState('#111111')
  const [outline, setOutline] = useState(OUTLINE_DEFAULT)
  const [fileName, setFileName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [slices, setSlices] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('AI가 만든 스티커 시트(흰 배경 그리드)를 올리면 360×360 PNG로 나눕니다.')
  const [dragOver, setDragOver] = useState(false)
  const [zoom, setZoom] = useState(defaultZoomRatio)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [customScale, setCustomScale] = useState(SLICE_SCALE_DEFAULT)
  const [textZone, setTextZone] = useState(TEXT_ZONE_DEFAULT)
  const [textZoneAnchor, setTextZoneAnchor] = useState(TEXT_ZONE_ANCHOR_DEFAULT)
  const [punchHoles, setPunchHoles] = useState(PUNCH_HOLES_DEFAULT)
  const [viewBg, setViewBg] = useState(VIEW_BG_DEFAULT)
  const [sideWidth, setSideWidth] = useState(EMO_SIDE_DEFAULT)
  const [sideResizing, setSideResizing] = useState(false)
  const [logCopied, setLogCopied] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [showTransparencyGuideModal, setShowTransparencyGuideModal] = useState(false)
  const [gridDetect, setGridDetect] = useState(null)
  const alphaGate = useTransparencyGate()
  const vGuidesRef = useRef(verticalGuides)
  const hGuidesRef = useRef(horizontalGuides)
  const boundsRef = useRef(bounds)
  const colsRef = useRef(cols)
  const rowsRef = useRef(rows)
  const modeRef = useRef(mode)
  const transparentRef = useRef(transparent)
  const textModeRef = useRef(textMode)
  const textEngineModeRef = useRef(textEngineMode)
  const customColorRef = useRef(customColor)
  const outlineRef = useRef(outline)
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  const customScaleRef = useRef(customScale)
  const textZoneRef = useRef(textZone)
  const textZoneAnchorRef = useRef(textZoneAnchor)
  const punchHolesRef = useRef(punchHoles)
  const viewBgRef = useRef(viewBg)
  const sideWidthRef = useRef(sideWidth)
  vGuidesRef.current = verticalGuides
  hGuidesRef.current = horizontalGuides
  boundsRef.current = bounds
  colsRef.current = cols
  rowsRef.current = rows
  modeRef.current = mode
  transparentRef.current = transparent
  textModeRef.current = textMode
  textEngineModeRef.current = textEngineMode
  customColorRef.current = customColor
  outlineRef.current = outline
  zoomRef.current = zoom
  panRef.current = pan
  customScaleRef.current = customScale
  textZoneRef.current = textZone
  textZoneAnchorRef.current = textZoneAnchor
  punchHolesRef.current = punchHoles
  viewBgRef.current = viewBg
  sideWidthRef.current = sideWidth

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !open) return undefined
    const onWheel = (event) => {
      if (!sheetRef.current) return
      event.preventDefault()
      const nextPct = stepPreviewZoomPercent(zoomRef.current * 100, event.deltaY > 0 ? -PREVIEW_ZOOM_STEP : PREVIEW_ZOOM_STEP)
      const next = nextPct / 100
      setZoom(next)
      zoomRef.current = next
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, sheetUrl])

  useEffect(() => {
    if (!open) return undefined
    const next = defaultZoomRatio()
    setZoom(next)
    setPan({ x: 0, y: 0 })
    zoomRef.current = next
    panRef.current = { x: 0, y: 0 }
    setOutline(OUTLINE_DEFAULT)
    outlineRef.current = OUTLINE_DEFAULT
    setPunchHoles(PUNCH_HOLES_DEFAULT)
    punchHolesRef.current = PUNCH_HOLES_DEFAULT
    setTextZoneAnchor(TEXT_ZONE_ANCHOR_DEFAULT)
    textZoneAnchorRef.current = TEXT_ZONE_ANCHOR_DEFAULT
    setTextEngineMode(TEXT_ENGINE_DEFAULT)
    textEngineModeRef.current = TEXT_ENGINE_DEFAULT
    setViewBg(VIEW_BG_DEFAULT)
    viewBgRef.current = VIEW_BG_DEFAULT
    return undefined
  }, [open])

  const cellCount = (verticalGuides.length + 1) * (horizontalGuides.length + 1)
  const zoomLabel = `${Math.round(zoom * 100)}%`

  const resetView = () => {
    const next = defaultZoomRatio()
    setZoom(next)
    setPan({ x: 0, y: 0 })
    zoomRef.current = next
    panRef.current = { x: 0, y: 0 }
  }

  const fitZoom = useCallback(() => {
    const next = defaultZoomRatio()
    setZoom(next)
    setPan({ x: 0, y: 0 })
    zoomRef.current = next
    panRef.current = { x: 0, y: 0 }
  }, [])

  const bumpZoom = (deltaPercent) => {
    const next = stepPreviewZoomPercent(zoomRef.current * 100, deltaPercent) / 100
    setZoom(next)
    zoomRef.current = next
  }

  const reset = () => {
    setLightboxIndex(-1)
    setSlices([])
    publishEmoticonCuts([])
    setSheetUrl('')
    setFileName('')
    sheetRef.current = null
    liveSheetMemory.canvas = null
    liveSheetMemory.url = ''
    liveSheetMemory.fileName = ''
    setBounds(DEFAULT_CROP_BOUNDS)
    boundsRef.current = DEFAULT_CROP_BOUNDS
    setVerticalGuides(equalSplitGuides(colsRef.current))
    setHorizontalGuides(equalSplitGuides(rowsRef.current))
    setActiveGuide(null)
    resetView()
    setOutline(OUTLINE_DEFAULT)
    outlineRef.current = OUTLINE_DEFAULT
    setPunchHoles(PUNCH_HOLES_DEFAULT)
    punchHolesRef.current = PUNCH_HOLES_DEFAULT
    setTextZoneAnchor(TEXT_ZONE_ANCHOR_DEFAULT)
    textZoneAnchorRef.current = TEXT_ZONE_ANCHOR_DEFAULT
    setTextEngineMode(TEXT_ENGINE_DEFAULT)
    textEngineModeRef.current = TEXT_ENGINE_DEFAULT
    setViewBg(VIEW_BG_DEFAULT)
    viewBgRef.current = VIEW_BG_DEFAULT
    publishInspectorHud({ status: 'idle', suspectCount: 0, sliceCount: 0 })
    setNote('AI가 만든 스티커 시트(흰 배경 그리드)를 올리면 360×360 PNG로 나눕니다.')
    setGridDetect(null)
  }

  useEffect(() => {
    if (!open) {
      setShowTransparencyGuideModal(false)
      return undefined
    }
    if (isPngGuideHiddenToday()) return undefined
    setShowTransparencyGuideModal(true)
    return undefined
  }, [open])

  const runSlice = useCallback(async (patch = {}) => {
    const source = patch.source ?? sheetRef.current
    if (!source) return
    const gen = sliceGen.current + 1
    sliceGen.current = gen
    setBusy(true)
    setNote('시트를 분석해 이모티콘을 나누는 중…')
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 16))
      const next = sliceSheet(source, {
        mode: patch.nextMode ?? modeRef.current,
        cols: patch.nextCols ?? colsRef.current,
        rows: patch.nextRows ?? rowsRef.current,
        transparent: patch.nextTransparent ?? transparentRef.current,
        verticalGuides: patch.nextVertical ?? vGuidesRef.current,
        horizontalGuides: patch.nextHorizontal ?? hGuidesRef.current,
        bounds: patch.nextBounds ?? boundsRef.current,
        textMode: patch.nextTextMode ?? textModeRef.current,
        textEngineMode: patch.nextTextEngineMode ?? textEngineModeRef.current,
        customColor: patch.nextCustomColor ?? customColorRef.current,
        outline: patch.nextOutline ?? outlineRef.current,
        customScale: patch.nextCustomScale ?? customScaleRef.current,
        textZonePercent: patch.nextTextZone ?? textZoneRef.current,
        textZoneAnchor: patch.nextTextZoneAnchor ?? textZoneAnchorRef.current,
        punchHoles: patch.nextPunchHoles ?? punchHolesRef.current,
      })
      if (gen !== sliceGen.current) return
      const bound = Array.from(next)
      bound.gridMeta = next.gridMeta
      setSlices(bound)
      publishEmoticonCuts(bound)
      const meta = {
        ...(next.gridMeta || next[0]?.gridMeta || {}),
        count: bound.length,
        rows: next.gridMeta?.rows || next[0]?.gridMeta?.rows,
        cols: next.gridMeta?.cols || next[0]?.gridMeta?.cols,
      }
      const usedSmart = (patch.nextMode ?? modeRef.current) === 'smart'
      if (usedSmart && meta?.cols && meta?.rows) {
        setCols(meta.cols)
        setRows(meta.rows)
        colsRef.current = meta.cols
        rowsRef.current = meta.rows
        if (Array.isArray(meta.verticalGuides)) {
          setVerticalGuides(meta.verticalGuides)
          vGuidesRef.current = meta.verticalGuides
        }
        if (Array.isArray(meta.horizontalGuides)) {
          setHorizontalGuides(meta.horizontalGuides)
          hGuidesRef.current = meta.horizontalGuides
        }
      }
      setGridDetect({ ...meta, count: bound.length })
      const suspects = bound.filter((item) => item.diagnostics?.suspects?.length).length
      publishInspectorHud({
        status: bound.length ? (suspects ? 'warn' : 'ok') : 'idle',
        suspectCount: suspects,
        sliceCount: bound.length,
      })
      const lossless = Boolean(bound[0]?.lossless)
      const gridLabel = formatSmartGridLabel({ ...meta, count: bound.length })
      setNote(bound.length
        ? `💡 ${gridLabel || `${bound.length}개`} 감지 완료 (카카오 ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} 규격)`
        : '객체를 찾지 못했습니다. 외곽 재단선과 모드 B 절단선을 맞춰 보세요.')
    } catch (error) {
      if (gen !== sliceGen.current) return
      setNote(error.message || '분할에 실패했습니다.')
      setLightboxIndex(-1)
      setSlices([])
      setGridDetect(null)
      publishEmoticonCuts([])
      publishInspectorHud({ status: 'idle', suspectCount: 0, sliceCount: 0 })
    } finally {
      if (gen === sliceGen.current) setBusy(false)
    }
  }, [])

  const processSplit = runSlice

  useEffect(() => {
    if (!open) return undefined
    const source = sheetRef.current || liveSheetMemory.canvas
    if (!source) return undefined
    sheetRef.current = source
    if (liveSheetMemory.url) {
      setSheetUrl(liveSheetMemory.url)
      setFileName(liveSheetMemory.fileName)
    }
    processSplit({ source, nextMode: modeRef.current || 'smart' })
    return undefined
  }, [open, SPLITTER_LIVE_REV, processSplit])

  const applyPreviewZoomPercent = (percent = PREVIEW_ZOOM_DEFAULT) => {
    const next = clampZoom(Number(percent) / 100)
    setZoom(next)
    zoomRef.current = next
    setPan({ x: 0, y: 0 })
    panRef.current = { x: 0, y: 0 }
  }

  const initModeBGuides = () => {
    const nextVertical = equalSplitGuides(colsRef.current)
    const nextHorizontal = equalSplitGuides(rowsRef.current)
    setVerticalGuides(nextVertical)
    setHorizontalGuides(nextHorizontal)
    vGuidesRef.current = nextVertical
    hGuidesRef.current = nextHorizontal
    return { nextVertical, nextHorizontal }
  }

  const bindDetectedGrid = (detected, source) => {
    if (!detected?.cells?.length) return
    const width = source?.width || 1
    const height = source?.height || 1
    const rows = detected.rows || 0
    const cols = detected.cols || 0
    if (cols) {
      setCols(cols)
      colsRef.current = cols
    }
    if (rows) {
      setRows(rows)
      rowsRef.current = rows
    }
    if (Array.isArray(detected.verticalGuides) && detected.verticalGuides.length) {
      setVerticalGuides(detected.verticalGuides)
      vGuidesRef.current = detected.verticalGuides
    }
    if (Array.isArray(detected.horizontalGuides) && detected.horizontalGuides.length) {
      setHorizontalGuides(detected.horizontalGuides)
      hGuidesRef.current = detected.horizontalGuides
    }
    setGridDetect({
      rows,
      cols,
      count: detected.cells.length,
      engine: detected.engine,
      cells: detected.cells,
      verticalGuides: detected.verticalGuides || [],
      horizontalGuides: detected.horizontalGuides || [],
      width,
      height,
    })
  }

  const runModeASmartDetection = (source, patch = {}) => {
    setMode('smart')
    modeRef.current = 'smart'
    return runSlice({
      ...patch,
      source,
      nextMode: 'smart',
    })
  }

  const onSheetPreviewLoad = useCallback(() => {
    fitZoom()
  }, [fitZoom])

  const triggerAfterSheetLoad = async (canvas) => {
    applyPreviewZoomPercent(35)
    const nextBounds = DEFAULT_CROP_BOUNDS
    setBounds(nextBounds)
    boundsRef.current = nextBounds
    setSlices([])
    const detected = handleDefaultSheetUpload(
      canvas,
      (cells) => {
        setGridDetect((prev) => ({
          ...(prev || {}),
          cells,
          count: cells.length,
          rows: DEFAULT_SHEET_ROWS,
          cols: DEFAULT_SHEET_COLS,
        }))
      },
      (text) => {
        setNote(`💡 ${text} 감지 완료 (카카오 ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} 규격)`)
      },
    )
    bindDetectedGrid(detected, canvas)
    const nextVertical = equalSplitGuides(DEFAULT_SHEET_COLS, nextBounds.left, nextBounds.right)
    const nextHorizontal = equalSplitGuides(DEFAULT_SHEET_ROWS, nextBounds.top, nextBounds.bottom)
    setCols(DEFAULT_SHEET_COLS)
    setRows(DEFAULT_SHEET_ROWS)
    colsRef.current = DEFAULT_SHEET_COLS
    rowsRef.current = DEFAULT_SHEET_ROWS
    setVerticalGuides(nextVertical)
    setHorizontalGuides(nextHorizontal)
    vGuidesRef.current = nextVertical
    hGuidesRef.current = nextHorizontal
    await runModeASmartDetection(canvas, {
      nextCols: DEFAULT_SHEET_COLS,
      nextRows: DEFAULT_SHEET_ROWS,
      nextVertical,
      nextHorizontal,
      nextBounds,
    })
  }

  const handleFile = async (file) => {
    if (!isAcceptedSheetFile(file)) {
      setNote('이미지 파일만 올릴 수 있습니다. PNG·JPG·WebP 모두 가능합니다.')
      return
    }
    setBusy(true)
    setNote('시트를 읽는 중…')
    try {
      const canvas = await fileToSheetCanvas(file)
      sheetRef.current = canvas
      liveSheetMemory.canvas = canvas
      liveSheetMemory.fileName = file.name
      liveSheetMemory.url = canvas.toDataURL('image/png')
      setFileName(file.name)
      setSheetUrl(liveSheetMemory.url)
      setLightboxIndex(-1)
      await triggerAfterSheetLoad(canvas)
    } catch (error) {
      setNote(error.message || '시트를 읽지 못했습니다.')
      setBusy(false)
    }
  }

  const reSlice = (patch = {}) => {
    const crop = boundsRef.current
    if (patch.mode) setMode(patch.mode)
    if (patch.cols != null) {
      setCols(patch.cols)
      const nextVertical = equalSplitGuides(patch.cols, crop.left, crop.right)
      setVerticalGuides(nextVertical)
      vGuidesRef.current = nextVertical
      patch.nextVertical = nextVertical
      patch.nextCols = patch.cols
    }
    if (patch.rows != null) {
      setRows(patch.rows)
      const nextHorizontal = equalSplitGuides(patch.rows, crop.top, crop.bottom)
      setHorizontalGuides(nextHorizontal)
      hGuidesRef.current = nextHorizontal
      patch.nextHorizontal = nextHorizontal
      patch.nextRows = patch.rows
    }
    if (patch.transparent != null) setTransparent(patch.transparent)
    if (patch.textMode) setTextMode(patch.textMode)
    if (patch.textEngineMode) {
      const nextEngine = normalizeTextEngineMode(patch.textEngineMode)
      setTextEngineMode(nextEngine)
      textEngineModeRef.current = nextEngine
      patch.nextTextEngineMode = nextEngine
      if (nextEngine === TEXT_ENGINE_SMART_RECOLOR && textModeRef.current === 'original') {
        setTextMode('custom')
        textModeRef.current = 'custom'
        patch.nextTextMode = 'custom'
      }
    }
    if (patch.customColor) setCustomColor(patch.customColor)
    if (patch.outline != null) setOutline(patch.outline)
    if (patch.customScale != null) {
      const next = clampSliceScale(patch.customScale)
      setCustomScale(next)
      customScaleRef.current = next
      patch.nextCustomScale = next
    }
    if (patch.textZone != null) {
      const next = clampTextZonePercent(patch.textZone)
      setTextZone(next)
      textZoneRef.current = next
      patch.nextTextZone = next
    }
    if (patch.textZoneAnchor != null) {
      const next = patch.textZoneAnchor === 'top' ? 'top' : TEXT_ZONE_ANCHOR_DEFAULT
      setTextZoneAnchor(next)
      textZoneAnchorRef.current = next
      patch.nextTextZoneAnchor = next
    }
    if (patch.punchHoles != null) {
      setPunchHoles(Boolean(patch.punchHoles))
      punchHolesRef.current = Boolean(patch.punchHoles)
      patch.nextPunchHoles = Boolean(patch.punchHoles)
    }
    if (sheetRef.current) runSlice(patch)
  }

  const applySheetGridPreset = (preset) => {
    if (!preset || !sheetRef.current) return
    reSlice({
      mode: 'grid',
      nextMode: 'grid',
      cols: preset.cols,
      rows: preset.rows,
    })
  }

  const applyScale = (value, immediate = false) => {
    const next = clampSliceScale(value)
    setCustomScale(next)
    customScaleRef.current = next
    window.clearTimeout(scaleTimer.current)
    if (!sheetRef.current) return
    if (immediate) {
      runSlice({ nextCustomScale: next })
      return
    }
    scaleTimer.current = window.setTimeout(() => {
      runSlice({ nextCustomScale: next })
    }, 40)
  }

  const applyTextZone = (value, immediate = false) => {
    const next = clampTextZonePercent(value)
    setTextZone(next)
    textZoneRef.current = next
    window.clearTimeout(zoneTimer.current)
    if (!sheetRef.current) return
    if (immediate) {
      runSlice({ nextTextZone: next })
      return
    }
    zoneTimer.current = window.setTimeout(() => {
      runSlice({ nextTextZone: next })
    }, 40)
  }

  const startSideResize = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const pointerId = event.pointerId
    const originX = event.clientX
    const originW = sideWidthRef.current
    setSideResizing(true)
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const next = clampEmoSideWidth(originW + (moveEvent.clientX - originX))
      sideWidthRef.current = next
      setSideWidth(next)
    }
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setSideResizing(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const commitGuides = () => {
    const crop = boundsRef.current
    const v = vGuidesRef.current.filter((item) => item > crop.left + 0.01 && item < crop.right - 0.01)
    const h = hGuidesRef.current.filter((item) => item > crop.top + 0.01 && item < crop.bottom - 0.01)
    if (v.length !== vGuidesRef.current.length) {
      setVerticalGuides(v)
      vGuidesRef.current = v
    }
    if (h.length !== hGuidesRef.current.length) {
      setHorizontalGuides(h)
      hGuidesRef.current = h
    }
    setCols(vGuidesRef.current.length + 1)
    setRows(hGuidesRef.current.length + 1)
    colsRef.current = vGuidesRef.current.length + 1
    rowsRef.current = hGuidesRef.current.length + 1
    if (sheetRef.current) runSlice({ nextMode: modeRef.current })
  }

  const addLine = (axis) => {
    const crop = boundsRef.current
    if (axis === 'v') {
      const next = insertGuide(vGuidesRef.current, crop.left, crop.right)
      setVerticalGuides(next)
      vGuidesRef.current = next
      setCols(next.length + 1)
    } else {
      const next = insertGuide(hGuidesRef.current, crop.top, crop.bottom)
      setHorizontalGuides(next)
      hGuidesRef.current = next
      setRows(next.length + 1)
    }
    commitGuides()
  }

  const deleteLine = (axis, index, event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (axis === 'v') {
      if (vGuidesRef.current.length <= 1) return
      const next = removeGuide(vGuidesRef.current, index)
      setVerticalGuides(next)
      vGuidesRef.current = next
    } else {
      if (hGuidesRef.current.length <= 1) return
      const next = removeGuide(hGuidesRef.current, index)
      setHorizontalGuides(next)
      hGuidesRef.current = next
    }
    commitGuides()
  }

  const ratioFromEvent = (axis, event) => {
    const board = stageRef.current?.querySelector('.emo-sheet-preview') || stageRef.current
    if (!board) return 0
    const rect = board.getBoundingClientRect()
    const value = axis === 'v' || axis === 'left' || axis === 'right'
      ? (event.clientX - rect.left) / Math.max(1, rect.width)
      : (event.clientY - rect.top) / Math.max(1, rect.height)
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
  }

  const startGuideDrag = (kind, key, event) => {
    if (event.target?.closest?.('.emo-guide-del')) return
    event.preventDefault()
    event.stopPropagation()
    const pointerId = event.pointerId
    dragRef.current = { kind, key, pointerId }
    setActiveGuide({ kind, key })
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const ratio = ratioFromEvent(kind === 'bound' ? key : kind, moveEvent)
      const crop = boundsRef.current
      if (kind === 'v') {
        setVerticalGuides((prev) => {
          const next = moveGuide(prev, key, ratio, 0.028, crop.left, crop.right)
          vGuidesRef.current = next
          return next
        })
        return
      }
      if (kind === 'h') {
        setHorizontalGuides((prev) => {
          const next = moveGuide(prev, key, ratio, 0.028, crop.top, crop.bottom)
          hGuidesRef.current = next
          return next
        })
        return
      }
      setBounds((prev) => {
        const crop = { ...prev }
        if (key === 'left') crop.left = ratio
        if (key === 'right') crop.right = ratio
        if (key === 'top') crop.top = ratio
        if (key === 'bottom') crop.bottom = ratio
        const next = normalizeBounds(crop)
        boundsRef.current = next
        return next
      })
    }
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      dragRef.current = null
      setActiveGuide(null)
      commitGuides()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const startPan = (event) => {
    if (event.target?.closest?.('.emo-guide, .emo-zoom-bar, button, input, label')) return
    event.preventDefault()
    const pointerId = event.pointerId
    const origin = { x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y }
    setPanning(true)
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const next = {
        x: origin.panX + (moveEvent.clientX - origin.x),
        y: origin.panY + (moveEvent.clientY - origin.y),
      }
      panRef.current = next
      setPan(next)
    }
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setPanning(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const downloadOne = async (item) => {
    const blob = await canvasToPngBlob(item.canvas)
    saveAs(blob, item.name)
  }

  const refreshPurgedSlices = () => {
    const next = slices.map((item) => {
      if (item?.canvas) purgeFakeBackground(item.canvas)
      return item?.canvas ? { ...item, preview: item.canvas.toDataURL('image/png') } : item
    })
    setSlices(next)
    publishEmoticonCuts(next)
    return next
  }

  const purgeBackgrounds = () => {
    if (!slices.length) return
    refreshPurgedSlices()
    setNote('✨ 배경이 완벽하게 투명화되었습니다!')
  }

  const downloadZip = async () => {
    if (!slices.length) return
    await alphaGate.runOrAsk(slices.map((item) => item.canvas).filter(Boolean), async ({ purged }) => {
      if (purged) refreshPurgedSlices()
      await packZip()
    })
  }

  const packZip = async () => {
    if (!slices.length) return
    setBusy(true)
    setNote('카카오 360×360 PNG를 ZIP으로 묶는 중…')
    try {
      const zip = new JSZip()
      const folder = zip.folder('kakao-emoticons-360')
      const nextPreviews = []
      for (const item of slices) {
        const preview = item.canvas.toDataURL('image/png')
        nextPreviews.push({ ...item, preview })
        const blob = await canvasToPngBlob(item.canvas)
        folder.file(item.name, blob)
      }
      setSlices(nextPreviews)
      const packed = await zip.generateAsync({ type: 'blob' })
      saveAs(packed, 'kakao-emoticons-360.zip')
      setNote(`${slices.length}개를 kakao-emoticons-360.zip 으로 저장했습니다.`)
    } catch (error) {
      setNote(error.message || 'ZIP 만들기에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const copySliceDiagnostics = async () => {
    try {
      const sliceReport = buildDiagnosticReport(slices, {
        mode: modeRef.current,
        textMode: textModeRef.current,
        outline: outlineRef.current,
        customScale: customScaleRef.current,
        textZonePercent: textZoneRef.current,
        textZoneAnchor: textZoneAnchorRef.current,
        punchHoles: punchHolesRef.current,
        transparent: transparentRef.current,
        previewZoomPercent: Math.round(zoomRef.current * 100),
      })
      const lossless = Boolean(slices[0]?.lossless)
      const report = mergeDiagnosticReport(sliceReport, evaluateSystemDiagnostics('ALL', {
        sheet: sheetRef.current,
        isTransparent: sheetRef.current ? sniffCanvasHasAlpha(sheetRef.current) : (lossless || null),
        lossless,
        cellCount: slices.length,
        hasZip: typeof JSZip === 'function',
      }))
      await copyDiagnosticLog(report)
      setLogCopied(true)
      window.setTimeout(() => setLogCopied(false), 2200)
      setNote('전사 진단 리포트가 복사되었습니다')
    } catch (error) {
      setNote(error.message || '진단 로그를 복사하지 못했습니다.')
    }
  }

  const dismissPngGuide = (hideToday = false) => {
    if (hideToday) hidePngGuideToday()
    setShowTransparencyGuideModal(false)
  }

  const requestSheetPick = () => {
    if (showTransparencyGuideModal && !isPngGuideHiddenToday()) return
    inputRef.current?.click()
  }

  if (!open) return null

  const smartOn = textEngineMode === TEXT_ENGINE_SMART_RECOLOR

  return (
    <div className="studio-modal-root emo-split-root" role="dialog" aria-modal="true" aria-labelledby="emo-split-title">
      <div className="studio-modal-backdrop" onClick={onClose} />
      <div className="studio-modal-card emo-split-card">
        {logCopied ? (
          <div className="emo-debug-toast" role="status">전사 진단 리포트가 복사되었습니다</div>
        ) : null}
        <header className="emo-split-head">
          <h2 id="emo-split-title">🧩 이모티콘 시트 분할기</h2>
          <div className="emo-enhance-bar">
            <div className="emo-engine-toggle" role="group" aria-label="텍스트 엔진">
              {TEXT_ENGINE_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-text-engine={item.id}
                  className={clsx('emo-enhance-btn', textEngineMode === item.id && 'is-on')}
                  disabled={busy && !slices.length}
                  onClick={() => reSlice({ textEngineMode: item.id, nextTextEngineMode: item.id })}
                  {...magnify(item.label, item.tooltip)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {smartOn ? (
              <>
            <label
              className="emo-zone-ctrl"
              {...magnify('텍스트 감지 높이', '하단이면 이미지 아래쪽부터, 상단이면 위쪽부터의 높이입니다. 이 영역 안의 글자만 색을 바꿉니다. 캐릭터 몸통이 걸리면 값을 낮추세요.')}
            >
              <span>↕ 텍스트 감지 높이: {textZone}% · {textZoneAnchor === 'top' ? '상단' : '하단'}</span>
              <input
                type="range"
                min={TEXT_ZONE_MIN}
                max={TEXT_ZONE_MAX}
                step="1"
                value={textZone}
                disabled={busy && !slices.length}
                onChange={(event) => applyTextZone(event.target.value)}
                onPointerUp={() => applyTextZone(textZoneRef.current, true)}
              />
            </label>
            <div className="emo-anchor-toggle" role="group" aria-label="텍스트 감지 위치">
              <button
                type="button"
                className={clsx('emo-enhance-btn', textZoneAnchor === 'bottom' && 'is-on')}
                onClick={() => reSlice({ textZoneAnchor: 'bottom' })}
                {...magnify('하단', '이미지 아래쪽 Y-Limit 안의 글자만 색을 바꿉니다')}
              >
                하단
              </button>
              <button
                type="button"
                className={clsx('emo-enhance-btn', textZoneAnchor === 'top' && 'is-on')}
                onClick={() => reSlice({ textZoneAnchor: 'top' })}
                {...magnify('상단', '이미지 위쪽부터 설정 높이까지 글자만 색을 바꿉니다')}
              >
                상단
              </button>
            </div>
            <div className="emo-enhance-modes">
              {TEXT_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx('emo-enhance-btn', textMode === item.id && 'is-on')}
                  onClick={() => reSlice({ textMode: item.id, nextTextMode: item.id })}
                  {...magnify(item.label, item.hint)}
                >
                  {item.label}
                </button>
              ))}
              {textMode === 'custom' ? (
                <label className="emo-color-pick" {...magnify('커스텀 텍스트 색', '하단 ROI 글자만 이 색으로 바꿉니다')}>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(event) => reSlice({ customColor: event.target.value, nextCustomColor: event.target.value })}
                  />
                </label>
              ) : null}
            </div>
            <label className="emo-check emo-check-inline" {...magnify('외곽선 보강', '텍스트 감지 영역 글자 알파 엣지에만 1px 스트로크를 칩니다')}>
              <input
                type="checkbox"
                checked={outline}
                onChange={(event) => reSlice({ outline: event.target.checked, nextOutline: event.target.checked })}
              />
              Outline
            </label>
              </>
            ) : null}
            <label className="emo-check emo-check-inline" {...magnify('안쪽 구멍 투명화', '글자/도형 안쪽 구멍까지 투명화합니다. 꺼 두면 외곽만 지워 하이라이트를 보호합니다.')}>
              <input
                type="checkbox"
                checked={punchHoles}
                disabled={!transparent}
                onChange={(event) => reSlice({ punchHoles: event.target.checked })}
              />
              안쪽 구멍 투명화
            </label>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기" data-tooltip="분할기 창을 닫습니다">
            ✕ 닫기
          </button>
        </header>

        <div className="emo-split-toolbar">
          <div className="emo-scale-ctrl">
            <span>🔍 이모티콘 크기 비율: {customScale}%</span>
            <button
              type="button"
              className="emo-scale-step"
              disabled={customScale <= SLICE_SCALE_MIN}
              onClick={() => applyScale(customScale - 1, true)}
              {...magnify('-1% 축소', '렌더 배율을 1% 줄여 여백을 늘립니다')}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <input
              type="range"
              min={SLICE_SCALE_MIN}
              max={SLICE_SCALE_MAX}
              step="1"
              value={customScale}
              disabled={busy && !slices.length}
              onChange={(event) => applyScale(event.target.value)}
              onPointerUp={() => applyScale(customScaleRef.current, true)}
              {...magnify('이모티콘 크기 비율', '360×360 안에서 캐릭터 렌더 크기만 50~150%로 조절합니다. 감지는 그대로입니다.')}
            />
            <button
              type="button"
              className="emo-scale-step"
              disabled={customScale >= SLICE_SCALE_MAX}
              onClick={() => applyScale(customScale + 1, true)}
              {...magnify('+1% 확대', '렌더 배율을 1% 키웁니다')}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            className="emo-scale-reset"
            disabled={customScale === SLICE_SCALE_DEFAULT}
            onClick={() => applyScale(SLICE_SCALE_DEFAULT, true)}
            {...magnify('크기 비율 리셋', '렌더 배율을 100%로 되돌립니다')}
          >
            <RotateCcw className="h-3.5 w-3.5" /> 리셋
          </button>
          <button
            type="button"
            className="emo-debug-btn"
            disabled={busy}
            onClick={copySliceDiagnostics}
            {...magnify('진단 로그 복사', '3대 모듈 Pass/Info/Warn 리포트를 클립보드에 복사합니다')}
          >
            {logCopied ? '복사됨' : '📋 진단 로그 복사'}
          </button>
        </div>

        <div
          className={clsx('emo-split-body', sideResizing && 'is-resizing')}
          style={{ '--emo-side-width': `${sideWidth}px` }}
        >
          <aside className="emo-split-side">
            <p className="emo-split-note" data-purge-toast={String(note).includes('완벽하게 투명화') ? '1' : '0'}>{busy ? '처리 중…' : note}</p>
            <div
              className={clsx('emo-drop', dragOver && 'is-over')}
              onClick={(event) => {
                if (event.target.closest('button, input')) return
                requestSheetPick()
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(false)
                handleFile(event.dataTransfer.files?.[0])
              }}
              {...magnify('시트 올리기', PNG_GUIDE_BODY)}
            >
              <Upload className="h-4 w-4" />
              <div>
                <strong>시트 올리기</strong>
                <p>{fileName || 'PNG·JPG·WebP'}</p>
              </div>
              <button
                type="button"
                className="mini-btn"
                onClick={requestSheetPick}
                {...magnify('파일 선택', PNG_GUIDE_FOOT)}
              >
                파일
              </button>
              <input
                ref={inputRef}
                type="file"
                accept={SHEET_ACCEPT}
                hidden
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>
            <p className="emo-drop-guide" data-sheet-guide="1">
              💡 4행 × 5열 (20개) 투명 PNG 시트를 기본 규격으로 권장합니다. 흰색 배경과 다른 비율도 제한 없이 올릴 수 있습니다.
            </p>

            <div className="emo-modes">
              <button
                type="button"
                className={clsx('emo-mode', mode === 'smart' && 'is-on')}
                disabled={busy}
                onClick={() => reSlice({ mode: 'smart', nextMode: 'smart' })}
                {...magnify('스마트 자동 감지', '행·열 투영 프로파일로 시트 칸을 자동으로 나눕니다. 캐릭터와 하단 글자는 한 컷으로 묶습니다.')}
              >
                자동 28구 분할
              </button>
              <button
                type="button"
                className={clsx('emo-mode', mode === 'grid' && 'is-on')}
                disabled={busy}
                onClick={() => reSlice({
                  mode: 'grid',
                  nextMode: 'grid',
                  nextCols: colsRef.current,
                  nextRows: rowsRef.current,
                  nextVertical: vGuidesRef.current,
                  nextHorizontal: hGuidesRef.current,
                })}
                {...magnify('그리드 분할', '모드 A가 잡은 행·열 선을 드래그해 미세 조정합니다.')}
              >
                모드 B
              </button>
            </div>
            <button
              type="button"
              className="emo-mode allow-long-text"
              data-purge-bg="1"
              disabled={busy || !slices.length}
              onClick={purgeBackgrounds}
              {...magnify('배경 투명화 확인사살', '가짜 흰/회색 격자 타일을 외곽부터 지워 진짜 투명 배경으로 바꿉니다.')}
            >
              🔪 배경 투명화 확인사살
            </button>
            <div className="emo-presets" data-sheet-presets="1">
              {SHEET_GRID_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={clsx(
                    'emo-preset',
                    gridDetect?.rows === preset.rows && gridDetect?.cols === preset.cols && 'is-on',
                  )}
                  disabled={busy || !sheetUrl}
                  onClick={() => applySheetGridPreset(preset)}
                  {...magnify(preset.label, preset.hint)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {gridDetect?.count ? (
              <p
                className="emo-grid-detect"
                data-grid-detect={`${gridDetect.rows}x${gridDetect.cols}`}
                {...magnify(
                  formatSmartGridLabel(gridDetect) || '그리드 감지',
                  '투영 프로파일로 행과 열을 나눴습니다. 모드 B에서 절단선을 미세 조정할 수 있습니다.',
                )}
              >
                💡 {formatSmartGridLabel(gridDetect)} 감지 완료
              </p>
            ) : null}

            {mode === 'grid' ? (
              <>
                <div className="emo-grid-ctrls">
                  <label>
                    가로 {verticalGuides.length + 1}열
                    <input type="range" min="2" max="12" value={Math.min(12, Math.max(2, verticalGuides.length + 1))} disabled={busy} onChange={(event) => reSlice({ cols: Number(event.target.value) })} />
                  </label>
                  <label>
                    세로 {horizontalGuides.length + 1}행
                    <input type="range" min="2" max="12" value={Math.min(12, Math.max(2, horizontalGuides.length + 1))} disabled={busy} onChange={(event) => reSlice({ rows: Number(event.target.value) })} />
                  </label>
                  <span className="emo-grid-total">{cellCount}칸</span>
                </div>
                <div className="emo-line-actions">
                  <button type="button" className="mini-btn" disabled={busy || verticalGuides.length >= 11} onClick={() => addLine('v')} {...magnify('세로선 추가', '가장 넓은 칸 가운데에 세로 절단선을 넣습니다')}>+ 세로선</button>
                  <button type="button" className="mini-btn" disabled={busy || horizontalGuides.length >= 11} onClick={() => addLine('h')} {...magnify('가로선 추가', '가장 넓은 칸 가운데에 가로 절단선을 넣습니다')}>+ 가로선</button>
                </div>
              </>
            ) : (
              <p className="emo-guide-hint">💡 시트 여백을 자동 정돈하여 개별 이모티콘 컷을 추출합니다.</p>
            )}

            <label className="emo-check" {...magnify('자동 배경 투명화', '단색/흰색 배경을 자동으로 제거합니다. 눈·옷 안쪽 흰색은 남습니다.')}>
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => reSlice({ transparent: event.target.checked, nextTransparent: event.target.checked })}
              />
              자동 배경 투명화
            </label>
            <label className="emo-check" {...magnify('안쪽 구멍 투명화', '글자/도형 안쪽 구멍까지 투명화합니다. 꺼 두면 외곽만 지워 하이라이트를 보호합니다.')}>
              <input
                type="checkbox"
                checked={punchHoles}
                disabled={!transparent}
                onChange={(event) => reSlice({ punchHoles: event.target.checked })}
              />
              안쪽 구멍 투명화
            </label>

            <div className="emo-actions">
              <button type="button" className="export-btn export-btn-png allow-long-text" disabled={busy || !slices.length} onClick={downloadZip} {...magnify(`${slices.length}종 ZIP`, `감지된 ${slices.length}컷을 360×360 PNG ZIP으로 받습니다`)}>
                <Download className="h-4 w-4" /> 📦 {slices.length}종 ZIP
              </button>
              <button type="button" className="mini-btn" disabled={busy} onClick={reset} {...magnify('시트 비우기', '올린 시트와 분할 결과를 지웁니다')}>비우기</button>
            </div>

            {slices.length ? (
              <ul className={clsx('emo-thumbs', `is-bg-${viewBg}`)}>
                {slices.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="emo-thumb-open"
                      onClick={() => setLightboxIndex(item.index)}
                      aria-label="확대"
                      {...magnify('확대', `${item.index + 1}번 컷을 크게 봅니다`)}
                    >
                      <HqCutThumb canvas={item.canvas} alt={item.name} />
                    </button>
                    <button type="button" className="emo-thumb-dl" onClick={() => downloadOne(item)} {...magnify(`${item.index + 1}번 PNG`, '이 칸만 360×360 PNG로 저장합니다')}>{item.index + 1}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <SplitEmptyState />
            )}
          </aside>

          <div
            className={clsx('emo-split-resizer', sideResizing && 'is-on')}
            role="separator"
            aria-orientation="vertical"
            aria-label="작업창 너비 조절"
            aria-valuemin={EMO_SIDE_MIN}
            aria-valuemax={EMO_SIDE_MAX}
            aria-valuenow={sideWidth}
            onPointerDown={startSideResize}
            onDoubleClick={() => {
              setSideWidth(EMO_SIDE_DEFAULT)
              sideWidthRef.current = EMO_SIDE_DEFAULT
            }}
            {...magnify('작업창 너비 조절', '드래그로 왼쪽 패널 폭을 280~600px로 바꿉니다. 더블클릭하면 380px로 돌아갑니다')}
          />

          <section className="emo-slicer-workspace">
            <div className="emo-zoom-bar">
              <button type="button" className="emo-zoom-btn" disabled={!sheetUrl || Math.round(zoom * 100) <= PREVIEW_ZOOM_MIN} onClick={() => bumpZoom(-PREVIEW_ZOOM_STEP)} {...magnify('축소', '미리보기를 5% 줄입니다 (10~200%)')}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="emo-zoom-btn emo-zoom-label" disabled={!sheetUrl} onClick={resetView} {...magnify(`${PREVIEW_ZOOM_DEFAULT}%`, `미리보기를 기본 ${PREVIEW_ZOOM_DEFAULT}%로 되돌립니다`)}>
                {zoomLabel}
              </button>
              <button type="button" className="emo-zoom-btn" disabled={!sheetUrl || Math.round(zoom * 100) >= PREVIEW_ZOOM_MAX} onClick={() => bumpZoom(PREVIEW_ZOOM_STEP)} {...magnify('확대', '미리보기를 5% 키웁니다 (10~200%)')}>
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="emo-zoom-btn" disabled={!sheetUrl} onClick={fitZoom} {...magnify('화면맞춤', `미리보기를 기본 ${PREVIEW_ZOOM_DEFAULT}%로 맞춰 시트 전체가 보이게 합니다`)}>
                <Maximize2 className="h-3.5 w-3.5" /> ⛶
              </button>
              <button
                type="button"
                className="emo-zoom-btn emo-bg-mode"
                onClick={() => {
                  const next = cycleViewBgMode(viewBgRef.current)
                  setViewBg(next)
                  viewBgRef.current = next
                }}
                {...magnify('배경 모드', '체커보드 → 다크 → 라이트 순으로 바꿔 투명 누끼와 외곽선 대비를 확인합니다')}
              >
                {VIEW_BG_LABELS[viewBg] || VIEW_BG_LABELS.checker}
              </button>
            </div>
            <div
              ref={viewportRef}
              className={clsx('emo-slicer-viewport', `is-bg-${viewBg}`, panning && 'is-panning', !sheetUrl && 'is-empty')}
              onPointerDown={startPan}
            >
              {sheetUrl ? (
                <div
                  className="emo-slicer-pan"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                >
                  <div
                    ref={stageRef}
                    className={clsx('emo-slicer-stage', 'is-grid')}
                    data-emo-slicer="mode-b"
                  >
                    <img
                      src={sheetUrl}
                      alt="업로드한 이모티콘 시트"
                      className="emo-sheet-preview"
                      draggable={false}
                      onLoad={onSheetPreviewLoad}
                    />
                    {mode === 'smart' && sheetRef.current && slices.map((item) => {
                      const box = item.box
                      const sw = sheetRef.current.width || 1
                      const sh = sheetRef.current.height || 1
                      if (!box) return null
                      return (
                        <div
                          key={`smart-box-${item.id}`}
                          className="emo-smart-box"
                          style={{
                            left: `${(box.x / sw) * 100}%`,
                            top: `${(box.y / sh) * 100}%`,
                            width: `${(box.w / sw) * 100}%`,
                            height: `${(box.h / sh) * 100}%`,
                          }}
                        />
                      )
                    })}
                    {['left', 'right', 'top', 'bottom'].map((edge) => (
                      <div
                        key={edge}
                        className={clsx(
                          'emo-guide is-bound',
                          `is-${edge === 'left' || edge === 'right' ? 'v' : 'h'}`,
                          `is-${edge}`,
                          activeGuide?.kind === 'bound' && activeGuide.key === edge && 'is-on',
                        )}
                        style={edge === 'left' || edge === 'right'
                          ? { left: `${bounds[edge] * 100}%` }
                          : { top: `${bounds[edge] * 100}%` }}
                        role="slider"
                        aria-label={`외곽 재단선 ${edge}`}
                        onPointerDown={(event) => startGuideDrag('bound', edge, event)}
                      />
                    ))}
                    {mode === 'grid' ? (
                      <>
                        {verticalGuides.map((ratio, index) => (
                          <div
                            key={`v-${index}`}
                            className={clsx('emo-guide is-v', activeGuide?.kind === 'v' && activeGuide.key === index && 'is-on')}
                            style={{ left: `${ratio * 100}%` }}
                            role="slider"
                            aria-label={`세로 절단선 ${index + 1}`}
                            onPointerDown={(event) => startGuideDrag('v', index, event)}
                            onContextMenu={(event) => deleteLine('v', index, event)}
                          >
                            <button type="button" className="emo-guide-del" aria-label="세로선 삭제" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }} onClick={(event) => deleteLine('v', index, event)}>✖</button>
                          </div>
                        ))}
                        {horizontalGuides.map((ratio, index) => (
                          <div
                            key={`h-${index}`}
                            className={clsx('emo-guide is-h', activeGuide?.kind === 'h' && activeGuide.key === index && 'is-on')}
                            style={{ top: `${ratio * 100}%` }}
                            role="slider"
                            aria-label={`가로 절단선 ${index + 1}`}
                            onPointerDown={(event) => startGuideDrag('h', index, event)}
                            onContextMenu={(event) => deleteLine('h', index, event)}
                          >
                            <button type="button" className="emo-guide-del is-h-del" aria-label="가로선 삭제" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }} onClick={(event) => deleteLine('h', index, event)}>✖</button>
                          </div>
                        ))}
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="emo-slicer-empty">시트를 올리면 오른쪽 캔버스에서 절단선을 맞출 수 있습니다.</p>
              )}
            </div>
          </section>
        </div>
      </div>
      <PreviewLightboxModal
        open={lightboxIndex >= 0}
        slices={slices}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(-1)}
        onIndexChange={setLightboxIndex}
      />
      <TransparencyGuideModal
        open={showTransparencyGuideModal}
        onContinue={() => dismissPngGuide(false)}
        onHideToday={() => dismissPngGuide(true)}
      />
      <TransparencyCheckModal
        open={alphaGate.open}
        onPurgeAndExport={alphaGate.confirmPurge}
        onExportAsIs={alphaGate.confirmAsIs}
        onCancel={alphaGate.cancel}
      />
    </div>
  )
}
