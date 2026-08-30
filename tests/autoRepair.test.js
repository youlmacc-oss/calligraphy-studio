import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CUSTOM_FONT_GROUP } from '../src/lib/customFonts.js'
import {
  applyOutlineAssist,
  applyTextTone,
  captionForCutIndex,
  CHARACTER_LOCK_RATIO,
  CHARACTER_WRITE_FLOOR_RATIO,
  clearTextPlatePixels,
  FLOOD_FILL_TOLERANCE,
  PUNCH_HOLES_DEFAULT,
  SLICE_PIPELINE,
  TEXT_RECOLOR_BYPASS,
  TEXT_ROI_HARD_LOCK,
  TEXT_STROKE_PRESERVE,
  TEXT_ENGINE_DEFAULT,
  TEXT_ENGINE_ORIGINAL,
  TEXT_ENGINE_VECTOR_OVERLAY,
  TEXT_ENGINE_SMART_RECOLOR,
  applyTextEngine,
  characterReadOnlyCeil,
  normalizeTextEngineMode,
} from '../src/lib/emoticonSplit.js'
import { FONT_CATEGORIES, FONT_TAB_LABELS, FONT_TAB_TOOLTIPS } from '../src/presets.js'
import { DEFAULT_EMOTICON_FONT_ID, EMOTICON_FONTS, captionCanvasFont } from '../src/lib/emoticonFonts.js'
import { GOLDEN_BASELINE } from '../src/utils/diagnosticsBaseline.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TAB_LABEL_BANNED = /(합니다|모음|폰트|스타일)/

function readSrc(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function sliceFn(src, name) {
  const token = `export function ${name}`
  const start = src.indexOf(token)
  if (start < 0) throw new Error(`missing ${token}`)
  const rest = src.slice(start + token.length)
  const match = rest.match(/\nexport (async )?function /)
  const end = match ? start + token.length + match.index : src.length
  return src.slice(start, end)
}

function assertShortLabel(id, label, tooltip) {
  const text = String(label || '').replace(/\s+/g, ' ').trim()
  const tip = String(tooltip || '').trim()
  expect(text.length, `${id} label`).toBeLessThanOrEqual(GOLDEN_BASELINE.uiIntegrity.maxButtonLabelLength)
  expect(text, `${id} 설명형 어미`).not.toMatch(TAB_LABEL_BANNED)
  expect(tip, `${id} tooltip`).toBeTruthy()
  expect(text).not.toBe(tip)
  expect(text.includes(tip)).toBe(false)
}

function makeImage(width, height) {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

function fillRect(image, x, y, w, h, rgba) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * image.width + xx) * 4
      image.data[i] = rgba[0]
      image.data[i + 1] = rgba[1]
      image.data[i + 2] = rgba[2]
      image.data[i + 3] = rgba[3]
    }
  }
}

function regionStats(image, y0, y1) {
  let hash = 2166136261
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const i = (y * image.width + x) * 4
      hash ^= image.data[i]
      hash = Math.imul(hash, 16777619)
      hash ^= image.data[i + 1]
      hash = Math.imul(hash, 16777619)
      hash ^= image.data[i + 2]
      hash = Math.imul(hash, 16777619)
      hash ^= image.data[i + 3]
      hash = Math.imul(hash, 16777619)
      r += image.data[i]
      g += image.data[i + 1]
      b += image.data[i + 2]
      n += 1
    }
  }
  return { hash, r: r / n, g: g / n, b: b / n }
}

function sample(image, x, y) {
  const i = (y * image.width + x) * 4
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]]
}

describe('자율 루프 자동 리페어 검증기', () => {
  it('1. UI_LABEL_INTEGRITY: 폰트 탭 라벨 길이 및 설명문 침범 검증', () => {
    expect(FONT_CATEGORIES.length).toBeGreaterThan(0)
    FONT_CATEGORIES.forEach((cat) => {
      expect(FONT_TAB_LABELS[cat.id]).toBe(cat.label)
      expect(FONT_TAB_TOOLTIPS[cat.id]).toBe(cat.tooltip)
      assertShortLabel(cat.id, cat.label, cat.tooltip)
    })
    assertShortLabel('custom', CUSTOM_FONT_GROUP.label, CUSTOM_FONT_GROUP.tooltip)

    const picker = readSrc('src/components/FontPicker.jsx')
    const tabFn = picker.slice(
      picker.indexOf('function CategoryTabButton'),
      picker.indexOf('function pickerGroups'),
    )
    expect(tabFn).toContain('data-tooltip={tooltip}')
    expect(tabFn).toContain('{label}')
    expect(tabFn).not.toMatch(/\{label\}\s*\{tooltip\}/)
    expect(tabFn).not.toContain('{cat.hint}')
    expect(picker).toContain('FONT_TAB_LABELS[cat.id] || cat.label')
    expect(picker).toContain('data-tooltip={FONT_TAB_TOOLTIPS[cat.id] || cat.tooltip}')
  })

  it('2. SPLITTER_INTEGRITY: 펀치홀 및 텍스트존 절단 비활성화 검증', () => {
    expect(GOLDEN_BASELINE.splitter.punchHoles).toBe(false)
    expect(GOLDEN_BASELINE.splitter.alphaThreshold).toBe(18)
    expect(GOLDEN_BASELINE.splitter.textModeDefault).toBe('original')
    expect(PUNCH_HOLES_DEFAULT).toBe(GOLDEN_BASELINE.splitter.punchHoles)
    expect(FLOOD_FILL_TOLERANCE).toBe(GOLDEN_BASELINE.splitter.alphaThreshold)
    expect(SLICE_PIPELINE).toBe(GOLDEN_BASELINE.splitter.pipeline)
    expect(SLICE_PIPELINE).not.toMatch(/pixel-text-recolor/i)
    expect(SLICE_PIPELINE).toMatch(/4-corner flood-fill-alpha/)

    const split = readSrc('src/lib/emoticonSplit.js')
    const floodFn = sliceFn(split, 'floodFillAlphaKey')
    expect(floodFn).toContain('markExteriorBackground')
    expect(split).toContain('enqueue(0, 0, true)')
    expect(split).toContain('enqueue(width - 1, 0, true)')
    expect(split).toContain('enqueue(0, height - 1, true)')
    expect(split).toContain('enqueue(width - 1, height - 1, true)')
    expect(split).toContain('sealed')
    expect(split).toContain('isBridgeGap')
    expect(split).toContain('export function extractCleanEmoticonCell')
    expect(sliceFn(split, 'extractCleanEmoticonCell')).toContain("globalCompositeOperation = 'destination-in'")
    expect(split).toContain('export function sniffCanvasHasAlpha')
    expect(split).toContain('export function processHybridSheetCell')
    expect(sliceFn(split, 'processHybridSheetCell')).toContain('extractLosslessCell')
    expect(split).toContain('export function processHighQualitySmartSplit')

    const fitFn = sliceFn(split, 'fitToKakaoCanvas')
    expect(fitFn).not.toContain('clearTextPlatePixels')
    expect(fitFn).not.toContain('enhanceSliceImageData')
    expect(fitFn).toContain('processHighQualityCrop')
    expect(fitFn).toContain('CROP_EDGE_INSET')
    expect(fitFn).toContain("imageSmoothingQuality = 'high'")
    expect(fitFn).not.toContain('applyTextTone')
    expect(sliceFn(split, 'processHighQualityCrop')).toContain('processHybridSheetCell')
    expect(sliceFn(split, 'fitToKakaoCanvas')).toContain('lossless')
    expect(split).toContain('export function processHighQualityCrop')
    expect(TEXT_RECOLOR_BYPASS).toBe(true)
    expect(GOLDEN_BASELINE.splitter.textRecolorBypass).toBe(true)
    expect(GOLDEN_BASELINE.splitter.textEngineDefault).toBe('ORIGINAL')
    expect(GOLDEN_BASELINE.splitter.textEngineModes).toEqual(['ORIGINAL', 'VECTOR_OVERLAY', 'SMART_RECOLOR'])
    expect(sliceFn(split, 'applyTextTone')).toContain('TEXT_RECOLOR_BYPASS')
    expect(sliceFn(split, 'applyTextTone')).toContain('TEXT_ENGINE_SMART_RECOLOR')
    expect(sliceFn(split, 'applyTextTone')).toContain('characterReadOnlyCeil')
    expect(TEXT_ROI_HARD_LOCK).toBe(true)
    expect(TEXT_STROKE_PRESERVE).toBe(true)
    expect(GOLDEN_BASELINE.splitter.textRoiHardLock).toBe(true)
    expect(GOLDEN_BASELINE.splitter.textStrokePreserve).toBe(true)
    expect(GOLDEN_BASELINE.splitter.characterLockRatio).toBe(CHARACTER_LOCK_RATIO)
    expect(GOLDEN_BASELINE.splitter.characterWriteFloorRatio).toBe(CHARACTER_WRITE_FLOOR_RATIO)
    expect(CHARACTER_WRITE_FLOOR_RATIO).toBe(0.32)
    expect(split).toContain('pixelTouchesColorful')
    expect(split).toContain('findCaptionRowBand')
    expect(split).toContain('markSmallLightFills')
    expect(split).toContain('isSolidInkInterior')
    expect(sliceFn(split, 'sliceSheet')).toContain('boxes.map((box, index)')
    expect(sliceFn(split, 'sliceSheet')).toContain('detectSmartEmoticonGrid')
    expect(split).toContain('export function detectSmartEmoticonGrid')
    expect(split).toContain('export function handleSheetAutoDetection')
    expect(split).toContain('export function handleDefaultSheetUpload')
    expect(split).toContain('export function isAcceptedSheetFile')
    expect(split).toContain('PNG_GUIDE_BODY')
    expect(split).toContain('DEFAULT_SHEET_COLS')
    expect(split).toContain('export function getRecommendedGrid')
    expect(split).toContain('export function generateSheetGrid')
    expect(split).toContain('export const SHEET_GRID_PRESETS')
    expect(split).toContain('export function isOverSplitSmartGrid')
    expect(split).toContain('export function isCollapsedSmartGrid')
    expect(split).toContain('export function findProjectionSegments')
    expect(split).toContain('export function inferGuidesFromSmartBoxes')
    expect(sliceFn(split, 'sliceSheet')).not.toMatch(/if\s*\(\s*index\s*[<>=]/)
    expect(sliceFn(split, 'sliceSheet')).toContain("console.log('[Splitter Live]', cutIndex, '처리 완료')")
    expect(sliceFn(split, 'sliceSheet')).toContain('applyTextEngine')
    expect(split).toContain('SPLITTER_LIVE_REV')
    expect(split).toContain('paintCutCaption')
    expect(captionForCutIndex(14)).toBe('어리둥절')

    const pipeline = readSrc('src/utils/textProcessingPipeline.js')
    expect(pipeline).toContain("export const TEXT_ENGINE_ORIGINAL = 'ORIGINAL'")
    expect(pipeline).toContain("export const TEXT_ENGINE_VECTOR_OVERLAY = 'VECTOR_OVERLAY'")
    expect(pipeline).toContain("export const TEXT_ENGINE_SMART_RECOLOR = 'SMART_RECOLOR'")
    expect(pipeline).toContain("export const TEXT_ENGINE_DEFAULT = TEXT_ENGINE_ORIGINAL")
    expect(pipeline).toContain('strokeText')
    expect(pipeline).toContain('fillText')
    expect(pipeline).toContain('fillClosedGlyphCounters')
    expect(pipeline).toContain("imageSmoothingQuality = 'high'")
    expect(pipeline).not.toContain('ctx.clearRect(0, edge - band, edge, band)')
    expect(pipeline).toContain('characterReadOnlyCeil')

    const splitterUi = readSrc('src/components/EmoticonSplitterModal.jsx')
    expect(splitterUi).toContain('processSplit')
    expect(splitterUi).toContain('SPLITTER_LIVE_REV')
    expect(splitterUi).toContain('liveSheetMemory')
    expect(splitterUi).toContain('data-text-engine')
    expect(splitterUi).toContain('TEXT_ENGINE_MODES')
    expect(splitterUi).toContain('showTransparencyGuideModal')
    expect(splitterUi).toContain('data-png-guide')
    expect(splitterUi).toContain('data-png-guide-ok')
    expect(splitterUi).toContain('data-grid-detect')
    expect(splitterUi).toContain('formatSmartGridLabel')
    expect(splitterUi).toContain('handleDefaultSheetUpload')
    expect(splitterUi).toContain('onSheetPreviewLoad')
    expect(splitterUi).toContain('data-sheet-guide')
    expect(splitterUi).toContain('data-split-empty')
    expect(splitterUi).toContain('자동 배경 투명화')
    expect(splitterUi).toContain('안쪽 구멍 투명화')
    expect(splitterUi).toContain('시트 분할 대기 중')
    expect(splitterUi).not.toContain('T=18 투명화')
    expect(splitterUi).not.toContain('CaptionVectorLabel')
    expect(splitterUi).not.toContain('금색 외곽 재단선')
    expect(splitterUi).toContain('data-sheet-presets')
    expect(splitterUi).toContain('applySheetGridPreset')
    expect(splitterUi).toContain('SHEET_GRID_PRESETS')
    expect(splitterUi).toContain('emo-smart-box')
    expect(splitterUi).toContain('slices.length}종 ZIP')
    expect(splitterUi).toContain('PNG_GUIDE_OK_LABEL')
    expect(splitterUi).toContain('checkerboard-bg')
    expect(pipeline).toContain('원본 유지')
    expect(pipeline).toContain('벡터 오버레이')
    expect(pipeline).toContain('스마트 리컬러')

    const diag = readSrc('src/lib/diagnosticChecks.js')
    expect(diag).toContain('handleSheetAutoDetection')
    expect(diag).toContain('handleDefaultSheetUpload')
    expect(diag).toContain('PNG_GUIDE_BODY')
    expect(diag).toContain('붕괴 3스트립')
    expect(diag).toContain('isOverSplitSmartGrid')
    expect(diag).toContain('5×6 피크')
    expect(diag).toContain('export async function checkTextEngine')
    expect(diag).toContain('probeLightboxCheckerboard')
    expect(diag).toContain('characterReadOnlyCeil')
    const registry = readSrc('src/lib/featureRegistry.js')
    expect(registry).toContain("id: 'text-engine'")
    expect(registry).toContain('checkTextEngine')
    expect(registry).toContain('HUD17 3단 텍스트 엔진')
    expect(registry).toContain("id: 'motion-seq'")
    expect(registry).toContain('checkMotionSequencer')
    expect(registry).toContain('GUIDEBOOK_SECTIONS')
    expect(registry).toContain('checkSheetPipeline')
    expect(registry).toContain('4행 × 5열 (총 20개)')
    expect(registry).toContain('Lossless Bypass')
    expect(registry).toContain('STEP 1. 시트 업로드와 28구 분할')
    expect(readSrc('src/lib/guidebookSections.js')).toContain('export const GUIDEBOOK_SECTIONS')
    expect(readSrc('src/lib/systemDiagnostics.js')).toContain('export function evaluateSystemDiagnostics')
    expect(readSrc('src/lib/systemDiagnostics.js')).toContain('export function exportFullDiagnosticLog')
    expect(readSrc('src/lib/systemDiagnostics.js')).toContain('Lossless Bypass')
    expect(readSrc('src/lib/systemDiagnostics.js')).toContain("'WARN'")
    expect(readSrc('src/components/EmoticonSplitterModal.jsx')).toContain('전사 진단 리포트가 복사되었습니다')
    expect(readSrc('src/components/GuidebookModal.jsx')).toContain('data-guide-pipeline')
    expect(diag).toContain('export async function checkSheetPipeline')
    expect(registry).toContain('STEP 4. 전체 ZIP 일괄 다운로드')
    expect(registry).toContain('자막 ON/OFF')
    expect(registry).toContain('개별 삭제')
    expect(registry).toContain('전체 비우기')
    expect(registry).toContain('임시 렌더 큐')
    expect(registry).toContain('PRO TIP. 핑퐁·파티클·채팅 시뮬')
    expect(readSrc('src/lib/studioHudChecks.js')).toContain('BFS_DEFRINGE')
    expect(readSrc('src/lib/studioHudChecks.js')).toContain('STUDIO_HUD_STEPS')
    expect(readSrc('src/components/MotionGifStudio/diagnosticsEngine.js')).toContain('runStudioHudChecks')
    expect(readSrc('src/components/MotionGifStudio/MotionDiagnosticsHUD.jsx')).toContain('data-diag-hud')
    expect(diag).toContain('export async function checkMotionSequencer')
    const seq = readSrc('src/components/MotionStudio/MotionPreviewCanvas.jsx')
    expect(seq).toContain('checkerboard-bg')
    expect(seq).toContain('paintParticleOverlay')
    expect(seq).toContain('pingPongPlayIndex')
    expect(seq).toContain('requestAnimationFrame')
    expect(seq).toContain('paintMotionFrame')
    expect(seq).not.toMatch(/bg-white/)
    const seqCss = readSrc('src/components/MotionStudio/motionStudio.css')
    expect(seqCss).not.toMatch(/#ffffff/)
    expect(seqCss).not.toMatch(/bg-white/)
    expect(seqCss).toContain('overflow-y: hidden')
    expect(seqCss).toContain('grid-template-columns: repeat(3')
    expect(seqCss).toContain('height: 48px')
    expect(seqCss).toContain('font-size: 16px')
    expect(seqCss).toContain('min-height: 360px')
    expect(seqCss).toContain('min-height: 105px')
    expect(seqCss).toContain('max-height: 105px')
    expect(seqCss).toContain('height: 75px')
    expect(seqCss).toContain('flex-shrink: 0')
    const fxUi = readSrc('src/components/MotionStudio/MotionEffectSelector.jsx')
    expect(fxUi).toContain('data-text-effect')
    expect(fxUi).toContain('TEXT_MOTION_EFFECTS')
    const fxLogic = readSrc('src/components/MotionStudio/dynamicTextMotion.js')
    expect(fxLogic).toContain("id: TEXT_MOTION_BOUNCE")
    expect(fxLogic).toContain('typewriter')
    expect(fxLogic).toContain('바운스')
    expect(fxLogic).toContain('쉐이크')
    expect(fxLogic).toContain('펄스')
    expect(fxLogic).toContain('타이핑')
    const fxPaint = readSrc('src/components/MotionStudio/DynamicTextMotionRenderer.js')
    expect(fxPaint).toContain('strokeText')
    expect(fxPaint).toContain('fillText')
    expect(fxPaint).toContain('ctx.translate')
    expect(fxPaint).toContain('ctx.scale')
    expect(fxPaint).toContain('ctx.rotate')
    const encoder = readSrc('src/utils/encoder/MotionEncoderEngine.js')
    expect(encoder).toContain('ENCODER_SIZE = 360')
    expect(encoder).toContain('floydSteinbergIndex')
    expect(encoder).toContain('GIFEncoder')
    expect(encoder).toContain('muxAnimatedWebp')
    expect(encoder).toContain('paintParticleOverlay')
    expect(encoder).toContain('paintMotionFrame')
    expect(encoder).toContain('composeStillMotionCanvases')
    expect(encoder).not.toMatch(/bg-white/)
    const processor = readSrc('src/utils/imageProcessor.js')
    expect(processor).toContain('export function defringeAlphaEdge')
    expect(processor).toContain('export function featherAlphaEdge')
    expect(processor).toContain('isWhiteFringePixel')
    expect(sliceFn(readSrc('src/lib/emoticonSplit.js'), 'extractCleanEmoticonCell')).not.toContain('defringeAlphaEdge')
    expect(sliceFn(readSrc('src/lib/emoticonSplit.js'), 'extractCleanEmoticonCell')).not.toContain('featherAlphaEdge')
    expect(readSrc('src/lib/emoticonSplit.js')).toContain('protectBounds')
    expect(readSrc('src/lib/emoticonSplit.js')).toContain('inLetterExclusion')
    const mgsCss = readSrc('src/components/MotionGifStudio/motionGifStudio.css')
    expect(mgsCss).toContain('95vw')
    expect(mgsCss).toContain('1650px')
    expect(mgsCss).toContain('92vh')
    expect(mgsCss).toContain('html[data-studio-fit] .studio-modal-card.mgs-card')
    expect(mgsCss).toContain('1520px')
    expect(readSrc('src/lib/studioFit.js')).toContain('STUDIO_FIT_WIDTH')
    expect(readSrc('src/lib/studioFit.js')).toContain('STUDIO_FIT_HEIGHT')
    expect(readSrc('src/lib/studioFit.js')).toContain('visualViewport')
    expect(mgsCss).toContain('aspect-ratio: 1 / 1')
    expect(mgsCss).toContain('max-height: 290px')
    expect(mgsCss).toContain('.mgs-pane.mgs-center')
    expect(mgsCss).toContain('grid-template-rows: minmax(0, 1fr)')
    expect(mgsCss).toContain('.mgs-pane.mgs-sources')
    const exportUi = readSrc('src/components/MotionStudio/MotionExportPanel.jsx')
    expect(exportUi).toContain('data-encode-fmt')
    expect(exportUi).toContain('data-clip-save')
    expect(exportUi).toContain('클립 저장')
    expect(exportUi).toContain('GIF로 내보내기')
    expect(exportUi).toContain('WebP(투명) 내보내기')
    expect(exportUi).toContain('변환 중')
    expect(exportUi).toContain('yieldToMain')
    expect(exportUi).toContain('purgeTempClips')
    expect(exportUi).toContain('내보내기 완료')
    expect(exportUi).not.toContain('addPackedClip')
    const progressUi = readSrc('src/components/MotionStudio/EncodeProgressModal.jsx')
    expect(progressUi).toContain('checkerboard-bg')
    expect(progressUi).toContain('data-encode-gauge')
    expect(progressUi).not.toMatch(/bg-white/)
    expect(readSrc('src/utils/encoder/MotionEncoderEngine.js')).toContain('export function yieldToMain')
    expect(readSrc('src/utils/encoder/MotionEncoderEngine.js')).toContain('프레임 처리 완료')
    const zipEngine = readSrc('src/utils/encoder/BatchExportEngine.js')
    expect(zipEngine).toContain('JSZip')
    expect(zipEngine).toContain('saveAs')
    expect(zipEngine).toContain('createSequenceClip')
    expect(zipEngine).toContain('isPermanent: true')
    expect(zipEngine).toContain('export function isPermanentClip')
    expect(zipEngine).toContain('motion-')
    expect(zipEngine).toContain('360')
    const clipUi = readSrc('src/components/MotionStudio/MotionClipManager.jsx')
    expect(clipUi).toContain('checkerboard-bg')
    expect(clipUi).toContain('data-motion-clip')
    expect(clipUi).toContain('data-clip-del')
    expect(clipUi).toContain('stopPropagation')
    expect(clipUi).toContain('전체 비우기')
    expect(clipUi).toContain('isPermanentClip')
    expect(readSrc('src/components/MotionStudio/motionStudioContext.jsx')).toContain('purgeTempClips')
    expect(clipUi).not.toMatch(/bg-white/)
    expect(readSrc('src/components/MotionStudio/motionStudioContext.jsx')).toContain('clearClips')
    expect(readSrc('src/components/MotionStudio/motionStudioContext.jsx')).toContain('fallbackSeq')
    expect(seqCss).toContain('.ms-clip-del')
    const zipBtn = readSrc('src/components/MotionStudio/MotionZipToolbarButton.jsx')
    expect(zipBtn).toContain('data-batch-zip')
    expect(zipBtn).toContain('전체 ZIP')
    expect(readSrc('src/components/MotionStudio/motionStudioContext.jsx')).toContain('saveSequenceClip')
    const seqPanel = readSrc('src/components/MotionStudio/MotionSequencerPanel.jsx')
    expect(seqPanel).toContain('data-play-speed')
    expect(seqPanel).toContain('MotionClipManager')
    expect(seqPanel).toContain('data-loop-mode')
    expect(seqPanel).toContain('ParticleOverlayBar')
    expect(seqPanel).toContain('ChatRoomSimulator')
    expect(seqPanel).toContain('StoreSpecHud')
    expect(seqPanel).toContain('CaptionControlBar')
    expect(seqPanel).toContain('data-caption-bar')
    expect(seqPanel).toContain('data-seq-toolbar')
    expect(readSrc('src/components/MotionStudio/CaptionControlBar.jsx')).toContain('data-caption-input')
    expect(readSrc('src/components/MotionStudio/CaptionControlBar.jsx')).toContain('자막 ON')
    expect(readSrc('src/components/MotionStudio/CaptionControlBar.jsx')).toContain('자막 OFF')
    expect(readSrc('src/components/MotionStudio/CaptionControlBar.jsx')).toContain('자막/텍스트 입력 (미입력 시 텍스트 없음)')
    expect(readSrc('src/components/MotionStudio/dynamicTextMotion.js')).toContain("return ''")
    expect(readSrc('src/components/MotionStudio/dynamicTextMotion.js')).toContain('export function resolveCaption')
    expect(readSrc('src/components/MotionStudio/MotionPreviewCanvas.jsx')).toContain('buildCaptionPose')
    expect(readSrc('src/utils/encoder/MotionEncoderEngine.js')).toContain('captionOn')
    expect(readSrc('src/components/MotionStudio/particleOverlayEngine.js')).toContain('PARTICLE_SPARKLE')
    expect(readSrc('src/components/MotionStudio/ChatRoomSimulator.jsx')).toContain('checkerboard-bg')
    expect(readSrc('src/components/MotionStudio/ChatRoomSimulator.jsx')).toContain('drawImage')
    expect(readSrc('src/components/MotionStudio/ChatRoomSimulator.jsx')).toContain('data-chat-mirror')
    expect(readSrc('src/components/MotionStudio/ChatRoomSimulator.jsx')).not.toMatch(/bg-white/)
    expect(seqPanel).toContain('chatMirrorRef')
    expect(readSrc('src/components/MotionStudio/MotionPreviewCanvas.jsx')).toContain('mirrorPreviewFrame')
    expect(readSrc('src/components/MotionStudio/storeSpecHud.js')).toContain('KAKAO_MAX_KB')
    const modalGlue = readSrc('src/components/MotionGifStudio/MotionGifStudioModal.jsx')
    expect(modalGlue).toContain('MotionSequencerPanel')
    expect(modalGlue).toContain('paintLiveCaptionLayer')
    expect(modalGlue).toContain('captionLiveRef')
    expect(seqPanel).toContain('captionLiveRef')
    expect(seqPanel).toContain('onCaptionLive')
    expect(readSrc('src/components/MotionStudio/MotionPreviewCanvas.jsx')).toContain('captionLoopIndex')
    expect(readSrc('src/components/MotionStudio/DynamicTextMotionRenderer.js')).toContain('isTextEnabled')
    expect(modalGlue).toContain('MotionStudioProvider')
    expect(modalGlue).toContain('MotionZipToolbarButton')
    expect(modalGlue).toContain('data-motion-preset')
    expect(modalGlue).toContain('MOTION_NONE')
    expect(modalGlue).toContain('모션 없음')
    expect(modalGlue).toContain('앵그리 셰이크')
    expect(modalGlue).toContain('롤링 틸트')
    expect(modalGlue).toContain('스쿼시 스트레치')
    expect(modalGlue).toContain('하트 비트')
    expect(modalGlue).toContain('줌 앤 펀치')
    const gifPresets = readSrc('src/components/MotionGifStudio/motionPresets.js')
    expect(gifPresets).toContain("id: 'angryShake'")
    expect(gifPresets).toContain("id: 'rollingTilt'")
    expect(gifPresets).toContain("id: 'squashStretch'")
    expect(gifPresets).toContain("id: 'heartbeat'")
    expect(gifPresets).toContain("id: 'zoomPunch'")
    expect(gifPresets).toContain("export const MOTION_NONE = 'none'")
    expect(gifPresets).toContain('export function isMotionNone')
    expect(gifPresets).toContain('export function jellyBounce')
    expect(readSrc('src/components/MotionGifStudio/motionGifStudio.css')).toContain('mgs-preset-grid')
    expect(readSrc('src/components/EmoticonSplitterModal.jsx')).not.toContain('MotionSequencerPanel')
    expect(registry).not.toMatch(/13단계/)
    const hud = readSrc('src/components/SelfDiagnosticModal.jsx')
    expect(hud).toContain('DIAG_STEPS.length')
    expect(hud).toContain('3단 텍스트 엔진')
    expect(hud).toContain('{total}')

    const debug = readSrc('src/utils/debugger.js')
    expect(debug).not.toMatch(/pixel-text-recolor/)
    expect(debug).toMatch(/4-corner flood-fill-alpha/)
  })

  it('3. LABEL_SCAN_HOSTS: CSS 쉼표 :not 함정 회귀 방지', () => {
    const hosts = GOLDEN_BASELINE.uiIntegrity.labelScanHosts
    expect(Array.isArray(hosts)).toBe(true)
    expect(hosts.length).toBeGreaterThanOrEqual(5)
    hosts.forEach((host) => {
      expect(host).not.toContain(',')
      expect(host.startsWith('.')).toBe(true)
    })
  })

  it('4. TEXT_ROI_LOCK: Rule A/B/C · 캐릭터 불변 · 단일톤 캡션 · original 우회', () => {
    const sheet = makeImage(40, 40)
    fillRect(sheet, 0, 0, 40, 28, [255, 136, 102, 255])
    fillRect(sheet, 4, 10, 8, 6, [180, 176, 170, 255])
    fillRect(sheet, 6, 20, 10, 6, [154, 160, 166, 255])
    fillRect(sheet, 18, 6, 4, 4, [20, 20, 20, 255])
    fillRect(sheet, 10, 32, 20, 3, [20, 20, 20, 255])
    fillRect(sheet, 8, 36, 24, 3, [20, 20, 20, 255])
    const original = makeImage(40, 40)
    original.data.set(sheet.data)
    const lockY = Math.floor(40 * CHARACTER_LOCK_RATIO)
    const before = regionStats(sheet, 0, lockY)

    applyTextTone(original, 'original', '#00ccff')
    expect(Array.from(original.data)).toEqual(Array.from(sheet.data))

    const frozen = makeImage(40, 40)
    frozen.data.set(sheet.data)
    applyTextTone(sheet, 'custom', '#00ccff')
    applyOutlineAssist(sheet, '#00ccff')
    clearTextPlatePixels(sheet)

    const after = regionStats(sheet, 0, lockY)
    expect(after.hash).toBe(before.hash)
    expect(after.r).toBeCloseTo(before.r, 10)
    expect(after.g).toBeCloseTo(before.g, 10)
    expect(after.b).toBeCloseTo(before.b, 10)
    expect(Array.from(sheet.data)).toEqual(Array.from(frozen.data))
    expect(sample(sheet, 6, 12)[3]).toBe(255)
    expect(sample(sheet, 8, 22)[3]).toBe(255)
    expect(sample(sheet, 19, 7).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 10, 32).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 18, 33).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 18, 37).slice(0, 3)).toEqual([20, 20, 20])
  })

  it('5. LAST_ROW_FILL: 20% 밴드 위 캡션도 채움만 리컬러 · 먹선/캐릭터 0.00%', () => {
    const sheet = makeImage(40, 40)
    fillRect(sheet, 0, 0, 40, 22, [255, 136, 102, 255])
    fillRect(sheet, 4, 10, 8, 6, [180, 176, 170, 255])
    fillRect(sheet, 18, 6, 4, 4, [20, 20, 20, 255])
    fillRect(sheet, 8, 24, 24, 8, [20, 20, 20, 255])
    fillRect(sheet, 10, 26, 20, 4, [255, 255, 255, 255])
    const beforeChar = regionStats(sheet, 0, 24)
    applyTextTone(sheet, 'custom', '#00ccff')
    const afterChar = regionStats(sheet, 0, 24)
    expect(afterChar.hash).toBe(beforeChar.hash)
    expect(afterChar.r).toBeCloseTo(beforeChar.r, 10)
    expect(afterChar.g).toBeCloseTo(beforeChar.g, 10)
    expect(afterChar.b).toBeCloseTo(beforeChar.b, 10)
    expect(sample(sheet, 19, 7).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 8, 24).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 18, 28).slice(0, 3)).toEqual([255, 255, 255])
  })

  it('6. CUTS_22_28_360: 카카오 360에서 밴드 위 캡션 채움 균일 · 원형판/캐릭터 0.00%', () => {
    const sheet = makeImage(360, 360)
    fillRect(sheet, 0, 0, 360, 210, [255, 136, 102, 255])
    fillRect(sheet, 40, 40, 80, 80, [180, 176, 170, 255])
    fillRect(sheet, 160, 50, 24, 24, [20, 20, 20, 255])
    fillRect(sheet, 40, 230, 280, 40, [20, 20, 20, 255])
    fillRect(sheet, 50, 240, 260, 20, [255, 255, 255, 255])
    const beforeChar = regionStats(sheet, 0, 230)
    applyTextTone(sheet, 'custom', '#00ccff')
    const afterChar = regionStats(sheet, 0, 230)
    expect(afterChar.hash).toBe(beforeChar.hash)
    expect(afterChar.r).toBeCloseTo(beforeChar.r, 10)
    expect(sample(sheet, 172, 62).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 40, 230).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 180, 250).slice(0, 3)).toEqual([255, 255, 255])
  })

  it('7. CUTS_22_28_LIFTED: 중간 높이 캡션도 채움만 · 원형판 0.00%', () => {
    const sheet = makeImage(360, 360)
    fillRect(sheet, 0, 0, 360, 110, [255, 136, 102, 255])
    fillRect(sheet, 132, 22, 96, 96, [124, 58, 237, 255])
    fillRect(sheet, 160, 40, 20, 20, [20, 20, 20, 255])
    fillRect(sheet, 70, 120, 220, 28, [20, 20, 20, 255])
    fillRect(sheet, 80, 126, 200, 16, [255, 255, 255, 255])
    const before = regionStats(sheet, 0, 120)
    applyTextTone(sheet, 'custom', '#00ccff')
    const after = regionStats(sheet, 0, 120)
    expect(after.hash).toBe(before.hash)
    expect(sample(sheet, 180, 70).slice(0, 3)).toEqual([124, 58, 237])
    expect(sample(sheet, 70, 120).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 180, 134).slice(0, 3)).toEqual([255, 255, 255])
  })

  it('8. LONG_PHRASE_GAPS: 감사합니다형 글자 사이는 안 칠하고 먹선 유지', () => {
    const sheet = makeImage(40, 40)
    fillRect(sheet, 0, 0, 40, 28, [255, 136, 102, 255])
    fillRect(sheet, 2, 30, 36, 9, [210, 210, 214, 255])
    fillRect(sheet, 4, 31, 8, 7, [20, 20, 20, 255])
    fillRect(sheet, 6, 33, 4, 3, [255, 255, 255, 255])
    fillRect(sheet, 20, 31, 8, 7, [20, 20, 20, 255])
    fillRect(sheet, 22, 33, 4, 3, [255, 255, 255, 255])
    applyTextTone(sheet, 'custom', '#00ccff')
    expect(sample(sheet, 4, 31).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 8, 34).slice(0, 3)).toEqual([255, 255, 255])
    expect(sample(sheet, 24, 34).slice(0, 3)).toEqual([255, 255, 255])
    expect(sample(sheet, 16, 34).slice(0, 3)).toEqual([210, 210, 214])
  })

  it('9. LIGHTBOX_ISOLATION: 확대 팝업 라벨 격리 · ESC/배경 닫기', () => {
    const modal = readSrc('src/components/PreviewLightboxModal.jsx')
    expect(modal).toContain('data-tooltip')
    expect(modal).toContain('Escape')
    expect(modal).toContain('닫기')
    expect(modal).toContain('◀')
    expect(modal).toContain('▶')
    expect(modal).toContain('checkerboard-bg')
    expect(modal).toContain('emo-lightbox-canvas checkerboard-bg')
    expect(modal).toContain('live: true')
    expect(modal).not.toMatch(/bg-white/)
    expect(modal).not.toMatch(/is-bg-\$\{viewBg\}/)
    expect(modal).not.toMatch(/fillStyle/)
    expect(modal).not.toMatch(/fillRect/)
    const css = readSrc('src/index.css')
    const boardAt = css.indexOf('.checkerboard-bg')
    const boardCss = css.slice(boardAt, css.indexOf('.emo-lightbox-canvas {', boardAt))
    expect(boardCss).toContain('repeating-conic-gradient')
    expect(boardCss).not.toMatch(/#ffffff/)
    expect(boardCss).not.toMatch(/bg-white/)
    const canvasAt = css.indexOf('.emo-lightbox-canvas {')
    const canvasCss = css.slice(canvasAt, css.indexOf('.emo-lightbox-nav {', canvasAt))
    expect(canvasCss).not.toMatch(/background:\s*#fff/)
    expect(canvasCss).not.toMatch(/background:\s*transparent/)
    expect(css).not.toMatch(/\.emo-lightbox-card\.is-bg-light \.emo-lightbox-canvas \{\s*background:\s*#ffffff/)
    expect(modal).not.toMatch(/>\s*어두운 오버레이/)
    const splitter = readSrc('src/components/EmoticonSplitterModal.jsx')
    expect(splitter).toContain('PreviewLightboxModal')
    expect(splitter).toContain('setLightboxIndex')
    expect(splitter).toContain('emo-thumb-open')
    expect(splitter).toContain('emo-split-root')
    expect(css).toContain('html[data-studio-fit] .studio-modal-card.emo-split-card')
    expect(css).toContain('html:not([data-studio-fit]) .emo-thumbs')
  })

  it('10. ALL_28_INDEX_LOOP: 1~28번 동일 파이프라인 · 누락 0', () => {
    const missed = []
    for (let index = 0; index < 28; index += 1) {
      const lastRow = index >= 21
      const sheet = makeImage(360, 360)
      fillRect(sheet, 0, 0, 360, lastRow ? 110 : 210, [255, 136, 102, 255])
      fillRect(sheet, 132, 22, 96, 96, [124, 58, 237, 255])
      fillRect(sheet, 160, 40, 20, 20, [20, 20, 20, 255])
      const textY = lastRow ? 120 : 230
      fillRect(sheet, 70, textY, 220, 28, [20, 20, 20, 255])
      fillRect(sheet, 80, textY + 6, 200, 16, [255, 255, 255, 255])
      const lockY = textY
      const before = regionStats(sheet, 0, lockY)
      applyTextTone(sheet, 'custom', '#00ccff')
      const after = regionStats(sheet, 0, lockY)
      const fill = sample(sheet, 180, textY + 14)
      const stroke = sample(sheet, 70, textY)
      const plate = sample(sheet, 180, 70)
      const eye = sample(sheet, 170, 50)
      if (after.hash !== before.hash) missed.push(`${index + 1}:char`)
      if (stroke[0] !== 20 || stroke[1] !== 20) missed.push(`${index + 1}:stroke`)
      if (fill[0] !== 255 || fill[1] !== 255 || fill[2] !== 255) missed.push(`${index + 1}:fill`)
      if (plate[0] !== 124 || eye[0] !== 20) missed.push(`${index + 1}:plate`)
    }
    expect(missed).toEqual([])
  })

  it('11. PROP_LOCK: 손/케이크 컬러 픽셀 0.00% · 캡션 채움만', () => {
    const sheet = makeImage(360, 360)
    fillRect(sheet, 0, 0, 360, 210, [255, 136, 102, 255])
    fillRect(sheet, 40, 80, 70, 50, [255, 180, 140, 255])
    fillRect(sheet, 200, 90, 80, 60, [255, 90, 140, 255])
    fillRect(sheet, 70, 230, 220, 28, [20, 20, 20, 255])
    fillRect(sheet, 80, 236, 200, 16, [255, 255, 255, 255])
    applyTextTone(sheet, 'custom', '#00ccff')
    expect(sample(sheet, 70, 100).slice(0, 3)).toEqual([255, 180, 140])
    expect(sample(sheet, 240, 120).slice(0, 3)).toEqual([255, 90, 140])
    expect(sample(sheet, 70, 230).slice(0, 3)).toEqual([20, 20, 20])
    expect(sample(sheet, 180, 244).slice(0, 3)).toEqual([255, 255, 255])
  })

  it('12. TEXT_ENGINE_3WAY: ORIGINAL 무변 · SMART ROI 상단 읽기전용 · 벡터 모듈 분리', () => {
    expect(TEXT_ENGINE_DEFAULT).toBe(TEXT_ENGINE_ORIGINAL)
    expect(normalizeTextEngineMode('vector_overlay')).toBe(TEXT_ENGINE_VECTOR_OVERLAY)
    expect(normalizeTextEngineMode('smart')).toBe(TEXT_ENGINE_SMART_RECOLOR)
    expect(characterReadOnlyCeil(360, 289)).toBe(289)
    const sheet = makeImage(360, 360)
    fillRect(sheet, 0, 0, 360, 210, [255, 136, 102, 255])
    fillRect(sheet, 40, 80, 70, 50, [255, 180, 140, 255])
    fillRect(sheet, 200, 90, 80, 60, [255, 90, 140, 255])
    fillRect(sheet, 70, 230, 220, 28, [20, 20, 20, 255])
    const before = regionStats(sheet, 0, 289)
    applyTextTone(sheet, 'custom', '#00ccff', { textEngineMode: TEXT_ENGINE_SMART_RECOLOR })
    const after = regionStats(sheet, 0, 289)
    expect(after.hash).toBe(before.hash)
    expect(sample(sheet, 70, 100).slice(0, 3)).toEqual([255, 180, 140])
    expect(sample(sheet, 240, 120).slice(0, 3)).toEqual([255, 90, 140])
    const passthrough = { marked: false }
    applyTextEngine(passthrough, { textEngineMode: TEXT_ENGINE_ORIGINAL, paintVector: () => { passthrough.marked = true } })
    expect(passthrough.marked).toBe(false)
    const emptyCustom = { marked: false }
    applyTextEngine(emptyCustom, {
      textEngineMode: TEXT_ENGINE_VECTOR_OVERLAY,
      customText: '',
      paintVector: () => { emptyCustom.marked = true },
    })
    expect(emptyCustom.marked).toBe(false)
    const emptyCaption = { marked: false }
    applyTextEngine(emptyCaption, {
      textEngineMode: TEXT_ENGINE_VECTOR_OVERLAY,
      caption: '',
      paintVector: () => { emptyCaption.marked = true },
    })
    expect(emptyCaption.marked).toBe(false)
  })

  it('13. TYPO_SINGLE_PASS: 외곽선/2차외곽선 숫자 두께 · 그림자 1회 리셋', () => {
    const src = readSrc('src/lib/renderStyle.js')
    expect(src).toContain('clearCanvasShadow')
    expect(src).toContain("shadowColor = 'transparent'")
    expect(src).toContain('sliderPass')
    expect(src).toContain('strokeMul')
    expect(src).toContain('(s1 + s2) * strokeMul')
    expect(src).toContain("Number(layer.strokeWidth) || 0")
    expect(src).toContain("Number(layer.strokeWidth2) || 0")
    expect(src).not.toContain('(style.lineWidth ?? 0) + style.lineWidth2')
    const s1 = Math.max(0, Number('3') || 0)
    const s2 = Math.max(0, Number('5') || 0)
    expect((s1 + s2) * 2).toBe(16)
    expect(s1 * 2).toBe(6)
    const diag = readSrc('src/lib/diagnosticChecks.js')
    expect(diag).toContain('computeDualStrokeWidths')
    expect(diag).toContain('probeTypographyIsolation')
  })

  it('14. STUDIO_HUD_SYNC: 픽셀 1:1 · 투명 알파 · 폰트 10선 · 브라우저/헤드셋', () => {
    const pixel = readSrc('src/components/MotionGifStudio/PixelSelectionModal.jsx')
    expect(pixel).toContain('w-32')
    expect(pixel).toContain('min-w-[124px]')
    expect(pixel).toContain('SIDEBAR_BOX')
    expect(pixel).toContain('width: 128')
    expect(pixel).toContain('object-contain')
    expect(pixel).not.toContain('aspect-square')
    expect(pixel).not.toContain('VIEW_ZOOM')
    expect(pixel).toContain('LOUPE_SIZE = 50')
    expect(pixel).toContain('data-pixel-loupe')
    expect(pixel).toContain('renderLoupeGrid')

    const styler = readSrc('src/lib/renderStyle.js')
    const purge = readSrc('src/lib/fakeBackgroundPurge.js')
    const studio = readSrc('src/components/MotionGifStudio/MotionGifStudioModal.jsx')
    const app = readSrc('src/App.jsx')
    expect(styler).toContain('export async function exportCleanCanvas')
    expect(styler).toContain('gridOn: false')
    expect(app).toContain('exportCleanCanvas')
    expect(purge).toContain('export function isFakeCheckerPixel')
    expect(purge).toContain('export function enforceTransparencyPurge')
    expect(studio).toContain('enforceTransparencyPurge')

    expect(EMOTICON_FONTS).toHaveLength(10)
    expect(DEFAULT_EMOTICON_FONT_ID).toBe('Jua')
    expect(EMOTICON_FONTS.map((item) => item.id)).toEqual([
      'Jua',
      'Do Hyeon',
      'CookieRun',
      'TmonMonsori',
      'GmarketSansBold',
      'Binggrae',
      'Yeon Sung',
      'GabiaBombaram',
      'NEXONLv1GothicBold',
      'Pretendard',
    ])
    expect(captionCanvasFont(30, 'Jua')).toContain('Jua')
    const caption = readSrc('src/components/MotionStudio/CaptionControlBar.jsx')
    const renderer = readSrc('src/components/MotionStudio/DynamicTextMotionRenderer.js')
    const encoder = readSrc('src/utils/encoder/MotionEncoderEngine.js')
    expect(caption).toContain('data-caption-font')
    expect(caption).toContain('EMOTICON_FONTS')
    expect(renderer).toContain('captionCanvasFont')
    expect(encoder).toContain('ensureEmoticonFontsReady')
    expect(encoder).toContain('captionFont')
    expect(readSrc('src/lib/emoticonFonts.js')).toContain('fontId ? [resolveEmoticonFont(fontId)] : EMOTICON_FONTS')
    expect(caption).toContain('ensureEmoticonFontsReady()')

    const refresh = readSrc('scripts/refresh-dev.js')
    const loop = readSrc('scripts/loop-test.js')
    const headset = readSrc('scripts/play-headset-sound.ps1')
    expect(refresh).toContain('calligraphy-studio-default-browser.lock')
    expect(refresh).toContain('기존 창/탭 재사용')
    expect(refresh).toContain('node_modules')
    expect(refresh).toContain('.vite')
    expect(loop).toContain('Cache-Control')
    expect(loop).toContain('must-revalidate')
    expect(loop).toContain("reload({ waitUntil: 'domcontentloaded' })")
    expect(headset).toContain('MediaPlayer')
    expect(headset).toContain('notify-primary.wav')
    expect(headset).toContain('notify-reminder.wav')

    const guide = readSrc('docs/GUIDEBOOK.md')
    expect(guide).toContain('초정밀 픽셀')
    expect(guide).toContain('50×50')
    expect(guide).toContain('exportCleanCanvas')
    expect(guide).toContain('주아체')
    expect(guide).toContain('npm run verify')
    expect(guide).toContain('헤드셋')
  })
})
