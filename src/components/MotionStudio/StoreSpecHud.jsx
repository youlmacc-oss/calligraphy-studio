import clsx from 'clsx'
import { estimateStoreSpec } from './storeSpecHud.js'

export default function StoreSpecHud({
  frameCount = 0,
  fps = 8,
  speed = 1,
  pingPong = false,
}) {
  const spec = estimateStoreSpec({ frameCount, fps, speed, pingPong })
  return (
    <aside className="ms-spec" data-store-spec="1" aria-label="심사 스펙">
      <p className="ms-kicker">심사 스펙</p>
      <p className="ms-spec-row">FPS {spec.fps} · {spec.seconds}s · {spec.frames}프레임</p>
      <p className="ms-spec-row">예상 {spec.kb}KB / 2048KB</p>
      <span className={clsx('ms-spec-badge', spec.pass ? 'is-ok' : 'is-warn')} data-spec-badge={spec.pass ? 'ok' : 'warn'}>
        {spec.badge}
      </span>
    </aside>
  )
}
