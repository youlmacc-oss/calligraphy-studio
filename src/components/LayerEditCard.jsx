import clsx from 'clsx'
import { Trash2 } from 'lucide-react'
import FontPicker from './FontPicker.jsx'
import { NumberSliderControl } from './NumberSliderControl.jsx'
import { magnify } from './MenuMagnifierHUD.jsx'
import { fitLayerFontSize, resolveWeight } from '../lib/renderStyle.js'
import { clampFontSize, FONT_SIZE_MAX, FONT_SIZE_MIN, fontSizeSliderRange } from '../lib/fontSize.js'
import {
  CALLIGRAPHY_PRESET_IDS,
  FONTS,
  getAspect,
  PRESETS,
  STICKER_THEMES,
  THEMES,
  WOODCUT_PRESETS,
  WOODCUT_STUDIO_IDS,
} from '../presets.js'

const FONTS_BY_ID = Object.fromEntries(FONTS.map((item) => [item.id, item]))

function isWoodcutPreset(item) {
  return WOODCUT_PRESETS.some((wood) => wood.id === item.id) || WOODCUT_STUDIO_IDS.includes(item.id)
}

function layerMeta(layer) {
  if (layer.type === 'seal') return { icon: '🏷️', title: '낙관 / 인장 편집 카드', hint: '전각 도장 레이어' }
  if (layer.role === 'main') return { icon: '👑', title: '메인 타이틀 편집 카드', hint: '대표 타이포 · 독립 스타일' }
  if (layer.role === 'sub') return { icon: '✨', title: '서브 타이틀 편집 카드', hint: '보조 타이포 · 독립 스타일' }
  return { icon: '🏷️', title: `${layer.name} 편집 카드`, hint: '추가 텍스트 레이어' }
}

export default function LayerEditCard({
  layer,
  index,
  total,
  expanded,
  studioTab,
  studio,
  onSelect,
  onPatch,
  onCommit,
  onRemove,
  onMove,
  onHoverFont,
  onSelectFont,
  onSelectPreset,
  onPatchStudio,
  onReorder,
  favoriteIds,
  onToggleFavorite,
  extraFonts = [],
  onAddFontFile,
}) {
  const meta = layerMeta(layer)
  const font = extraFonts.find((item) => item.id === layer.fontId) ?? FONTS_BY_ID[layer.fontId] ?? FONTS[0]
  const weight = resolveWeight(font, layer.fontWeight ?? 400)
  const range = fontSizeSliderRange()
  const aspect = getAspect(studio?.aspectId || '1:1')
  const layerPreset = PRESETS.find((item) => item.id === layer.presetId) ?? null
  const shader = layerPreset?.shader
  const showCalligraphy = CALLIGRAPHY_PRESET_IDS.includes(layer.presetId) || shader === 'calligraphy' || shader === 'carvedSeal'
  const showWoodcut = WOODCUT_STUDIO_IDS.includes(layer.presetId) || shader === 'woodcutCarving' || shader === 'woodblock'
  const showStickers = shader === 'kitschSticker'
  const visiblePresets = studioTab === 'calligraphy'
    ? PRESETS.filter((item) => CALLIGRAPHY_PRESET_IDS.includes(item.id))
    : studioTab === 'woodcut'
      ? PRESETS.filter((item) => WOODCUT_STUDIO_IDS.includes(item.id))
      : null

  const renderPresetCard = (item) => {
    const selected = item.id === layer.presetId
    const number = PRESETS.findIndex((entry) => entry.id === item.id) + 1
    const woodcut = isWoodcutPreset(item)
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectPreset(layer.id, item)}
        className={clsx(
          'preset-card allow-long-text rounded-xl border text-left transition',
          woodcut && 'woodcut-card',
          selected
            ? woodcut
              ? 'border-amber-400/50 bg-amber-400/10'
              : 'border-cyan-400/50 bg-cyan-400/10'
            : 'border-white/10 bg-black/20 hover:border-white/20',
        )}
        {...magnify(item.name, '이 레이어에만 적용되는 스타일 프리셋입니다')}
      >
        <span className="preset-no">{String(number).padStart(2, '0')}</span>
        {woodcut && item.lang ? <span className="woodcut-lang">{item.lang}</span> : null}
        <span className="preset-card-name">{item.name}</span>
      </button>
    )
  }

  const locked = layer.role === 'main' || layer.role === 'sub'
  const accent = layer.role === 'main' ? 'main' : layer.role === 'sub' ? 'sub' : 'extra'

  return (
    <article
      data-layer-card={layer.id}
      className={clsx('layer-card', `is-${accent}`, expanded && 'is-on')}
      onPointerDownCapture={onSelect}
    >
      <div className="layer-card-head">
        <div className="layer-card-toggle">
          <span className="layer-card-icon">{meta.icon}</span>
          <span className="min-w-0 flex-1 text-left">
            <span className="layer-name">{meta.title}</span>
            <span className="layer-text">{meta.hint} · 이 레이어만 변경됩니다</span>
          </span>
          {expanded ? <span className="layer-active-badge">{accent === 'sub' ? '서브 포커스' : accent === 'main' ? '메인 포커스' : '선택됨'}</span> : null}
        </div>
      </div>
        <div className="layer-order-bar">
          <button
            type="button"
            className="layer-z-btn"
            disabled={index <= 0}
            onClick={() => onReorder?.(layer.id, 'back')}
            {...magnify('맨 뒤로', '가장 아래(배경 쪽)로 보냅니다')}
          >
            🔄 맨 뒤로
          </button>
          <button
            type="button"
            className="layer-z-btn"
            disabled={index <= 0}
            onClick={() => onReorder?.(layer.id, 'down')}
            {...magnify('한 단계 아래로', '바로 아래 레이어보다 뒤로 보냅니다')}
          >
            ⬇️ 한 단계 아래로
          </button>
          <button
            type="button"
            className="layer-z-btn"
            disabled={index >= total - 1}
            onClick={() => onReorder?.(layer.id, 'up')}
            {...magnify('한 단계 위로', '바로 위 레이어보다 앞으로 올립니다')}
          >
            ⬆️ 한 단계 위로
          </button>
          <button
            type="button"
            className="layer-z-btn"
            disabled={index >= total - 1}
            onClick={() => onReorder?.(layer.id, 'front')}
            {...magnify('맨 앞으로', '가장 위(눈앞)로 올립니다')}
          >
            🔝 맨 앞으로
          </button>
          {!locked ? (
            <button type="button" className="layer-del-btn" onClick={() => onRemove(layer.id)} aria-label="레이어 삭제" {...magnify('레이어 삭제', '이 추가 레이어를 제거합니다')}>
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>

      <div className="layer-card-body">
          <textarea
            value={layer.text}
            onChange={(event) => onPatch(layer.id, { text: event.target.value }, false)}
            onFocus={onSelect}
            onBlur={onCommit}
            onKeyDown={(event) => event.stopPropagation()}
            maxLength={160}
            rows={layer.role === 'main' || layer.role === 'sub' ? 3 : 2}
            className={clsx('ui-input ui-textarea', layer.role === 'main' && 'ui-input-title')}
            style={{ fontFamily: font.family, fontWeight: weight }}
            placeholder="Enter로 줄을 바꿉니다"
            {...magnify(
              layer.role === 'main' ? '메인 타이틀 입력' : layer.role === 'sub' ? '서브 타이틀 입력' : '레이어 텍스트 입력',
              'Enter로 여러 줄을 쓰고, 시 구절처럼 개행할 수 있습니다',
            )}
          />
          {layer.type !== 'seal' ? (
            <div className="align-toggle mt-2" role="group" aria-label="텍스트 정렬">
              {[
                { id: 'left', label: '⬅️ 좌측 정렬' },
                { id: 'center', label: '⏺️ 중앙 정렬' },
                { id: 'right', label: '➡️ 우측 정렬' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={clsx('align-btn', (layer.align || 'center') === item.id && 'is-on')}
                  onClick={() => onPatch(layer.id, { align: item.id })}
                  {...magnify(item.label, '여러 줄 텍스트의 좌우 정렬을 바꿉니다')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}

          {layer.type !== 'seal' ? (
            <div className="mt-3">
              <p className="ui-label mb-1.5">🔤 이 레이어 전용 폰트</p>
              <FontPicker
                value={layer.fontId}
                text={layer.text}
                weight={weight}
                preferredGroup={font.group}
                favoriteIds={favoriteIds}
                onToggleFavorite={onToggleFavorite}
                extraFonts={extraFonts}
                onAddFontFile={onAddFontFile}
                onChange={(fontId) => onSelectFont(layer.id, fontId)}
                onHoverFont={onHoverFont}
              />
            </div>
          ) : null}

          <div className="size-fit-block mt-3">
            <div className="size-fit-head">
              <button
                type="button"
                className="size-fit-btn"
                onClick={() => onPatch(layer.id, {
                  fontSize: fitLayerFontSize(layer, font, aspect.w, aspect.h, {
                    min: FONT_SIZE_MIN,
                    max: FONT_SIZE_MAX,
                  }),
                })}
                {...magnify('화면 맞춤', '캔버스 가로의 약 85% 안에 글자가 들어오도록 크기를 자동 계산합니다')}
              >
                📏 화면 맞춤
              </button>
            </div>
            <NumberSliderControl
              label="크기"
              tooltip={`${FONT_SIZE_MIN}~${FONT_SIZE_MAX}px. 기본 70px가 슬라이더 정중앙입니다. 긴 문장은 화면 맞춤으로 한 번에 줄입니다`}
              unit="px"
              min={range.min}
              max={range.max}
              step={1}
              value={clampFontSize(layer.fontSize)}
              onChange={(next) => onPatch(layer.id, { fontSize: clampFontSize(next) }, false)}
              onCommit={onCommit}
            />
          </div>
          <NumberSliderControl
            label="자간"
            tooltip="글자 사이 간격을 조절합니다"
            unit="px"
            min={-8}
            max={28}
            step={1}
            value={layer.letterSpacing}
            onChange={(next) => onPatch(layer.id, { letterSpacing: next }, false)}
            onCommit={onCommit}
          />
          {layer.type !== 'seal' ? (
            <NumberSliderControl
              label="줄간격"
              tooltip="여러 줄 사이 세로 간격을 조절합니다"
              unit=""
              min={80}
              max={250}
              step={1}
              value={Math.round((layer.lineHeight ?? 1.2) * 100)}
              onChange={(next) => onPatch(layer.id, { lineHeight: next / 100 }, false)}
              onCommit={onCommit}
            />
          ) : null}
          <NumberSliderControl
            label="회전"
            tooltip="이 텍스트만 각도를 돌립니다"
            unit="°"
            min={-180}
            max={180}
            step={1}
            value={layer.rotation}
            onChange={(next) => onPatch(layer.id, { rotation: next }, false)}
            onCommit={onCommit}
          />
          {layer.type !== 'seal' ? (
            <NumberSliderControl
              label="곡선 텍스트"
              tooltip="글자를 원형·반원 아치로 휘게 합니다"
              unit="°"
              min={-180}
              max={180}
              step={1}
              value={layer.curveAmount ?? 0}
              onChange={(next) => onPatch(layer.id, { curveAmount: next }, false)}
              onCommit={onCommit}
            />
          ) : null}
          <NumberSliderControl
            label="투명도"
            tooltip="글자가 배경과 얼마나 겹쳐 보일지 조절합니다"
            unit="%"
            min={0}
            max={100}
            step={1}
            value={Math.round((layer.opacity ?? 1) * 100)}
            onChange={(next) => onPatch(layer.id, { opacity: next / 100 }, false)}
            onCommit={onCommit}
          />
          <NumberSliderControl
            label="가로 위치"
            tooltip="텍스트를 좌우로 옮깁니다"
            min={-45}
            max={45}
            step={1}
            value={Math.round((layer.ox ?? 0) * 100)}
            onChange={(next) => onPatch(layer.id, { ox: next / 100 }, false)}
            onCommit={onCommit}
          />
          <NumberSliderControl
            label="세로 위치"
            tooltip="텍스트를 위아래로 옮깁니다"
            min={-45}
            max={45}
            step={1}
            value={Math.round((layer.oy ?? 0) * 100)}
            onChange={(next) => onPatch(layer.id, { oy: next / 100 }, false)}
            onCommit={onCommit}
          />

          {layer.type !== 'seal' ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[400, 700].map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={!font.weights.includes(value)}
                  onClick={() => onPatch(layer.id, { fontWeight: value })}
                  className={clsx('weight-btn', weight === value && 'is-on', !font.weights.includes(value) && 'opacity-35')}
                  {...magnify(value === 700 ? '굵게 Bold' : '보통 Normal', '글자 두께를 바꿉니다')}
                >
                  {value === 700 ? 'Bold' : 'Normal'}
                </button>
              ))}
            </div>
          ) : null}

          {layer.type !== 'seal' ? (
            <div className="mt-4">
              <p className="ui-label mb-1.5">🎨 이 레이어 전용 프리셋</p>
              <button
                type="button"
                className={clsx('sticker-chip mb-2 w-full', !layer.presetId && 'is-on')}
                onClick={() => onSelectPreset(layer.id, null)}
                {...magnify('기본 단색', '프리셋 없이 색과 외곽선만 사용합니다')}
              >
                기본 단색 (프리셋 없음)
              </button>
              <div className="preset-scroll space-y-3">
                {studioTab === 'allinone' ? THEMES.map((theme) => (
                  <div key={theme.id}>
                    <p className="theme-label">{theme.name}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PRESETS.filter((item) => item.theme === theme.id).map(renderPresetCard)}
                    </div>
                  </div>
                )) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {(visiblePresets ?? []).map(renderPresetCard)}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="ui-label mb-1.5">🎨 컬러 · 외곽선 · 그림자</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="ui-label" {...magnify('텍스트 색', '글자 본문 색을 고릅니다')}>텍스트
                <input type="color" className="color-input" value={layer.color} onChange={(event) => onPatch(layer.id, { color: event.target.value }, false)} />
              </label>
              <label className="ui-label" {...magnify('외곽선 색', '글자 테두리 색을 고릅니다')}>외곽선
                <input type="color" className="color-input" value={layer.strokeColor} onChange={(event) => onPatch(layer.id, { strokeColor: event.target.value }, false)} />
              </label>
              <div className="col-span-2">
                <NumberSliderControl
                  label="외곽선 두께"
                  tooltip="글자 테두리를 두껍게 또는 얇게 만듭니다"
                  min={0}
                  max={14}
                  step={1}
                  value={layer.strokeWidth}
                  onChange={(next) => onPatch(layer.id, { strokeWidth: next }, false)}
                  onCommit={onCommit}
                />
              </div>
              <label className="ui-label" {...magnify('2차 외곽선 색', '유튜브 썸네일용 바깥 테두리 색입니다')}>2차 외곽선
                <input type="color" className="color-input" value={layer.strokeColor2 || '#0f172a'} onChange={(event) => onPatch(layer.id, { strokeColor2: event.target.value }, false)} />
              </label>
              <div className="col-span-2">
                <NumberSliderControl
                  label="2차 두께"
                  tooltip="안쪽 테두리 바깥에 한 겹 더 칩니다"
                  min={0}
                  max={18}
                  step={1}
                  value={layer.strokeWidth2 ?? 0}
                  onChange={(next) => onPatch(layer.id, { strokeWidth2: next }, false)}
                  onCommit={onCommit}
                />
              </div>
              <label className="ui-label" {...magnify('그림자 색', '글자 그림자의 색을 고릅니다')}>그림자
                <input type="color" className="color-input" value={layer.shadowColor} onChange={(event) => onPatch(layer.id, { shadowColor: event.target.value }, false)} />
              </label>
              <div className="col-span-2">
                <NumberSliderControl
                  label="그림자 블러"
                  tooltip="그림자를 부드럽게 번지게 합니다"
                  min={0}
                  max={40}
                  step={1}
                  value={layer.shadowBlur}
                  onChange={(next) => onPatch(layer.id, { shadowBlur: next }, false)}
                  onCommit={onCommit}
                />
              </div>
            </div>
          </div>

          {showCalligraphy ? (
            <div className="calligraphy-panel mt-3">
              <p className="ui-label mb-2">✍️ 서예 세부 조절</p>
              <NumberSliderControl
                label="먹물 농담"
                tooltip="서예 잉크의 진하기를 조절합니다"
                min={10}
                max={100}
                step={1}
                value={studio.inkDensity}
                sliderClassName="ctrl-slider ink-slider"
                onChange={(next) => onPatchStudio({ inkDensity: next }, false)}
                onCommit={onCommit}
              />
              <NumberSliderControl
                label="번짐 / 갈필"
                tooltip="붓이 마른 듯한 갈필·번짐 정도를 조절합니다"
                min={0}
                max={100}
                step={1}
                value={studio.dryBrush}
                sliderClassName="ctrl-slider ink-slider"
                onChange={(next) => onPatchStudio({ dryBrush: next }, false)}
                onCommit={onCommit}
              />
            </div>
          ) : null}

          {showWoodcut ? (
            <div className="woodcut-panel mt-3">
              <p className="ui-label mb-2">🪵 목각 세부 조절</p>
              <NumberSliderControl
                label="조각 깊이"
                tooltip="목각이 파여 들어간 깊이를 조절합니다"
                min={1}
                max={12}
                step={1}
                value={studio.chiselDepth}
                sliderClassName="ctrl-slider wood-slider"
                onChange={(next) => onPatchStudio({ chiselDepth: next }, false)}
                onCommit={onCommit}
              />
              <NumberSliderControl
                label="나이테 결"
                tooltip="나무 결의 거친 정도를 조절합니다"
                min={0}
                max={100}
                step={1}
                value={studio.roughness}
                sliderClassName="ctrl-slider wood-slider"
                onChange={(next) => onPatchStudio({ roughness: next }, false)}
                onCommit={onCommit}
              />
            </div>
          ) : null}

          {showStickers ? (
            <div className="sticker-panel mt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="ui-label">🎭 스티커 데코</span>
                <button
                  type="button"
                  className={clsx('sticker-toggle', studio.stickerOn && 'is-on')}
                  onClick={() => onPatchStudio({ stickerOn: !studio.stickerOn })}
                  data-tooltip="키치 스티커 데코를 켜거나 끕니다"
                >
                  {studio.stickerOn ? '켜기' : '끄기'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {STICKER_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onPatchStudio({ stickerTheme: theme.id })}
                    className={clsx('sticker-chip', studio.stickerTheme === theme.id && 'is-on')}
                    data-tooltip={`${theme.label} 스티커 테마`}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
    </article>
  )
}
