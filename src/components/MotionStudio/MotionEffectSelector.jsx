import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { TEXT_MOTION_EFFECTS, TEXT_MOTION_NONE } from './dynamicTextMotion.js'

export default function MotionEffectSelector({
  value = TEXT_MOTION_NONE,
  onChange,
}) {
  return (
    <div className="ms-fx" role="group" aria-label="텍스트 모션" data-motion-fx="1">
      {TEXT_MOTION_EFFECTS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={clsx('ms-btn', 'ms-fx-btn', value === item.id && 'is-on')}
          data-text-effect={item.id}
          onClick={() => onChange?.(item.id)}
          {...magnify(item.label, item.tooltip)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
