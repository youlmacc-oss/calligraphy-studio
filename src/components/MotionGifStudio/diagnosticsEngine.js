import { quantize } from 'gifenc'
import { MOTION_NONE, MOTION_PRESETS, isMotionNone, sampleMotion } from './motionPresets.js'
import { resolvePlatformSize } from './platformPresets.js'
import { ALPHA_CUT, GIF_HEADER, maskRgbaTransparency } from './gifEncodeCore.js'
import { countGifFrames } from './gifEngine.js'
import { primeHqContext } from '../../utils/hqRender.js'
import {
  GOLDEN_BASELINE,
  evaluateMotionBaseline,
  evaluateUiIntegrityBaseline,
} from '../../utils/diagnosticsBaseline.js'
import { runStudioHudChecks, STUDIO_HUD_STEPS } from '../../lib/studioHudChecks.js'

export const MOTION_DIAG_STEPS = STUDIO_HUD_STEPS

const PASS = 'PASS'
const WARN = 'WARN'
const FAIL = 'FAIL'

const LABEL_SCAN_HOSTS = GOLDEN_BASELINE.uiIntegrity.labelScanHosts
const LABEL_SCAN = LABEL_SCAN_HOSTS.map((host) => `${host} button`).join(', ')
const TIP_SCAN = `${LABEL_SCAN}, .slider-control, .mgs-slider`

export function buttonIsLabelExempt(btn) {
  if (!(btn instanceof Element)) return true
  return btn.classList.contains('allow-long-text')
    || btn.hasAttribute('data-label-exempt')
    || btn.classList.contains('font-picker-trigger')
    || btn.classList.contains('font-picker-pick')
}

function visibleButtonLabel(btn) {
  const parts = []
  const walk = (node) => {
    if (!node) return
    if (node.nodeType === 3) {
      parts.push(node.nodeValue || '')
      return
    }
    if (node.nodeType !== 1) return
    if (typeof node.matches === 'function' && node.matches('svg, img, .font-acc-chevron')) return
    node.childNodes.forEach(walk)
  }
  walk(btn)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

function buttonClassHint(btn) {
  const raw = typeof btn.className === 'string' ? btn.className : ''
  const first = raw.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')
  return first || btn.tagName.toLowerCase()
}

export function auditButtonLabels() {
  const ui = GOLDEN_BASELINE.uiIntegrity
  if (typeof document === 'undefined') {
    return { id: 'UI_LABEL_INTEGRITY', name: 'UI 라벨 무결성', status: WARN, detail: 'DOM 대기' }
  }
  const seen = new Set()
  const scanned = []
  LABEL_SCAN_HOSTS.forEach((host) => {
    document.querySelectorAll(`${host} button`).forEach((btn) => {
      if (seen.has(btn)) return
      seen.add(btn)
      scanned.push(btn)
    })
  })
  const corrupted = []
  let exemptCount = 0
  scanned.forEach((btn) => {
    if (buttonIsLabelExempt(btn)) {
      exemptCount += 1
      return
    }
    const text = visibleButtonLabel(btn)
    if (!text) return
    const verdict = evaluateUiIntegrityBaseline({ labelLength: text.length, labelText: text })
    if (!verdict.ok) {
      const shown = text.length > 48 ? `${text.slice(0, 48)}…` : text
      corrupted.push({
        className: buttonClassHint(btn),
        length: text.length,
        text: shown,
      })
    }
  })
  const detail = corrupted.length === 0
    ? `크롬 버튼 라벨 ≤${ui.maxButtonLabelLength} · 면제 ${exemptCount} · baseline ${GOLDEN_BASELINE.version}`
    : `오염된 버튼 감지: ${corrupted.map((row) => `${row.className} ${row.length}자 “${row.text}”`).join(' · ')}`
  return {
    id: 'UI_LABEL_INTEGRITY',
    name: 'UI 라벨 무결성',
    status: corrupted.length === 0 ? PASS : FAIL,
    detail,
    metrics: {
      scanned: scanned.length,
      exempt: exemptCount,
      failCount: corrupted.length,
      offenders: corrupted,
    },
  }
}

export function auditTooltipBindings() {
  const expected = GOLDEN_BASELINE.uiIntegrity.requiredTooltipFontSize
  if (typeof document === 'undefined') {
    return { id: 'TOOLTIP_COVERAGE', name: '16px 빅 툴팁 커버리지', status: WARN, detail: 'DOM 대기' }
  }
  const targets = document.querySelectorAll(TIP_SCAN)
  let missing = 0
  targets.forEach((el) => {
    if (!el.getAttribute('data-tooltip') && !el.closest('[data-tooltip]')) missing += 1
  })
  const engine = document.getElementById(GOLDEN_BASELINE.uiIntegrity.requiredFloatingEngineId)
  const fontSize = engine && typeof getComputedStyle === 'function'
    ? getComputedStyle(engine).fontSize
    : ''
  const sizeOk = String(fontSize).replace(/\s/g, '') === expected
  if (missing === 0 && sizeOk) {
    return {
      id: 'TOOLTIP_COVERAGE',
      name: '16px 빅 툴팁 커버리지',
      status: PASS,
      detail: `전 메뉴 ${expected} 툴팁 100% 매핑 · baseline ${GOLDEN_BASELINE.version}`,
    }
  }
  if (missing === 0 && !sizeOk) {
    return {
      id: 'TOOLTIP_COVERAGE',
      name: '16px 빅 툴팁 커버리지',
      status: FAIL,
      detail: `툴팁 폰트 ${fontSize || '없음'} ≠ baseline ${expected}`,
    }
  }
  return {
    id: 'TOOLTIP_COVERAGE',
    name: '16px 빅 툴팁 커버리지',
    status: WARN,
    detail: `툴팁 누락 요소 ${missing}건`,
  }
}

export function auditGlobalTooltipEngine() {
  const expectedId = GOLDEN_BASELINE.uiIntegrity.requiredFloatingEngineId
  if (typeof document === 'undefined') {
    return { id: 'TOOLTIP_ENGINE_MOUNT', name: '플로팅 툴팁 엔진 상태', status: WARN, detail: 'DOM 대기' }
  }
  const node = document.getElementById(expectedId)
  const verdict = evaluateUiIntegrityBaseline({ engineId: node ? expectedId : '' })
  return {
    id: 'TOOLTIP_ENGINE_MOUNT',
    name: '플로팅 툴팁 엔진 상태',
    status: verdict.ok ? PASS : FAIL,
    detail: verdict.ok
      ? `16px 고대비 플로팅 엔진 정상 구동 · ${GOLDEN_BASELINE.version}`
      : `GlobalTooltip 엔진 누락 (#${expectedId})`,
  }
}

function check(id, status, detail, metrics = {}) {
  return { id, status, detail, metrics }
}

export function readGifHeader(uint8) {
  if (!uint8?.length) return ''
  const n = Math.min(6, uint8.length)
  let out = ''
  for (let i = 0; i < n; i += 1) out += String.fromCharCode(uint8[i])
  return out
}

function poseAmp(intensity) {
  const n = Number(intensity)
  if (!Number.isFinite(n)) return 0.7
  return n > 1 ? n / 100 : Math.min(1, Math.max(0, n))
}

function poseDistance(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY
  return (
    Math.abs(a.dx - b.dx)
    + Math.abs(a.dy - b.dy)
    + Math.abs(a.scaleX - b.scaleX) * 40
    + Math.abs(a.scaleY - b.scaleY) * 40
    + Math.abs(a.rotateDeg - b.rotateDeg)
    + Math.abs(a.alpha - b.alpha) * 20
    + Math.abs((a.glowRadius || 0) - (b.glowRadius || 0)) * 0.2
    + Math.abs((a.rgbShift || 0) - (b.rgbShift || 0))
    + Math.abs((a.sliceShift || 0) - (b.sliceShift || 0))
  )
}

function sampleCanvas(canvas, maxEdge = 48) {
  if (!canvas?.width || !canvas?.height) return null
  try {
    const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height, 1))
    const width = Math.max(1, Math.round(canvas.width * scale))
    const height = Math.max(1, Math.round(canvas.height * scale))
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    const ctx = tmp.getContext('2d', { willReadFrequently: true, alpha: true })
    primeHqContext(ctx)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(canvas, 0, 0, width, height)
    const image = ctx.getImageData(0, 0, width, height)
    tmp.width = 0
    tmp.height = 0
    return image
  } catch {
    return null
  }
}

export function inspectAlpha(canvas) {
  const image = sampleCanvas(canvas, 72)
  if (!image) return null
  const { data, width, height } = image
  let transparent = 0
  let fringe = 0
  let opaque = 0
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) transparent += 1
    else if (a < 255) fringe += 1
    else opaque += 1
  }
  const sampled = transparent + fringe + opaque
  return {
    width,
    height,
    sampled,
    transparent,
    fringe,
    opaque,
    cut: ALPHA_CUT,
    pct: sampled ? Math.round(((transparent + fringe) / sampled) * 1000) / 10 : 0,
  }
}

export function inspectPalette(canvas) {
  const image = sampleCanvas(canvas, 48)
  if (!image) return null
  try {
    const masked = maskRgbaTransparency(image.data, ALPHA_CUT)
    const palette = quantize(masked, 255, { format: 'rgb565' }) || []
    const colors = palette.length
    const transparentIndex = Math.min(255, colors)
    return {
      colors,
      transparentIndex,
      hasSlot: colors < 256,
      format: 'rgb565',
    }
  } catch (error) {
    return { error: error.message || 'quantize failed', colors: 0, transparentIndex: -1, hasSlot: false }
  }
}

function checkSrcLoad(snap) {
  if (snap.loading) return check('SRC_LOAD', WARN, '소스 디코딩 중', { loading: true })
  if (!snap.hasSource) return check('SRC_LOAD', FAIL, '소스 이미지 없음', { width: 0, height: 0 })
  const width = snap.sourceMeta?.width || 0
  const height = snap.sourceMeta?.height || 0
  if (width < 8 || height < 8) {
    return check('SRC_LOAD', FAIL, `원본 규격 부족 ${width}×${height}`, { width, height })
  }
  if (width > 4096 || height > 4096) {
    return check('SRC_LOAD', WARN, `초대형 원본 ${width}×${height}`, { width, height })
  }
  return check('SRC_LOAD', PASS, `원본 ${width}×${height} 유효`, { width, height })
}

function checkAlphaMask(snap) {
  if (!snap.hasSource) return check('ALPHA_MASK', FAIL, '알파 샘플 대상 없음')
  const alpha = snap.alpha
  if (!alpha) return check('ALPHA_MASK', WARN, '알파 채널을 읽지 못함')
  if (alpha.pct <= 0) return check('ALPHA_MASK', WARN, '불투명 소스 · 투명 픽셀 0%', alpha)
  return check('ALPHA_MASK', PASS, `투명 ${alpha.pct}% · fringe ${alpha.fringe}`, alpha)
}

function checkMathLoop(snap) {
  const preset = isMotionNone(snap.preset) ? MOTION_NONE : (snap.preset || 'jellyBounce')
  const amp = poseAmp(snap.intensity)
  const frames = Math.max(2, snap.frameCount || 24)
  const start = sampleMotion(preset, 0, amp)
  const wrapped = sampleMotion(preset, 1, amp)
  const last = sampleMotion(preset, (frames - 1) / frames, amp)
  const wrapErr = poseDistance(start, wrapped)
  const seamErr = poseDistance(start, last)
  const seamMax = GOLDEN_BASELINE.motionEngine.loopSeamToleranceMax
  const metrics = { wrapErr: Number(wrapErr.toFixed(4)), seamErr: Number(seamErr.toFixed(3)), frames, preset, baselineSeamMax: seamMax }
  if (wrapErr > 0.001) return check('MATH_LOOP', FAIL, `t=0 vs t=1 불연속 Δ${wrapErr.toFixed(3)}`, metrics)
  if (seamErr > seamMax) return check('MATH_LOOP', FAIL, `루프 이음 Δ${seamErr.toFixed(2)} > baseline ${seamMax}`, metrics)
  return check('MATH_LOOP', PASS, `t=0≡t=1 · 이음 Δ${seamErr.toFixed(2)} ≤ ${seamMax}`, metrics)
}

function checkFpsTrack(snap) {
  const hz = Number(snap.actualFps) || 0
  const target = Number(snap.targetFps) || GOLDEN_BASELINE.motionEngine.targetFps
  const minHz = GOLDEN_BASELINE.motionEngine.allowedHzMin
  const metrics = { hz: Math.round(hz * 10) / 10, target, baselineMinHz: minHz }
  if (!snap.hasSource) return check('FPS_TRACK', FAIL, '렌더 루프 대기', metrics)
  if (!snap.playing) return check('FPS_TRACK', WARN, `일시정지 · 마지막 ${Math.round(hz)} Hz`, metrics)
  if (hz <= 0) return check('FPS_TRACK', WARN, '주파수 샘플링 중', metrics)
  if (hz < minHz) return check('FPS_TRACK', FAIL, `실측 ${hz.toFixed(1)} Hz < baseline ${minHz}`, metrics)
  if (target !== GOLDEN_BASELINE.motionEngine.targetFps) {
    return check('FPS_TRACK', WARN, `인코드 ${target} FPS ≠ baseline ${GOLDEN_BASELINE.motionEngine.targetFps}`, metrics)
  }
  return check('FPS_TRACK', PASS, `실측 ${hz.toFixed(0)} Hz · 인코드 ${target} FPS`, metrics)
}

function checkCanvasResize(snap) {
  const expected = resolvePlatformSize(snap.sizeId, {
    naturalWidth: snap.sourceMeta?.width,
    naturalHeight: snap.sourceMeta?.height,
    width: snap.sourceMeta?.width,
    height: snap.sourceMeta?.height,
  })
  const fitted = snap.fittedSize || {}
  const metrics = {
    sizeId: expected.id,
    expectedW: expected.width,
    expectedH: expected.height,
    fittedW: fitted.width || 0,
    fittedH: fitted.height || 0,
  }
  if (!snap.hasSource) return check('CANVAS_RESIZE', FAIL, '리사이즈 입력 없음', metrics)
  if (fitted.width !== expected.width || fitted.height !== expected.height) {
    return check('CANVAS_RESIZE', FAIL, `피팅 ${fitted.width || 0}×${fitted.height || 0} ≠ ${expected.width}×${expected.height}`, metrics)
  }
  const srcW = snap.sourceMeta?.width || 0
  const srcH = snap.sourceMeta?.height || 0
  if (expected.id === 'original' && Math.max(srcW, srcH) > 1024) {
    return check('CANVAS_RESIZE', WARN, `원본 클램프 ${expected.width}×${expected.height}`, metrics)
  }
  return check('CANVAS_RESIZE', PASS, `${expected.id} ${expected.width}×${expected.height}`, metrics)
}

function checkPaletteQuant(snap) {
  if (!snap.hasSource) return check('PALETTE_QUANT', FAIL, '팔레트 샘플 없음')
  const palette = snap.palette
  if (!palette) return check('PALETTE_QUANT', WARN, '양자화 샘플 대기')
  if (palette.error) return check('PALETTE_QUANT', FAIL, palette.error, palette)
  if (!palette.colors) return check('PALETTE_QUANT', FAIL, '팔레트 0색', palette)
  if (!palette.hasSlot || palette.transparentIndex < 0) {
    return check('PALETTE_QUANT', FAIL, '투명 인덱스 슬롯 없음', palette)
  }
  if (palette.colors > 250) {
    return check('PALETTE_QUANT', WARN, `${palette.colors}색 · Tidx ${palette.transparentIndex}`, palette)
  }
  return check('PALETTE_QUANT', PASS, `${palette.colors}색 · 투명 인덱스 ${palette.transparentIndex}`, palette)
}

function checkEncodeProgress(snap) {
  const progress = Math.max(0, Math.min(100, Number(snap.progress) || 0))
  const metrics = {
    progress,
    phase: snap.encodePhase || (snap.encoding ? 'encode' : 'idle'),
    frames: snap.frameCount || 0,
    estimateKb: snap.estimateKb || 0,
  }
  if (snap.encodeError && !snap.encoding) {
    return check('ENCODE_PROGRESS', FAIL, snap.encodeError, metrics)
  }
  if (snap.encoding) {
    if (progress <= 0) return check('ENCODE_PROGRESS', WARN, '프레임 캡처 대기 0%', metrics)
    return check('ENCODE_PROGRESS', PASS, `${metrics.phase} ${progress}% · ${snap.frameHint || `${metrics.frames}f`}`, metrics)
  }
  if (snap.lastBlob?.bytes) return check('ENCODE_PROGRESS', PASS, `대기 · 마지막 ${Math.round(snap.lastBlob.bytes / 1024)} KB`, metrics)
  const cap = GOLDEN_BASELINE.motionEngine.maxEstimateKb
  if (metrics.estimateKb > cap) {
    return check('ENCODE_PROGRESS', FAIL, `예상 ${metrics.estimateKb} KB > baseline ${cap} KB`, metrics)
  }
  return check('ENCODE_PROGRESS', PASS, `Ready · 예상 ${metrics.estimateKb} KB / ${metrics.frames}f ≤ ${cap}KB`, metrics)
}

function checkBlobValidation(snap) {
  const blob = snap.lastBlob
  if (!blob) return check('BLOB_VALIDATION', PASS, '대기 · 아직 내보낸 GIF 없음')
  const header = blob.header || ''
  const bytes = blob.bytes || 0
  const metrics = { ...blob }
  if (header !== GIF_HEADER) return check('BLOB_VALIDATION', FAIL, `헤더 ${header || '없음'} ≠ GIF89a`, metrics)
  if (!blob.netscape) return check('BLOB_VALIDATION', FAIL, 'NETSCAPE2.0 무한루프 없음', metrics)
  if (bytes < 64) return check('BLOB_VALIDATION', FAIL, `용량 ${bytes}B 비정상`, metrics)
  const capKb = GOLDEN_BASELINE.motionEngine.maxEstimateKb
  if (bytes > capKb * 1024) {
    return check('BLOB_VALIDATION', FAIL, `GIF ${Math.round(bytes / 1024)} KB > baseline ${capKb} KB`, metrics)
  }
  return check('BLOB_VALIDATION', PASS, `GIF89a · ${Math.round(bytes / 1024)} KB ≤ ${capKb}KB · ${blob.elapsedMs || 0}ms`, metrics)
}

const RUNNERS = {
  SRC_LOAD: checkSrcLoad,
  ALPHA_MASK: checkAlphaMask,
  MATH_LOOP: checkMathLoop,
  FPS_TRACK: checkFpsTrack,
  CANVAS_RESIZE: checkCanvasResize,
  PALETTE_QUANT: checkPaletteQuant,
  ENCODE_PROGRESS: checkEncodeProgress,
  BLOB_VALIDATION: checkBlobValidation,
  UI_LABEL_INTEGRITY: () => {
    const row = auditButtonLabels()
    return check(row.id, row.status, row.detail, row.metrics || {})
  },
  TOOLTIP_COVERAGE: () => {
    const row = auditTooltipBindings()
    return check(row.id, row.status, row.detail)
  },
  TOOLTIP_ENGINE_MOUNT: () => {
    const row = auditGlobalTooltipEngine()
    return check(row.id, row.status, row.detail)
  },
}

export function runMotionDiagnostics(snap = {}) {
  const frameCount = countGifFrames(snap.targetFps || GOLDEN_BASELINE.motionEngine.targetFps, snap.loopSeconds || 2)
  const merged = { ...snap, frameCount: snap.frameCount || frameCount }
  const checks = runStudioHudChecks()
  const passCount = checks.filter((item) => item.status === PASS).length
  const warnCount = checks.filter((item) => item.status === WARN).length
  const failCount = checks.filter((item) => item.status === FAIL).length
  const overall = failCount ? FAIL : warnCount ? WARN : PASS
  const baseline = evaluateMotionBaseline({
    targetFps: Number(merged.targetFps) || GOLDEN_BASELINE.motionEngine.targetFps,
    estimateKb: merged.estimateKb || 0,
    presetIds: MOTION_PRESETS.map((item) => item.id),
  })
  const metrics = {
    fps: Math.round((Number(merged.actualFps) || 0) * 10) / 10,
    targetFps: merged.targetFps || GOLDEN_BASELINE.motionEngine.targetFps,
    source: merged.sourceMeta ? `${merged.sourceMeta.width}×${merged.sourceMeta.height}` : '—',
    output: merged.fittedSize ? `${merged.fittedSize.width}×${merged.fittedSize.height}` : '—',
    frames: merged.frameCount,
    estimateKb: merged.estimateKb || 0,
    elapsedMs: merged.encoding
      ? Math.round(merged.encodeElapsedMs || 0)
      : (merged.lastBlob?.elapsedMs || 0),
    progress: merged.progress || 0,
    baselineVersion: GOLDEN_BASELINE.version,
    baselineOk: baseline.ok,
  }
  const report = {
    timestamp: new Date().toISOString(),
    overall,
    passCount,
    warnCount,
    failCount,
    total: checks.length,
    checks,
    metrics,
    baseline,
    baselineVersion: GOLDEN_BASELINE.version,
  }
  report.logText = formatDiagLog(report)
  return report
}

export function formatDiagLog(report) {
  return JSON.stringify({
    module: 'MotionGifStudio',
    timestamp: report.timestamp,
    baselineVersion: report.baselineVersion || GOLDEN_BASELINE.version,
    baseline: report.baseline,
    summary: `${report.passCount}/${report.total} PASS · ${report.warnCount} WARN · ${report.failCount} FAIL`,
    overall: report.overall,
    metrics: report.metrics,
    checks: (report.checks || []).map((item) => ({
      id: item.id,
      status: item.status,
      detail: item.detail,
      metrics: item.metrics,
    })),
  }, null, 2)
}

export function idleMotionDiagnostics() {
  return runMotionDiagnostics({})
}
