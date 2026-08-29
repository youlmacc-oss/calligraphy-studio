import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import { PARTICLE_LAYERS, normalizeParticleLayers } from './particleOverlayEngine.js'

export default function ParticleOverlayBar({ value = [], onChange }) {
  const on = new Set(normalizeParticleLayers(value))

  const toggle = (id) => {
    const next = new Set(on)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange?.(PARTICLE_LAYERS.map((item) => item.id).filter((key) => next.has(key)))
  }

  return (
    <div className="ms-fx" data-particle-bar="1" role="group" aria-label="파티클">
      {PARTICLE_LAYERS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={clsx('ms-btn', 'ms-fx-btn', on.has(item.id) && 'is-on')}
          data-particle={item.id}
          onClick={() => toggle(item.id)}
          {...magnify(item.label, `${item.label} 루프 오버레이를 미리보기와 내보내기에 겹칩니다`)}
        >
          {item.icon} {item.label}
        </button>
      ))}
    </div>
  )
}
