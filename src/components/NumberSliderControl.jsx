import clsx from 'clsx'
import { magnify } from './MenuMagnifierHUD.jsx'

function stepDecimals(step) {
  const text = String(step)
  if (!text.includes('.')) return 0
  return text.split('.')[1]?.length || 1
}

function snapValue(value, min, max, step) {
  const raw = Number(value)
  const base = Number.isFinite(raw) ? raw : min
  const decimals = stepDecimals(step)
  const snapped = decimals ? Number(base.toFixed(decimals)) : Math.round(base)
  return Math.min(max, Math.max(min, snapped))
}

export function NumberSliderControl({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  tooltip,
  showInput = true,
  formatValue,
  sliderClassName = 'ctrl-slider',
}) {
  const current = snapValue(value, min, max, step)
  const readout = formatValue ? formatValue(current) : current

  const emit = (next, commit = false) => {
    const clamped = snapValue(next, min, max, step)
    onChange?.(clamped)
    if (commit) onCommit?.()
  }

  return (
    <div className="num-slider slider-control" data-num-slider="1">
      {label ? (
        <div className="num-slider-head">
          <span className="ui-label" {...(tooltip ? magnify(label, tooltip) : {})}>{label}</span>
        </div>
      ) : null}
      <div className="num-slider-row">
        <button
          type="button"
          className="num-slider-btn"
          data-slider-step="-"
          disabled={current <= min}
          onClick={() => emit(current - step, true)}
          {...magnify('-', `${step}${unit} 감소`)}
        >
          -
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          className={clsx(sliderClassName, 'num-slider-range')}
          onChange={(event) => emit(Number(event.target.value))}
          onPointerUp={() => onCommit?.()}
          {...(tooltip ? magnify(`${label} 슬라이더`, tooltip) : {})}
        />
        <button
          type="button"
          className="num-slider-btn"
          data-slider-step="+"
          disabled={current >= max}
          onClick={() => emit(current + step, true)}
          {...magnify('+', `${step}${unit} 증가`)}
        >
          +
        </button>
        {showInput ? (
          <input
            type="number"
            className="num-slider-input"
            min={min}
            max={max}
            step={step}
            value={current}
            onChange={(event) => emit(event.target.value)}
            onBlur={() => onCommit?.()}
            aria-label={`${label || '값'} 직접 입력`}
          />
        ) : (
          <span className="num-slider-readout">{readout}{unit}</span>
        )}
      </div>
    </div>
  )
}

export function bumpSliderValue(value, delta, min, max, step = 1) {
  return snapValue(Number(value) + Number(delta), min, max, step)
}
