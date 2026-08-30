import { useEffect } from 'react'
import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { DEFAULT_EMOTICON_FONT_ID, EMOTICON_FONTS, ensureEmoticonFontsReady, normalizeEmoticonFontId } from '../../lib/emoticonFonts.js'
import { CAPTION_SIZE_PRESETS, CAPTION_STROKE_PRESETS } from './dynamicTextMotion.js'

export default function CaptionControlBar({
  enabled = false,
  text = '',
  sizeId = 'md',
  strokeId = 'black',
  fontId = DEFAULT_EMOTICON_FONT_ID,
  onEnabled,
  onText,
  onSize,
  onStroke,
  onFont,
  tailOn = false,
  onTail,
}) {
  const selectedFont = normalizeEmoticonFontId(fontId)

  useEffect(() => {
    ensureEmoticonFontsReady()
  }, [])

  useEffect(() => {
    ensureEmoticonFontsReady(selectedFont)
  }, [selectedFont])

  return (
    <div className="ms-caption ms-toolbar-row" data-caption-bar="1" aria-label="자막 입력">
      <button
        type="button"
        className={clsx('ms-btn', enabled && 'is-on')}
        data-caption-on={enabled ? '1' : '0'}
        data-text-toggle={enabled ? 'on' : 'off'}
        onClick={() => onEnabled?.(!enabled)}
        {...magnify(enabled ? '자막 ON' : '자막 OFF', '자막을 켜거나 끕니다. 끄거나 비우면 문구가 완전히 사라집니다')}
      >
        {enabled ? '자막 ON' : '자막 OFF'}
      </button>
      <input
        className="ms-caption-input"
        type="text"
        value={text}
        maxLength={24}
        placeholder="자막/텍스트 입력 (미입력 시 텍스트 없음)"
        data-caption-input="1"
        disabled={!enabled}
        onChange={(event) => onText?.(event.target.value)}
        aria-label="자막 입력"
      />
      <select
        className="ms-caption-font"
        value={selectedFont}
        disabled={!enabled}
        data-caption-font="1"
        aria-label="자막 폰트"
        onChange={(event) => onFont?.(normalizeEmoticonFontId(event.target.value))}
        {...magnify('자막 폰트', '말풍선/자막에 쓸 상업용 무료 한글 폰트 10선입니다')}
      >
        {EMOTICON_FONTS.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
            {font.name}
          </option>
        ))}
      </select>
      <div className="ms-speed" role="group" aria-label="글자 크기">
        {CAPTION_SIZE_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx('ms-btn', sizeId === item.id && 'is-on')}
            data-caption-size={item.id}
            disabled={!enabled}
            onClick={() => onSize?.(item.id)}
            {...magnify(item.label, '자막 글자 크기입니다')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="ms-speed" role="group" aria-label="외곽선">
        {CAPTION_STROKE_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={clsx('ms-btn', strokeId === item.id && 'is-on')}
            data-caption-stroke={item.id}
            disabled={!enabled}
            onClick={() => onStroke?.(item.id)}
            {...magnify(item.label, '자막 외곽선 색입니다')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={clsx('ms-btn', tailOn && 'is-on')}
        data-caption-tail={tailOn ? '1' : '0'}
        disabled={!enabled}
        onClick={() => onTail?.(!tailOn)}
        {...magnify(tailOn ? '꼬리 ON' : '꼬리 OFF', '말풍선 꼬리를 켜고 세 점을 드래그해 방향과 곡률을 맞춥니다')}
      >
        {tailOn ? '💬 꼬리 ON' : '💬 꼬리 OFF'}
      </button>
    </div>
  )
}
