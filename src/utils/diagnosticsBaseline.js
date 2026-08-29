export const GOLDEN_BASELINE = {
  version: '2026.08-PRO-OPTIMIZED',
  splitter: {
    totalCuts: 28,
    grid: { rows: 4, cols: 7 },
    alphaThreshold: 18,
    punchHoles: false,
    textModeDefault: 'original',
    textEngineDefault: 'ORIGINAL',
    textEngineModes: ['ORIGINAL', 'VECTOR_OVERLAY', 'SMART_RECOLOR'],
    textRecolorBypass: true,
    textRoiHardLock: true,
    textStrokePreserve: true,
    characterLockRatio: 0.8,
    characterWriteFloorRatio: 0.32,
    pipeline: 'crop → 4-corner flood-fill-alpha(T=18)',
    targetCanvas: { width: 360, height: 360 },
    allowedCornerAlphaMax: 0,
    platePixelTolerance: 0,
  },
  motionEngine: {
    targetFps: 24,
    allowedHzMin: 20,
    loopSeamToleranceMax: 3.5,
    maxEstimateKb: 3500,
    supportedPresets: ['jellyBounce', 'neonPulse', 'cuteWiggle', 'glitch', 'softFloating'],
  },
  uiIntegrity: {
    maxButtonLabelLength: 16,
    bannedLabelKeywords: ['합니다', '뒤집습니다', '휘게', '도구 열기'],
    requiredTooltipFontSize: '16px',
    requiredFloatingEngineId: 'global-floating-tooltip',
    // Per-host only. Never join and append `:not(...)` — CSS comma lists apply :not to the last item.
    labelScanHosts: ['.canvas-toolbar', '.edit-toolbar', '.app-nav', '.studio-left', '.mgs-root'],
  },
}

export function canonicalMotionPresetId(id) {
  if (id === 'glitch') return 'cinematicGlitch'
  return id
}

export function baselineMotionPresetIds() {
  return GOLDEN_BASELINE.motionEngine.supportedPresets.map(canonicalMotionPresetId)
}

export function isBaselineMotionPreset(id) {
  return baselineMotionPresetIds().includes(canonicalMotionPresetId(id))
}

export function compareNumber(actual, expected, label) {
  const ok = Number(actual) === Number(expected)
  return {
    ok,
    label,
    actual,
    expected,
    detail: ok ? `${label} ${actual} ≡ baseline` : `${label} ${actual} ≠ baseline ${expected}`,
  }
}

export function compareLte(actual, max, label) {
  const value = Number(actual)
  const ok = Number.isFinite(value) && value <= Number(max)
  return {
    ok,
    label,
    actual: value,
    expected: `≤ ${max}`,
    detail: ok ? `${label} ${value} ≤ ${max}` : `${label} ${value} > baseline ${max}`,
  }
}

export function compareGte(actual, min, label) {
  const value = Number(actual)
  const ok = Number.isFinite(value) && value >= Number(min)
  return {
    ok,
    label,
    actual: value,
    expected: `≥ ${min}`,
    detail: ok ? `${label} ${value} ≥ ${min}` : `${label} ${value} < baseline ${min}`,
  }
}

export function evaluateSplitterBaseline({
  floodTolerance,
  canvasWidth,
  canvasHeight,
  gridRows,
  gridCols,
  cutCount,
  cornerAlphaMax,
  platePixels,
  textEngineDefault,
  textEngineModes,
} = {}) {
  const spec = GOLDEN_BASELINE.splitter
  const rows = []
  if (floodTolerance != null) {
    rows.push(compareNumber(floodTolerance, spec.alphaThreshold, 'Flood T'))
  }
  if (canvasWidth != null) {
    rows.push(compareNumber(canvasWidth, spec.targetCanvas.width, '컷 가로'))
  }
  if (canvasHeight != null) {
    rows.push(compareNumber(canvasHeight, spec.targetCanvas.height, '컷 세로'))
  }
  if (gridRows != null) {
    rows.push(compareNumber(gridRows, spec.grid.rows, '그리드 행'))
  }
  if (gridCols != null) {
    rows.push(compareNumber(gridCols, spec.grid.cols, '그리드 열'))
  }
  if (cutCount != null) {
    rows.push(compareNumber(cutCount, spec.totalCuts, '컷 수'))
  }
  if (cornerAlphaMax != null) {
    rows.push(compareLte(cornerAlphaMax, spec.allowedCornerAlphaMax, '코너 알파'))
  }
  if (platePixels != null) {
    rows.push(compareLte(platePixels, spec.platePixelTolerance, '플레이트 픽셀'))
  }
  if (textEngineDefault != null) {
    const actual = String(textEngineDefault)
    const expected = String(spec.textEngineDefault)
    const ok = actual === expected
    rows.push({
      ok,
      label: '텍스트 엔진 기본',
      actual,
      expected,
      detail: ok ? `엔진 ${actual} ≡ baseline` : `엔진 ${actual} ≠ baseline ${expected}`,
    })
  }
  if (Array.isArray(textEngineModes)) {
    const expected = (spec.textEngineModes || []).slice()
    const actual = textEngineModes.slice()
    const ok = expected.length === actual.length && expected.every((id, index) => id === actual[index])
    rows.push({
      ok,
      label: '텍스트 엔진 3단',
      actual: actual.join(','),
      expected: expected.join(','),
      detail: ok ? '3단 엔진 ORIGINAL/VECTOR/SMART ≡ baseline' : `엔진 모드 drift actual=${actual.join('|')} baseline=${expected.join('|')}`,
    })
  }
  const fail = rows.filter((row) => !row.ok)
  return {
    version: GOLDEN_BASELINE.version,
    ok: fail.length === 0,
    fail,
    rows,
  }
}

export function evaluateMotionBaseline({
  targetFps,
  actualHz,
  seamErr,
  estimateKb,
  presetIds,
} = {}) {
  const spec = GOLDEN_BASELINE.motionEngine
  const rows = []
  if (targetFps != null) {
    rows.push(compareNumber(targetFps, spec.targetFps, '인코드 FPS'))
  }
  if (actualHz != null && Number(actualHz) > 0) {
    rows.push(compareGte(actualHz, spec.allowedHzMin, '실측 Hz'))
  }
  if (seamErr != null) {
    rows.push(compareLte(seamErr, spec.loopSeamToleranceMax, '루프 이음'))
  }
  if (estimateKb != null && Number(estimateKb) > 0) {
    rows.push(compareLte(estimateKb, spec.maxEstimateKb, '예상 KB'))
  }
  if (Array.isArray(presetIds)) {
    const expected = baselineMotionPresetIds()
    const actual = [...new Set(presetIds.map(canonicalMotionPresetId))]
    const missing = expected.filter((id) => !actual.includes(id))
    const ok = missing.length === 0
    rows.push({
      ok,
      label: '모션 프리셋',
      actual: actual.join(','),
      expected: expected.join(','),
      detail: ok
        ? `코어 5종 ⊂ ${actual.length}종 ≡ baseline`
        : `프리셋 drift missing=${missing.join('|')} actual=${actual.join('|')}`,
    })
  }
  const fail = rows.filter((row) => !row.ok)
  return {
    version: GOLDEN_BASELINE.version,
    ok: fail.length === 0,
    fail,
    rows,
  }
}

export function auditFrozenGoldenBaseline(sample = {}) {
  const splitter = evaluateSplitterBaseline(sample)
  const motion = evaluateMotionBaseline(sample)
  const ui = evaluateUiIntegrityBaseline(sample)
  const fail = [...splitter.fail, ...motion.fail, ...ui.fail]
  const rows = [...splitter.rows, ...motion.rows, ...ui.rows]
  return {
    version: GOLDEN_BASELINE.version,
    ok: fail.length === 0,
    fail,
    rows,
    splitter,
    motion,
    ui,
    detail: fail.length === 0
      ? `Golden Baseline ${GOLDEN_BASELINE.version} 일치`
      : fail.map((row) => row.detail).join(' · '),
  }
}

export function evaluateUiIntegrityBaseline({
  labelLength,
  labelText = '',
  tooltipFontSize,
  engineId,
} = {}) {
  const spec = GOLDEN_BASELINE.uiIntegrity
  const rows = []
  if (labelLength != null) {
    rows.push(compareLte(labelLength, spec.maxButtonLabelLength, '버튼 라벨 길이'))
  }
  if (labelText) {
    const hit = spec.bannedLabelKeywords.find((word) => String(labelText).includes(word))
    rows.push({
      ok: !hit,
      label: '금지어',
      actual: hit || 'none',
      expected: spec.bannedLabelKeywords.join('|'),
      detail: hit ? `금지어 "${hit}" 감지` : '금지어 없음',
    })
  }
  if (tooltipFontSize != null) {
    const ok = String(tooltipFontSize).replace(/\s/g, '') === spec.requiredTooltipFontSize
    rows.push({
      ok,
      label: '툴팁 폰트',
      actual: tooltipFontSize,
      expected: spec.requiredTooltipFontSize,
      detail: ok ? `툴팁 ${spec.requiredTooltipFontSize}` : `툴팁 ${tooltipFontSize} ≠ ${spec.requiredTooltipFontSize}`,
    })
  }
  if (engineId != null) {
    const ok = engineId === spec.requiredFloatingEngineId
    rows.push({
      ok,
      label: '플로팅 엔진 ID',
      actual: engineId,
      expected: spec.requiredFloatingEngineId,
      detail: ok ? '플로팅 엔진 상주' : `엔진 ID ${engineId || '없음'} ≠ ${spec.requiredFloatingEngineId}`,
    })
  }
  const fail = rows.filter((row) => !row.ok)
  return {
    version: GOLDEN_BASELINE.version,
    ok: fail.length === 0,
    fail,
    rows,
  }
}
