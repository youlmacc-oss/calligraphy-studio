import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'
import { Download, Upload, X } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { magnify } from './MenuMagnifierHUD.jsx'
import { canvasToPngBlob } from '../lib/exportFormats.js'
import {
  DEFAULT_CROP_BOUNDS,
  KAKAO_STICKER_SIZE,
  equalSplitGuides,
  fileToSheetCanvas,
  insertGuide,
  moveGuide,
  normalizeBounds,
  removeGuide,
  sliceSheet,
} from '../lib/emoticonSplit.js'

const TEXT_MODES = [
  { id: 'original', label: '원본 유지' },
  { id: 'black', label: '고대비 블랙 강화' },
  { id: 'white', label: '선명한 화이트' },
  { id: 'custom', label: '커스텀 색상' },
]

export default function EmoticonSplitterModal({ open, onClose }) {
  const inputRef = useRef(null)
  const stageRef = useRef(null)
  const sheetRef = useRef(null)
  const dragRef = useRef(null)
  const sliceGen = useRef(0)
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
  const [outline, setOutline] = useState(false)
  const [fileName, setFileName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [slices, setSlices] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('AI가 만든 스티커 시트(흰 배경 그리드)를 올리면 360×360 PNG로 나눕니다.')
  const [dragOver, setDragOver] = useState(false)
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

  const cellCount = (verticalGuides.length + 1) * (horizontalGuides.length + 1)

  const reset = () => {
    setSlices([])
    setSheetUrl('')
    setFileName('')
    sheetRef.current = null
    setBounds(DEFAULT_CROP_BOUNDS)
    boundsRef.current = DEFAULT_CROP_BOUNDS
    setVerticalGuides(equalSplitGuides(colsRef.current))
    setHorizontalGuides(equalSplitGuides(rowsRef.current))
    setActiveGuide(null)
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
      })
      if (gen !== sliceGen.current) return
      setSlices(next)
      setNote(next.length
        ? `${next.length}개로 나눴습니다. 카카오 규격 ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} · 슈퍼샘플링 PNG입니다.`
        : '객체를 찾지 못했습니다. 외곽 재단선과 모드 B 절단선을 맞춰 보세요.')
    } catch (error) {
      if (gen !== sliceGen.current) return
      setNote(error.message || '분할에 실패했습니다.')
      setSlices([])
    } finally {
      if (gen === sliceGen.current) setBusy(false)
    }
  }, [])

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
      const nextBounds = DEFAULT_CROP_BOUNDS
      const nextV = equalSplitGuides(colsRef.current)
      const nextH = equalSplitGuides(rowsRef.current)
      setBounds(nextBounds)
      setVerticalGuides(nextV)
      setHorizontalGuides(nextH)
      boundsRef.current = nextBounds
      vGuidesRef.current = nextV
      hGuidesRef.current = nextH
      await runSlice({ source: canvas, nextBounds, nextVertical: nextV, nextHorizontal: nextH })
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
    if (sheetRef.current) runSlice(patch)
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
    const stage = stageRef.current
    if (!stage) return 0
    const rect = stage.getBoundingClientRect()
    return axis === 'v' || axis === 'left' || axis === 'right'
      ? (event.clientX - rect.left) / Math.max(1, rect.width)
      : (event.clientY - rect.top) / Math.max(1, rect.height)
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
      for (const item of slices) {
        const blob = await canvasToPngBlob(item.canvas)
        folder.file(item.name, blob)
      }
      const packed = await zip.generateAsync({ type: 'blob' })
      saveAs(packed, 'kakao-emoticons-360.zip')
      setNote(`${slices.length}개를 kakao-emoticons-360.zip 으로 저장했습니다.`)
    } catch (error) {
      setNote(error.message || 'ZIP 만들기에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="studio-modal-root" role="dialog" aria-modal="true" aria-labelledby="emo-split-title">
      <div className="studio-modal-backdrop" onClick={onClose} />
      <div className="studio-modal-card emo-split-card">
        <div className="studio-modal-head">
          <div>
            <p className="studio-modal-kicker">Kakao 360×360 PNG · Super-sample</p>
            <h2 id="emo-split-title">🧩 이모티콘 시트 분할기</h2>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="emo-split-note">{busy ? '처리 중…' : note}</p>

        <div className="emo-enhance-bar">
          <p className="emo-enhance-kicker">텍스트 가독성 보정</p>
          <div className="emo-enhance-modes">
            {TEXT_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx('emo-enhance-btn', textMode === item.id && 'is-on')}
                onClick={() => reSlice({ textMode: item.id, nextTextMode: item.id })}
              >
                {item.label}
              </button>
            ))}
            {textMode === 'custom' ? (
              <label className="emo-color-pick">
                <input
                  type="color"
                  value={customColor}
                  onChange={(event) => reSlice({ customColor: event.target.value, nextCustomColor: event.target.value })}
                />
              </label>
            ) : null}
          </div>
          <label className="emo-check emo-check-inline">
            <input
              type="checkbox"
              checked={outline}
              onChange={(event) => reSlice({ outline: event.target.checked, nextOutline: event.target.checked })}
            />
            1px 외곽선 보강 (Outline Assist)
          </label>
        </div>

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
        >
          <Upload className="h-5 w-5" />
          <div>
            <strong>시트를 드래그하거나 클릭해서 올리기</strong>
            <p>흰 배경 · 5×6 / 6×5 그리드 시트가 가장 정확합니다</p>
          </div>
          <button
            type="button"
            className="mini-btn"
            onClick={() => inputRef.current?.click()}
            {...magnify('시트 이미지 선택', 'AI가 만든 이모티콘 시트 PNG/JPEG를 고릅니다')}
          >
            파일 선택
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>
        {fileName ? <p className="emo-file">{fileName}</p> : null}

        <div className="emo-modes">
          <button
            type="button"
            className={clsx('emo-mode', mode === 'smart' && 'is-on')}
            disabled={busy}
            onClick={() => reSlice({ mode: 'smart', nextMode: 'smart' })}
            {...magnify('스마트 자동 감지', '배경을 빼고 각 이모티콘 외곽 상자를 찾아 자릅니다')}
          >
            모드 A · 스마트 자동 감지
          </button>
          <button
            type="button"
            className={clsx('emo-mode', mode === 'grid' && 'is-on')}
            disabled={busy}
            onClick={() => reSlice({ mode: 'grid', nextMode: 'grid' })}
            {...magnify('그리드 분할', '1px 절단선과 외곽 재단선을 드래그해 칸을 맞춥니다')}
          >
            모드 B · 그리드 분할
          </button>
        </div>

        {mode === 'grid' ? (
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
        ) : null}

        {mode === 'grid' ? (
          <div className="emo-line-actions">
            <button type="button" className="mini-btn" disabled={busy || verticalGuides.length >= 11} onClick={() => addLine('v')}>+ 세로선 추가</button>
            <button type="button" className="mini-btn" disabled={busy || horizontalGuides.length >= 11} onClick={() => addLine('h')}>+ 가로선 추가</button>
            <p className="emo-guide-hint">금색 외곽선으로 여백을 자르고, 시안/마젠타 1px 선을 드래그하세요. ✖ 또는 우클릭으로 선을 지웁니다.</p>
          </div>
        ) : (
          <p className="emo-guide-hint">금색 외곽 재단선을 드래그하면 시트 여백을 잘라 모드 A 감지 범위가 좁아집니다.</p>
        )}

        <label className="emo-check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(event) => reSlice({ transparent: event.target.checked, nextTransparent: event.target.checked })}
          />
          배경 투명화 (Alpha PNG)
        </label>

        {sheetUrl ? (
          <div className="emo-slicer-wrap">
            <div
              ref={stageRef}
              className={clsx('emo-slicer-stage', 'is-grid')}
              data-emo-slicer="mode-b"
            >
              <img src={sheetUrl} alt="업로드한 이모티콘 시트" className="emo-sheet-preview" draggable={false} />
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
        ) : null}

        <div className="emo-actions">
          <button type="button" className="export-btn export-btn-png" disabled={busy || !slices.length} onClick={downloadZip} {...magnify('전체 ZIP 다운로드', '360×360 PNG를 한 개의 ZIP으로 받습니다')}>
            <Download className="h-4 w-4" /> 📦 전체 ZIP 다운로드 (카카오 규격 360x360)
          </button>
          <button type="button" className="mini-btn" disabled={busy} onClick={reset}>시트 비우기</button>
        </div>

        {slices.length ? (
          <ul className="emo-thumbs">
            {slices.map((item) => (
              <li key={item.id}>
                <img src={item.preview} alt={item.name} />
                <button type="button" onClick={() => downloadOne(item)}>{item.index + 1}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
