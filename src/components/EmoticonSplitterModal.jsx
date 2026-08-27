import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Download, Maximize2, Minus, Plus, RotateCcw, Upload, X, Bug } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { magnify } from './MenuMagnifierHUD.jsx'
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
  stepPreviewZoomPercent,
  cycleViewBgMode,
} from '../lib/emoticonSplit.js'
import { buildDiagnosticReport, copyDiagnosticLog, publishInspectorHud } from '../utils/debugger.js'
import { publishEmoticonCuts } from './MotionGifStudio/cutSnapshot.js'

const TEXT_MODES = [
  { id: 'original', label: '원본 유지', hint: '텍스트 감지 영역과 캐릭터 색을 모두 그대로 둡니다' },
  { id: 'black', label: '고대비 블랙 강화', hint: '텍스트 감지 영역 안의 글자만 검게 살리고 캐릭터 본체는 건드리지 않습니다' },
  { id: 'white', label: '선명한 화이트', hint: '텍스트 감지 영역 안의 글자만 흰색으로 바꾸고 캐릭터 본체는 보존합니다' },
  { id: 'custom', label: '커스텀 색상', hint: '텍스트 감지 영역 안의 글자 클러스터만 고른 색으로 치환합니다' },
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
  const vGuidesRef = useRef(verticalGuides)
  const hGuidesRef = useRef(horizontalGuides)
  const boundsRef = useRef(bounds)
  const colsRef = useRef(cols)
  const rowsRef = useRef(rows)
  const modeRef = useRef(mode)
  const transparentRef = useRef(transparent)
  const textModeRef = useRef(textMode)
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
    setSlices([])
    publishEmoticonCuts([])
    setSheetUrl('')
    setFileName('')
    sheetRef.current = null
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
    setViewBg(VIEW_BG_DEFAULT)
    viewBgRef.current = VIEW_BG_DEFAULT
    publishInspectorHud({ status: 'idle', suspectCount: 0, sliceCount: 0 })
    setNote('AI가 만든 스티커 시트(흰 배경 그리드)를 올리면 360×360 PNG로 나눕니다.')
  }

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
        customColor: patch.nextCustomColor ?? customColorRef.current,
        outline: patch.nextOutline ?? outlineRef.current,
        customScale: patch.nextCustomScale ?? customScaleRef.current,
        textZonePercent: patch.nextTextZone ?? textZoneRef.current,
        textZoneAnchor: patch.nextTextZoneAnchor ?? textZoneAnchorRef.current,
        punchHoles: patch.nextPunchHoles ?? punchHolesRef.current,
      })
      if (gen !== sliceGen.current) return
      setSlices(next)
      publishEmoticonCuts(next)
      const suspects = next.filter((item) => item.diagnostics?.suspects?.length).length
      publishInspectorHud({
        status: next.length ? (suspects ? 'warn' : 'ok') : 'idle',
        suspectCount: suspects,
        sliceCount: next.length,
      })
      setNote(next.length
        ? `${next.length}개로 나눴습니다. 카카오 규격 ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} · Crop→Flood T18→획치환${suspects ? ` · 진단 의심 ${suspects}칸` : ''}.`
        : '객체를 찾지 못했습니다. 외곽 재단선과 모드 B 절단선을 맞춰 보세요.')
    } catch (error) {
      if (gen !== sliceGen.current) return
      setNote(error.message || '분할에 실패했습니다.')
      setSlices([])
      publishEmoticonCuts([])
      publishInspectorHud({ status: 'idle', suspectCount: 0, sliceCount: 0 })
    } finally {
      if (gen === sliceGen.current) setBusy(false)
    }
  }, [])

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

  const runModeASmartDetection = (source, patch = {}) => {
    setMode('smart')
    modeRef.current = 'smart'
    return runSlice({
      ...patch,
      source,
      nextMode: 'smart',
    })
  }

  const triggerAfterSheetLoad = async (canvas) => {
    applyPreviewZoomPercent(35)
    const nextBounds = DEFAULT_CROP_BOUNDS
    setBounds(nextBounds)
    boundsRef.current = nextBounds
    const { nextVertical, nextHorizontal } = initModeBGuides()
    await runModeASmartDetection(canvas, {
      nextBounds,
      nextVertical,
      nextHorizontal,
    })
  }

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setNote('이미지 파일만 올릴 수 있습니다.')
      return
    }
    setBusy(true)
    setNote('시트를 읽는 중…')
    try {
      const canvas = await fileToSheetCanvas(file)
      sheetRef.current = canvas
      setFileName(file.name)
      setSheetUrl(canvas.toDataURL('image/png'))
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

  const downloadZip = async () => {
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
    if (!slices.length) return
    try {
      const report = buildDiagnosticReport(slices, {
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
      await copyDiagnosticLog(report)
      setLogCopied(true)
      window.setTimeout(() => setLogCopied(false), 2200)
      setNote('진단 로그가 클립보드에 복사되었습니다!')
    } catch (error) {
      setNote(error.message || '진단 로그를 복사하지 못했습니다.')
    }
  }

  if (!open) return null

  return (
    <div className="studio-modal-root" role="dialog" aria-modal="true" aria-labelledby="emo-split-title">
      <div className="studio-modal-backdrop" onClick={onClose} />
      <div className="studio-modal-card emo-split-card">
        {logCopied ? (
          <div className="emo-debug-toast" role="status">진단 로그가 클립보드에 복사되었습니다!</div>
        ) : null}
        <header className="emo-split-head">
          <h2 id="emo-split-title">🧩 이모티콘 시트 분할기</h2>
          <div className="emo-enhance-bar">
            <p className="emo-enhance-kicker">텍스트 가독성 보정</p>
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
                <label className="emo-color-pick" {...magnify('커스텀 텍스트 색', '감지 영역 글자 클러스터만 이 색으로 바꿉니다')}>
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
            <label className="emo-check emo-check-inline" {...magnify('내부 고립 구멍 투명화', '꺼 두면 외곽 Flood-Fill만 적용합니다. 켜면 닫힌 배경 구멍까지 Alpha=0으로 확장합니다')}>
              <input
                type="checkbox"
                checked={punchHoles}
                disabled={!transparent}
                onChange={(event) => reSlice({ punchHoles: event.target.checked })}
              />
              내부 고립 구멍 투명화
            </label>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기" {...magnify('닫기', '분할기 창을 닫습니다')}>
            <X className="h-4 w-4" />
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
            disabled={!slices.length || busy}
            onClick={copySliceDiagnostics}
            {...magnify('진단 로그', '슬라이스 좌표·알파·흰 패치·인접 행 침범을 JSON으로 복사하고 콘솔 테이블을 출력합니다')}
          >
            <Bug className="h-3.5 w-3.5" /> {logCopied ? '복사됨' : '🐞 진단 로그'}
          </button>
        </div>

        <div
          className={clsx('emo-split-body', sideResizing && 'is-resizing')}
          style={{ '--emo-side-width': `${sideWidth}px` }}
        >
          <aside className="emo-split-side">
            <p className="emo-split-note">{busy ? '처리 중…' : note}</p>
            <div
              className={clsx('emo-drop', dragOver && 'is-over')}
              onClick={(event) => {
                if (event.target.closest('button, input')) return
                inputRef.current?.click()
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
              {...magnify('시트 업로드', 'AI가 만든 이모티콘 시트 PNG/JPEG를 올립니다')}
            >
              <Upload className="h-4 w-4" />
              <div>
                <strong>시트 올리기</strong>
                <p>{fileName || '흰 배경 5×6 / 6×5 그리드'}</p>
              </div>
              <button
                type="button"
                className="mini-btn"
                onClick={() => inputRef.current?.click()}
                {...magnify('시트 이미지 선택', 'AI가 만든 이모티콘 시트 PNG/JPEG를 고릅니다')}
              >
                파일
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>

            <div className="emo-modes">
              <button
                type="button"
                className={clsx('emo-mode', mode === 'smart' && 'is-on')}
                disabled={busy}
                onClick={() => reSlice({ mode: 'smart', nextMode: 'smart' })}
                {...magnify('스마트 자동 감지', '배경을 빼고 각 이모티콘 외곽 상자를 찾아 자릅니다')}
              >
                모드 A
              </button>
              <button
                type="button"
                className={clsx('emo-mode', mode === 'grid' && 'is-on')}
                disabled={busy}
                onClick={() => reSlice({ mode: 'grid', nextMode: 'grid' })}
                {...magnify('그리드 분할', '1px 절단선과 외곽 재단선을 드래그해 칸을 맞춥니다')}
              >
                모드 B
              </button>
            </div>

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
              <p className="emo-guide-hint">금색 외곽 재단선으로 여백을 자른 뒤 객체를 감지합니다.</p>
            )}

            <label className="emo-check" {...magnify('배경 투명화', '360 모서리에서 플러드필로 바깥 흰/미색만 지웁니다. 눈·옷 안쪽 흰색은 남습니다')}>
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => reSlice({ transparent: event.target.checked, nextTransparent: event.target.checked })}
              />
              배경 투명화 (Alpha PNG)
            </label>
            <label className="emo-check" {...magnify('내부 고립 구멍 투명화', '꺼 두면 외곽만 지워 이마·눈 하이라이트를 보호합니다. 켜면 팔/다리 사이·원형 테두리 안 닫힌 배경 구멍까지 Alpha=0으로 확장합니다')}>
              <input
                type="checkbox"
                checked={punchHoles}
                disabled={!transparent}
                onChange={(event) => reSlice({ punchHoles: event.target.checked })}
              />
              내부 고립 구멍 투명화
            </label>

            <div className="emo-actions">
              <button type="button" className="export-btn export-btn-png" disabled={busy || !slices.length} onClick={downloadZip} {...magnify('전체 ZIP 다운로드', '360×360 PNG를 한 개의 ZIP으로 받습니다')}>
                <Download className="h-4 w-4" /> 📦 전체 ZIP 다운로드
              </button>
              <button type="button" className="mini-btn" disabled={busy} onClick={reset} {...magnify('시트 비우기', '올린 시트와 분할 결과를 지웁니다')}>비우기</button>
            </div>

            {slices.length ? (
              <ul className={clsx('emo-thumbs', `is-bg-${viewBg}`)}>
                {slices.map((item) => (
                  <li key={item.id}>
                    <img src={item.preview} alt={item.name} />
                    <button type="button" onClick={() => downloadOne(item)} {...magnify(`${item.index + 1}번 PNG`, '이 칸만 360×360 PNG로 저장합니다')}>{item.index + 1}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="emo-thumbs-empty">분할 결과가 여기에 30칸 그리드로 쌓입니다.</p>
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
                      onLoad={fitZoom}
                    />
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
    </div>
  )
}
