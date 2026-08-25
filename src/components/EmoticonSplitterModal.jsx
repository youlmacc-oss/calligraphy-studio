import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'
import { Download, Upload, X } from 'lucide-react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { magnify } from './MenuMagnifierHUD.jsx'
import { canvasToPngBlob } from '../lib/exportFormats.js'
import { KAKAO_STICKER_SIZE, fileToSheetCanvas, sliceSheet } from '../lib/emoticonSplit.js'

export default function EmoticonSplitterModal({ open, onClose }) {
  const inputRef = useRef(null)
  const [mode, setMode] = useState('smart')
  const [cols, setCols] = useState(6)
  const [rows, setRows] = useState(5)
  const [transparent, setTransparent] = useState(true)
  const [fileName, setFileName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [slices, setSlices] = useState([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('AI가 만든 스티커 시트(흰 배경 그리드)를 올리면 360×360 PNG로 나눕니다.')
  const [dragOver, setDragOver] = useState(false)
  const sheetRef = useRef(null)

  const reset = () => {
    setSlices([])
    setSheetUrl('')
    setFileName('')
    sheetRef.current = null
    setNote('AI가 만든 스티커 시트(흰 배경 그리드)를 올리면 360×360 PNG로 나눕니다.')
  }

  const runSlice = useCallback(async (source, nextMode = mode, nextCols = cols, nextRows = rows, nextTransparent = transparent) => {
    if (!source) return
    setBusy(true)
    setNote('시트를 분석해 이모티콘을 나누는 중…')
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 16))
      const next = sliceSheet(source, {
        mode: nextMode,
        cols: nextCols,
        rows: nextRows,
        transparent: nextTransparent,
      })
      setSlices(next)
      setNote(next.length
        ? `${next.length}개로 나눴습니다. 카카오 규격 ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} PNG입니다.`
        : '객체를 찾지 못했습니다. 그리드 균등 분할로 바꿔 행/열을 맞춰 보세요.')
    } catch (error) {
      setNote(error.message || '분할에 실패했습니다.')
      setSlices([])
    } finally {
      setBusy(false)
    }
  }, [cols, mode, rows, transparent])

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
      await runSlice(canvas)
    } catch (error) {
      setNote(error.message || '시트를 읽지 못했습니다.')
      setBusy(false)
    }
  }

  const reSlice = (patch = {}) => {
    const nextMode = patch.mode ?? mode
    const nextCols = patch.cols ?? cols
    const nextRows = patch.rows ?? rows
    const nextTransparent = patch.transparent ?? transparent
    if (patch.mode) setMode(patch.mode)
    if (patch.cols != null) setCols(patch.cols)
    if (patch.rows != null) setRows(patch.rows)
    if (patch.transparent != null) setTransparent(patch.transparent)
    if (sheetRef.current) runSlice(sheetRef.current, nextMode, nextCols, nextRows, nextTransparent)
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
            <p className="studio-modal-kicker">Kakao 360×360 PNG</p>
            <h2 id="emo-split-title">🧩 이모티콘 시트 분할기</h2>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </button>
        </div>
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
            onClick={() => reSlice({ mode: 'smart' })}
            {...magnify('스마트 자동 감지', '배경을 빼고 각 이모티콘 외곽 상자를 찾아 자릅니다')}
          >
            모드 A · 스마트 자동 감지
          </button>
          <button
            type="button"
            className={clsx('emo-mode', mode === 'grid' && 'is-on')}
            disabled={busy}
            onClick={() => reSlice({ mode: 'grid' })}
            {...magnify('그리드 균등 분할', '행과 열을 정해 바둑판처럼 정확히 나눕니다')}
          >
            모드 B · 그리드 균등 분할
          </button>
        </div>

        {mode === 'grid' ? (
          <div className="emo-grid-ctrls">
            <label>
              가로 {cols}열
              <input type="range" min="2" max="10" value={cols} disabled={busy} onChange={(event) => reSlice({ cols: Number(event.target.value) })} />
            </label>
            <label>
              세로 {rows}행
              <input type="range" min="2" max="10" value={rows} disabled={busy} onChange={(event) => reSlice({ rows: Number(event.target.value) })} />
            </label>
            <span className="emo-grid-total">{cols * rows}칸</span>
          </div>
        ) : null}

        <label className="emo-check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(event) => reSlice({ transparent: event.target.checked })}
          />
          배경 투명화 (Alpha PNG)
        </label>

        {sheetUrl ? (
          <img src={sheetUrl} alt="업로드한 이모티콘 시트" className="emo-sheet-preview" />
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
