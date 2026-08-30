import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { pauseStudioFit } from '../../lib/studioFit.js'
import {
  PurePixelSelectionEngine,
  extractSpriteFromMask,
  readSourceImageData,
  renderLoupeGrid,
  sourceSize,
} from './pixelSelectionEngine.js'

const LOUPE_SIZE = 50
const LOUPE_SCALE = 6
const LOUPE_PX = LOUPE_SIZE * LOUPE_SCALE
const BRUSH_SIZES = [1, 2, 4, 8, 16]
const SIDEBAR_BTN = 'mgs-tab text-xs flex w-full items-center justify-center gap-1.5 whitespace-nowrap'
const SIDEBAR_BOX = { width: 128, minWidth: 128, maxWidth: 128, flexShrink: 0 }
const COMPACT_BTN = {
  padding: '6px 8px',
  fontSize: 12,
  lineHeight: 1.2,
  minHeight: 32,
  width: '100%',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

function eventToImage(event, canvas, width, height) {
  const rect = canvas.getBoundingClientRect()
  const touch = event.touches?.[0] || event.changedTouches?.[0]
  const clientX = touch ? touch.clientX : event.clientX
  const clientY = touch ? touch.clientY : event.clientY
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * width,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * height,
  }
}

function paintStudio(ctx, source, mask, width, height) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = false
  if (source) ctx.drawImage(source, 0, 0, width, height)
  const overlay = ctx.getImageData(0, 0, width, height)
  const { data } = overlay
  const limit = Math.min(mask?.length || 0, width * height)
  for (let i = 0; i < limit; i += 1) {
    if (!mask[i]) continue
    const p = i * 4
    data[p] = Math.min(255, data[p] * 0.45 + 6)
    data[p + 1] = Math.min(255, data[p + 1] * 0.45 + 182)
    data[p + 2] = Math.min(255, data[p + 2] * 0.45 + 212)
    data[p + 3] = Math.max(data[p + 3], 160)
  }
  ctx.putImageData(overlay, 0, 0)
}

export default function PixelSelectionModal({
  open = false,
  isOpen = false,
  source = null,
  sourceImage = null,
  image = null,
  onClose,
  onApply,
}) {
  const visible = Boolean(open || isOpen)
  source = source || sourceImage || image
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const loupeRef = useRef(null)
  const imageDataRef = useRef(null)
  const engineRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef(null)
  const loupeOriginRef = useRef({ startX: 0, startY: 0 })
  const [ready, setReady] = useState(false)
  const [tool, setTool] = useState('brush')
  const [brush, setBrush] = useState(4)
  const [tolerance, setTolerance] = useState(15)
  const [tick, setTick] = useState(0)
  const [draftNote, setDraftNote] = useState('')
  const [loupe, setLoupe] = useState(null)
  const [viewBox, setViewBox] = useState({ w: 360, h: 360 })
  const size = sourceSize(source)
  const engine = engineRef.current
  const selected = engine ? engine.selectedCount() : 0
  const paintTool = tool === 'loupe' ? 'brush' : tool

  const bump = () => setTick((value) => value + 1)

  useEffect(() => {
    if (!visible || !source) {
      imageDataRef.current = null
      engineRef.current = null
      setReady(false)
      setDraftNote('')
      setLoupe(null)
      return undefined
    }
    const next = new PurePixelSelectionEngine(size.width, size.height)
    next.loadDraft()
    engineRef.current = next
    imageDataRef.current = readSourceImageData(source)
    setReady(Boolean(imageDataRef.current))
    setTick((value) => value + 1)
    return undefined
  }, [visible, source, size.width, size.height])

  useEffect(() => {
    if (!visible || !source || !canvasRef.current || !engineRef.current) return undefined
    const canvas = canvasRef.current
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width
      canvas.height = size.height
    }
    paintStudio(canvas.getContext('2d'), source, engineRef.current.mask, size.width, size.height)
    return undefined
  }, [visible, source, size.width, size.height, tick])

  useEffect(() => {
    if (!visible || !loupe || !loupeRef.current || !source || !engineRef.current) return undefined
    const canvas = loupeRef.current
    canvas.width = LOUPE_PX
    canvas.height = LOUPE_PX
    const origin = renderLoupeGrid(canvas, source, engineRef.current.mask, loupe.x, loupe.y)
    loupeOriginRef.current = origin
    return undefined
  }, [visible, loupe, source, tick])

  useEffect(() => {
    if (!visible) return undefined
    pauseStudioFit(true)
    return () => pauseStudioFit(false)
  }, [visible])

  useEffect(() => {
    if (!visible) return undefined
    const stage = stageRef.current
    if (!stage) return undefined
    const fitContain = () => {
      const box = stage.getBoundingClientRect()
      const maxW = Math.max(80, box.width)
      const maxH = Math.max(80, Math.min(box.height, window.innerHeight * 0.78))
      const srcW = Math.max(1, size.width)
      const srcH = Math.max(1, size.height)
      const scale = Math.min(maxW / srcW, maxH / srcH)
      setViewBox({
        w: Math.max(80, Math.floor(srcW * scale)),
        h: Math.max(80, Math.floor(srcH * scale)),
      })
    }
    fitContain()
    const observer = new ResizeObserver(fitContain)
    observer.observe(stage)
    window.addEventListener('resize', fitContain)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fitContain)
    }
  }, [visible, size.width, size.height])

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (loupe) {
          setLoupe(null)
          return
        }
        onClose?.()
        return
      }
      const redo = (event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'Y' || (event.shiftKey && (event.key === 'z' || event.key === 'Z')))
      const undo = (event.ctrlKey || event.metaKey) && (event.key === 'z' || event.key === 'Z') && !event.shiftKey
      if (redo) {
        event.preventDefault()
        if (engineRef.current?.redo()) bump()
        return
      }
      if (undo) {
        event.preventDefault()
        if (engineRef.current?.undo()) bump()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, onClose, loupe])

  if (!visible || typeof document === 'undefined') return null

  const paintAt = (x, y, erase, commit, interpolate) => {
    const current = engineRef.current
    if (!current) return
    if (paintTool === 'wand' && !erase) {
      current.magicWand(imageDataRef.current?.data, x, y, tolerance)
      bump()
      return
    }
    const prev = lastPtRef.current
    if (interpolate && prev) current.paintStroke(prev.x, prev.y, x, y, brush, erase)
    else current.paint(x, y, brush, erase)
    lastPtRef.current = { x, y }
    if (commit) {
      current.saveHistory()
      lastPtRef.current = null
    }
    bump()
  }

  const applyAt = (event, commit) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const point = eventToImage(event, canvas, size.width, size.height)
    if (tool === 'loupe' && event.type === 'pointerdown') {
      setLoupe({ x: Math.round(point.x), y: Math.round(point.y) })
      return
    }
    const erase = paintTool === 'erase' || event.button === 2 || event.buttons === 2
    paintAt(point.x, point.y, erase, commit, Boolean(lastPtRef.current))
  }

  const applyLoupeAt = (event, commit) => {
    const canvas = loupeRef.current
    const current = engineRef.current
    if (!canvas || !current) return
    const origin = loupeOriginRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = LOUPE_PX / LOUPE_SIZE
    const lx = Math.floor(((event.clientX - rect.left) / Math.max(1, rect.width)) * LOUPE_SIZE)
    const ly = Math.floor(((event.clientY - rect.top) / Math.max(1, rect.height)) * LOUPE_SIZE)
    const x = (origin.startX || 0) + Math.max(0, Math.min(LOUPE_SIZE - 1, lx))
    const y = (origin.startY || 0) + Math.max(0, Math.min(LOUPE_SIZE - 1, ly))
    const erase = paintTool === 'erase' || event.button === 2 || event.buttons === 2
    void scale
    paintAt(x, y, erase, commit, Boolean(lastPtRef.current))
  }

  const apply = () => {
    if (!engineRef.current || engineRef.current.selectedCount() < 1) return
    onApply?.(extractSpriteFromMask(source, engineRef.current.mask))
  }

  return createPortal(
    (
      <div
        className="fixed inset-0 z-[99999] flex w-full items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        data-pixel-studio="1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pixel-studio-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.85)',
        }}
      >
        <div
          className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950"
          data-pixel-shell="1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 'min(1500px, 96vw)',
            minWidth: 'min(1500px, 96vw)',
            maxWidth: '1500px',
            height: '92vh',
            maxHeight: '92vh',
            minHeight: 0,
            flexShrink: 0,
            alignSelf: 'center',
            boxSizing: 'border-box',
          }}
        >
          <header className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <h3 id="pixel-studio-title" className="text-xs font-semibold text-cyan-100">✨ 초정밀 픽셀 선택 추출 에디터</h3>
              <span className="hidden text-[11px] text-slate-400 sm:inline">| 와이드/직사각형/정사각형 전비율 완벽 지원</span>
            </div>
            <span className="mgs-badge text-[11px]" data-pixel-zoom="1">맞춤</span>
          </header>

          <div
            className="flex w-full min-h-0 min-w-0 flex-1 items-stretch justify-between gap-3 overflow-hidden bg-slate-950/95 p-3"
            data-pixel-body="1"
            style={{ width: '100%', minWidth: 0, display: 'flex', flex: '1 1 auto' }}
          >
            <aside
              className="flex w-32 min-w-[124px] min-h-0 max-h-full shrink-0 flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/90 p-2"
              data-pixel-col="left"
              style={SIDEBAR_BOX}
            >
              <button type="button" className={clsx(SIDEBAR_BTN, tool === 'brush' && 'is-on')} style={COMPACT_BTN} data-pixel-tool="brush" onClick={() => setTool('brush')}>
                🖌️ 브러시
              </button>
              <button type="button" className={clsx(SIDEBAR_BTN, tool === 'erase' && 'is-on')} style={COMPACT_BTN} data-pixel-tool="erase" onClick={() => setTool('erase')}>
                🧹 지우개
              </button>
              <button type="button" className={clsx(SIDEBAR_BTN, tool === 'wand' && 'is-on')} style={COMPACT_BTN} data-pixel-wand="1" data-pixel-tool="wand" onClick={() => setTool('wand')}>
                🪄 완드
              </button>
              <button type="button" className={clsx(SIDEBAR_BTN, tool === 'loupe' && 'is-on')} style={COMPACT_BTN} data-pixel-loupe-open="1" data-pixel-tool="loupe" onClick={() => setTool('loupe')}>
                🔍 50×50확대
              </button>
              <div className="grid grid-cols-3 gap-1 border-t border-slate-800 pt-1">
                {BRUSH_SIZES.map((sizePx) => (
                  <button
                    key={sizePx}
                    type="button"
                    className={clsx('mgs-tab text-[11px] whitespace-nowrap', brush === sizePx && 'is-on')}
                    style={{ padding: '4px 2px', fontSize: 11, minHeight: 24, width: '100%', whiteSpace: 'nowrap' }}
                    data-pixel-brush={String(sizePx)}
                    onClick={() => setBrush(sizePx)}
                  >
                    {sizePx}px
                  </button>
                ))}
              </div>
              <label className="mgs-hint text-[11px]" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                허용치 {tolerance}
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={tolerance}
                  data-pixel-tolerance="1"
                  onChange={(event) => setTolerance(Number(event.target.value) || 15)}
                />
              </label>
            </aside>

            <div
              ref={stageRef}
              className="checkerboard-bg relative flex h-full min-h-0 min-w-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800/80 p-1"
              data-pixel-stage="1"
              style={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}
            >
              <canvas
                ref={canvasRef}
                className="max-h-[75vh] w-auto max-w-full cursor-crosshair object-contain"
                data-pixel-canvas="1"
                data-pixel-ready={ready ? '1' : '0'}
                data-pixel-selected={String(selected)}
                width={size.width}
                height={size.height}
                style={{
                  touchAction: 'none',
                  width: viewBox.w,
                  height: viewBox.h,
                  maxWidth: '100%',
                  maxHeight: 'min(75vh, 100%)',
                  objectFit: 'contain',
                  imageRendering: 'pixelated',
                }}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  drawingRef.current = tool !== 'loupe'
                  lastPtRef.current = null
                  event.currentTarget.setPointerCapture?.(event.pointerId)
                  applyAt(event, tool === 'wand')
                }}
                onPointerMove={(event) => {
                  if (!drawingRef.current || tool === 'wand' || tool === 'loupe') return
                  applyAt(event, false)
                }}
                onPointerUp={() => {
                  if (drawingRef.current && tool !== 'wand' && tool !== 'loupe') engineRef.current?.saveHistory()
                  drawingRef.current = false
                  lastPtRef.current = null
                }}
                onPointerLeave={() => {
                  if (drawingRef.current && tool !== 'wand' && tool !== 'loupe') engineRef.current?.saveHistory()
                  drawingRef.current = false
                  lastPtRef.current = null
                }}
              />
              {loupe ? (
                <div
                  className="rounded-xl border border-cyan-400/40 bg-slate-950 p-2"
                  data-pixel-loupe="1"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: 12,
                    zIndex: 4,
                    width: LOUPE_PX + 16,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="mgs-hint">50×50 정밀 픽셀 격자</p>
                    <button type="button" className="mgs-tab text-xs" style={COMPACT_BTN} data-pixel-loupe-close="1" onClick={() => setLoupe(null)}>
                      × 닫기
                    </button>
                  </div>
                  <canvas
                    ref={loupeRef}
                    className="cursor-crosshair"
                    data-pixel-loupe-canvas="1"
                    width={LOUPE_PX}
                    height={LOUPE_PX}
                    style={{ width: LOUPE_PX, height: LOUPE_PX, imageRendering: 'pixelated', touchAction: 'none' }}
                    onContextMenu={(event) => event.preventDefault()}
                    onPointerDown={(event) => {
                      drawingRef.current = true
                      lastPtRef.current = null
                      event.currentTarget.setPointerCapture?.(event.pointerId)
                      applyLoupeAt(event, paintTool === 'wand')
                    }}
                    onPointerMove={(event) => {
                      if (!drawingRef.current || paintTool === 'wand') return
                      applyLoupeAt(event, false)
                    }}
                    onPointerUp={() => {
                      if (drawingRef.current && paintTool !== 'wand') engineRef.current?.saveHistory()
                      drawingRef.current = false
                      lastPtRef.current = null
                    }}
                  />
                </div>
              ) : null}
            </div>

            <aside
              className="flex w-32 min-w-[124px] min-h-0 max-h-full shrink-0 flex-col gap-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/90 p-2"
              data-pixel-col="right"
              style={SIDEBAR_BOX}
            >
              <button
                type="button"
                className={SIDEBAR_BTN}
                style={COMPACT_BTN}
                data-pixel-draft-save="1"
                onClick={() => {
                  engineRef.current?.saveDraft()
                  setDraftNote('임시 저장했습니다.')
                }}
              >
                💾 임시저장
              </button>
              <button
                type="button"
                className={SIDEBAR_BTN}
                style={COMPACT_BTN}
                data-pixel-draft-load="1"
                onClick={() => {
                  const ok = engineRef.current?.loadDraft()
                  setDraftNote(ok ? '임시 저장을 불러왔습니다.' : '불러올 임시 저장이 없습니다.')
                  bump()
                }}
              >
                📂 불러오기
              </button>
              <div className="my-0.5 h-px bg-slate-800" />
              <button type="button" className={SIDEBAR_BTN} style={COMPACT_BTN} data-pixel-undo="1" onClick={() => { if (engineRef.current?.undo()) bump() }}>
                ↩️ Undo
              </button>
              <button type="button" className={SIDEBAR_BTN} style={COMPACT_BTN} data-pixel-redo="1" onClick={() => { if (engineRef.current?.redo()) bump() }}>
                ↪️ Redo
              </button>
              <button type="button" className={SIDEBAR_BTN} style={COMPACT_BTN} data-pixel-invert="1" onClick={() => { engineRef.current?.invert(); bump() }}>
                🔀 반전
              </button>
              <button type="button" className={SIDEBAR_BTN} style={COMPACT_BTN} data-pixel-grow="1" onClick={() => { engineRef.current?.grow(); bump() }}>
                ➕ 확장
              </button>
              <button type="button" className={SIDEBAR_BTN} style={COMPACT_BTN} data-pixel-shrink="1" onClick={() => { engineRef.current?.shrink(); bump() }}>
                ➖ 축소
              </button>
            </aside>
          </div>

          {draftNote ? <p className="mgs-hint shrink-0 px-3 text-[11px]" data-pixel-draft-toast="1">{draftNote}</p> : null}
          <footer className="flex w-full shrink-0 flex-wrap items-center justify-between gap-1.5 border-t border-slate-800 px-5 py-2.5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="mgs-tab text-xs"
                style={COMPACT_BTN}
                data-pixel-reset="1"
                onClick={() => {
                  engineRef.current?.clear()
                  setLoupe(null)
                  bump()
                }}
              >
                🔄 초기화
              </button>
              <button type="button" className="mgs-tab text-xs" style={COMPACT_BTN} data-pixel-cancel="1" onClick={() => onClose?.()}>
                닫기
              </button>
            </div>
            <button
              type="button"
              className={clsx('mgs-tab text-xs', selected > 0 && 'is-on')}
              style={{ ...COMPACT_BTN, width: 'auto', padding: '8px 14px' }}
              data-pixel-apply="1"
              disabled={selected < 1}
              onClick={apply}
            >
              ✨ 선택 영역 추출 적용
            </button>
          </footer>
        </div>
      </div>
    ),
    document.documentElement,
  )
}
