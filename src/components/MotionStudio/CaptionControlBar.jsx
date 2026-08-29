import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { CAPTION_SIZE_PRESETS, CAPTION_STROKE_PRESETS } from './dynamicTextMotion.js'

export default function CaptionControlBar({
  enabled = false,
  text = '',
  sizeId = 'md',
  strokeId = 'black',
  onEnabled,
  onText,
  onSize,
  onStroke,
}) {
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
    </div>
  )
}
