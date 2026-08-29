import { useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { estimateLayerBox, ROTATE_PIN_GAP } from '../lib/renderStyle.js'

function readHostSize(node) {
  const host = node?.parentElement
  if (!host) return { w: 0, h: 0 }
  const rect = host.getBoundingClientRect()
  return { w: Math.round(rect.width), h: Math.round(rect.height) }
}

export default function LayerGuideOverlay({
  layer,
  viewW: viewWProp = 0,
  viewH: viewHProp = 0,
  scale: scaleProp,
  previewBg = 'dark',
  measureOptions = {},
  hidden = false,
}) {
  const svgRef = useRef(null)
  const [measured, setMeasured] = useState({ w: viewWProp, h: viewHProp })

  useLayoutEffect(() => {
    if (hidden) return undefined
    const apply = () => {
      const next = readHostSize(svgRef.current)
      if (next.w > 0 && next.h > 0) {
        setMeasured((prev) => (prev.w === next.w && prev.h === next.h ? prev : next))
      }
    }
    apply()
    const host = svgRef.current?.parentElement
    if (!host || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(apply)
    observer.observe(host)
    return () => observer.disconnect()
  }, [hidden, layer, previewBg])

  const viewW = measured.w || viewWProp
  const viewH = measured.h || viewHProp
  const scale = viewW && viewH ? Math.min(viewW, viewH) / 512 : (scaleProp || 1)
  const box = (!hidden && layer && viewW && viewH)
    ? estimateLayerBox(layer, viewW, viewH, scale, measureOptions)
    : null

  if (hidden) return null

  const light = previewBg === 'light'
  const accent = layer?.role === 'sub' ? 'sub' : layer?.role === 'main' ? 'main' : 'extra'
  const stroke = light
    ? (accent === 'sub' ? '#a21caf' : accent === 'extra' ? '#a16207' : '#0e7490')
    : (accent === 'sub' ? 'rgba(232,121,249,0.95)' : accent === 'extra' ? 'rgba(250,204,21,0.95)' : 'rgba(34,211,238,0.95)')
  const fill = light
    ? (accent === 'sub' ? '#c026d3' : accent === 'extra' ? '#ca8a04' : '#0891b2')
    : (accent === 'sub' ? '#e879f9' : accent === 'extra' ? '#facc15' : '#67e8f9')

  return (
    <svg
      ref={svgRef}
      className={clsx('layer-guide-overlay', `is-bg-${previewBg}`)}
      width={viewW || '100%'}
      height={viewH || '100%'}
      viewBox={viewW && viewH ? `0 0 ${viewW} ${viewH}` : undefined}
      data-layer-guide={box ? '1' : '0'}
      data-canvas-cross={viewW && viewH ? '1' : '0'}
      aria-hidden="true"
    >
      {viewW && viewH ? (
        <g className="canvas-crosshair" data-canvas-crosshair="1">
          <line x1={viewW / 2} y1={0} x2={viewW / 2} y2={viewH} />
          <line x1={0} y1={viewH / 2} x2={viewW} y2={viewH / 2} />
        </g>
      ) : null}
      {box ? (
        <g transform={`translate(${box.x} ${box.y}) rotate(${((box.rotation || 0) * 180) / Math.PI})`}>
          <line x1={-box.w / 2} y1={0} x2={box.w / 2} y2={0} className="layer-guide-center" stroke={stroke} />
          <line x1={0} y1={-box.h / 2} x2={0} y2={box.h / 2} className="layer-guide-center" stroke={stroke} />
          <rect
            x={-box.w / 2}
            y={-box.h / 2}
            width={box.w}
            height={box.h}
            className="layer-guide-box"
            stroke={stroke}
            fill="none"
          />
          <line x1={0} y1={-box.h / 2} x2={0} y2={-box.h / 2 - ROTATE_PIN_GAP} stroke={stroke} strokeWidth="1.6" />
          <circle cx={0} cy={-box.h / 2 - ROTATE_PIN_GAP} r="5" fill={fill} stroke={stroke} strokeWidth="1" />
          <rect x={box.w / 2 - 5} y={box.h / 2 - 5} width="10" height="10" fill={fill} stroke={stroke} strokeWidth="1" />
        </g>
      ) : null}
    </svg>
  )
}
