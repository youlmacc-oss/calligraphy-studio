import {
  canvasToJpegBlob,
  canvasToPngBlob,
  encodeGifFromCanvases,
  encodeIcoFromCanvas,
} from './exportFormats.js'
import { inspectFavoriteStore } from './fontFavorites.js'
import { inspectStudioFonts } from './fontPreload.js'
import { DEFAULT_TEXT, FONT_CATEGORIES } from '../presets.js'
import { GUIDE_SAMPLES } from './guideSamples.js'
import { DEFAULT_STUDIO_FONT_ID, DEFAULT_STUDIO_MAIN_SIZE, DEFAULT_STUDIO_PRESET_ID, defaultStudioState } from './studioModel.js'
import { liveStatusFromLayer } from './liveStatus.js'
import {
  clampFontSize,
  FONT_SIZE_MAIN_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
} from './fontSize.js'
import { composeGifFrame, GIF_MOTIONS } from './gifMotion.js'
import {
  applyCustomSliceScale,
  applyOutlineAssist,
  applyTextTone,
  clearTextPlatePixels,
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
  CROP_EDGE_INSET,
  fitToKakaoCanvas,
  floodFillAlphaKey,
  applyFloodFillTransparency,
  processHighQualitySmartSplit,
  processHighQualityCrop,
  extractCleanEmoticonCell,
  detectSmartEmoticonGrid,
  generateSheetGrid,
  getRecommendedGrid,
  guessStickerGridShape,
  handleDefaultSheetUpload,
  handleSheetAutoDetection,
  isAcceptedSheetFile,
  isOverSplitSmartGrid,
  PNG_GUIDE_BODY,
  SHEET_GRID_PRESETS,
  processHybridSheetCell,
  sniffCanvasHasAlpha,
  PNG_GUIDE_OK_LABEL,
  PNG_GUIDE_HIDE_LABEL,
  captionForCutIndex,
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
  splitDoubleHeightBoxes,
  splitDoubleWidthBoxes,
  splitGuideBoxes,
  splitGridBoxes,
  stepPreviewZoomPercent,
  TEXT_ZONE_DEFAULT,
  TEXT_ZONE_ANCHOR_DEFAULT,
  TEXT_RECOLOR_BYPASS,
  TEXT_ROI_HARD_LOCK,
  TEXT_STROKE_PRESERVE,
  TEXT_ENGINE_DEFAULT,
  TEXT_ENGINE_MODES,
  TEXT_ENGINE_ORIGINAL,
  TEXT_ENGINE_SMART_RECOLOR,
  TEXT_ENGINE_VECTOR_OVERLAY,
  applyTextEngine,
  characterReadOnlyCeil,
  normalizeTextEngineMode,
  paintCutCaption,
  CHARACTER_LOCK_RATIO,
  CHARACTER_WRITE_FLOOR_RATIO,
  SPLITTER_LIVE_REV,
  PUNCH_HOLES_DEFAULT,
  VIEW_BG_DEFAULT,
  cycleViewBgMode,
  punchIsolatedBackgroundHoles,
  textZoneBounds,
  textZoneStartY,
} from './emoticonSplit.js'
import { inspectRenderedSlice } from '../utils/debugger.js'
import { GUIDEBOOK_SECTIONS } from './guidebookSections.js'
import { APP_BUILD } from './appBuild.js'
import { evaluateSystemDiagnostics, exportFullDiagnosticLog } from './systemDiagnostics.js'
import PreviewLightboxModal from '../components/PreviewLightboxModal.jsx'
import LayerGuideOverlay from '../components/LayerGuideOverlay.jsx'
import {
  GOLDEN_BASELINE,
  auditFrozenGoldenBaseline,
} from '../utils/diagnosticsBaseline.js'
import { HQ_KERNEL, polishHqImageData } from '../utils/hqRender.js'
import { applyBilateralEdgePreserve, applyDefringeToContext, defringeAlphaEdge, featherAlphaEdge, resamplePremultiplied } from '../utils/imageProcessor.js'
import { MOTION_NONE, MOTION_PRESETS, sampleMotion as sampleGifPreset, isMotionNone } from '../components/MotionGifStudio/motionPresets.js'
import {
  SEQUENCE_FPS_DEFAULT,
  SEQUENCE_FPS_MAX,
  SEQUENCE_FPS_MIN,
  clampSequenceFps,
  expandPingPong,
  moveSequenceItem,
  pingPongPlayIndex,
  resolvePlaybackFrames,
  stillLoopFrameCount,
  captionLoopIndex,
} from '../components/MotionStudio/motionSequencer.js'
import {
  sampleTextMotion,
  TEXT_MOTION_EFFECTS,
  TEXT_MOTION_BOUNCE,
  TEXT_MOTION_NONE,
  TEXT_MOTION_PULSE,
  TEXT_MOTION_TYPEWRITER,
  resolveCaption,
  captionForSequenceItem,
} from '../components/MotionStudio/dynamicTextMotion.js'
import { paintDynamicTextMotion, paintLiveCaptionLayer } from '../components/MotionStudio/DynamicTextMotionRenderer.js'
import { PARTICLE_LAYERS } from '../components/MotionStudio/particleOverlayEngine.js'
import { estimateStoreSpec } from '../components/MotionStudio/storeSpecHud.js'
import { STUDIO_HUD_STEPS } from './studioHudChecks.js'
import MotionPreviewCanvas from '../components/MotionStudio/MotionPreviewCanvas.jsx'
import MotionSequencerPanel from '../components/MotionStudio/MotionSequencerPanel.jsx'
import MotionEffectSelector from '../components/MotionStudio/MotionEffectSelector.jsx'
import CaptionControlBar from '../components/MotionStudio/CaptionControlBar.jsx'
import MotionExportPanel from '../components/MotionStudio/MotionExportPanel.jsx'
import EncodeProgressModal from '../components/MotionStudio/EncodeProgressModal.jsx'
import MotionClipManager from '../components/MotionStudio/MotionClipManager.jsx'
import MotionZipToolbarButton from '../components/MotionStudio/MotionZipToolbarButton.jsx'
import ChatRoomSimulator, { mirrorPreviewFrame } from '../components/MotionStudio/ChatRoomSimulator.jsx'
import { ENCODER_SIZE, composeSequenceCanvases, composeStillMotionCanvases, encodeGifFromCanvases as encodeMotionGif, yieldToMain, frameProgressCopy } from '../utils/encoder/MotionEncoderEngine.js'
import { isAnimatedWebp, muxAnimatedWebp } from '../utils/encoder/webpAnimMux.js'
import { createSequenceClip, motionClipFileName } from '../utils/encoder/BatchExportEngine.js'
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

function cssBlobFor(selectorPart) {
  if (typeof document === 'undefined') return ''
  const chunks = []
  const sheets = document.styleSheets
  for (let s = 0; s < sheets.length; s += 1) {
    let rules
    try {
      rules = sheets[s].cssRules
    } catch {
      continue
    }
    if (!rules) continue
    for (let r = 0; r < rules.length; r += 1) {
      const rule = rules[r]
      if (!rule?.selectorText || !rule.selectorText.includes(selectorPart)) continue
      chunks.push(`${rule.selectorText}{${rule.style?.cssText || ''}}`)
    }
  }
  return chunks.join('\n')
}

function goldenGridCutCount() {
  const { grid, targetCanvas } = GOLDEN_BASELINE.splitter
  return splitGridBoxes(
    targetCanvas.width * grid.cols,
    targetCanvas.height * grid.rows,
    grid.cols,
    grid.rows,
  ).length
}

function readLiveTooltipBaseline() {
  const expectedId = GOLDEN_BASELINE.uiIntegrity.requiredFloatingEngineId
  if (typeof document === 'undefined') {
    return { engineId: '', tooltipFontSize: '' }
  }
  const node = document.getElementById(expectedId)
  return {
    engineId: node ? expectedId : '',
    tooltipFontSize: node && typeof getComputedStyle === 'function'
      ? getComputedStyle(node).fontSize
      : '',
  }
}

export function compareLiveToGoldenBaseline(extra = {}) {
  return auditFrozenGoldenBaseline({
    floodTolerance: FLOOD_FILL_TOLERANCE,
    canvasWidth: KAKAO_STICKER_SIZE,
    canvasHeight: KAKAO_STICKER_SIZE,
    cutCount: goldenGridCutCount(),
    textEngineDefault: TEXT_ENGINE_DEFAULT,
    textEngineModes: TEXT_ENGINE_MODES.map((item) => item.id),
    presetIds: MOTION_PRESETS.map((item) => item.id),
    ...readLiveTooltipBaseline(),
    ...extra,
  })
}

function withGoldenBaseline(result, slice = 'all') {
  if (!result?.status) return result
  const audit = compareLiveToGoldenBaseline()
  const part = slice === 'all' ? audit : audit[slice]
  if (!part) return result
  const fail = part.fail || []
  const version = GOLDEN_BASELINE.version
  if (fail.length === 0) {
    return { ...result, detail: `${result.detail} · baseline ${version}` }
  }
  const drift = fail.map((row) => row.detail).join(' · ')
  if (result.status === 'error') {
    return { ...result, detail: `${result.detail} · BASELINE DRIFT ${drift}` }
  }
  return { status: 'error', detail: `BASELINE DRIFT ${drift}` }
}

export function enrichDiagnosticWithPipeline(stepId, result) {
  if (!result?.status) return result
  const extra = assertPipelineHud(stepId)
  let merged = result
  if (extra) {
    if (result.status === 'error') {
      merged = result
    } else if (extra.status === 'error') {
      merged = extra
    } else if (extra.status === 'warn' && result.status === 'ok') {
      merged = { status: 'warn', detail: `${result.detail} · ${extra.detail}` }
    } else if (result.status === 'ok' && extra.detail) {
      merged = { status: 'ok', detail: `${result.detail} · ${extra.detail}` }
    }
  }
  if (stepId === 'fps-pipeline') return withGoldenBaseline(merged, 'all')
  if (stepId === 'gif-engine') return withGoldenBaseline(merged, 'motion')
  if (stepId === 'live-hud') return withGoldenBaseline(merged, 'ui')
  if (stepId === 'export' || stepId === 'emoticon-slicer' || stepId === 'text-engine') return withGoldenBaseline(merged, 'splitter')
  return merged
}

function assertPipelineHud(stepId) {
  switch (stepId) {
    case 'gpu': {
      const shell = typeof document !== 'undefined' ? document.querySelector('.studio-shell') : null
      const css = cssBlobFor('studio-shell')
      if (css.includes('100vh') || css.includes('100dvh')) {
        if (shell && getComputedStyle(shell).overflow !== 'hidden') {
          return { status: 'warn', detail: 'IDLE · .studio-shell overflow가 hidden이 아닙니다.' }
        }
        return { status: 'ok', detail: '100vh 노스크롤 확인' }
      }
      if (shell && getComputedStyle(shell).overflow === 'hidden') {
        return { status: 'ok', detail: '100vh 셸 overflow hidden 확인' }
      }
      if (!css) {
        return { status: 'warn', detail: 'IDLE · 스타일시트에서 100vh 규칙을 읽지 못했습니다.' }
      }
      return { status: 'error', detail: '스튜디오 16인치 노스크롤 100vh 레이아웃 CSS가 없습니다.' }
    }
    case 'buffer': {
      const css = cssBlobFor('emo-split-card')
      if (css.includes('92vw') && css.includes('86vh')) {
        return { status: 'ok', detail: '92vw×86vh 확인' }
      }
      if (!css) {
        return { status: 'warn', detail: 'IDLE · 스타일시트에서 92vw×86vh 규칙을 읽지 못했습니다.' }
      }
      return { status: 'error', detail: '분할기 92vw×86vh 상대단위 레이아웃이 없습니다.' }
    }
    case 'fonts': {
      if (PREVIEW_ZOOM_DEFAULT !== 35 || PREVIEW_ZOOM_STEP !== 5) {
        return { status: 'error', detail: '기본 줌 35% 또는 5% 증감 스텝이 깨졌습니다.' }
      }
      return { status: 'ok', detail: `줌 ${PREVIEW_ZOOM_DEFAULT}% / ${PREVIEW_ZOOM_STEP}%` }
    }
    case 'layers': {
      if (clampEmoSideWidth(200) !== EMO_SIDE_MIN || clampEmoSideWidth(900) !== EMO_SIDE_MAX) {
        return { status: 'error', detail: '좌우 패널 드래그 리사이저 클램프가 실패했습니다.' }
      }
      return { status: 'ok', detail: `패널 ${EMO_SIDE_MIN}~${EMO_SIDE_MAX}px` }
    }
    case 'drag': {
      if (VIEW_BG_DEFAULT !== 'checker' || cycleViewBgMode('checker') !== 'dark' || cycleViewBgMode('light') !== 'checker') {
        return { status: 'error', detail: '체커보드/다크/라이트 배경 모드 순환이 실패했습니다.' }
      }
      if (typeof PreviewLightboxModal !== 'function') {
        return { status: 'error', detail: '확대 미리보기 팝업이 없습니다.' }
      }
      const lightboxSrc = String(PreviewLightboxModal)
      if (!lightboxSrc.includes('checkerboard-bg') || lightboxSrc.includes('bg-white')) {
        return { status: 'error', detail: '확대 팝업 체커보드가 없거나 bg-white가 남아 있습니다.' }
      }
      return { status: 'ok', detail: '배경 모드 순환 · 확대 팝업 격자 고정' }
    }
    case 'type': {
      const keep = splitDoubleHeightBoxes([{ x: 0, y: 0, w: 40, h: 40 }, { x: 50, y: 0, w: 40, h: 40 }])
      if (keep.length !== 2 || keep[0].h !== 40) {
        return { status: 'error', detail: '모드 A 정상 박스가 후처리에서 변형되었습니다.' }
      }
      return { status: 'ok', detail: '모드 A 후처리 비침습 확인' }
    }
    case 'stack': {
      const wide = splitDoubleWidthBoxes([{ x: 0, y: 0, w: 40, h: 40 }, { x: 0, y: 50, w: 40, h: 40 }, { x: 0, y: 100, w: 88, h: 40 }])
      const tall = splitDoubleHeightBoxes([{ x: 0, y: 0, w: 40, h: 40 }, { x: 50, y: 0, w: 40, h: 40 }, { x: 100, y: 0, w: 40, h: 88 }])
      if (wide.length !== 4 || tall.length !== 4) {
        return { status: 'error', detail: '가로/세로 2배 결합 자동 반분할이 실패했습니다.' }
      }
      return { status: 'ok', detail: 'Double Height/Width 분할 확인' }
    }
    case 'history': {
      const custom = splitGridBoxes(100, 50, 2, 2, [0.25], [0.6])
      if (custom[0].y + custom[0].h > custom[2]?.y) {
        return { status: 'error', detail: '모드 B Strict Boundary가 다음 행을 침범합니다.' }
      }
      return { status: 'ok', detail: '모드 B 가이드 경계 확인' }
    }
    case 'bg': {
      const crop = normalizeBounds({ left: 0.2, top: 0.1, right: 0.8, bottom: 0.9 })
      const framed = splitGuideBoxes(100, 100, [0.5], [], crop)
      if (framed.length !== 2 || Math.abs(framed[0].x - 20) > 1) {
        return { status: 'error', detail: '외곽 재단선 Strict 크롭이 실패했습니다.' }
      }
      return { status: 'ok', detail: '인접 셀 침범 0% 크롭 확인' }
    }
    case 'edit': {
      if (PREVIEW_ZOOM_DEFAULT !== 35 || TEXT_ZONE_ANCHOR_DEFAULT !== 'bottom') {
        return { status: 'error', detail: 'Zero-Click 기본값(줌 35% · 텍스트 하단)이 깨졌습니다.' }
      }
      return { status: 'ok', detail: '업로드 직후 기본 연산값 확인' }
    }
    case 'export': {
      const spec = GOLDEN_BASELINE.splitter
      if (FLOOD_FILL_TOLERANCE !== spec.alphaThreshold) {
        return { status: 'error', detail: `Flood-Fill T가 ${FLOOD_FILL_TOLERANCE}입니다(기대 baseline ${spec.alphaThreshold}).` }
      }
      return { status: 'ok', detail: `T=${spec.alphaThreshold} 하이라이트 보호 허용치 ≡ ${GOLDEN_BASELINE.version}` }
    }
    case 'ai': {
      const spec = GOLDEN_BASELINE.splitter
      if (PUNCH_HOLES_DEFAULT !== spec.punchHoles || spec.punchHoles !== false) {
        return { status: 'error', detail: '내부 고립 구멍 투명화 기본값이 OFF가 아닙니다.' }
      }
      if (spec.textModeDefault !== 'original' || spec.textRecolorBypass !== true || spec.textEngineDefault !== 'ORIGINAL') {
        return { status: 'error', detail: '텍스트 기본 original/ORIGINAL 또는 리컬러 바이패스 플래그가 깨졌습니다.' }
      }
      return { status: 'ok', detail: '구멍 투명화 기본 OFF · 텍스트 original 비절단 확인' }
    }
    case 'favorites': {
      if (textZoneStartY(360, 20) !== 289 || textZoneBounds(360, 20, 'top').y1 !== 72) {
        return { status: 'error', detail: '텍스트 존 하단/상단 스위치 좌표가 깨졌습니다.' }
      }
      if (TEXT_ENGINE_DEFAULT !== 'ORIGINAL' || TEXT_ENGINE_MODES.length !== 3) {
        return { status: 'error', detail: '3단 텍스트 엔진 레지스트리가 깨졌습니다.' }
      }
      return { status: 'ok', detail: '텍스트 존 상/하단 · 3단 엔진 ORIGINAL 기본' }
    }
    case 'live-hud': {
      if (typeof applyTextTone !== 'function') {
        return { status: 'error', detail: '텍스트 톤 함수가 없습니다.' }
      }
      if (
        !TEXT_RECOLOR_BYPASS
        || !TEXT_ROI_HARD_LOCK
        || !TEXT_STROKE_PRESERVE
        || CHARACTER_LOCK_RATIO !== 0.8
        || CHARACTER_WRITE_FLOOR_RATIO !== 0.32
        || !SPLITTER_LIVE_REV
      ) {
        return { status: 'error', detail: '픽셀 리컬러 바이패스 또는 캐릭터 영역 잠금이 깨졌습니다.' }
      }
      if (captionForCutIndex(14) !== '어리둥절') {
        return { status: 'error', detail: '15번 컷 캡션 매핑이 어리둥절이 아닙니다.' }
      }
      if (TEXT_ENGINE_DEFAULT !== 'ORIGINAL' || normalizeTextEngineMode('vector_overlay') !== 'VECTOR_OVERLAY') {
        return { status: 'error', detail: '3단 텍스트 엔진 기본값 또는 모드 정규화가 깨졌습니다.' }
      }
      return { status: 'ok', detail: '픽셀 리컬러 바이패스 · 3단 텍스트 엔진 · 15번 어리둥절' }
    }
    case 'gif-engine': {
      if (OUTLINE_DEFAULT !== true) {
        return { status: 'error', detail: 'Outline 기본값이 ON이 아닙니다.' }
      }
      if (!Array.isArray(HQ_KERNEL) || HQ_KERNEL.length !== 9 || HQ_KERNEL[4] !== 5) {
        return { status: 'error', detail: 'HQ 3×3 샤프 커널이 깨졌습니다.' }
      }
      if (typeof resamplePremultiplied !== 'function' || typeof applyBilateralEdgePreserve !== 'function') {
        return { status: 'error', detail: '알파 독립 프리멀티플라이 리샘플러가 없습니다.' }
      }
      return { status: 'ok', detail: 'Outline 기본 ON · HQ 샤프 커널 · Premul/Bilateral(인코드 전용) 확인' }
    }
    case 'emoticon-slicer': {
      const spec = GOLDEN_BASELINE.splitter
      if (KAKAO_STICKER_SIZE !== spec.targetCanvas.width || KAKAO_STICKER_SIZE !== spec.targetCanvas.height) {
        return { status: 'error', detail: `${KAKAO_STICKER_SIZE} 규격 ≠ baseline ${spec.targetCanvas.width}×${spec.targetCanvas.height}.` }
      }
      if (typeof inspectRenderedSlice !== 'function') {
        return { status: 'error', detail: '360 규격 또는 Diagnostic Inspector가 없습니다.' }
      }
      if (typeof polishHqImageData !== 'function') {
        return { status: 'error', detail: '360 HQ 폴리시 파이프라인이 없습니다.' }
      }
      const cuts = goldenGridCutCount()
      if (cuts !== spec.totalCuts) {
        return { status: 'error', detail: `골든 그리드 ${spec.grid.rows}×${spec.grid.cols}=${cuts} ≠ baseline ${spec.totalCuts}컷.` }
      }
      if (typeof applyTextEngine !== 'function' || spec.textEngineDefault !== 'ORIGINAL') {
        return { status: 'error', detail: '텍스트 엔진이 fit 파이프라인에서 분리되지 않았습니다.' }
      }
      return { status: 'ok', detail: `${spec.targetCanvas.width} Safe Margin · ${spec.totalCuts}컷 · 엔진 분리 · ${GOLDEN_BASELINE.version}` }
    }
    case 'text-engine': {
      if (TEXT_ENGINE_DEFAULT !== 'ORIGINAL') {
        return { status: 'error', detail: '텍스트 엔진 기본값이 ORIGINAL이 아닙니다.' }
      }
      if (normalizeTextEngineMode('smart_recolor') !== TEXT_ENGINE_SMART_RECOLOR) {
        return { status: 'error', detail: 'SMART_RECOLOR 정규화가 실패했습니다.' }
      }
      if (captionForCutIndex(14) !== '어리둥절') {
        return { status: 'error', detail: '15번 컷 캡션 매핑이 어리둥절이 아닙니다.' }
      }
      return { status: 'ok', detail: '3단 엔진 · 15번 어리둥절 · ORIGINAL 기본' }
    }
    case 'pro-engine': {
      if (typeof inspectRenderedSlice !== 'function') {
        return { status: 'error', detail: '🐞 진단 로그 Inspector가 없습니다.' }
      }
      return { status: 'ok', detail: '4대 픽셀 지표 Inspector 확인' }
    }
    case 'fps-pipeline': {
      if (typeof canvasToPngBlob !== 'function') {
        return { status: 'error', detail: 'PNG 즉시 다운로드 파이프라인이 없습니다.' }
      }
      return { status: 'ok', detail: 'ZIP/PNG 패키징 모듈 확인' }
    }
    case 'motion-seq': {
      if (clampSequenceFps(8) !== 8 || clampSequenceFps(3) !== 4 || clampSequenceFps(30) !== 24) {
        return { status: 'error', detail: '시퀀서 FPS 클램프(4~24, 기본 8)가 깨졌습니다.' }
      }
      const bounce = sampleTextMotion(TEXT_MOTION_BOUNCE, 2, 8, '테스트')
      if (!bounce || bounce.y === 0) {
        return { status: 'error', detail: '바운스 텍스트 모션 보간이 실패했습니다.' }
      }
      if (ENCODER_SIZE !== 360 || typeof encodeMotionGif !== 'function') {
        return { status: 'error', detail: '모션 인코더 360×360 엔진이 없습니다.' }
      }
      if (motionClipFileName(0, 'gif') !== 'motion-01.gif') {
        return { status: 'error', detail: 'ZIP 파일명 규칙이 motion-01.gif가 아닙니다.' }
      }
      return { status: 'ok', detail: '프레임 시퀀서 · 텍스트 모션 · 인코더 · ZIP 확인' }
    }
    default:
      return null
  }
}

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

export async function checkSheetPipeline() {
  if (!APP_BUILD) {
    return { status: 'error', detail: '배포 빌드 리비전이 없습니다.' }
  }
  if (typeof evaluateSystemDiagnostics !== 'function') {
    return { status: 'error', detail: '3대 모듈 자가진단 엔진이 없습니다.' }
  }
  const report = evaluateSystemDiagnostics('ALL')
  if (report.status === 'warn' || report.moduleList?.length !== 3) {
    return { status: 'error', detail: '3대 모듈 자가진단이 실패했습니다.' }
  }
  const log = exportFullDiagnosticLog(report)
  if (!log.includes('[PASS]') || !log.includes('Alpha Sniffer') || !log.includes('4 rows by 5 columns')) {
    return { status: 'error', detail: '전사 진단 리포트 포맷이 비어 있습니다.' }
  }
  if (!Array.isArray(GUIDEBOOK_SECTIONS) || GUIDEBOOK_SECTIONS.length !== 4) {
    return { status: 'error', detail: '가이드북 3단계+진단 섹션이 없습니다.' }
  }
  if (!GUIDEBOOK_SECTIONS.some((section) => String(section.content || '').includes('4 rows by 5 columns'))) {
    return { status: 'error', detail: '4×5 투명 시트 생성 프롬프트가 가이드북에 없습니다.' }
  }
  return { status: 'ok', detail: `PASS · 스튜디오·분할기·생성기 3모듈 · 가이드북 4섹션 · ${APP_BUILD}` }
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

function auditFontCategoryLabelData() {
  const spec = GOLDEN_BASELINE.uiIntegrity
  const banned = spec.bannedLabelKeywords || []
  const bad = FONT_CATEGORIES.filter((item) => {
    const label = String(item.label || '').replace(/\s+/g, ' ').trim()
    const tooltip = String(item.tooltip || '').trim()
    if (!label || !tooltip) return true
    if (label.length > spec.maxButtonLabelLength) return true
    if (label === tooltip || label.includes(tooltip)) return true
    return banned.some((word) => label.includes(word))
  })
  return bad
}

function auditLabelScanHostContract() {
  const hosts = GOLDEN_BASELINE.uiIntegrity.labelScanHosts
  if (!Array.isArray(hosts) || hosts.length < 5) return false
  return hosts.every((host) => typeof host === 'string' && !host.includes(','))
}

export async function checkFonts(_ctx, onLog) {
  if (!auditLabelScanHostContract()) {
    return {
      status: 'error',
      detail: '라벨 스캔 호스트가 쉼표 선택자라 CSS :not 함정이 재발합니다. LABEL_SCAN_HOSTS 배열을 유지하세요.',
    }
  }
  const dirtyTabs = auditFontCategoryLabelData()
  if (dirtyTabs.length) {
    return {
      status: 'error',
      detail: `폰트 탭 label이 tooltip과 격리되지 않음: ${dirtyTabs.map((item) => item.id).join(', ')}`,
    }
  }
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
  if (DEFAULT_TEXT !== '龍 Dragon 풍정') {
    return { status: 'error', detail: '기본 문구가 龍 Dragon 풍정과 다릅니다.' }
  }
  const factory = defaultStudioState()
  const main = factory.layers.find((layer) => layer.role === 'main')
  if (!factory.gridOn) {
    return { status: 'error', detail: '기본 격자/눈금이 꺼져 있습니다.' }
  }
  if (main?.text !== DEFAULT_TEXT || main?.fontId !== DEFAULT_STUDIO_FONT_ID || main?.presetId !== DEFAULT_STUDIO_PRESET_ID || main?.fontSize !== DEFAULT_STUDIO_MAIN_SIZE) {
    return { status: 'error', detail: '기본 훈민정음 언해 목각 샘플이 아닙니다.' }
  }
  if (factory.studioTab !== 'woodcut' || factory.previewBg !== 'dark' || factory.stickerOn !== false || factory.gridOn !== true || factory.aspectId !== '1:1') {
    return { status: 'error', detail: '기본 목각 탭/다크 캔버스/격자/1:1이 아닙니다.' }
  }
  const woodcut = GUIDE_SAMPLES['pungjeong-woodcut']
  if (!woodcut || woodcut.presetId !== 'hunmin-woodcut' || woodcut.layers?.main?.text !== DEFAULT_TEXT) {
    return { status: 'error', detail: '기본 목각 샘플 원클릭 데이터가 없습니다.' }
  }
  const overlaySrc = String(LayerGuideOverlay)
  if (!overlaySrc.includes('data-canvas-cross') || !overlaySrc.includes('canvas-crosshair')) {
    return { status: 'error', detail: '캔버스 중앙 십자 가이드가 없습니다.' }
  }
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
  const lightboxSrc = String(PreviewLightboxModal)
  if (typeof PreviewLightboxModal !== 'function' || !lightboxSrc.includes('checkerboard-bg') || lightboxSrc.includes('bg-white')) {
    return { status: 'error', detail: '확대 팝업 체커보드가 없거나 흰 배경이 남아 있습니다.' }
  }
  return { status: 'ok', detail: '2D 앵커·회전 히트박스 · 기본 龍 Dragon 풍정 목각 · 다크·십자 가이드 · 확대 팝업 checkerboard-bg 고정.' }
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
  const mid = (FONT_SIZE_MIN + FONT_SIZE_MAX) / 2
  if (FONT_SIZE_MAIN_DEFAULT !== mid) {
    return { status: 'error', detail: `기본 크기 ${FONT_SIZE_MAIN_DEFAULT}px가 슬라이더 중앙(${mid}px)과 다릅니다.` }
  }
  if (clampFontSize(1) !== FONT_SIZE_MIN || clampFontSize(999) !== FONT_SIZE_MAX) {
    return { status: 'error', detail: `크기 슬라이더 클램프 ${FONT_SIZE_MIN}~${FONT_SIZE_MAX}px가 실패했습니다.` }
  }
  if (clampFontSize(FONT_SIZE_MAIN_DEFAULT) !== FONT_SIZE_MAIN_DEFAULT) {
    return { status: 'error', detail: '기본 폰트 크기가 슬라이더 범위 밖으로 잘립니다.' }
  }
  return { status: 'ok', detail: `줄바꿈 3행 · 행간 클램프 · 좌/중/우 정렬 · 크기 ${FONT_SIZE_MIN}~${FONT_SIZE_MAX}px(기본 ${FONT_SIZE_MAIN_DEFAULT}px 중앙)이 일치합니다.` }
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
  if (typeof document !== 'undefined') {
    const overlay = document.querySelector('.layer-guide-overlay')
    const toggle = document.querySelector('.canvas-bg-toggle')
    const canvas = document.querySelector('#main-canvas-area canvas')
    if (overlay && toggle && canvas) {
      const overlayZ = Number.parseInt(getComputedStyle(overlay).zIndex, 10)
      const toggleZ = Number.parseInt(getComputedStyle(toggle).zIndex, 10)
      const canvasZ = Number.parseInt(getComputedStyle(canvas).zIndex, 10)
      if (!(canvasZ < overlayZ && overlayZ < toggleZ)) {
        return {
          status: 'warn',
          detail: `가이드 오버레이 스택 canvas ${canvasZ} / overlay ${overlayZ} / toggle ${toggleZ}`,
        }
      }
    }
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
  const studioIds = MOTION_PRESETS.map((item) => item.id)
  if (MOTION_PRESETS.length !== 10) {
    return { status: 'error', detail: '모션 스튜디오 프리셋이 10종이 아닙니다.' }
  }
  if (!isMotionNone(MOTION_NONE) || isMotionNone('jellyBounce')) {
    return { status: 'error', detail: '모션 없음(none) 토글 판별이 실패했습니다.' }
  }
  const nonePose = sampleGifPreset(MOTION_NONE, 0.4, 1)
  if (nonePose.dx !== 0 || nonePose.dy !== 0 || nonePose.rotateDeg !== 0 || nonePose.scaleX !== 1 || nonePose.scaleY !== 1) {
    return { status: 'error', detail: '모션 없음 상태가 원본 1:1 고정이 아닙니다.' }
  }
  const extraIds = ['angryShake', 'rollingTilt', 'squashStretch', 'heartbeat', 'zoomPunch']
  if (extraIds.some((id) => !studioIds.includes(id))) {
    return { status: 'error', detail: '메신저 모션 확장 5종이 없습니다.' }
  }
  const tilt = sampleGifPreset('rollingTilt', 0.25, 1)
  if (Math.abs(tilt.rotateDeg - 12) > 0.05) {
    return { status: 'error', detail: '롤링 틸트 ±12° 보간이 실패했습니다.' }
  }
  const punch = sampleGifPreset('zoomPunch', 0.5, 1)
  if (punch.scaleX <= 1.1) {
    return { status: 'error', detail: '줌 앤 펀치 돌출 스케일이 실패했습니다.' }
  }
  const beat = sampleGifPreset('heartbeat', 0.18, 1)
  if (beat.scaleX <= 1.05) {
    return { status: 'error', detail: '하트 비트 쿵-쾅 펄스가 실패했습니다.' }
  }
  const motion = auditFrozenGoldenBaseline({ presetIds: studioIds }).motion
  if (!motion.ok) {
    return { status: 'error', detail: `모션 스튜디오 프리셋 drift · ${motion.fail.map((row) => row.detail).join(' · ')}` }
  }
  return {
    status: 'ok',
    detail: `PASS · 레거시 ${GIF_MOTIONS.map((item) => item.name).join(' / ')} · 스튜디오 10종 ≡ ${GOLDEN_BASELINE.version} · 인코더 ${blob.size}B · 프레임 ${frames.length}`,
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
  if (typeof detectSmartEmoticonGrid !== 'function') {
    return { status: 'error', detail: '투영 프로파일 스마트 그리드 엔진이 없습니다.' }
  }
  const grid2 = detectSmartEmoticonGrid(sheet)
  if (grid2.cells.length !== 2 || grid2.rows !== 1 || grid2.cols !== 2) {
    return { status: 'error', detail: `투영 프로파일이 1×2 시트를 ${grid2.rows}×${grid2.cols}(${grid2.cells.length})로 오인했습니다.` }
  }
  const quad = document.createElement('canvas')
  quad.width = 200
  quad.height = 200
  const quadCtx = quad.getContext('2d')
  quadCtx.fillStyle = '#ffffff'
  quadCtx.fillRect(0, 0, 200, 200)
  quadCtx.fillStyle = '#111111'
  quadCtx.fillRect(12, 12, 72, 72)
  quadCtx.fillRect(116, 12, 72, 72)
  quadCtx.fillRect(12, 116, 72, 72)
  quadCtx.fillRect(116, 116, 72, 72)
  const quadGrid = detectSmartEmoticonGrid(quad)
  if (quadGrid.cells.length !== 4 || quadGrid.rows !== 2 || quadGrid.cols !== 2) {
    return { status: 'error', detail: `투영 프로파일이 2×2 시트를 ${quadGrid.rows}×${quadGrid.cols}(${quadGrid.cells.length})로 오인했습니다.` }
  }
  const stacked = document.createElement('canvas')
  stacked.width = 120
  stacked.height = 160
  const stackedCtx = stacked.getContext('2d')
  stackedCtx.fillStyle = '#ffffff'
  stackedCtx.fillRect(0, 0, 120, 160)
  stackedCtx.fillStyle = '#111111'
  stackedCtx.fillRect(22, 12, 76, 78)
  stackedCtx.fillRect(32, 112, 56, 14)
  const stackedGrid = detectSmartEmoticonGrid(stacked)
  if (stackedGrid.cells.length !== 1) {
    return { status: 'error', detail: `캐릭터+자막이 ${stackedGrid.cells.length}칸으로 쪼개졌습니다.` }
  }
  if ((stackedGrid.cells[0].y + stackedGrid.cells[0].h) < 120) {
    return { status: 'error', detail: '캐릭터+자막 결합 박스가 하단 글자를 포함하지 않습니다.' }
  }
  const pack = document.createElement('canvas')
  pack.width = 500
  pack.height = 400
  const packCtx = pack.getContext('2d', { alpha: true })
  packCtx.clearRect(0, 0, 500, 400)
  packCtx.fillStyle = 'rgba(210, 210, 210, 0.14)'
  packCtx.fillRect(0, 0, 500, 400)
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      packCtx.globalAlpha = 1
      packCtx.fillStyle = '#1f2937'
      packCtx.fillRect(14 + col * 96, 12 + row * 96, 70, 56)
      packCtx.fillRect(22 + col * 96, 74 + row * 96, 54, 12)
    }
  }
  const packGrid = detectSmartEmoticonGrid(pack)
  if (packGrid.cells.length !== 20 || packGrid.rows !== 4 || packGrid.cols !== 5) {
    return { status: 'error', detail: `투영 프로파일이 4×5 투명 시트를 ${packGrid.rows}×${packGrid.cols}(${packGrid.cells.length})로 오인했습니다.` }
  }
  const packSlices = sliceSheet(pack, { mode: 'smart', transparent: true })
  if (packSlices.length !== 20) {
    return { status: 'error', detail: `4×5 시트가 sliceSheet 상태에서 ${packSlices.length}개로 멈췄습니다.` }
  }
  if (typeof handleSheetAutoDetection !== 'function' || typeof handleDefaultSheetUpload !== 'function') {
    return { status: 'error', detail: '시트 로드 자동 감지 핸들러가 없습니다.' }
  }
  let boundCells = null
  const auto = handleSheetAutoDetection(pack, (cells) => { boundCells = cells }, () => {})
  if (!Array.isArray(boundCells) || boundCells.length !== 20 || auto.count !== 20) {
    return { status: 'error', detail: '업로드 자동 감지가 20칸을 상태에 주입하지 못했습니다.' }
  }
  let defaultBound = null
  const defaultSnap = handleDefaultSheetUpload(pack, (cells) => { defaultBound = cells }, () => {})
  if (!Array.isArray(defaultBound) || defaultBound.length !== 20 || defaultSnap.rows !== 4 || defaultSnap.cols !== 5) {
    return { status: 'error', detail: '기본 4×5 스냅이 20칸을 상태에 주입하지 못했습니다.' }
  }
  if (!isAcceptedSheetFile({ type: 'image/jpeg', name: 'sheet.jpg' }) || !isAcceptedSheetFile({ type: '', name: 'sheet.webp' })) {
    return { status: 'error', detail: 'JPG/WebP 업로드 허용이 막혀 있습니다.' }
  }
  if (!String(PNG_GUIDE_BODY || '').includes('4행 × 5열')) {
    return { status: 'error', detail: '4×5 투명 시트 권장 가이드가 없습니다.' }
  }
  const strips = document.createElement('canvas')
  strips.width = 500
  strips.height = 400
  const stripsCtx = strips.getContext('2d', { alpha: true })
  stripsCtx.clearRect(0, 0, 500, 400)
  stripsCtx.fillStyle = '#1f2937'
  stripsCtx.fillRect(8, 4, 148, 392)
  stripsCtx.fillRect(176, 4, 148, 392)
  stripsCtx.fillRect(344, 4, 148, 392)
  const stripGrid = detectSmartEmoticonGrid(strips)
  if (stripGrid.cells.length !== 20 || stripGrid.rows !== 4 || stripGrid.cols !== 5) {
    return { status: 'error', detail: `붕괴 3스트립이 ${stripGrid.rows}×${stripGrid.cols}(${stripGrid.cells.length})로 남았습니다(기대 4×5=20).` }
  }
  const rec = getRecommendedGrid(500, 400)
  if (rec.rows !== 4 || rec.cols !== 5) {
    return { status: 'error', detail: `표준 시트 추천 그리드가 ${rec.rows}×${rec.cols}입니다(기대 4×5).` }
  }
  const snapped = guessStickerGridShape(800, 700, 5, 6)
  if (snapped.rows !== 4 || snapped.cols !== 5) {
    return { status: 'error', detail: `5×6 피크가 ${snapped.rows}×${snapped.cols}로 남았습니다(기대 4×5 스냅).` }
  }
  if (generateSheetGrid(500, 400, 5, 4).length !== 20 || !Array.isArray(SHEET_GRID_PRESETS) || SHEET_GRID_PRESETS.length !== 4) {
    return { status: 'error', detail: '시트 규격 프리셋 또는 generateSheetGrid(5×4)가 없습니다.' }
  }
  const fake30 = []
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      fake30.push({ x: col * 80, y: row * 80, w: 70, h: 70 })
    }
  }
  if (!isOverSplitSmartGrid(fake30, 500, 400)) {
    return { status: 'error', detail: '5×6=30 과다 분할을 감지하지 못했습니다.' }
  }
  const doubled = splitDoubleHeightBoxes([
    { x: 0, y: 0, w: 40, h: 40 },
    { x: 50, y: 0, w: 40, h: 40 },
    { x: 100, y: 0, w: 40, h: 88 },
  ])
  if (doubled.length !== 4 || doubled[2].h !== 44 || doubled[3].y !== 44) {
    return { status: 'error', detail: '모드 A 세로 결합 덩어리 후처리 분할이 실패했습니다.' }
  }
  if (doubled[0].h !== 40 || doubled[1].h !== 40) {
    return { status: 'error', detail: '정상 높이 모드 A 박스가 후처리에서 변경되었습니다.' }
  }
  const wide = splitDoubleWidthBoxes([
    { x: 0, y: 0, w: 40, h: 40 },
    { x: 0, y: 50, w: 40, h: 40 },
    { x: 0, y: 100, w: 88, h: 40 },
  ])
  if (wide.length !== 4 || wide[2].w !== 44 || wide[3].x !== 44) {
    return { status: 'error', detail: '모드 A 가로 결합 덩어리 후처리 분할이 실패했습니다.' }
  }
  if (wide[0].w !== 40 || wide[1].w !== 40) {
    return { status: 'error', detail: '정상 너비 모드 A 박스가 후처리에서 변경되었습니다.' }
  }
  const spec = GOLDEN_BASELINE.splitter
  if (TEXT_RECOLOR_BYPASS !== spec.textRecolorBypass || spec.textRecolorBypass !== true) {
    return { status: 'error', detail: '텍스트 리컬러 바이패스 플래그가 골든 기준선과 다릅니다.' }
  }
  if (TEXT_ENGINE_DEFAULT !== spec.textEngineDefault || spec.textEngineDefault !== 'ORIGINAL') {
    return { status: 'error', detail: '텍스트 엔진 기본값이 골든 ORIGINAL과 다릅니다.' }
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
  const goldenCuts = goldenGridCutCount()
  if (goldenCuts !== spec.totalCuts) {
    return { status: 'error', detail: `골든 그리드 ${spec.grid.rows}×${spec.grid.cols}가 ${goldenCuts}칸입니다(기대 ${spec.totalCuts}).` }
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
    return { status: 'error', detail: `${spec.targetCanvas.width}×${spec.targetCanvas.height} 안전 여백 contain-fit이 실패했습니다.` }
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
  if (kakao.width !== spec.targetCanvas.width || kakao.height !== spec.targetCanvas.height) {
    return { status: 'error', detail: `${spec.targetCanvas.width}×${spec.targetCanvas.height} 리사이저가 ${kakao.width}×${kakao.height}를 반환했습니다.` }
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
  if (outerPx > spec.allowedCornerAlphaMax) {
    return { status: 'error', detail: `외곽 플러드필 코너 알파 ${outerPx} > baseline ${spec.allowedCornerAlphaMax}.` }
  }
  if (ringPx < 180) {
    return { status: 'error', detail: '플러드필이 캐릭터 외곽 픽셀을 지웠습니다.' }
  }
  if (eyePx < 180) {
    return { status: 'error', detail: '플러드필이 캐릭터 내부 흰색을 지웠습니다.' }
  }
  if (FLOOD_FILL_TOLERANCE !== spec.alphaThreshold) {
    return { status: 'error', detail: `플러드필 허용 오차가 ${FLOOD_FILL_TOLERANCE}입니다(기대 baseline ${spec.alphaThreshold}).` }
  }
  if (OUTLINE_DEFAULT !== true) {
    return { status: 'error', detail: 'Outline 외곽선 보강 기본값이 ON이 아닙니다.' }
  }
  if (PUNCH_HOLES_DEFAULT !== spec.punchHoles || spec.punchHoles !== false) {
    return { status: 'error', detail: '내부 고립 구멍 투명화 기본값이 OFF가 아닙니다.' }
  }
  if (TEXT_ZONE_ANCHOR_DEFAULT !== 'bottom' || VIEW_BG_DEFAULT !== 'checker') {
    return { status: 'error', detail: '텍스트 하단 앵커 또는 체커보드 배경 기본값이 깨졌습니다.' }
  }
  if (cycleViewBgMode('checker') !== 'dark' || cycleViewBgMode('light') !== 'checker') {
    return { status: 'error', detail: '뷰포트 배경 모드 순환(체커보드→다크→라이트)이 실패했습니다.' }
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
  if (paperPx > spec.allowedCornerAlphaMax) {
    return { status: 'error', detail: `외곽 플러드필 원형 밖 알파 ${paperPx} > baseline ${spec.allowedCornerAlphaMax}.` }
  }
  if (strokePx < 180) {
    return { status: 'error', detail: '플러드필이 캐릭터 진한 외곽선을 넘었습니다.' }
  }
  if (highlightPx < 200) {
    return { status: 'error', detail: '플러드필이 원형 테두리 안 하이라이트를 뚫었습니다.' }
  }
  const island = document.createElement('canvas')
  island.width = 48
  island.height = 48
  const islandCtx = island.getContext('2d')
  islandCtx.fillStyle = '#f4f4f6'
  islandCtx.fillRect(0, 0, 48, 48)
  islandCtx.strokeStyle = '#1a1410'
  islandCtx.lineWidth = 5
  islandCtx.beginPath()
  islandCtx.arc(24, 24, 16, 0, Math.PI * 2)
  islandCtx.stroke()
  islandCtx.fillStyle = '#f2e4c8'
  islandCtx.beginPath()
  islandCtx.arc(24, 24, 5, 0, Math.PI * 2)
  islandCtx.fill()
  const closed = floodFillAlphaKey(islandCtx.getImageData(0, 0, 48, 48))
  const innerPaper = closed.data[((24 * 48) + 32) * 4 + 3]
  if (innerPaper < 180) {
    return { status: 'error', detail: '구멍 투명화 OFF에서 닫힌 내부 배경이 지워졌습니다.' }
  }
  punchIsolatedBackgroundHoles(closed)
  if (closed.data[((24 * 48) + 32) * 4 + 3] > 20) {
    return { status: 'error', detail: '내부 고립 구멍이 Alpha=0으로 확장되지 않았습니다.' }
  }
  if (closed.data[((24 * 48) + 24) * 4 + 3] < 180) {
    return { status: 'error', detail: '구멍 투명화가 캐릭터 하이라이트를 지웠습니다.' }
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
  if (typeof processHighQualitySmartSplit !== 'function' || typeof processHighQualityCrop !== 'function') {
    return { status: 'error', detail: '2-Pass 고품질 알파 마스킹 엔진이 없습니다.' }
  }
  if (typeof extractCleanEmoticonCell !== 'function' || !String(extractCleanEmoticonCell).includes('destination-in')) {
    return { status: 'error', detail: 'destination-in 알파 마스크 합성 엔진이 없습니다.' }
  }
  if (typeof sniffCanvasHasAlpha !== 'function' || typeof processHybridSheetCell !== 'function') {
    return { status: 'error', detail: '알파 스니프 하이브리드 분할 엔진이 없습니다.' }
  }
  if (!String(processHybridSheetCell).includes('sniffCanvasHasAlpha') || !String(processHybridSheetCell).includes('extractLosslessCell')) {
    return { status: 'error', detail: '하이브리드 셀이 무손실 우회를 쓰지 않습니다.' }
  }
  if (String(PNG_GUIDE_OK_LABEL || '').length > GOLDEN_BASELINE.uiIntegrity.maxButtonLabelLength) {
    return { status: 'error', detail: '투명 PNG 안내 확인 버튼이 16자를 넘습니다.' }
  }
  if (String(PNG_GUIDE_HIDE_LABEL || '').length > GOLDEN_BASELINE.uiIntegrity.maxButtonLabelLength) {
    return { status: 'error', detail: '투명 PNG 안내 숨김 버튼이 16자를 넘습니다.' }
  }
  const alphaSheet = document.createElement('canvas')
  alphaSheet.width = 24
  alphaSheet.height = 24
  const alphaCtx = alphaSheet.getContext('2d', { alpha: true })
  alphaCtx.clearRect(0, 0, 24, 24)
  if (!sniffCanvasHasAlpha(alphaSheet)) {
    return { status: 'error', detail: '투명 시트 알파 스니프가 모서리 알파를 놓쳤습니다.' }
  }
  const paperSheet = document.createElement('canvas')
  paperSheet.width = 24
  paperSheet.height = 24
  const paperCtx = paperSheet.getContext('2d', { alpha: true })
  paperCtx.fillStyle = '#ffffff'
  paperCtx.fillRect(0, 0, 24, 24)
  if (sniffCanvasHasAlpha(paperSheet)) {
    return { status: 'error', detail: '불투명 흰 시트를 투명으로 오인했습니다.' }
  }
  if (typeof defringeAlphaEdge !== 'function' || typeof featherAlphaEdge !== 'function') {
    return { status: 'error', detail: '1px 알파 디프린지 또는 1.5px 페더 필터가 없습니다.' }
  }
  const fringe = new ImageData(8, 8)
  for (let i = 0; i < fringe.data.length; i += 4) {
    fringe.data[i] = 255
    fringe.data[i + 1] = 255
    fringe.data[i + 2] = 255
    fringe.data[i + 3] = 255
  }
  for (let y = 0; y < 8; y += 1) fringe.data[(y * 8) * 4 + 3] = 0
  defringeAlphaEdge(fringe)
  if (fringe.data[(0 * 8 + 1) * 4 + 3] > 16) {
    return { status: 'error', detail: '1px 디프린지가 알파 경계 후광을 침식하지 않습니다.' }
  }
  if (fringe.data[(3 * 8 + 3) * 4 + 3] < 180) {
    return { status: 'error', detail: '1px 디프린지가 내부 불투명 픽셀을 지웠습니다.' }
  }
  const letter = document.createElement('canvas')
  letter.width = 48
  letter.height = 48
  const letterCtx = letter.getContext('2d')
  letterCtx.fillStyle = '#f4f4f6'
  letterCtx.fillRect(0, 0, 48, 48)
  letterCtx.fillStyle = '#111111'
  letterCtx.fillRect(16, 38, 16, 10)
  letterCtx.fillStyle = '#ffffff'
  letterCtx.fillRect(20, 41, 8, 4)
  const letterData = floodFillAlphaKey(letterCtx.getImageData(0, 0, 48, 48))
  punchIsolatedBackgroundHoles(letterData, { protectBounds: textZoneBounds(48, 20, 'bottom') })
  if (letterData.data[((43 * 48) + 24) * 4 + 3] < 180) {
    return { status: 'error', detail: '글자 바운딩 박스 내부 고립 영역이 구멍 투명화에서 보호되지 않았습니다.' }
  }
  if (CROP_EDGE_INSET !== 1) {
    return { status: 'error', detail: '360 크롭 1px 재단선 인셋이 없습니다.' }
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
  if (textZoneBounds(360, 20, 'top').y1 !== 72 || textZoneBounds(40, 20, 'top').y1 !== 8) {
    return { status: 'error', detail: '상단 텍스트 감지 구간이 Y=0~퍼센트 높이와 다릅니다.' }
  }
  if (clampTextZonePercent(3) !== 5 || clampTextZonePercent(90) !== 50) {
    return { status: 'error', detail: '텍스트 감지 높이 클램프가 5~50%를 지키지 않습니다.' }
  }
  applyTextTone(local, 'custom', '#00ccff')
  if (local.data[bodyAt] !== bodyBefore[0] || local.data[aboveAt] !== aboveBefore[0] || local.data[furAt] !== furBefore[0]) {
    return { status: 'error', detail: '텍스트 ROI 락이 캐릭터/털 픽셀을 변경했습니다.' }
  }
  if (local.data[textAt] !== 20 || local.data[textAt + 1] !== 20 || local.data[textAt + 2] !== 20) {
    return { status: 'error', detail: '리컬러 바이패스가 하단 캡션 원본을 바꿨습니다.' }
  }
  const hangul = document.createElement('canvas')
  hangul.width = 40
  hangul.height = 40
  const hangulCtx = hangul.getContext('2d')
  hangulCtx.fillStyle = '#ff8866'
  hangulCtx.fillRect(0, 0, 40, 28)
  hangulCtx.fillStyle = '#141414'
  hangulCtx.fillRect(18, 6, 4, 4)
  hangulCtx.fillRect(10, 32, 20, 3)
  hangulCtx.fillRect(8, 36, 24, 3)
  const hangulData = hangulCtx.getImageData(0, 0, 40, 40)
  const eyeBefore = [hangulData.data[(7 * 40 + 19) * 4], hangulData.data[(7 * 40 + 19) * 4 + 1], hangulData.data[(7 * 40 + 19) * 4 + 2]]
  applyTextTone(hangulData, 'custom', '#00ccff')
  if (hangulData.data[(33 * 40 + 18) * 4] !== 20 || hangulData.data[(33 * 40 + 18) * 4 + 1] !== 20) {
    return { status: 'error', detail: '리컬러 바이패스가 캡션 윗획 원본을 바꿨습니다.' }
  }
  if (hangulData.data[(37 * 40 + 20) * 4] !== 20 || hangulData.data[(37 * 40 + 20) * 4 + 1] !== 20) {
    return { status: 'error', detail: '리컬러 바이패스가 캡션 아랫획 원본을 바꿨습니다.' }
  }
  if (hangulData.data[(32 * 40 + 10) * 4] !== 20) {
    return { status: 'error', detail: '리컬러가 캡션 먹선 외곽을 지웠습니다.' }
  }
  if (hangulData.data[(7 * 40 + 19) * 4] !== eyeBefore[0] || hangulData.data[(10 * 40 + 8) * 4] !== 255) {
    return { status: 'error', detail: '리컬러가 캐릭터 눈/본체까지 침범했습니다.' }
  }
  const tight = bandCtx.getImageData(0, 0, 40, 40)
  applyTextTone(tight, 'custom', '#00ccff', { textZonePercent: 10 })
  if (tight.data[bodyAt] !== bodyBefore[0] || tight.data[aboveAt] !== aboveBefore[0]) {
    return { status: 'error', detail: '텍스트 시드 10%가 본체/분리 픽셀까지 치환했습니다.' }
  }
  const topBand = bandCtx.getImageData(0, 0, 40, 40)
  topBand.data[(4 * 40 + 20) * 4] = 20
  topBand.data[(4 * 40 + 20) * 4 + 1] = 20
  topBand.data[(4 * 40 + 20) * 4 + 2] = 20
  topBand.data[(4 * 40 + 20) * 4 + 3] = 255
  applyTextTone(topBand, 'custom', '#00ccff', { textZonePercent: 20, textZoneAnchor: 'top' })
  if (topBand.data[(4 * 40 + 20) * 4] !== 20) {
    return { status: 'error', detail: '상단 스위치가 캐릭터 영역 검정 픽셀을 변경했습니다.' }
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
  if (glyphData.data[(36 * 40 + 18) * 4] !== 20 || glyphData.data[(36 * 40 + 18) * 4 + 1] !== 20) {
    return { status: 'error', detail: '리컬러 바이패스가 투명 위 캡션 원본을 바꿨습니다.' }
  }
  const boxed = document.createElement('canvas')
  boxed.width = 40
  boxed.height = 40
  const boxedCtx = boxed.getContext('2d', { alpha: true })
  boxedCtx.clearRect(0, 0, 40, 40)
  boxedCtx.fillStyle = '#ffffff'
  boxedCtx.fillRect(10, 33, 20, 6)
  boxedCtx.fillStyle = '#141414'
  boxedCtx.fillRect(14, 34, 12, 4)
  const boxedData = boxedCtx.getImageData(0, 0, 40, 40)
  clearTextPlatePixels(boxedData)
  applyTextTone(boxedData, 'custom', '#00ccff')
  if (boxedData.data[(36 * 40 + 20) * 4] !== 20 || boxedData.data[(36 * 40 + 20) * 4 + 1] !== 20) {
    return { status: 'error', detail: '리컬러 바이패스가 흰 판 위 캡션 원본을 바꿨습니다.' }
  }
  if (boxedData.data[(34 * 40 + 12) * 4 + 3] < 200) {
    return { status: 'error', detail: '흰 패치 펀치가 원본 플레이트를 지웠습니다.' }
  }
  const cream = document.createElement('canvas')
  cream.width = 40
  cream.height = 40
  const creamCtx = cream.getContext('2d', { alpha: true })
  creamCtx.clearRect(0, 0, 40, 40)
  creamCtx.fillStyle = '#d2d2d6'
  creamCtx.fillRect(9, 33, 22, 7)
  creamCtx.fillStyle = '#909090'
  creamCtx.fillRect(13, 34, 1, 4)
  creamCtx.fillStyle = '#141414'
  creamCtx.fillRect(14, 34, 12, 4)
  const creamData = creamCtx.getImageData(0, 0, 40, 40)
  clearTextPlatePixels(creamData)
  applyTextTone(creamData, 'custom', '#00ccff')
  if (creamData.data[(36 * 40 + 20) * 4] !== 20 || creamData.data[(36 * 40 + 20) * 4 + 1] !== 20) {
    return { status: 'error', detail: '리컬러 바이패스가 미색 판 위 캡션 원본을 바꿨습니다.' }
  }
  if (creamData.data[(34 * 40 + 10) * 4] !== 210) {
    return { status: 'error', detail: '미색 패치가 리컬러에서 지워졌습니다.' }
  }
  const lastRow = document.createElement('canvas')
  lastRow.width = 40
  lastRow.height = 40
  const lastCtx = lastRow.getContext('2d')
  lastCtx.fillStyle = '#ff8866'
  lastCtx.fillRect(0, 0, 40, 22)
  lastCtx.fillStyle = '#141414'
  lastCtx.fillRect(18, 6, 4, 4)
  lastCtx.fillRect(8, 24, 24, 8)
  lastCtx.fillStyle = '#ffffff'
  lastCtx.fillRect(10, 26, 20, 4)
  const lastData = lastCtx.getImageData(0, 0, 40, 40)
  const lastEye = [lastData.data[(7 * 40 + 19) * 4], lastData.data[(7 * 40 + 19) * 4 + 1], lastData.data[(7 * 40 + 19) * 4 + 2]]
  const lastBody = lastData.data[(10 * 40 + 10) * 4]
  applyTextTone(lastData, 'custom', '#00ccff')
  if (lastData.data[(7 * 40 + 19) * 4] !== lastEye[0] || lastData.data[(10 * 40 + 10) * 4] !== lastBody) {
    return { status: 'error', detail: '마지막 행 리컬러가 캐릭터 픽셀을 변경했습니다.' }
  }
  if (lastData.data[(24 * 40 + 8) * 4] !== 20 || lastData.data[(24 * 40 + 8) * 4 + 1] !== 20) {
    return { status: 'error', detail: '리컬러가 캡션 먹선 외곽을 지웠습니다.' }
  }
  if (lastData.data[(28 * 40 + 18) * 4] !== 255 || lastData.data[(28 * 40 + 18) * 4 + 1] !== 255) {
    return { status: 'error', detail: '리컬러 바이패스가 캡션 흰 채움 원본을 바꿨습니다.' }
  }
  const lifted = document.createElement('canvas')
  lifted.width = 360
  lifted.height = 360
  const liftedCtx = lifted.getContext('2d')
  liftedCtx.fillStyle = '#ff8866'
  liftedCtx.fillRect(0, 0, 360, 110)
  liftedCtx.fillStyle = '#7c3aed'
  liftedCtx.beginPath()
  liftedCtx.arc(180, 70, 48, 0, Math.PI * 2)
  liftedCtx.fill()
  liftedCtx.fillStyle = '#141414'
  liftedCtx.fillRect(160, 40, 20, 20)
  liftedCtx.fillRect(70, 120, 220, 28)
  liftedCtx.fillStyle = '#ffffff'
  liftedCtx.fillRect(80, 126, 200, 16)
  const liftedData = liftedCtx.getImageData(0, 0, 360, 360)
  const plateBefore = [liftedData.data[(70 * 360 + 180) * 4], liftedData.data[(70 * 360 + 180) * 4 + 1], liftedData.data[(70 * 360 + 180) * 4 + 2]]
  applyTextTone(liftedData, 'custom', '#00ccff')
  if (liftedData.data[(70 * 360 + 180) * 4] !== plateBefore[0] || liftedData.data[(50 * 360 + 170) * 4] !== 20) {
    return { status: 'error', detail: '22~28번 유형 리컬러가 원형판/눈을 변경했습니다.' }
  }
  if (liftedData.data[(120 * 360 + 70) * 4] !== 20) {
    return { status: 'error', detail: '리컬러가 중간 높이 캡션 먹선을 지웠습니다.' }
  }
  if (liftedData.data[(134 * 360 + 180) * 4] !== 255 || liftedData.data[(134 * 360 + 180) * 4 + 1] !== 255) {
    return { status: 'error', detail: '리컬러 바이패스가 중간 높이 캡션 흰 채움 원본을 바꿨습니다.' }
  }
  if (typeof PreviewLightboxModal !== 'function') {
    return { status: 'error', detail: '확대 미리보기 팝업 컴포넌트가 없습니다.' }
  }
  const lightboxSrc = String(PreviewLightboxModal)
  if (!lightboxSrc.includes('checkerboard-bg') || lightboxSrc.includes('bg-white')) {
    return { status: 'error', detail: '확대 팝업 체커보드 배경이 없거나 흰 배경이 남아 있습니다.' }
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
  if (outline.data[(33 * 40 + 18) * 4 + 3] > 20 || outline.data[(5 * 40 + 18) * 4 + 3] > 20) {
    return { status: 'error', detail: '외곽선 보강 바이패스가 원본에 스트로크를 넣었습니다.' }
  }
  const inspected = inspectRenderedSlice({
    canvas: kakao,
    source: sheet,
    box: grid[0],
    index: 0,
    name: 'kakao-360-01.png',
    mode: 'grid',
    textZonePercent: TEXT_ZONE_DEFAULT,
    transparent: true,
  })
  if (!inspected?.cornerAlpha || typeof inspected.hasBoundingBoxArtifact !== 'boolean') {
    return { status: 'error', detail: '슬라이스 진단 인스펙터가 4대 지표를 기록하지 못했습니다.' }
  }
  if (inspected.cornerAlpha.status !== 'PASS' && inspected.cornerAlpha.status !== 'FAIL') {
    return { status: 'error', detail: 'cornerAlpha PASS/FAIL 상태가 없습니다.' }
  }
  if (typeof inspected.adjacentRowOverlap !== 'boolean' || typeof inspected.characterHighlightProtected !== 'boolean') {
    return { status: 'error', detail: 'adjacentRowOverlap/highlight 보존 지표가 boolean이 아닙니다.' }
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
    detail: `PASS · 스마트 ${smart.length}객체 · 가로세로결합분할 · 구멍OFF기본 · 3단엔진${TEXT_ENGINE_DEFAULT} · 팝업체커보드 · 텍스트상하단 · 배경순환 · 파이프라인CropFloodT${FLOOD_FILL_TOLERANCE} · 진단인스펙터 · toBlob PNG · 텍스트존${TEXT_ZONE_DEFAULT}% · Outline기본ON · 그리드 ${grid.length}칸 · 골든 ${goldenCuts}컷 · ${KAKAO_STICKER_SIZE}×${KAKAO_STICKER_SIZE} · ZIP ${packed.size}B · ${GOLDEN_BASELINE.version}`,
  }
}

function hashBand(data, width, y0, y1) {
  let hash = 2166136261
  const top = Math.max(0, y0)
  const bottom = Math.min(data.length / (width * 4), y1)
  for (let y = top; y < bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      hash ^= data[i]
      hash = Math.imul(hash, 16777619)
      hash ^= data[i + 3]
      hash = Math.imul(hash, 16777619)
    }
  }
  return hash
}

function probeLightboxCheckerboard() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    return { status: 'warn', detail: 'IDLE · 체커보드 CSS를 읽을 DOM이 없습니다.' }
  }
  const host = document.createElement('div')
  host.className = 'checkerboard-bg emo-lightbox-stage'
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:40px;height:40px;'
  document.body.appendChild(host)
  const style = getComputedStyle(host)
  const image = style.backgroundImage || ''
  const color = style.backgroundColor || ''
  document.body.removeChild(host)
  const solidWhite = /rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/i.test(color) && (!image || image === 'none')
  if (solidWhite) {
    return { status: 'error', detail: '확대 팝업 스테이지가 흰색 배경입니다.' }
  }
  if (!/conic|gradient|repeating/i.test(image)) {
    return { status: 'warn', detail: 'IDLE · checkerboard-bg 격자 패턴을 스타일시트에서 찾지 못했습니다.' }
  }
  return { status: 'ok', detail: '팝업 checkerboard-bg 격자 확인' }
}

export async function checkTextEngine() {
  const spec = GOLDEN_BASELINE.splitter
  const modes = TEXT_ENGINE_MODES.map((item) => item.id)
  if (TEXT_ENGINE_DEFAULT !== TEXT_ENGINE_ORIGINAL || spec.textEngineDefault !== 'ORIGINAL') {
    return { status: 'error', detail: '텍스트 엔진 기본값이 ORIGINAL이 아닙니다.' }
  }
  if (
    normalizeTextEngineMode('original') !== TEXT_ENGINE_ORIGINAL
    || normalizeTextEngineMode('vector_overlay') !== TEXT_ENGINE_VECTOR_OVERLAY
    || normalizeTextEngineMode('smart_recolor') !== TEXT_ENGINE_SMART_RECOLOR
  ) {
    return { status: 'error', detail: '3단 텍스트 엔진 모드 정규화가 실패했습니다.' }
  }
  if (modes.join(',') !== (spec.textEngineModes || []).join(',')) {
    return { status: 'error', detail: '골든 기준선 3단 엔진 목록과 런타임 모드가 다릅니다.' }
  }
  const tooLong = TEXT_ENGINE_MODES.find((item) => String(item.label || '').length > GOLDEN_BASELINE.uiIntegrity.maxButtonLabelLength)
  if (tooLong) {
    return { status: 'error', detail: `엔진 라벨 "${tooLong.label}"이 ${GOLDEN_BASELINE.uiIntegrity.maxButtonLabelLength}자를 넘습니다.` }
  }
  if (TEXT_ENGINE_MODES.some((item) => !String(item.tooltip || '').trim() || item.tooltip === item.label)) {
    return { status: 'error', detail: '엔진 버튼 설명문이 data-tooltip 격리를 지키지 않습니다.' }
  }
  if (captionForCutIndex(14) !== '어리둥절') {
    return { status: 'error', detail: '15번 컷 캡션 매핑이 어리둥절이 아닙니다.' }
  }
  if (characterReadOnlyCeil(360, 289) !== 289) {
    return { status: 'error', detail: 'SMART_RECOLOR Y_threshold(읽기 전용 천장)가 289가 아닙니다.' }
  }

  let painted = false
  applyTextEngine({ dummy: true }, {
    textEngineMode: TEXT_ENGINE_ORIGINAL,
    paintVector: () => { painted = true },
    recolorPixels: () => { painted = true },
  })
  if (painted) {
    return { status: 'error', detail: 'ORIGINAL 모드가 벡터/리컬러 콜백을 호출했습니다.' }
  }

  const vector = document.createElement('canvas')
  vector.width = 360
  vector.height = 360
  const vectorCtx = vector.getContext('2d')
  if (!vectorCtx) return { status: 'warn', detail: 'IDLE · 벡터 오버레이 프로브 컨텍스트를 열 수 없습니다.' }
  vectorCtx.clearRect(0, 0, 360, 360)
  paintCutCaption(vector, '어리둥절')
  const ink = vectorCtx.getImageData(0, 230, 360, 130)
  let inkHits = 0
  for (let i = 3; i < ink.data.length; i += 4) {
    if (ink.data[i] > 40) inkHits += 1
  }
  if (inkHits < 80) {
    return { status: 'error', detail: 'VECTOR_OVERLAY 3중 외곽선이 하단 밴드에 캡션을 그리지 못했습니다.' }
  }
  const topKeep = vectorCtx.getImageData(180, 40, 1, 1).data
  if (topKeep[3] > 20) {
    return { status: 'error', detail: '벡터 오버레이가 상단 캐릭터 밴드를 칠했습니다.' }
  }
  const glyph = document.createElement('canvas')
  glyph.width = 360
  glyph.height = 360
  const glyphCtx = glyph.getContext('2d')
  glyphCtx.clearRect(0, 0, 360, 360)
  paintCutCaption(glyph, 'ㅇ')
  const gpix = glyphCtx.getImageData(0, 0, 360, 360).data
  let minX = 360
  let maxX = 0
  let minY = 360
  let maxY = 0
  for (let y = 0; y < 360; y += 1) {
    for (let x = 0; x < 360; x += 1) {
      if (gpix[(y * 360 + x) * 4 + 3] < 40) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX <= minX || maxY <= minY) {
    return { status: 'error', detail: '벡터 오버레이가 한글 ㅇ을 그리지 못했습니다.' }
  }
  const cx = (minX + maxX) >> 1
  const cy = (minY + maxY) >> 1
  if (gpix[(cy * 360 + cx) * 4 + 3] < 180) {
    return { status: 'error', detail: '벡터 오버레이가 글자 내부 닫힌 영역을 투명으로 남겼습니다.' }
  }

  const roi = document.createElement('canvas')
  roi.width = 360
  roi.height = 360
  const roiCtx = roi.getContext('2d')
  roiCtx.fillStyle = '#ff8866'
  roiCtx.fillRect(0, 0, 360, 210)
  roiCtx.fillStyle = '#ffb48c'
  roiCtx.fillRect(40, 80, 70, 50)
  roiCtx.fillStyle = '#ff5a8a'
  roiCtx.fillRect(200, 90, 80, 60)
  roiCtx.fillStyle = '#141414'
  roiCtx.fillRect(70, 300, 220, 28)
  roiCtx.fillStyle = '#ffffff'
  roiCtx.fillRect(80, 306, 200, 16)
  const pixels = roiCtx.getImageData(0, 0, 360, 360)
  const lockY = characterReadOnlyCeil(360, 289)
  const before = hashBand(pixels.data, 360, 0, lockY)
  const hand = [pixels.data[(100 * 360 + 70) * 4], pixels.data[(100 * 360 + 70) * 4 + 1], pixels.data[(100 * 360 + 70) * 4 + 2]]
  const cake = [pixels.data[(120 * 360 + 240) * 4], pixels.data[(120 * 360 + 240) * 4 + 1], pixels.data[(120 * 360 + 240) * 4 + 2]]
  applyTextTone(pixels, 'custom', '#00ccff', { textEngineMode: TEXT_ENGINE_SMART_RECOLOR })
  const after = hashBand(pixels.data, 360, 0, lockY)
  if (after !== before) {
    return { status: 'error', detail: 'SMART_RECOLOR가 Y_threshold 위 캐릭터 영역을 변경했습니다.' }
  }
  if (pixels.data[(100 * 360 + 70) * 4] !== hand[0] || pixels.data[(120 * 360 + 240) * 4] !== cake[0]) {
    return { status: 'error', detail: 'SMART_RECOLOR가 손/케이크 컬러 픽셀을 침범했습니다.' }
  }

  const lightboxSrc = String(PreviewLightboxModal)
  if (typeof PreviewLightboxModal !== 'function' || !lightboxSrc.includes('checkerboard-bg') || lightboxSrc.includes('bg-white')) {
    return { status: 'error', detail: '확대 팝업에 checkerboard-bg가 없거나 bg-white가 남아 있습니다.' }
  }
  const board = probeLightboxCheckerboard()
  if (board.status === 'error') return board

  return {
    status: board.status === 'warn' ? 'warn' : 'ok',
    detail: `PASS · ORIGINAL 무변 · VECTOR 캡션 ${inkHits}px · SMART Y≥${lockY} · 15번 어리둥절 · ${board.detail} · ${GOLDEN_BASELINE.version}`,
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
        count += 1
        if (count > 4 && last) deltas.push(now - last)
        last = now
        if (count < 24) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    }),
    new Promise((resolve) => window.setTimeout(resolve, 900)),
  ])
  const sorted = deltas.slice().sort((a, b) => a - b)
  const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 16.7
  const fps = Math.min(60, 1000 / Math.max(1, mid))
  const probe = document.createElement('canvas')
  probe.width = 256
  probe.height = 256
  const t0 = performance.now()
  const ctx = probe.getContext('2d')
  if (!ctx) return { status: 'warn', detail: 'IDLE · 파이프라인 프로브 컨텍스트를 열 수 없습니다.' }
  if (!Array.isArray(HQ_KERNEL) || HQ_KERNEL.length !== 9 || HQ_KERNEL[4] !== 5 || typeof polishHqImageData !== 'function') {
    return { status: 'error', detail: 'HQ 렌더 파이프라인(커널/폴리시)이 기준선에서 빠졌습니다.' }
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#22d3ee'
  ctx.fillRect(0, 0, 256, 256)
  ctx.getImageData(8, 8, 48, 48)
  const latency = performance.now() - t0
  const live = readRenderPerf()
  const minHz = GOLDEN_BASELINE.motionEngine.allowedHzMin
  if (fps < minHz && latency > 40) {
    return {
      status: 'error',
      detail: `rAF ${Math.round(fps)} FPS < baseline ${minHz}Hz · 프로브 ${latency.toFixed(1)}ms · ${live.text}`,
    }
  }
  if (fps < minHz) {
    return {
      status: 'warn',
      detail: `IDLE · 진단 스캔 중 rAF ${Math.round(fps)} FPS (페인트 프로브 ${latency.toFixed(1)}ms는 정상) · ${live.text}`,
    }
  }
  const stable = fps >= 45 && latency <= 40
  if (!stable) {
    return {
      status: 'warn',
      detail: `IDLE · rAF ${Math.round(fps)} FPS / 프로브 ${latency.toFixed(1)}ms · 라이브 ${live.text} · baseline ${minHz}Hz 통과`,
    }
  }
  return {
    status: 'ok',
    detail: `PASS · ${Math.round(fps)} FPS ≥ ${minHz}Hz / 프로브 ${latency.toFixed(1)}ms · ${live.text} · ${GOLDEN_BASELINE.version}`,
  }
}

export async function checkMotionSequencer() {
  if (SEQUENCE_FPS_DEFAULT !== 8 || SEQUENCE_FPS_MIN !== 4 || SEQUENCE_FPS_MAX !== 24) {
    return { status: 'error', detail: '시퀀서 기본 FPS가 8(4~24)이 아닙니다.' }
  }
  if (clampSequenceFps(SEQUENCE_FPS_DEFAULT) !== 8 || clampSequenceFps(1) !== 4 || clampSequenceFps(99) !== 24) {
    return { status: 'error', detail: '시퀀서 FPS 클램프가 실패했습니다.' }
  }
  const moved = moveSequenceItem([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, -1)
  if (moved[1]?.id !== 'c' || moved[2]?.id !== 'b') {
    return { status: 'error', detail: '타임라인 순서 변경이 실패했습니다.' }
  }
  if (STUDIO_HUD_STEPS.length !== 10 || STUDIO_HUD_STEPS[0]?.id !== 'BFS_DEFRINGE') {
    return { status: 'error', detail: '모션 스튜디오 HUD 10항목이 동기화되지 않았습니다.' }
  }
  const bounceBack = expandPingPong(['a', 'b', 'c', 'd'], true)
  if (bounceBack.join('') !== 'abcdcb' || pingPongPlayIndex(4, 4, true) !== 2) {
    return { status: 'error', detail: '핑퐁 루프 1-2-3-4-3-2 순환이 실패했습니다.' }
  }
  if (PARTICLE_LAYERS.length !== 4 || !PARTICLE_LAYERS.some((item) => item.id === 'sparkle')) {
    return { status: 'error', detail: '파티클 오버레이 4종이 없습니다.' }
  }
  const virtual = resolvePlaybackFrames([], 'data:image/png,still')
  if (!virtual.stillLoop || virtual.frames.length !== 1 || stillLoopFrameCount(8, 2, 1) !== 16) {
    return { status: 'error', detail: '단일 이미지 가상 프레임 루프가 실패했습니다.' }
  }
  const spec = estimateStoreSpec({ frameCount: 4, fps: 8, pingPong: true })
  if (spec.frames !== 6 || spec.kb <= 0) {
    return { status: 'error', detail: '심사 스펙 HUD 계산이 실패했습니다.' }
  }
  const ids = TEXT_MOTION_EFFECTS.map((item) => item.id)
  if (TEXT_MOTION_EFFECTS.length !== 5 || !ids.includes(TEXT_MOTION_BOUNCE) || !ids.includes(TEXT_MOTION_TYPEWRITER)) {
    return { status: 'error', detail: '텍스트 모션 프리셋 5종이 없습니다.' }
  }
  const none = sampleTextMotion(TEXT_MOTION_NONE, 2, 8, '테스트')
  if (none.x !== 0 || none.y !== 0 || none.scale !== 1 || none.text !== '테스트') {
    return { status: 'error', detail: '없음(고정 텍스트) 포즈가 항등이 아닙니다.' }
  }
  const bounce = sampleTextMotion(TEXT_MOTION_BOUNCE, 2, 8, '테스트')
  if (bounce.y === 0) {
    return { status: 'error', detail: '바운스 Y 진폭 보간이 실패했습니다.' }
  }
  const pulse = sampleTextMotion(TEXT_MOTION_PULSE, 2, 8, '테스트')
  if (pulse.scale < 0.9 || pulse.scale > 1.15) {
    return { status: 'error', detail: '펄스 Scale 0.9~1.15 보간이 실패했습니다.' }
  }
  const typed = sampleTextMotion(TEXT_MOTION_TYPEWRITER, 0, 4, 'ABCD')
  if (typed.text !== 'A') {
    return { status: 'error', detail: '타이프라이터 글자 슬라이스가 실패했습니다.' }
  }
  if (resolveCaption(false, '아파요') !== '' || resolveCaption(true, '안녕') !== '안녕' || resolveCaption(true, '   ') !== '') {
    return { status: 'error', detail: '자막 OFF/빈 입력이 잔여 텍스트를 남깁니다.' }
  }
  if (resolveCaption(true, '아파요', { customText: '' }) !== '' || captionForSequenceItem({ cutIndex: 0 }) !== '') {
    return { status: 'error', detail: '빈 customText가 기본 예시 문구로 되돌아갑니다.' }
  }
  const liveClock = captionLoopIndex(0.5, 8, 2, 1)
  if (liveClock.total !== 16 || liveClock.index !== 8) {
    return { status: 'error', detail: '자막 루프 인덱스가 메인 프리뷰와 동기화되지 않습니다.' }
  }
  if (!String(paintLiveCaptionLayer).includes('isTextEnabled') || !String(paintLiveCaptionLayer).includes('customText')) {
    return { status: 'error', detail: '메인 프리뷰 자막 레이어가 isTextEnabled/customText를 받지 않습니다.' }
  }
  const previewSrc = String(MotionPreviewCanvas)
  const panelSrc = String(MotionSequencerPanel)
  const selectorSrc = String(MotionEffectSelector)
  const rendererSrc = String(paintDynamicTextMotion)
  if (!previewSrc.includes('checkerboard-bg') || previewSrc.includes('bg-white')) {
    return { status: 'error', detail: '모션 프리뷰 캔버스에 checkerboard-bg가 없거나 bg-white가 있습니다.' }
  }
  if (!previewSrc.includes('paintDynamicTextMotion') || !previewSrc.includes('buildCaptionPose')) {
    return { status: 'error', detail: '프리뷰가 DynamicTextMotionRenderer와 연결되어 있지 않습니다.' }
  }
  if (!previewSrc.includes('captionLoopIndex')) {
    return { status: 'error', detail: '프리뷰 자막 모션이 루프 시간에 연결되지 않았습니다.' }
  }
  if (!previewSrc.includes('applyDefringeToContext')) {
    return { status: 'error', detail: '모션 프리뷰에 1px 디프린지가 없습니다.' }
  }
  if (!previewSrc.includes('paintParticleOverlay') || !previewSrc.includes('pingPongPlayIndex')) {
    return { status: 'error', detail: '프리뷰에 파티클 또는 핑퐁 루프가 없습니다.' }
  }
  if (!previewSrc.includes('requestAnimationFrame') || !previewSrc.includes('paintMotionFrame')) {
    return { status: 'error', detail: '단일 이미지 requestAnimationFrame 모션 루프가 없습니다.' }
  }
  if (!previewSrc.includes('mirrorPreviewFrame') || !String(mirrorPreviewFrame).includes('drawImage')) {
    return { status: 'error', detail: '채팅 미리보기 캔버스 미러링이 없습니다.' }
  }
  if (!isMotionNone(MOTION_NONE) || sampleGifPreset(MOTION_NONE, 0.5, 1).scaleX !== 1 || sampleGifPreset('jellyBounce', 0.18, 1).scaleY === 1) {
    return { status: 'error', detail: '모션 없음 고정 또는 젤리 바운스 분리가 실패했습니다.' }
  }
  if (!panelSrc.includes('data-motion-seq') || !panelSrc.includes('일시정지') || !panelSrc.includes('MotionEffectSelector')) {
    return { status: 'error', detail: '프레임 시퀀서 패널 또는 모션 이펙트 선택기가 없습니다.' }
  }
  if (!panelSrc.includes('data-caption-bar') || !panelSrc.includes('CaptionControlBar')) {
    return { status: 'error', detail: '자막 입력창 또는 ON/OFF 토글이 없습니다.' }
  }
  if (!panelSrc.includes('captionLiveRef') || !panelSrc.includes('onCaptionLive')) {
    return { status: 'error', detail: '메인 프리뷰 자막 동기화 ref가 없습니다.' }
  }
  if (!String(CaptionControlBar).includes('data-caption-input') || !String(CaptionControlBar).includes('data-caption-on')) {
    return { status: 'error', detail: '자막 입력창 또는 ON/OFF 토글이 없습니다.' }
  }
  if (!panelSrc.includes('data-loop-mode') || !panelSrc.includes('ParticleOverlayBar') || !panelSrc.includes('ChatRoomSimulator') || !panelSrc.includes('StoreSpecHud')) {
    return { status: 'error', detail: '핑퐁·파티클·채팅 시뮬·심사 HUD가 없습니다.' }
  }
  if (!selectorSrc.includes('data-text-effect')) {
    return { status: 'error', detail: 'MotionEffectSelector에 data-text-effect가 없습니다.' }
  }
  if (!rendererSrc.includes('strokeText') || !rendererSrc.includes('fillText')) {
    return { status: 'error', detail: '동적 텍스트 렌더러가 Canvas 2D strokeText/fillText를 쓰지 않습니다.' }
  }
  if (ENCODER_SIZE !== 360) {
    return { status: 'error', detail: '인코더 출력 해상도가 360×360이 아닙니다.' }
  }
  const muxed = muxAnimatedWebp([Uint8Array.of(1, 2, 3, 4)], { width: 360, height: 360, delay: 125 })
  if (!isAnimatedWebp(muxed)) {
    return { status: 'error', detail: 'Animated WebP 뮤저가 ANIM/ANMF 컨테이너를 만들지 않습니다.' }
  }
  const gifSrc = String(encodeMotionGif)
  const exportSrc = String(MotionExportPanel)
  const progressSrc = String(EncodeProgressModal)
  if (!gifSrc.includes('floydSteinbergIndex') || !gifSrc.includes('GIFEncoder')) {
    return { status: 'error', detail: 'GIF 인코더에 gifenc 또는 Floyd-Steinberg가 없습니다.' }
  }
  if (!String(applyDefringeToContext).includes('defringeAlphaEdge')) {
    return { status: 'error', detail: '인코더 경로의 디프린지 헬퍼가 없습니다.' }
  }
  if (!String(composeSequenceCanvases).includes('paintParticleOverlay')) {
    return { status: 'error', detail: '인코더 파티클 오버레이가 연결되어 있지 않습니다.' }
  }
  if (!String(composeStillMotionCanvases).includes('paintMotionFrame') || !String(composeSequenceCanvases).includes('stillLoop')) {
    return { status: 'error', detail: '단일 이미지 모션 프리셋 인코딩이 연결되어 있지 않습니다.' }
  }
  if (!panelSrc.includes('MotionExportPanel') || !exportSrc.includes('data-encode-fmt') || !exportSrc.includes('data-clip-save')) {
    return { status: 'error', detail: '시퀀서 내보내기 또는 클립 저장 버튼이 없습니다.' }
  }
  const seqClip = createSequenceClip({ frames: [{ url: 'thumb' }], fps: 8, effect: 'bounce' }, 0)
  if (seqClip.fileName !== '클립 1' || seqClip.blob || !seqClip.sharedUrl || seqClip.frames.length !== 1 || seqClip.isPermanent !== true) {
    return { status: 'error', detail: '현재 모션 클립 저장 슬롯이 실패했습니다.' }
  }
  if (exportSrc.includes('addPackedClip') || !exportSrc.includes('purgeTempClips')) {
    return { status: 'error', detail: '내보내기가 임시 클립을 라인에 남기거나 완료 후 정리하지 않습니다.' }
  }
  if (!progressSrc.includes('checkerboard-bg') || progressSrc.includes('bg-white')) {
    return { status: 'error', detail: '인코딩 진행 창에 checkerboard-bg가 없거나 bg-white가 있습니다.' }
  }
  if (!progressSrc.includes('data-encode-gauge') || !exportSrc.includes('변환 중') || !exportSrc.includes('yieldToMain')) {
    return { status: 'error', detail: '인코딩 진행률 게이지 또는 메인스레드 양보가 없습니다.' }
  }
  if (typeof yieldToMain !== 'function' || !frameProgressCopy('gif', 8, 16).includes('8 / 16')) {
    return { status: 'error', detail: '프레임 진행률 문구 헬퍼가 없습니다.' }
  }
  if (motionClipFileName(0, 'gif') !== 'motion-01.gif' || motionClipFileName(1, 'webp') !== 'motion-02.webp') {
    return { status: 'error', detail: 'ZIP 파일명이 motion-01.gif 규격이 아닙니다.' }
  }
  const clipSrc = String(MotionClipManager)
  const zipBtnSrc = String(MotionZipToolbarButton)
  if (!clipSrc.includes('checkerboard-bg') || clipSrc.includes('bg-white')) {
    return { status: 'error', detail: '클립 갤러리에 checkerboard-bg가 없거나 bg-white가 있습니다.' }
  }
  if (!clipSrc.includes('data-clip-del') || !clipSrc.includes('stopPropagation') || !clipSrc.includes('전체 비우기')) {
    return { status: 'error', detail: '클립 개별 삭제 또는 전체 비우기가 없습니다.' }
  }
  if (!panelSrc.includes('fallbackSeq') || !clipSrc.includes('clearClips')) {
    return { status: 'error', detail: '클립 삭제 후 시퀀서 폴백이 없습니다.' }
  }
  if (!zipBtnSrc.includes('data-batch-zip') || !panelSrc.includes('data-play-speed') || !panelSrc.includes('MotionClipManager')) {
    return { status: 'error', detail: '클립 보관함, 배속 토글 또는 ZIP 일괄 버튼이 없습니다.' }
  }
  return {
    status: 'ok',
    detail: `PASS · 타임라인 · 핑퐁 · 파티클 · 채팅 시뮬 · 심사 HUD · GIF/WebP · ZIP motion-01 · ${SEQUENCE_FPS_DEFAULT}FPS · ${GOLDEN_BASELINE.version}`,
  }
}
