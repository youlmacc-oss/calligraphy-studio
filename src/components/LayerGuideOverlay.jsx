import { useLayoutEffect, useState } from 'react'
import clsx from 'clsx'
import { estimateLayerBox, ROTATE_PIN_GAP } from '../lib/renderStyle.js'

export default function LayerGuideOverlay({
  layer,
  viewW,
  viewH,
  scale,
  previewBg = 'dark',
  measureOptions = {},
  hidden = false,
}) {
  const [box, setBox] = useState(null)

  useLayoutEffect(() => {
    if (hidden || !layer || !viewW || !viewH) {
      setBox(null)
      return undefined
    }
    setBox(estimateLayerBox(layer, viewW, viewH, scale, measureOptions))
    return undefined
  }, [hidden, layer, viewW, viewH, scale, measureOptions])

  if (hidden || !box || !viewW || !viewH) return null

  const light = previewBg === 'light'
  const accent = layer.role === 'sub' ? 'sub' : layer.role === 'main' ? 'main' : 'extra'
  const stroke = light
    ? (accent === 'sub' ? '#a21caf' : accent === 'extra' ? '#a16207' : '#0e7490')
    : (accent === 'sub' ? 'rgba(232,121,249,0.95)' : accent === 'extra' ? 'rgba(250,204,21,0.95)' : 'rgba(34,211,238,0.95)')
  const fill = light
    ? (accent === 'sub' ? '#c026d3' : accent === 'extra' ? '#ca8a04' : '#0891b2')
    : (accent === 'sub' ? '#e879f9' : accent === 'extra' ? '#facc15' : '#67e8f9')
  const hw = box.w / 2
  const hh = box.h / 2
  const deg = ((box.rotation || 0) * 180) / Math.PI
  const pinY = -hh - ROTATE_PIN_GAP

  return (
    <svg
      className={clsx('layer-guide-overlay', `is-bg-${previewBg}`)}
      width={viewW}
      height={viewH}
      viewBox={`0 0 ${viewW} ${viewH}`}
      aria-hidden="true"
    >
      <g transform={`translate(${box.x} ${box.y}) rotate(${deg})`}>
        <line x1={-hw} y1={0} x2={hw} y2={0} className="layer-guide-center" stroke={stroke} />
        <line x1={0} y1={-hh} x2={0} y2={hh} className="layer-guide-center" stroke={stroke} />
        <rect
          x={-hw}
          y={-hh}
          width={box.w}
          height={box.h}
          className="layer-guide-box"
          stroke={stroke}
          fill="none"
        />
        <line x1={0} y1={-hh} x2={0} y2={pinY} stroke={stroke} strokeWidth="1.6" />
        <circle cx={0} cy={pinY} r="5" fill={fill} stroke={stroke} strokeWidth="1" />
        <rect x={hw - 5} y={hh - 5} width="10" height="10" fill={fill} stroke={stroke} strokeWidth="1" />
      </g>
    </svg>
  )
}
