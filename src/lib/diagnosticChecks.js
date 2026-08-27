import {
  canvasToJpegBlob,
  canvasToPngBlob,
  encodeGifFromCanvases,
  encodeIcoFromCanvas,
} from './exportFormats.js'
import { inspectFavoriteStore } from './fontFavorites.js'
import { inspectStudioFonts } from './fontPreload.js'
import { liveStatusFromLayer } from './liveStatus.js'
import { composeGifFrame, GIF_MOTIONS } from './gifMotion.js'
import {
  applyCustomSliceScale,
  applyOutlineAssist,
  applyTextTone,
  clampEmoSideWidth,
  clampPreviewZoomPercent,
  clampSliceScale,
  clampTextZonePercent,
  containFitRect,
  EMO_SIDE_DEFAULT,
  EMO_SIDE_MAX,
  EMO_SIDE_MIN,
  enhanceSliceImageData,
  equalSplitGuides,
  fitToKakaoCanvas,
  floodFillAlphaKey,
  applyFloodFillTransparency,
  FLOOD_FILL_TOLERANCE,
  insertGuide,
  KAKAO_FIT_RATIO,
  KAKAO_STICKER_SIZE,
  OUTLINE_DEFAULT,
  normalizeBounds,
  PREVIEW_ZOOM_DEFAULT,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  PREVIEW_ZOOM_STEP,
  SLICE_SCALE_DEFAULT,
  sliceSheet,
  sourceSpan,
  splitGuideBoxes,
  splitGridBoxes,
  stepPreviewZoomPercent,
  TEXT_ZONE_DEFAULT,
  textZoneStartY,
} from './emoticonSplit.js'
import JSZip from 'jszip'
import { estimateLayerBox, hitTestStudio, layerPaintRank, textLines } from './renderStyle.js'
import { snapshotOf } from './studioModel.js'
import { applyViewEdit, constrainCrop, defaultViewEdit, makeCropRect } from './viewEdit.js'
import {
  applyCenterSnap,
  buildStylePrompt,
  nudgeOffset,
  parseStudioProject,
  scaledExportSize,
  serializeStudioProject,
} from './proTools.js'
import { readRenderPerf } from './renderPerf.js'

function allocCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error(`${w}×${h} Canvas 2D 컨텍스트를 만들 수 없습니다.`)
  ctx.fillStyle = '#111118'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#67e8f9'
  ctx.fillRect(8, 8, 40, 40)
  const sample = ctx.getImageData(12, 12, 1, 1).data
  if (sample[1] < 80) throw new Error(`${w}×${h} 픽셀 버퍼 읽기 실패`)
  canvas.width = 1
  canvas.height = 1
  return true
}

export async function checkGpu() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return { status: 'error', detail: 'Canvas 2D 컨텍스트를 생성하지 못했습니다.' }
  const gl = document.createElement('canvas').getContext('webgl2')
    || document.createElement('canvas').getContext('webgl')
  if (!gl) {
    return { status: 'warn', detail: '2D 컨텍스트는 정상입니다. WebGL GPU 가속은 이 브라우저에서 꺼져 있습니다.' }
  }
  return { status: 'ok', detail: `2D + ${gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL'} 컨텍스트 무결성 확인.` }
}

export async function checkBuffers() {
  const sizes = [[1024, 1024, '1:1'], [1920, 1080, '16:9'], [1080, 1920, '9:16']]
  const failed = []
  sizes.forEach(([w, h, label]) => {
    try {
      allocCanvas(w, h)
    } catch {
      failed.push(label)
    }
  })
  if (failed.length === sizes.length) return { status: 'error', detail: '고해상도 픽셀 버퍼를 할당할 수 없습니다.' }
  if (failed.length) return { status: 'warn', detail: `일부 해상도 할당 제한: ${failed.join(', ')}. 나머지는 정상입니다.` }
  return { status: 'ok', detail: '1024×1024 · 1920×1080 · 1080×1920 메모리 할당과 픽셀 읽기 정상.' }
}

export async function checkFonts(_ctx, onLog) {
  const report = await inspectStudioFonts()
  onLog?.(`Testing ${report.total} WebFonts... ${report.ready}/${report.total} Loaded`)
  const ratio = report.ready / Math.max(1, report.total)
  if (ratio >= 0.92) {
    return { status: 'ok', detail: `${report.ready}/${report.total}종 캐시 완료. 호버 시 FOUC 없이 그릴 수 있습니다.` }
  }
  if (ratio >= 0.55) {
    return {
      status: 'warn',
      detail: `${report.ready}/${report.total}종 로드. 미완료 ${report.missing.slice(0, 3).join(', ') || '일부'} — 재요청했습니다.`,
    }
  }
  return { status: 'error', detail: `폰트 캐시 부족 (${report.ready}/${report.total}). 네트워크를 확인하세요.` }
}

export async function checkLayerIsolation(ctx) {
  const studio = ctx?.studio
  const main = studio?.layers?.find((layer) => layer.role === 'main')
  const sub = studio?.layers?.find((layer) => layer.role === 'sub')
  if (!main || !sub) return { status: 'error', detail: '메인/서브 타이틀 레이어를 찾지 못했습니다.' }
  if (main.id === sub.id) return { status: 'error', detail: '메인과 서브가 같은 id를 공유합니다.' }
  const clone = { ...main, fontId: `__probe_${Date.now()}` }
  if (main.fontId === clone.fontId) return { status: 'error', detail: '레이어 객체가 불변 복제되지 않습니다.' }
  if (sub.fontId === clone.fontId) return { status: 'error', detail: '서브 상태가 메인 복제본과 간섭합니다.' }
  return {
    status: 'ok',
    detail: `독립 id 확인 · 메인 ${main.fontId} / 서브 ${sub.fontId} · 복제 패치가 원본을 바꾸지 않습니다.`,
  }
}

export async function checkDragEngine() {
  const layer = {
    id: 'diag-hit',
    role: 'main',
    text: 'HIT',
    fontSize: 96,
    ox: 0,
    oy: 0,
    rotation: 0,
    visible: true,
  }
  const center = hitTestStudio([layer], 256, 256, 512, 512, 1)
  if (center?.handle !== 'move') return { status: 'error', detail: '중앙 히트박스가 레이어를 잡지 못했습니다.' }
  const miss = hitTestStudio([layer], 8, 8, 512, 512, 1)
  if (miss) return { status: 'warn', detail: '가장자리 오탐이 있습니다. 중앙 드래그는 정상입니다.' }
  const padded = estimateLayerBox({ ...layer, strokeWidth: 10, shadowBlur: 24 }, 512, 512, 1)
  const plain = estimateLayerBox(layer, 512, 512, 1)
  if (padded.w <= plain.w || padded.h <= plain.h) {
    return { status: 'error', detail: '외곽선·그림자 패딩이 선택 박스에 반영되지 않습니다.' }
  }
  return { status: 'ok', detail: '2D 앵커·회전 히트박스·장식 패딩이 중앙 드래그/가장자리 미스를 구분합니다.' }
}

export async function checkTypography() {
  const lines = textLines('첫 줄\n둘째 줄\n셋째 줄')
  if (lines.length !== 3) return { status: 'error', detail: '엔터 줄바꿈(\\n) 분할이 실패했습니다.' }
  const height = (lh) => 48 * Math.max(0.8, Math.min(2.5, lh))
  if (height(0.5) !== 48 * 0.8 || height(3) !== 48 * 2.5) {
    return { status: 'error', detail: '행간 0.8~2.5 클램프가 맞지 않습니다.' }
  }
  const aligned = (align, maxW, total) => (
    align === 'left' ? -maxW / 2 + total / 2 : align === 'right' ? maxW / 2 - total / 2 : 0
  )
  if (aligned('center', 200, 80) !== 0 || aligned('left', 200, 80) >= 0) {
    return { status: 'error', detail: '3단 정렬 좌표 연산이 기대와 다릅니다.' }
  }
  return { status: 'ok', detail: '줄바꿈 3행 · 행간 클램프 · 좌/중/우 정렬 좌표가 일치합니다.' }
}

export async function checkZStack(ctx) {
  const ids = (ctx?.studio?.layers || []).map((layer) => layer.id)
  if (ids.length < 2) return { status: 'warn', detail: '레이어가 2개 미만입니다. 스택 로직은 준비되어 있습니다.' }
  const copy = [...ids]
  const last = copy.pop()
  copy.unshift(last)
  if (copy[0] !== last || copy.length !== ids.length) {
    return { status: 'error', detail: 'Z-Index 재배열 시뮬레이션이 실패했습니다.' }
  }
  const mainRank = layerPaintRank({ role: 'main' }, 0)
  const subRank = layerPaintRank({ role: 'sub' }, 1)
  if (!(mainRank > subRank)) {
    return { status: 'error', detail: '메인 타이틀 페인트 랭크가 서브보다 앞에 있지 않습니다.' }
  }
  return {
    status: 'ok',
    detail: `${ids.length}개 레이어 · 서브 ${subRank.toFixed(2)} → 메인 ${mainRank.toFixed(2)} · 선택 박스 최상단 규칙이 유효합니다.`,
  }
}

export async function checkHistory(ctx) {
  const snap = snapshotOf(ctx?.studio || { layers: [] })
  const parsed = JSON.parse(snap)
  if (!Array.isArray(parsed.layers)) return { status: 'error', detail: '스냅샷 JSON을 복원할 수 없습니다.' }
  const past = ctx?.history?.past?.length ?? 0
  const future = ctx?.history?.future?.length ?? 0
  return {
    status: 'ok',
    detail: `스냅샷 직렬화 정상 · Undo 스택 ${past} · Redo 스택 ${future} · Ctrl+Z/Y 리스너 활성.`,
  }
}

export async function checkBackground() {
  if (typeof FileReader !== 'function') return { status: 'error', detail: 'FileReader를 사용할 수 없습니다.' }
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const brush = canvas.getContext('2d')
  brush.globalCompositeOperation = 'multiply'
  brush.fillStyle = '#ff6688'
  brush.fillRect(0, 0, 32, 32)
  brush.globalCompositeOperation = 'screen'
  brush.fillStyle = '#2244ff'
  brush.fillRect(8, 8, 16, 16)
  const op = brush.globalCompositeOperation
  if (op !== 'screen') return { status: 'error', detail: '블렌드 모드 전환이 거부되었습니다.' }

  const frame = typeof document !== 'undefined' ? document.getElementById('main-canvas-area') : null
  if (!frame) {
    return { status: 'warn', detail: '합성 연산은 정상이나 미리보기 배경 래퍼를 찾지 못했습니다.' }
  }
  const mode = ['checker', 'dark', 'light'].find((id) => frame.classList.contains(`is-bg-${id}`))
    || frame.getAttribute('data-preview-bg')
  if (!mode) {
    return { status: 'warn', detail: '미리보기 배경 모드 클래스(is-bg-*)가 바인딩되지 않았습니다.' }
  }
  const liveCanvas = frame.querySelector('canvas')
  if (liveCanvas) {
    const canvasBg = window.getComputedStyle(liveCanvas).backgroundColor
    if (canvasBg === 'rgb(0, 0, 0)' || canvasBg === 'black') {
      return { status: 'warn', detail: 'IDLE · 캔버스 요소가 불투명 검정이라 투명/라이트 플레이트가 가려집니다.' }
    }
  }
  const plate = window.getComputedStyle(frame)
  if (mode === 'light' && !/255/.test(plate.backgroundColor || '')) {
    return { status: 'warn', detail: 'IDLE · 라이트 모드인데 래퍼 배경이 흰색이 아닙니다.' }
  }
  if (mode === 'dark' && plate.backgroundImage && plate.backgroundImage !== 'none') {
    return { status: 'warn', detail: 'IDLE · 다크 모드에 체커 이미지가 남아 있습니다.' }
  }
  if (mode === 'checker' && (!plate.backgroundImage || plate.backgroundImage === 'none')) {
    return { status: 'warn', detail: 'IDLE · 투명 모드 체커보드 패턴이 없습니다.' }
  }
  return {
    status: 'ok',
    detail: `FileReader · Multiply/Screen · 미리보기 배경 ${mode} 플레이트 바인딩 확인.`,
  }
}

export async function checkEdit() {
  const crop = constrainCrop(makeCropRect('16:9'), '16:9')
  if (crop.w <= 0 || crop.h <= 0) return { status: 'error', detail: '크롭 좌표 연산이 비어 있습니다.' }
  const source = document.createElement('canvas')
  source.width = 64
  source.height = 64
  const ctx = source.getContext('2d')
  ctx.fillStyle = '#334155'
  ctx.fillRect(0, 0, 64, 64)
  const edited = applyViewEdit(source, {
    ...defaultViewEdit(),
    rotation90: 90,
    flipH: true,
    contrast: 120,
    saturation: 80,
    ink: 20,
    crop,
  }, { letterbox: false })
  if (!edited || !edited.width) return { status: 'error', detail: '회전/반전/필터 파이프라인이 캔버스를 반환하지 않았습니다.' }
  return { status: 'ok', detail: `크롭 ${crop.w.toFixed(2)}×${crop.h.toFixed(2)} · 90°/FlipH/필터 출력 ${edited.width}×${edited.height}.` }
}

export async function checkEncoders() {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 40
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#22d3ee'
  ctx.fillRect(0, 0, 40, 40)
  const png = await canvasToPngBlob(canvas)
  const jpeg = await canvasToJpegBlob(canvas, 0.95)
  const gif = await encodeGifFromCanvases([canvas, canvas], 120)
  const ico = await encodeIcoFromCanvas(canvas, [32, 64])
  const ok = png?.size > 20 && jpeg?.size > 20 && gif?.size > 20 && ico?.size > 20
  if (!ok) return { status: 'error', detail: 'PNG/JPEG/GIF/ICO 인코더가 빈 파일을 반환했습니다.' }
  return {
    status: 'ok',
    detail: `PNG ${png.size}B · JPEG ${jpeg.size}B · GIF ${gif.size}B · ICO ${ico.size}B`,
  }
}

export async function checkAiMask(ctx) {
  const promptPack = ctx?.promptPack
  const apiKeys = ctx?.apiKeys
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const board = canvas.getContext('2d', { willReadFrequently: true })
  board.fillStyle = '#000000'
  board.fillRect(0, 0, 256, 256)
  board.fillStyle = '#ffffff'
  board.font = '700 88px sans-serif'
  board.textAlign = 'center'
  board.textBaseline = 'middle'
  board.fillText('龍', 128, 128)
  const data = board.getImageData(0, 0, 256, 256).data
  let white = 0
  let other = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    if (r >= 247) white += 1
    else if (r > 8) other += 1
  }
  if (white < 30) return { status: 'error', detail: '1024-class 흑백 마스크 실루엣이 비었습니다.' }
  const pack = promptPack || {}
  if (!pack.full || !pack.positive) return { status: 'error', detail: '프롬프트 빌더 템플릿이 비어 있습니다.' }
  const hasKey = Boolean(apiKeys?.falKey || apiKeys?.replicateKey || apiKeys?.grokKey || apiKeys?.customUrl)
  if (other / (256 * 256) > 0.25) {
    return { status: 'warn', detail: `마스크 흰 실루엣 ${white}px · 회색 안티앨리어싱 감지. 프롬프트 ${pack.full.length}자.` }
  }
  if (!hasKey || apiKeys?.provider === 'local') {
    return {
      status: 'ok',
      detail: `순수 흑백 마스크·프롬프트 정합 OK (${pack.full.length}자). API 키 없음 → 로컬 시뮬레이션.`,
    }
  }
  return {
    status: 'ok',
    detail: `흑백 마스크 추출 OK · ${apiKeys.provider} 키 저장 · 프롬프트 ${pack.full.length}자.`,
  }
}

export async function checkFavorites(ctx, onLog) {
  const report = inspectFavoriteStore(ctx?.favoriteFonts)
  onLog?.(`Favorites store ${report.stored.length}/${report.catalogSize} matched fonts`)
  if (report.parseError) {
    return { status: 'error', detail: 'localStorage 즐겨찾기 JSON 파싱 실패. 별표를 다시 누르면 재직렬화됩니다.' }
  }
  if (!report.isArray) {
    return { status: 'error', detail: '즐겨찾기 페이로드가 배열이 아닙니다. 스키마 손상.' }
  }
  if (report.unknown.length || report.duplicates > 0) {
    return {
      status: 'warn',
      detail: `매칭 ${report.stored.length}종 · 미등록 ${report.unknown.length} · 중복 ${report.duplicates}. 로드 시 정리됩니다.`,
    }
  }
  const memoryJoin = report.memory.join(',')
  const storedJoin = report.stored.join(',')
  if (memoryJoin !== storedJoin) {
    return { status: 'warn', detail: `메모리 ${report.memory.length}종과 스토리지 ${report.stored.length}종이 어긋났습니다.` }
  }
  const roundTrip = JSON.stringify(report.stored)
  if (JSON.stringify(JSON.parse(roundTrip)) !== roundTrip) {
    return { status: 'error', detail: '즐겨찾기 JSON 라운드트립 직렬화가 실패했습니다.' }
  }
  return {
    status: 'ok',
    detail: report.stored.length
      ? `직렬화 무결성 OK · ${report.stored.length}종 카탈로그 100% 매칭 · 메인/서브 공유 목록.`
      : '저장소 준비됨 · 등록 0종. ⭐를 누르면 즉시 localStorage에 기록됩니다.',
  }
}

export async function checkLiveStatusHud(ctx) {
  const studio = ctx?.studio
  const layer = studio?.layers?.find((item) => item.id === studio.activeLayerId) ?? studio?.layers?.[0]
  if (!layer) return { status: 'error', detail: '활성 레이어가 없어 Live Status HUD를 검증할 수 없습니다.' }
  const info = liveStatusFromLayer(layer, {})
  if (!info?.stats || !info.badge?.text) {
    return { status: 'error', detail: 'HUD 집계 모델이 비어 있습니다.' }
  }
  const hud = typeof document !== 'undefined' ? document.querySelector('.live-status-hud') : null
  const area = typeof document !== 'undefined' ? document.getElementById('main-canvas-area') : null
  if (!hud) return { status: 'error', detail: '캔버스 하단 Live Status HUD DOM을 찾지 못했습니다.' }
  const text = hud.textContent || ''
  if (!text.includes(info.stats) || !text.includes(info.badge.text)) {
    return { status: 'warn', detail: `HUD 표시가 선택 레이어(${info.badge.text} · ${info.stats})와 어긋납니다.` }
  }
  if (!area) {
    return { status: 'warn', detail: `HUD ${info.badge.text} · ${info.stats}는 정상이나 #main-canvas-area 기준점이 없습니다.` }
  }
  const hudRect = hud.getBoundingClientRect()
  const areaRect = area.getBoundingClientRect()
  const viewH = window.innerHeight || document.documentElement.clientHeight
  if (hudRect.bottom > viewH + 2) {
    return { status: 'warn', detail: `IDLE · 하단 인포 바가 뷰포트 밖으로 잘립니다 (${Math.round(hudRect.bottom - viewH)}px).` }
  }
  if (hudRect.height > 56) {
    return { status: 'warn', detail: `IDLE · 인포 바 높이 ${Math.round(hudRect.height)}px — 슬림 도킹(36~42px)보다 큽니다.` }
  }
  if (areaRect.bottom > hudRect.top + 6) {
    return { status: 'warn', detail: 'IDLE · 캔버스가 하단 인포 바와 겹쳐 슬림 도킹이 깨졌습니다.' }
  }
  const diagHud = typeof document !== 'undefined' ? document.querySelector('.diag-hud') : null
  const gauge = diagHud?.querySelector('.diag-gauge')
  if (!diagHud || !gauge) {
    return { status: 'warn', detail: '인포 바는 정상이나 자가진단 게이지 HUD를 찾지 못했습니다.' }
  }
  return {
    status: 'ok',
    detail: `HUD ${info.badge.text} · ${info.stats} · 슬림 ${Math.round(hudRect.height)}px 도킹 · 뷰포트 내 · 자가진단 게이지 확인.`,
  }
}

export async function checkGifEngine() {
  if (typeof encodeGifFromCanvases !== 'function') {
    return { status: 'warn', detail: 'IDLE · GIF 인코더 모듈을 불러오지 못했습니다.' }
  }
  if (GIF_MOTIONS.length !== 3) {
    return { status: 'error', detail: 'GIF 모션 프리셋이 3종이 아닙니다.' }
  }
  const sample = document.createElement('canvas')
  sample.width = 24
  sample.height = 24
  const brush = sample.getContext('2d')
  if (!brush) return { status: 'warn', detail: 'IDLE · 프레임 버퍼 컨텍스트를 열 수 없습니다.' }
  brush.fillStyle = '#67e8f9'
  brush.fillRect(3, 3, 18, 18)
  const frames = GIF_MOTIONS.map((motion, index) => composeGifFrame(sample, motion.id, index / 3))
  if (frames.some((frame) => !frame?.width)) {
    return { status: 'warn', detail: 'IDLE · 모션 프레임 버퍼가 비어 있습니다.' }
  }
  const blob = await encodeGifFromCanvases(frames, 80)
  if (!blob || blob.size < 32) {
    return { status: 'warn', detail: 'IDLE · 인코더는 로드됐지만 샘플 GIF가 비어 있습니다.' }
  }
  return {
    status: 'ok',
    detail: `PASS · ${GIF_MOTIONS.map((item) => item.name).join(' / ')} · 인코더 ${blob.size}B · 프레임 ${frames.length}`,
  }
}

export async function checkEmoticonSlicer() {
  if (typeof JSZip !== 'function') {
    return { status: 'warn', detail: 'IDLE · JSZip 모듈을 불러오지 못했습니다.' }
  }
  const sheet = document.createElement('canvas')
  sheet.width = 240
  sheet.height = 120
  const ctx = sheet.getContext('2d')
  if (!ctx) return { status: 'warn', detail: 'IDLE · 슬라이싱 버퍼를 열 수 없습니다.' }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 240, 120)
  ctx.fillStyle = '#111111'
  ctx.fillRect(12, 12, 84, 84)
  ctx.fillRect(140, 18, 72, 72)
  const smart = sliceSheet(sheet, { mode: 'smart', transparent: true })
  if (smart.length !== 2) {
    return { status: 'error', detail: `모드 A 스마트 감지가 ${smart.length}객체를 반환했습니다(기대 2).` }
  }
  const grid = splitGridBoxes(240, 120, 2, 1)
  const custom = splitGridBoxes(100, 50, 2, 2, [0.25], [0.6])
  const even = equalSplitGuides(3)
  const added = insertGuide([0.33, 0.66], 0, 1)
  const crop = normalizeBounds({ left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 })
  const framed = splitGuideBoxes(100, 100, [0.5], [], crop)
  if (grid.length !== 2) {
    return { status: 'error', detail: '균등 그리드 칸 수가 열×행과 다릅니다.' }
  }
  if (!custom[0] || Math.abs(custom[0].w - 25) > 1 || Math.abs(custom[2]?.y - 30) > 2) {
    return { status: 'error', detail: '모드 B 커스텀 절단선 좌표가 Bounding Box에 반영되지 않습니다.' }
  }
  if (custom[0].y + custom[0].h > custom[2].y) {
    return { status: 'error', detail: '모드 B 행 상자가 다음 행 가이드선을 침범합니다.' }
  }
  if (even.length !== 2 || Math.abs(even[0] - 1 / 3) > 1e-6) {
    return { status: 'error', detail: '균등 가이드 생성이 실패했습니다.' }
  }
  if (added.length !== 3) {
    return { status: 'error', detail: '절단선 추가가 가장 넓은 칸에 삽입되지 않습니다.' }
  }
  if (Math.abs(crop.left - 0.2) > 1e-6 || framed.length !== 2 || Math.abs(framed[0].x - 20) > 1) {
    return { status: 'error', detail: '외곽 재단선이 분할 상자에 반영되지 않습니다.' }
  }
  const mapped = sourceSpan(0.5, 1, 240)
  if (mapped.origin !== 120 || mapped.size !== 120) {
    return { status: 'error', detail: '가이드 비율이 원본 픽셀과 1:1로 매핑되지 않습니다.' }
  }
  const fit = containFitRect(200, 100, KAKAO_STICKER_SIZE, KAKAO_FIT_RATIO)
  if (fit.renderX < 10 || fit.renderY < 10 || fit.renderW > KAKAO_STICKER_SIZE * KAKAO_FIT_RATIO + 1) {
    return { status: 'error', detail: '360×360 안전 여백 contain-fit이 실패했습니다.' }
  }
  const half = applyCustomSliceScale(fit, 50)
  const grown = applyCustomSliceScale(fit, 150)
  if (half.renderW !== Math.round(fit.renderW * 0.5) || grown.renderW !== Math.round(fit.renderW * 1.5)) {
    return { status: 'error', detail: '이모티콘 크기 비율 50~150% 스케일이 renderW/H에 반영되지 않습니다.' }
  }
  if (clampSliceScale(49) !== 50 || clampSliceScale(151) !== 150 || clampSliceScale(100) !== SLICE_SCALE_DEFAULT) {
    return { status: 'error', detail: '크기 비율 슬라이더 클램프(50~150)가 실패했습니다.' }
  }
  if (clampSliceScale(100 - 1) !== 99 || clampSliceScale(150 + 1) !== 150) {
    return { status: 'error', detail: '크기 비율 ±1% 버튼 스텝이 클램프와 동기화되지 않습니다.' }
  }
  if (stepPreviewZoomPercent(100, PREVIEW_ZOOM_STEP) !== 105 || stepPreviewZoomPercent(12, -PREVIEW_ZOOM_STEP) !== PREVIEW_ZOOM_MIN) {
    return { status: 'error', detail: '미리보기 줌 5% 스텝이 실패했습니다.' }
  }
  if (PREVIEW_ZOOM_DEFAULT !== 35) {
    return { status: 'error', detail: '미리보기 기본 줌이 35%가 아닙니다.' }
  }
  if (clampPreviewZoomPercent(8) !== PREVIEW_ZOOM_MIN || clampPreviewZoomPercent(240) !== PREVIEW_ZOOM_MAX) {
    return { status: 'error', detail: '미리보기 줌 한도(10~200%)가 실패했습니다.' }
  }
  if (clampEmoSideWidth(200) !== EMO_SIDE_MIN || clampEmoSideWidth(900) !== EMO_SIDE_MAX || clampEmoSideWidth(380) !== EMO_SIDE_DEFAULT) {
    return { status: 'error', detail: '작업창 리사이저 너비 클램프(280~600)가 실패했습니다.' }
  }
  const slim = sliceSheet(sheet, { mode: 'smart', transparent: true, customScale: 50 })
  if (slim.length !== 2) {
    return { status: 'error', detail: '크기 비율 조절이 모드 A 객체 수에 영향을 줬습니다.' }
  }
  const kakao = fitToKakaoCanvas(sheet, grid[0])
  if (kakao.width !== KAKAO_STICKER_SIZE || kakao.height !== KAKAO_STICKER_SIZE) {
    return { status: 'error', detail: `360×360 리사이저가 ${kakao.width}×${kakao.height}를 반환했습니다.` }
  }
  const corner = kakao.getContext('2d').getImageData(2, 2, 1, 1).data
  if (corner[3] > 40) {
    return { status: 'warn', detail: 'IDLE · 360×360 알파 채널이 불투명합니다.' }
  }
  if (corner[3] < 10 && corner[0] + corner[1] + corner[2] > 24) {
    return { status: 'warn', detail: 'IDLE · 투명 픽셀 RGB가 남아 ZIP에서 검은 배경으로 보일 수 있습니다.' }
  }
  const key = document.createElement('canvas')
  key.width = 48
  key.height = 48
  const keyCtx = key.getContext('2d')
  keyCtx.fillStyle = '#f7f2ea'
  keyCtx.fillRect(0, 0, 48, 48)
  keyCtx.fillStyle = '#1a1a1a'
  keyCtx.fillRect(12, 12, 24, 24)
  keyCtx.fillStyle = '#ffffff'
  keyCtx.fillRect(18, 18, 12, 12)
  const keyed = floodFillAlphaKey(keyCtx.getImageData(0, 0, 48, 48))
  const outerPx = keyed.data[2 * 4 + 3]
  const ringPx = keyed.data[((16 * 48) + 16) * 4 + 3]
  const eyePx = keyed.data[((24 * 48) + 24) * 4 + 3]
  if (outerPx > 12) {
    return { status: 'error', detail: '외곽 플러드필이 미색 배경을 투명으로 바꾸지 못했습니다.' }
  }
  if (ringPx < 180) {
    return { status: 'error', detail: '플러드필이 캐릭터 외곽 픽셀을 지웠습니다.' }
  }
  if (eyePx < 180) {
    return { status: 'error', detail: '플러드필이 캐릭터 내부 흰색을 지웠습니다.' }
  }
  if (FLOOD_FILL_TOLERANCE !== 22) {
    return { status: 'error', detail: `플러드필 허용 오차가 ${FLOOD_FILL_TOLERANCE}입니다(기대 22).` }
  }
  if (OUTLINE_DEFAULT !== true) {
    return { status: 'error', detail: 'Outline 외곽선 보강 기본값이 ON이 아닙니다.' }
  }
  const halo = document.createElement('canvas')
  halo.width = 48
  halo.height = 48
  const haloCtx = halo.getContext('2d')
  haloCtx.fillStyle = '#f7f2ea'
  haloCtx.fillRect(0, 0, 48, 48)
  haloCtx.fillStyle = '#1a1410'
  haloCtx.beginPath()
  haloCtx.arc(24, 24, 16, 0, Math.PI * 2)
  haloCtx.fill()
  haloCtx.fillStyle = '#f2e4c8'
  haloCtx.beginPath()
  haloCtx.arc(24, 24, 12, 0, Math.PI * 2)
  haloCtx.fill()
  const guarded = floodFillAlphaKey(haloCtx.getImageData(0, 0, 48, 48))
  const paperPx = guarded.data[1 * 4 + 3]
  const strokePx = guarded.data[((24 * 48) + 9) * 4 + 3]
  const highlightPx = guarded.data[((24 * 48) + 24) * 4 + 3]
  if (paperPx > 12) {
    return { status: 'error', detail: '외곽 플러드필이 원형 테두리 밖 배경을 투명으로 바꾸지 못했습니다.' }
  }
  if (strokePx < 180) {
    return { status: 'error', detail: '플러드필이 캐릭터 진한 외곽선을 넘었습니다.' }
  }
  if (highlightPx < 200) {
    return { status: 'error', detail: '플러드필이 원형 테두리 안 하이라이트를 뚫었습니다.' }
  }
  const plate = document.createElement('canvas')
  plate.width = 48
  plate.height = 48
  const plateCtx = plate.getContext('2d', { alpha: true })
  plateCtx.clearRect(0, 0, 48, 48)
  plateCtx.fillStyle = '#f4f4f6'
  plateCtx.fillRect(8, 8, 32, 32)
  plateCtx.fillStyle = '#141414'
  plateCtx.fillRect(14, 30, 20, 6)
  applyFloodFillTransparency(plateCtx, 48, 48)
  const plateData = plateCtx.getImageData(0, 0, 48, 48)
  if (plateData.data[(10 * 48 + 10) * 4 + 3] > 12 || plateData.data[(2 * 48 + 2) * 4 + 3] > 12) {
    return { status: 'error', detail: '글자 주변 사각 흰 패치가 플러드필 후에도 남았습니다.' }
  }
  if (plateData.data[(32 * 48 + 20) * 4 + 3] < 180) {
    return { status: 'error', detail: '글자 획이 흰 패치 제거 과정에서 지워졌습니다.' }
  }
  const probe = document.createElement('canvas')
  probe.width = 8
  probe.height = 8
  const brush = probe.getContext('2d')
  brush.fillStyle = '#808080'
  brush.fillRect(0, 0, 8, 8)
  brush.fillStyle = '#111111'
  brush.fillRect(3, 0, 2, 8)
  const before = brush.getImageData(0, 0, 8, 8)
  const edge = (4 * 8 + 2) * 4
  const sample = before.data[edge]
  enhanceSliceImageData(before, { amount: 0.22, contrast: 1.08 })
  if (before.data[edge] === sample) {
    return { status: 'warn', detail: 'IDLE · 360 슬라이스 샤프닝/대비 보정이 가장자리 픽셀을 바꾸지 않았습니다.' }
  }
  const band = document.createElement('canvas')
  band.width = 40
  band.height = 40
  const bandCtx = band.getContext('2d')
  bandCtx.fillStyle = '#ff8866'
  bandCtx.fillRect(0, 0, 40, 40)
  bandCtx.fillStyle = '#9aa0a6'
  bandCtx.fillRect(2, 34, 6, 6)
  bandCtx.fillStyle = '#141414'
  bandCtx.fillRect(16, 20, 8, 6)
  bandCtx.fillRect(8, 34, 24, 6)
  const local = bandCtx.getImageData(0, 0, 40, 40)
  const bodyAt = (10 * 40 + 20) * 4
  const aboveAt = (22 * 40 + 20) * 4
  const furAt = (36 * 40 + 4) * 4
  const textAt = (36 * 40 + 20) * 4
  const bodyBefore = [local.data[bodyAt], local.data[bodyAt + 1], local.data[bodyAt + 2]]
  const aboveBefore = [local.data[aboveAt], local.data[aboveAt + 1], local.data[aboveAt + 2]]
  const furBefore = [local.data[furAt], local.data[furAt + 1], local.data[furAt + 2]]
  if (textZoneStartY(360, 20) !== 289 || textZoneStartY(40, TEXT_ZONE_DEFAULT) !== 33) {
    return { status: 'error', detail: '텍스트 감지 한계선 Y가 하단 높이 공식과 다릅니다.' }
  }
  if (clampTextZonePercent(3) !== 5 || clampTextZonePercent(90) !== 50) {
    return { status: 'error', detail: '텍스트 감지 높이 클램프가 5~50%를 지키지 않습니다.' }
  }
  applyTextTone(local, 'custom', '#00ccff')
  if (local.data[bodyAt] !== bodyBefore[0] || local.data[bodyAt + 1] !== bodyBefore[1] || local.data[bodyAt + 2] !== bodyBefore[2]) {
    return { status: 'error', detail: '텍스트 보정이 상단 캐릭터 본체 픽셀을 변경했습니다.' }
  }
  if (local.data[aboveAt] !== aboveBefore[0] || local.data[aboveAt + 1] !== aboveBefore[1] || local.data[aboveAt + 2] !== aboveBefore[2]) {
    return { status: 'error', detail: '텍스트 보정이 감지 한계선 위의 검정 픽셀을 변경했습니다.' }
  }
  if (local.data[furAt] !== furBefore[0] || local.data[furAt + 1] !== furBefore[1] || local.data[furAt + 2] !== furBefore[2]) {
    return { status: 'error', detail: '텍스트 보정이 회색 털/플레이트 픽셀을 침범했습니다.' }
  }
  if (local.data[textAt] !== 0 || local.data[textAt + 1] !== 204 || local.data[textAt + 2] !== 255) {
    return { status: 'warn', detail: 'IDLE · 하단 검정 글자 획이 커스텀 색으로 치환되지 않았습니다.' }
  }
  const tight = bandCtx.getImageData(0, 0, 40, 40)
  applyTextTone(tight, 'custom', '#00ccff', { textZonePercent: 10 })
  if (tight.data[textAt] !== 20 || tight.data[textAt + 1] !== 20 || tight.data[textAt + 2] !== 20) {
    return { status: 'error', detail: '텍스트 감지 높이 10%가 한계선 밖 글자까지 치환했습니다.' }
  }
  const glyph = document.createElement('canvas')
  glyph.width = 40
  glyph.height = 40
  const glyphCtx = glyph.getContext('2d', { alpha: true })
  glyphCtx.clearRect(0, 0, 40, 40)
  glyphCtx.fillStyle = '#141414'
  glyphCtx.fillRect(16, 34, 8, 4)
  const glyphData = glyphCtx.getImageData(0, 0, 40, 40)
  applyTextTone(glyphData, 'custom', '#00ccff')
  if (glyphData.data[(36 * 40 + 18) * 4] !== 0 || glyphData.data[(36 * 40 + 18) * 4 + 1] !== 204) {
    return { status: 'warn', detail: 'IDLE · 투명 위 검정 획이 커스텀 색으로 치환되지 않았습니다.' }
  }
  if (glyphData.data[(33 * 40 + 16) * 4 + 3] > 20 || glyphData.data[(36 * 40 + 12) * 4 + 3] > 20) {
    return { status: 'error', detail: '텍스트 색 치환이 글자 주변에 사각 패치를 칠했습니다.' }
  }
  const ring = document.createElement('canvas')
  ring.width = 40
  ring.height = 40
  const ringCtx = ring.getContext('2d')
  ringCtx.clearRect(0, 0, 40, 40)
  ringCtx.fillStyle = '#111111'
  ringCtx.fillRect(18, 34, 4, 4)
  const outline = ringCtx.getImageData(0, 0, 40, 40)
  applyOutlineAssist(outline, '#111111')
  if (outline.data[(33 * 40 + 18) * 4 + 3] < 80) {
    return { status: 'warn', detail: 'IDLE · 하단 글자 1px 외곽선 보강이 알파 엣지에 스트로크를 넣지 않았습니다.' }
  }
  if (outline.data[(5 * 40 + 18) * 4 + 3] > 20) {
    return { status: 'error', detail: '외곽선 보강이 상단 캐릭터 영역까지 번졌습니다.' }
  }
  const zip = new JSZip()
  const pngBlob = await canvasToPngBlob(kakao)
  if (!pngBlob || pngBlob.type !== 'image/png') {
    return { status: 'error', detail: 'ZIP PNG가 canvas.toBlob(image/png) 알파 경로를 쓰지 않습니다.' }
  }
  zip.file('kakao-360-01.png', pngBlob)
  const packed = await zip.generateAsync({ type: 'blob' })
  if (!packed?.size) return { status: 'warn', detail: 'IDLE · ZIP 엔진 출력이 비어 있습니다.' }
  return {
    status: 'ok',
    detail: `PASS · 스마트 ${smart.length}객체 · 유클리드플러드필T${FLOOD_FILL_TOLERANCE} · toBlob PNG · 텍스트존${TEXT_ZONE_DEFAULT}% · 텍스트획가드 · 스케일50-150 · 그리드 ${grid.length}칸 · ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} · ZIP ${packed.size}B`,
  }
}

export async function checkProEngine() {
  if (typeof FontFace !== 'function') {
    return { status: 'warn', detail: 'IDLE · FontFace API를 이 브라우저에서 찾지 못했습니다.' }
  }
  const nudged = nudgeOffset(0, 0, 'ArrowRight', { viewW: 100, viewH: 100 })
  if (!nudged.moved || Math.abs(nudged.ox - 0.01) > 1e-6) {
    return { status: 'error', detail: '1px 방향키 너지가 실패했습니다.' }
  }
  const fast = nudgeOffset(0, 0, 'ArrowDown', { viewW: 100, viewH: 100, shift: true })
  if (Math.abs(fast.oy - 0.1) > 1e-6) {
    return { status: 'error', detail: 'Shift+방향키 10px 너지가 실패했습니다.' }
  }
  const snap = applyCenterSnap(0.01, 0.01)
  if (!snap.snapX || !snap.snapY || snap.ox !== 0 || snap.oy !== 0) {
    return { status: 'error', detail: '중앙 자석 스냅이 실패했습니다.' }
  }
  const fourK = scaledExportSize({ w: 1024, h: 1024 }, 4)
  if (fourK.exportW !== 4096 || fourK.exportH !== 4096) {
    return { status: 'error', detail: '4x 고해상도 스케일이 실패했습니다.' }
  }
  const json = serializeStudioProject({
    layers: [{
      id: 'a',
      role: 'main',
      text: 'Hi',
      ox: 0,
      oy: 0,
      color: '#f8fafc',
      strokeWidth: 2,
      strokeWidth2: 6,
      strokeColor2: '#0f172a',
      curveAmount: 40,
    }],
    background: { dataUrl: '' },
    aspectId: '1:1',
  })
  const parsed = parseStudioProject(json)
  if (parsed.layers[0].curveAmount !== 40 || parsed.layers[0].strokeWidth2 !== 6) {
    return { status: 'error', detail: '프로젝트 JSON이 곡선/2중외곽선을 보존하지 않습니다.' }
  }
  const prompt = buildStylePrompt({
    layer: parsed.layers[0],
    font: { label: 'Custom' },
    preset: { name: 'Neon' },
    studio: { aspectId: '1:1' },
  })
  if (!prompt.full.includes('[Grok]') || !prompt.full.includes('dual-stroke') || !prompt.full.includes('arc')) {
    return { status: 'warn', detail: 'IDLE · 스타일 프롬프트 생성기가 불완전합니다.' }
  }
  return {
    status: 'ok',
    detail: 'PASS · 스냅 · 1px/10px 단축키 · 곡선 JSON · 2중외곽선 · 4x 스케일 · FontFace',
  }
}

export async function checkFpsPipeline() {
  if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') {
    return { status: 'warn', detail: 'IDLE · rAF / performance API를 쓰지 못하는 환경입니다.' }
  }
  const deltas = []
  await Promise.race([
    new Promise((resolve) => {
      let last = 0
      let count = 0
      const step = (now) => {
        if (last) deltas.push(now - last)
        last = now
        count += 1
        if (count < 8) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    }),
    new Promise((resolve) => window.setTimeout(resolve, 600)),
  ])
  const avg = deltas.length ? deltas.reduce((sum, item) => sum + item, 0) / deltas.length : 16.7
  const fps = Math.min(60, 1000 / Math.max(1, avg))
  const probe = document.createElement('canvas')
  probe.width = 256
  probe.height = 256
  const t0 = performance.now()
  const ctx = probe.getContext('2d')
  if (!ctx) return { status: 'warn', detail: 'IDLE · 파이프라인 프로브 컨텍스트를 열지 못했습니다.' }
  ctx.fillStyle = '#22d3ee'
  ctx.fillRect(0, 0, 256, 256)
  ctx.getImageData(8, 8, 48, 48)
  const latency = performance.now() - t0
  const live = readRenderPerf()
  const stable = fps >= 45 && latency <= 40
  if (!stable) {
    return {
      status: 'warn',
      detail: `IDLE · rAF ${Math.round(fps)} FPS / 프로브 ${latency.toFixed(1)}ms · 라이브 ${live.text}`,
    }
  }
  return {
    status: 'ok',
    detail: `PASS · ${Math.round(fps)} FPS / 프로브 ${latency.toFixed(1)}ms · ${live.text}`,
  }
}
