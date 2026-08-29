import { FONTS, PRESETS } from '../presets.js'
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from './fontSize.js'
import { curveExtraPad } from './proTools.js'
import { paintStickers } from './stickers.js'
import { applyViewEdit } from './viewEdit.js'
import { hqPixelRatio, primeHqContext } from '../utils/hqRender.js'

const EXPORT_SIZE = 1024
const FONTS_BY_ID = Object.fromEntries(FONTS.map((item) => [item.id, item]))
const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((item) => [item.id, item]))
const BOX_SAFETY_PAD = 14
export const ROTATE_PIN_GAP = 22

let metricsCanvas
let bboxProbe

function canvasToUrl(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/png')
  })
}

export function resolveWeight(font, requested) {
  if (font.weights.includes(requested)) return requested
  return font.weights.includes(700) ? 700 : font.weights[0]
}

function applyTypeface(ctx, { font, fontSize, fontWeight }) {
  const weight = resolveWeight(font, fontWeight)
  ctx.font = `${weight} ${fontSize}px ${font.family}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
}

function layoutText(ctx, text, letterSpacing) {
  const chars = [...text]
  const widths = chars.map((ch) => ctx.measureText(ch).width)
  const total =
    widths.reduce((sum, width) => sum + width, 0) +
    letterSpacing * Math.max(0, chars.length - 1)
  return { chars, widths, total }
}

function eachGlyph(layout, x, y, letterSpacing, paint) {
  let cursor = x - layout.total / 2
  layout.chars.forEach((ch, index) => {
    paint(ch, cursor, y, 0, layout.widths[index])
    cursor += layout.widths[index] + letterSpacing
  })
}

function eachGlyphOnArc(layout, originX, originY, letterSpacing, curveDeg, paint) {
  const span = (Number(curveDeg) || 0) * Math.PI / 180
  if (Math.abs(span) < 0.02) {
    eachGlyph(layout, originX, originY, letterSpacing, paint)
    return
  }
  const mag = Math.abs(span)
  const sign = span >= 0 ? 1 : -1
  const radius = layout.total / Math.max(0.08, mag)
  let distance = 0
  layout.chars.forEach((ch, index) => {
    const mid = distance + layout.widths[index] / 2
    const t = layout.total > 0 ? mid / layout.total : 0.5
    const angle = -mag / 2 + mag * t
    const x = originX + Math.sin(angle) * radius
    const y = originY + sign * (Math.cos(angle) - 1) * radius
    paint(ch, x, y, angle * sign, layout.widths[index])
    distance += layout.widths[index] + letterSpacing
  })
}

function strokeOrFillGlyph(ctx, mode, ch, gx, gy, angle, width) {
  if (!angle) {
    if (mode === 'stroke') ctx.strokeText(ch, gx, gy)
    else ctx.fillText(ch, gx, gy)
    return
  }
  ctx.save()
  ctx.translate(gx, gy)
  ctx.rotate(angle)
  if (mode === 'stroke') ctx.strokeText(ch, -width / 2, 0)
  else ctx.fillText(ch, -width / 2, 0)
  ctx.restore()
}

function walkGlyphs(layout, x, y, letterSpacing, curve, paint) {
  if (Math.abs(Number(curve) || 0) >= 2) {
    eachGlyphOnArc(layout, x, y, letterSpacing, curve, paint)
    return
  }
  eachGlyph(layout, x, y, letterSpacing, paint)
}

function fillSpaced(ctx, layout, x, y, letterSpacing) {
  eachGlyph(layout, x, y, letterSpacing, (ch, gx, gy) => ctx.fillText(ch, gx, gy))
}

function strokeSpaced(ctx, layout, x, y, letterSpacing) {
  eachGlyph(layout, x, y, letterSpacing, (ch, gx, gy) => ctx.strokeText(ch, gx, gy))
}

function paintLayer(ctx, layout, x, y, letterSpacing, style) {
  ctx.save()
  if (style.shadowColor) {
    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur ?? 0
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
  }
  const ox = x + (style.ox ?? 0)
  const oy = y + (style.oy ?? 0)
  const curve = Number(style.curve) || 0
  const run = (mode) => walkGlyphs(layout, ox, oy, letterSpacing, curve, (ch, gx, gy, angle, width) => {
    strokeOrFillGlyph(ctx, mode, ch, gx, gy, angle, width)
  })
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  if (style.stroke2Style && (style.lineWidth2 ?? 0) > 0) {
    ctx.strokeStyle = style.stroke2Style
    ctx.lineWidth = (style.lineWidth ?? 0) + style.lineWidth2
    run('stroke')
  }
  if (style.strokeStyle && (style.lineWidth ?? 0) > 0) {
    ctx.strokeStyle = style.strokeStyle
    ctx.lineWidth = style.lineWidth ?? 2
    run('stroke')
  }
  if (style.fillStyle) {
    ctx.fillStyle = style.fillStyle
    run('fill')
  }
  ctx.restore()
}

function verticalGradient(ctx, x, y, fontSize, stops) {
  const gradient = ctx.createLinearGradient(x, y - fontSize * 0.55, x, y + fontSize * 0.55)
  stops.forEach(([stop, color]) => gradient.addColorStop(stop, color))
  return gradient
}

const TYPO_SHADERS = new Set([
  'waveWarp',
  'kineticStack',
  'splitSlice',
  'hollowOutline',
  'circularBadge',
  'kitschSticker',
  'chunkyBubble',
  'interlockBlock',
  'woodcutCarving',
])

function paintGlyph(ctx, ch, gx, gy, width, fillStyle, strokeStyle, lineWidth) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth
    ctx.lineJoin = 'round'
    ctx.strokeText(ch, gx + width / 2, gy)
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fillText(ch, gx + width / 2, gy)
  }
  ctx.restore()
}

function paintWaveWarp(ctx, layout, x, y, letterSpacing, fontSize, colors, mask) {
  const [c0, c1] = colors
  const amp = fontSize * 0.42
  let cursor = x - layout.total / 2
  layout.chars.forEach((ch, index) => {
    const mid = cursor + layout.widths[index] / 2
    const t = layout.total === 0 ? 0.5 : (mid - (x - layout.total / 2)) / layout.total
    const wave = Math.sin(t * Math.PI * 3) * amp * 0.45
    const arc = Math.sin(t * Math.PI) * -amp * 0.55
    const tangent = Math.cos(t * Math.PI * 3) * 0.35 + Math.cos(t * Math.PI) * 0.45
    ctx.save()
    ctx.translate(mid, y + wave + arc)
    ctx.rotate(tangent)
    paintGlyph(ctx, ch, -layout.widths[index] / 2, 0, layout.widths[index], mask ? '#fff' : c1, mask ? '#fff' : c0, Math.max(2, fontSize * 0.04))
    ctx.restore()
    cursor += layout.widths[index] + letterSpacing
  })
}

function paintKineticStack(ctx, layout, x, y, letterSpacing, fontSize, colors, mask) {
  const [c0, c1, c2] = colors
  const layers = 8
  for (let i = layers; i >= 0; i -= 1) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(i * 0.018)
    ctx.translate(-x, -y)
    ctx.globalAlpha = i === 0 ? 1 : mask ? 0.18 : 0.1 + (1 - i / layers) * 0.12
    const ox = i * fontSize * 0.055
    const oy = -i * fontSize * 0.07
    paintLayer(ctx, layout, x, y, letterSpacing, {
      fillStyle: mask ? '#ffffff' : i === 0 ? c0 : i % 2 ? c1 : c2,
      ox,
      oy,
      shadowColor: i === 0 && !mask ? c1 : undefined,
      shadowBlur: i === 0 ? fontSize * 0.2 : 0,
    })
    ctx.restore()
  }
}

function paintSplitSlice(ctx, layout, x, y, letterSpacing, fontSize, colors, mask, viewW, viewH) {
  const [c0, c1, c2] = colors
  const shift = fontSize * 0.14
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(viewW, 0)
  ctx.lineTo(0, viewH)
  ctx.closePath()
  ctx.clip()
  paintLayer(ctx, layout, x, y, letterSpacing, {
    fillStyle: mask ? '#ffffff' : c0,
    strokeStyle: mask ? '#ffffff' : c2,
    lineWidth: Math.max(2, fontSize * 0.03),
    ox: -shift,
    oy: shift * 0.6,
  })
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(viewW, 0)
  ctx.lineTo(viewW, viewH)
  ctx.lineTo(0, viewH)
  ctx.closePath()
  ctx.clip()
  paintLayer(ctx, layout, x, y, letterSpacing, {
    fillStyle: mask ? '#ffffff' : c1,
    strokeStyle: mask ? '#ffffff' : c2,
    lineWidth: Math.max(2, fontSize * 0.03),
    ox: shift,
    oy: -shift * 0.6,
  })
  ctx.restore()
}

function paintHollowOutline(ctx, layout, x, y, letterSpacing, fontSize, colors, mask) {
  const [c0, c1, c2] = colors
  const rings = [0.22, 0.14, 0.08, 0.04]
  rings.forEach((ratio, index) => {
    paintLayer(ctx, layout, x, y, letterSpacing, {
      strokeStyle: mask ? '#ffffff' : [c0, c1, c2, '#f8fafc'][index],
      lineWidth: Math.max(1.5, fontSize * ratio),
    })
  })
}

function paintCircularBadge(ctx, layout, x, y, fontSize, colors, mask, viewW, viewH) {
  const [c0, c1, c2] = colors
  const radius = Math.min(viewW, viewH) * 0.3
  const count = Math.max(1, layout.chars.length)
  ctx.save()
  ctx.strokeStyle = mask ? 'rgba(255,255,255,0.85)' : c2
  ctx.lineWidth = Math.max(2, fontSize * 0.035)
  ctx.beginPath()
  ctx.arc(x, y, radius + fontSize * 0.42, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, Math.max(24, radius - fontSize * 0.38), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  layout.chars.forEach((ch, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2
    ctx.save()
    ctx.translate(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
    ctx.rotate(angle + Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = mask ? '#ffffff' : c1
    ctx.shadowColor = mask ? 'transparent' : c0
    ctx.shadowBlur = fontSize * 0.18
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
}

function roundBox(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function paintChunkyLetters(ctx, layout, x, y, letterSpacing, fontSize, { fill, stroke, bounce = 0.07, tilt = 0.05, line = 0.16 }, mask) {
  let cursor = x - layout.total / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.miterLimit = 2
  layout.chars.forEach((ch, index) => {
    const lift = Math.sin(index * 1.35) * fontSize * bounce
    ctx.save()
    ctx.translate(cursor + layout.widths[index] / 2, y + lift)
    ctx.rotate((index % 2 === 0 ? -1 : 1) * tilt)
    ctx.lineWidth = Math.max(6, fontSize * line)
    ctx.strokeStyle = mask ? '#ffffff' : stroke
    ctx.fillStyle = mask ? '#ffffff' : fill
    ctx.strokeText(ch, 0, 0)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
    cursor += layout.widths[index] + letterSpacing
  })
}

function paintKitschSticker(ctx, layout, x, y, letterSpacing, fontSize, colors, mask, extras) {
  const [, c1, c2] = colors
  paintChunkyLetters(
    ctx,
    layout,
    x,
    y,
    letterSpacing,
    fontSize,
    { fill: c1, stroke: c2, bounce: 0.08, tilt: 0.06, line: 0.18 },
    mask,
  )
  if (extras.stickerOn !== false) {
    paintStickers(ctx, {
      text: extras.text || '',
      x,
      y,
      fontSize,
      layout,
      theme: extras.stickerTheme || 'fnb',
      mask,
    })
  }
}

function paintChunkyBubble(ctx, layout, x, y, letterSpacing, fontSize, colors, mask) {
  const [c0, c1, c2] = colors
  if (!mask) {
    paintChunkyLetters(
      ctx,
      layout,
      x + fontSize * 0.04,
      y + fontSize * 0.06,
      letterSpacing,
      fontSize,
      { fill: c2, stroke: c2, bounce: 0.05, tilt: 0.03, line: 0.2 },
      false,
    )
  }
  paintChunkyLetters(
    ctx,
    layout,
    x,
    y,
    letterSpacing,
    fontSize,
    { fill: c1, stroke: c0, bounce: 0.05, tilt: 0.03, line: 0.22 },
    mask,
  )
}

function paintInterlockBlock(ctx, layout, x, y, letterSpacing, fontSize, colors, mask) {
  const [c0, c1, c2] = colors
  const overlap = Math.max(6, fontSize * 0.14)
  const blockH = fontSize * 1.18
  const used = layout.total - overlap * Math.max(0, layout.chars.length - 1) + fontSize * 1.15
  let cursor = x - used / 2
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  layout.chars.forEach((ch, index) => {
    const bounce = (index % 2 === 0 ? -1 : 1) * fontSize * 0.1
    const bw = layout.widths[index] + fontSize * 0.34
    const bx = cursor - fontSize * 0.14
    const by = y + bounce - blockH / 2
    roundBox(ctx, bx, by, bw, blockH, fontSize * 0.28)
    ctx.lineWidth = Math.max(4, fontSize * 0.05)
    ctx.fillStyle = mask ? '#ffffff' : index % 2 === 0 ? c1 : c0
    ctx.strokeStyle = mask ? '#ffffff' : c2
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = mask ? '#ffffff' : c2
    ctx.fillText(ch, cursor + layout.widths[index] / 2, y + bounce)
    cursor += layout.widths[index] + letterSpacing - overlap
  })

  const n = Math.min(20, Math.max(1, layout.chars.length))
  const badge = String.fromCodePoint(0x245f + n)
  const badgeX = cursor + fontSize * 0.42
  const badgeY = y + fontSize * 0.08
  const badgeR = fontSize * 0.42
  ctx.beginPath()
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
  ctx.fillStyle = mask ? '#ffffff' : c0
  ctx.strokeStyle = mask ? '#ffffff' : c2
  ctx.lineWidth = Math.max(4, fontSize * 0.05)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = mask ? '#ffffff' : c2
  ctx.font = `700 ${Math.max(18, fontSize * 0.42)}px Pretendard, "Noto Sans KR", sans-serif`
  ctx.fillText(badge, badgeX, badgeY + 1)
}

const grainCache = { key: '', canvas: null }

function getWoodGrain(width, height, roughness) {
  const key = `${width}x${height}:${Math.round(roughness)}`
  if (grainCache.key === key && grainCache.canvas) return grainCache.canvas
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(2, Math.round(width))
  canvas.height = Math.max(2, Math.round(height))
  const g = canvas.getContext('2d')
  g.fillStyle = '#5a3a24'
  g.fillRect(0, 0, canvas.width, canvas.height)
  const amp = 0.06 + roughness / 140
  for (let y = 0; y < canvas.height; y += 2) {
    g.strokeStyle = `rgba(18, 8, 4, ${0.1 + amp * 0.55})`
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= canvas.width; x += 6) {
      const wobble = Math.sin(x * 0.035 + y * 0.08) * (2 + roughness * 0.06)
      g.lineTo(x, y + wobble)
    }
    g.stroke()
  }
  const scratches = 10 + Math.round(roughness / 8)
  for (let i = 0; i < scratches; i += 1) {
    const x = (i * 97 + roughness * 3) % canvas.width
    g.strokeStyle = `rgba(12, 6, 2, ${0.12 + amp})`
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x + Math.sin(i) * 8, canvas.height)
    g.stroke()
  }
  grainCache.key = key
  grainCache.canvas = canvas
  return canvas
}

function paintWoodcutCarving(ctx, layout, x, y, letterSpacing, fontSize, colors, mask, extras, viewW, viewH) {
  const [c0, c1, c2] = colors
  const depth = extras.chiselDepth ?? 6
  const roughness = extras.roughness ?? 48
  const dx = Math.max(1.2, depth * 0.48)

  if (mask) {
    paintLayer(ctx, layout, x, y, letterSpacing, {
      fillStyle: '#ffffff',
      ox: dx,
      oy: dx,
    })
    paintLayer(ctx, layout, x, y, letterSpacing, {
      fillStyle: '#ffffff',
      ox: -dx * 0.45,
      oy: -dx * 0.45,
    })
    paintLayer(ctx, layout, x, y, letterSpacing, {
      fillStyle: '#ffffff',
      strokeStyle: '#ffffff',
      lineWidth: Math.max(2, 1 + depth * 0.38),
    })
    return
  }

  paintLayer(ctx, layout, x, y, letterSpacing, {
    fillStyle: c2,
    ox: dx * 0.9,
    oy: dx * 1.35,
    shadowColor: 'rgba(20, 8, 2, 0.45)',
    shadowBlur: 6 + roughness * 0.08,
  })
  paintLayer(ctx, layout, x, y, letterSpacing, {
    fillStyle: '#0c0704',
    ox: dx,
    oy: dx,
  })
  paintLayer(ctx, layout, x, y, letterSpacing, {
    fillStyle: c1,
    ox: -dx,
    oy: -dx,
  })
  paintLayer(ctx, layout, x, y, letterSpacing, {
    fillStyle: c0,
  })

  const layer = document.createElement('canvas')
  layer.width = Math.max(2, Math.round(viewW))
  layer.height = Math.max(2, Math.round(viewH))
  const lctx = layer.getContext('2d')
  lctx.font = ctx.font
  lctx.textAlign = 'left'
  lctx.textBaseline = 'middle'
  lctx.fillStyle = '#ffffff'
  fillSpaced(lctx, layout, x, y, letterSpacing)
  lctx.globalCompositeOperation = 'source-in'
  lctx.drawImage(getWoodGrain(viewW, viewH, roughness), 0, 0)
  ctx.save()
  ctx.globalAlpha = 0.32 + roughness / 260
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(layer, 0, 0)
  ctx.restore()

  paintLayer(ctx, layout, x, y, letterSpacing, {
    strokeStyle: '#140a06',
    lineWidth: Math.max(1, 0.7 + depth * 0.14),
  })
}

function paintShader(ctx, layout, x, y, letterSpacing, fontSize, preset, viewW, viewH, mask = false, extras = {}) {
  const [c0, c1, c2] = preset.colors
  const emboss = Math.max(2, fontSize * 0.045)

  switch (preset.shader) {
    case 'waveWarp':
      paintWaveWarp(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask)
      return
    case 'kineticStack':
      paintKineticStack(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask)
      return
    case 'splitSlice':
      paintSplitSlice(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask, viewW, viewH)
      return
    case 'hollowOutline':
      paintHollowOutline(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask)
      return
    case 'circularBadge':
      paintCircularBadge(ctx, layout, x, y, fontSize, preset.colors, mask, viewW, viewH)
      return
    case 'kitschSticker':
      paintKitschSticker(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask, extras)
      return
    case 'chunkyBubble':
      paintChunkyBubble(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask)
      return
    case 'interlockBlock':
      paintInterlockBlock(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask)
      return
    case 'woodcutCarving':
    case 'woodblock':
      paintWoodcutCarving(ctx, layout, x, y, letterSpacing, fontSize, preset.colors, mask, extras, viewW, viewH)
      return
    case 'liquidChrome':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
        shadowColor: c1,
        shadowBlur: fontSize * 0.35,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: emboss,
        oy: emboss,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        ox: -emboss * 0.7,
        oy: -emboss * 0.7,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, '#ffffff'],
          [0.35, c1],
          [0.55, c0],
          [1, c2],
        ]),
        strokeStyle: 'rgba(255,255,255,0.45)',
        lineWidth: Math.max(1.5, fontSize * 0.015),
      })
      break

    case 'inflatedJelly':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        strokeStyle: c2,
        lineWidth: fontSize * 0.22,
        fillStyle: c2,
        shadowColor: c0,
        shadowBlur: fontSize * 0.28,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, '#fff1f2'],
          [0.35, c1],
          [0.7, c0],
          [1, c2],
        ]),
      })
      break

    case 'cyberNeon':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
        shadowColor: c0,
        shadowBlur: fontSize * 0.55,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        shadowColor: c2,
        shadowBlur: fontSize * 0.35,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: '#f8fafc',
        strokeStyle: c1,
        lineWidth: Math.max(2, fontSize * 0.04),
      })
      break

    case 'hologram':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: -3,
        shadowColor: c2,
        shadowBlur: 18,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        ox: 3,
        shadowColor: c1,
        shadowBlur: 18,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, c0],
          [0.5, c1],
          [1, c2],
        ]),
        strokeStyle: 'rgba(255,255,255,0.35)',
        lineWidth: Math.max(1, fontSize * 0.02),
      })
      break

    case 'calligraphy': {
      const ink = extras.inkDensity ?? 70
      const dry = extras.dryBrush ?? 30
      const shade = Math.round(18 - ink * 0.12)
      const alpha = 0.4 + (ink / 100) * 0.58
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: `rgba(0,0,0,${0.18 + dry / 280})`,
        ox: 3,
        oy: 5,
        shadowColor: 'rgba(0,0,0,0.4)',
        shadowBlur: 8 + dry * 0.08,
      })
      const flakes = 1 + Math.round(dry / 18)
      for (let i = 0; i < flakes; i += 1) {
        paintLayer(ctx, layout, x, y, letterSpacing, {
          fillStyle: `rgba(${shade},${shade},${shade},${alpha * (1 - i * 0.12)})`,
          ox: Math.sin(i * 1.7) * (dry * 0.055),
          oy: Math.cos(i * 1.3) * (dry * 0.045),
        })
      }
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: `rgba(${Math.max(0, shade - 8)},${Math.max(0, shade - 8)},${Math.max(0, shade - 8)},${alpha})`,
        strokeStyle: c2,
        lineWidth: Math.max(1, fontSize * 0.018 + dry * 0.01),
      })
      break
    }

    case 'carvedSeal':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: 3,
        oy: 3,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
        strokeStyle: c1,
        lineWidth: Math.max(3, fontSize * 0.055),
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        ox: -1.5,
        oy: -1.5,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
      })
      break

    case 'graffiti':
      for (let i = 8; i >= 1; i -= 1) {
        paintLayer(ctx, layout, x, y, letterSpacing, {
          fillStyle: c2,
          ox: i * 1.4,
          oy: i * 1.4,
        })
      }
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
        strokeStyle: '#020617',
        lineWidth: Math.max(4, fontSize * 0.07),
        shadowColor: c1,
        shadowBlur: fontSize * 0.2,
      })
      break

    case 'comicPop':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: fontSize * 0.08,
        oy: fontSize * 0.08,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
        strokeStyle: c2,
        lineWidth: Math.max(5, fontSize * 0.08),
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        ox: -fontSize * 0.02,
        oy: -fontSize * 0.02,
      })
      break

    case 'softBrutal':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: 'rgba(15,23,42,0.35)',
        ox: fontSize * 0.1,
        oy: fontSize * 0.12,
        shadowColor: 'rgba(15,23,42,0.25)',
        shadowBlur: 18,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
        strokeStyle: c2,
        lineWidth: Math.max(3, fontSize * 0.045),
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        ox: -emboss,
        oy: -emboss,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c0,
      })
      break

    case 'gothicDark':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: 6,
        oy: 10,
        shadowColor: c0,
        shadowBlur: 24,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, '#f8fafc'],
          [0.45, c0],
          [1, c2],
        ]),
        strokeStyle: c1,
        lineWidth: Math.max(2, fontSize * 0.03),
      })
      break

    case 'crystalGlass':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        shadowColor: c0,
        shadowBlur: fontSize * 0.4,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, 'rgba(255,255,255,0.95)'],
          [0.4, c0],
          [0.7, c1],
          [1, c2],
        ]),
        strokeStyle: 'rgba(255,255,255,0.7)',
        lineWidth: Math.max(2, fontSize * 0.03),
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: 'rgba(255,255,255,0.45)',
        oy: -fontSize * 0.1,
      })
      break

    case 'mechanicBevel':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: emboss * 1.4,
        oy: emboss * 1.4,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        ox: emboss,
        oy: emboss,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: '#fafaf9',
        ox: -emboss,
        oy: -emboss,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, '#ffffff'],
          [0.45, c0],
          [1, c2],
        ]),
        strokeStyle: c1,
        lineWidth: Math.max(2, fontSize * 0.028),
      })
      break

    case 'botanical':
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        shadowColor: c0,
        shadowBlur: fontSize * 0.45,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c2,
        ox: 3,
        oy: 4,
      })
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: verticalGradient(ctx, x, y, fontSize, [
          [0, '#dcfce7'],
          [0.4, c1],
          [1, c2],
        ]),
        strokeStyle: c0,
        lineWidth: Math.max(2, fontSize * 0.03),
      })
      break

    default:
      paintLayer(ctx, layout, x, y, letterSpacing, {
        fillStyle: c1,
        shadowColor: c0,
        shadowBlur: 24,
      })
  }
}

async function ensureFont(font, fontSize, fontWeight) {
  const weight = resolveWeight(font, fontWeight)
  const spec = `${weight} ${Math.max(12, Math.round(fontSize))}px ${font.family}`
  try {
    await document.fonts.load(spec)
  } catch {
    /* fallback system fonts still render */
  }
}

export function displayText(text) {
  const raw = String(text ?? '').replace(/\r\n/g, '\n')
  return raw.length ? raw : '龍 Dragon 풀정'
}

export function textLines(text) {
  return displayText(text).split('\n')
}

function lineBlock(ctx, text, letterSpacing, fontSize, lineHeight = 1.2, align = 'center') {
  const lines = textLines(text)
  const layouts = lines.map((line) => layoutText(ctx, line.length ? line : ' ', letterSpacing))
  const maxW = Math.max(...layouts.map((item) => item.total), fontSize * 0.5)
  const lh = fontSize * Math.max(0.8, Math.min(2.5, Number(lineHeight) || 1.2))
  const startY = -((layouts.length - 1) * lh) / 2
  return { layouts, maxW, lh, startY, align: align || 'center' }
}

function alignedX(align, maxW, total) {
  if (align === 'left') return -maxW / 2 + total / 2
  if (align === 'right') return maxW / 2 - total / 2
  return 0
}

export function fitLayerFontSize(layer, font, viewW, viewH = viewW, {
  min = FONT_SIZE_MIN,
  max = FONT_SIZE_MAX,
  fill = 0.85,
} = {}) {
  if (typeof document === 'undefined') return Math.round(layer.fontSize || min)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return Math.round(layer.fontSize || min)
  const targetW = Math.max(48, viewW * fill)
  const targetH = Math.max(48, viewH * fill)
  const strokePad = (Number(layer.strokeWidth) || 0) * 2
  const spacing = Number(layer.letterSpacing) || 0
  const lineCount = Math.max(1, textLines(layer.text).length)
  const lineHeight = Math.max(0.8, Math.min(2.5, Number(layer.lineHeight) || 1.2))

  const measure = (size) => {
    applyTypeface(ctx, { font, fontSize: size, fontWeight: layer.fontWeight })
    const block = lineBlock(ctx, layer.text, spacing, size, lineHeight, layer.align)
    const width = block.maxW + strokePad
    const height = size * lineHeight * lineCount * (layer.type === 'seal' ? 1.1 : 1.08)
    return { width, height }
  }

  const fits = (size) => {
    const box = measure(size)
    return box.width <= targetW && box.height <= targetH
  }

  if (fits(max)) return max
  if (!fits(min)) return min

  let lo = min
  let hi = max
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return Math.max(min, Math.min(max, Math.round(lo)))
}

function paintSealStamp(ctx, viewW, viewH, fontSize, text, mask = false) {
  const size = Math.max(28, fontSize * 0.32)
  const x = viewW * 0.74
  const y = viewH * 0.74
  const glyph = [...text].find((ch) => /[\u4e00-\u9fff\uac00-\ud7af]/.test(ch)) || '印'
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.08)
  ctx.fillStyle = mask ? '#ffffff' : 'rgba(185, 28, 28, 0.92)'
  ctx.strokeStyle = mask ? '#ffffff' : '#7f1d1d'
  ctx.lineWidth = 2
  ctx.fillRect(-size / 2, -size / 2, size, size)
  ctx.strokeRect(-size / 2, -size / 2, size, size)
  ctx.fillStyle = mask ? '#000000' : '#fff5f5'
  ctx.font = `700 ${Math.round(size * 0.52)}px "Nanum Myeongjo", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, 0, 2)
  ctx.restore()
}

function drawStyled(ctx, {
  text,
  preset,
  font,
  fontSize,
  letterSpacing,
  fontWeight,
  transparent,
  width,
  height,
  stickerOn,
  stickerTheme,
  chiselDepth,
  roughness,
  inkDensity,
  dryBrush,
  sealOn,
}) {
  const display = displayText(text)
  const viewW = width ?? ctx.canvas.width
  const viewH = height ?? ctx.canvas.height
  const x = viewW / 2
  const y = viewH / 2

  ctx.clearRect(0, 0, viewW, viewH)

  if (!transparent) {
    const bg = ctx.createRadialGradient(x, viewH * 0.4, 20, x, y, viewW * 0.72)
    bg.addColorStop(0, '#161622')
    bg.addColorStop(1, '#07070c')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, viewW, viewH)
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'
    ctx.lineWidth = 1
    for (let i = 64; i < viewW; i += 64) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, viewH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(viewW, i)
      ctx.stroke()
    }
  }

  applyTypeface(ctx, { font, fontSize, fontWeight })
  const extras = {
    text: display,
    stickerOn,
    stickerTheme,
    chiselDepth,
    roughness,
    inkDensity,
    dryBrush,
    sealOn,
  }
  const block = lineBlock(ctx, display, letterSpacing, fontSize, 1.2, 'center')
  block.layouts.forEach((layout, index) => {
    paintShader(
      ctx,
      layout,
      x + alignedX(block.align, block.maxW, layout.total),
      y + block.startY + index * block.lh,
      letterSpacing,
      fontSize,
      preset,
      viewW,
      viewH,
      false,
      extras,
    )
  })
  if (sealOn) paintSealStamp(ctx, viewW, viewH, fontSize, display, false)
}

function drawMask(ctx, {
  text,
  font,
  fontSize,
  letterSpacing,
  fontWeight,
  width,
  height,
  preset,
  stickerOn,
  stickerTheme,
  chiselDepth,
  roughness,
  inkDensity,
  dryBrush,
  sealOn,
}) {
  const display = displayText(text)
  const viewW = width ?? ctx.canvas.width
  const viewH = height ?? ctx.canvas.height
  ctx.clearRect(0, 0, viewW, viewH)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, viewW, viewH)
  applyTypeface(ctx, { font, fontSize, fontWeight })
  const extras = {
    text: display,
    stickerOn,
    stickerTheme,
    chiselDepth,
    roughness,
    inkDensity,
    dryBrush,
    sealOn,
  }
  const block = lineBlock(ctx, display, letterSpacing, fontSize, 1.2, 'center')
  block.layouts.forEach((layout, index) => {
    const lx = viewW / 2 + alignedX(block.align, block.maxW, layout.total)
    const ly = viewH / 2 + block.startY + index * block.lh
    if (preset && TYPO_SHADERS.has(preset.shader)) {
      paintShader(ctx, layout, lx, ly, letterSpacing, fontSize, preset, viewW, viewH, true, extras)
    } else {
      ctx.fillStyle = '#ffffff'
      fillSpaced(ctx, layout, lx, ly, letterSpacing)
    }
  })
  if (sealOn) paintSealStamp(ctx, viewW, viewH, fontSize, display, true)
}

export function layerAnchor(layer, viewW, viewH) {
  return {
    x: viewW / 2 + (Number(layer.ox) || 0) * viewW,
    y: viewH / 2 + (Number(layer.oy) || 0) * viewH,
  }
}

function metricsContext() {
  if (typeof document === 'undefined') return null
  if (!metricsCanvas) {
    metricsCanvas = document.createElement('canvas')
    metricsCanvas.width = 8
    metricsCanvas.height = 8
  }
  return metricsCanvas.getContext('2d')
}

function measureDomTextBox(layer, font, fontSize, spacing, lineHeight) {
  if (typeof document === 'undefined' || !document.body || !font) return null
  if (!bboxProbe) {
    bboxProbe = document.createElement('div')
    bboxProbe.setAttribute('data-styler-bbox-probe', 'true')
    bboxProbe.setAttribute('aria-hidden', 'true')
    Object.assign(bboxProbe.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      zIndex: '-1',
      width: 'max-content',
      maxWidth: 'none',
      height: 'auto',
      margin: '0',
      padding: '0',
      border: '0',
      whiteSpace: 'pre',
    })
    document.body.appendChild(bboxProbe)
  }
  const weight = resolveWeight(font, layer.fontWeight)
  bboxProbe.style.font = `${weight} ${fontSize}px ${font.family}`
  bboxProbe.style.letterSpacing = `${spacing}px`
  bboxProbe.style.lineHeight = String(lineHeight)
  bboxProbe.textContent = displayText(layer.text)
  const rect = bboxProbe.getBoundingClientRect()
  return {
    w: bboxProbe.offsetWidth || rect.width,
    h: bboxProbe.offsetHeight || rect.height,
  }
}

function glyphOverflow(ctx, block) {
  let left = 0
  let right = 0
  let ascent = 0
  let descent = 0
  for (const layout of block.layouts) {
    for (const ch of layout.chars) {
      const metrics = ctx.measureText(ch)
      left = Math.max(left, metrics.actualBoundingBoxLeft || 0)
      right = Math.max(right, metrics.actualBoundingBoxRight || 0)
      ascent = Math.max(ascent, metrics.actualBoundingBoxAscent || metrics.fontBoundingBoxAscent || 0)
      descent = Math.max(descent, metrics.actualBoundingBoxDescent || metrics.fontBoundingBoxDescent || 0)
    }
  }
  return { left, right, ascent, descent }
}

function resolveBoxFont(layer, options) {
  return options?.fontsById?.[layer.fontId]
    ?? options?.font
    ?? FONTS_BY_ID[layer.fontId]
    ?? FONTS[0]
}

function resolveBoxPreset(layer, options) {
  if (layer.presetId && options?.presetsById?.[layer.presetId]) return options.presetsById[layer.presetId]
  if (layer.presetId && PRESETS_BY_ID[layer.presetId]) return PRESETS_BY_ID[layer.presetId]
  if (layer.role === 'main') return options?.preset ?? null
  return null
}

function shaderDecorationPad(shader, fontSize, contentW, contentH, viewW, viewH, stickerOn) {
  const glow = (ratio) => fontSize * ratio
  switch (shader) {
    case 'kitschSticker': {
      const boxW = contentW + fontSize * 0.9
      const boxH = fontSize * 1.35
      const sticker = fontSize * 0.44
      const extraX = stickerOn === false
        ? glow(0.22)
        : Math.max(glow(0.22), boxW * 0.52 + fontSize * 0.18 + sticker - contentW / 2)
      const extraY = stickerOn === false
        ? glow(0.16)
        : Math.max(glow(0.16), boxH * 0.72 + fontSize * 0.12 + sticker - contentH / 2)
      return { extraX, extraY }
    }
    case 'circularBadge': {
      const radius = Math.min(viewW, viewH) * 0.3 + fontSize * 0.42 + glow(0.18)
      return {
        extraX: Math.max(0, radius - contentW / 2),
        extraY: Math.max(0, radius - contentH / 2),
      }
    }
    case 'waveWarp':
      return { extraX: glow(0.22), extraY: glow(0.55) }
    case 'kineticStack':
      return { extraX: glow(0.64), extraY: glow(0.76) }
    case 'splitSlice':
      return { extraX: glow(0.16), extraY: glow(0.12) }
    case 'hollowOutline':
      return { extraX: glow(0.22), extraY: glow(0.22) }
    case 'chunkyBubble':
      return { extraX: glow(0.28), extraY: glow(0.24) }
    case 'interlockBlock':
      return { extraX: glow(1.05), extraY: glow(0.32) }
    case 'woodcutCarving':
    case 'woodblock':
      return { extraX: glow(0.16), extraY: glow(0.2) }
    case 'liquidChrome':
    case 'inflatedJelly':
    case 'cyberNeon':
    case 'crystalGlass':
    case 'botanical':
      return { extraX: glow(0.55), extraY: glow(0.55) }
    case 'hologram':
      return { extraX: 24, extraY: 18 }
    case 'calligraphy':
      return { extraX: 18, extraY: 22 }
    case 'graffiti':
      return { extraX: glow(0.28) + 14, extraY: glow(0.28) + 14 }
    case 'comicPop':
      return { extraX: glow(0.16), extraY: glow(0.16) }
    case 'softBrutal':
      return { extraX: glow(0.16) + 18, extraY: glow(0.18) + 18 }
    case 'gothicDark':
      return { extraX: 24, extraY: 28 }
    case 'mechanicBevel':
      return { extraX: glow(0.12), extraY: glow(0.12) }
    case 'carvedSeal':
      return { extraX: glow(0.08) + 4, extraY: glow(0.08) + 4 }
    default:
      return shader ? { extraX: 24, extraY: 24 } : { extraX: glow(0.08), extraY: glow(0.08) }
  }
}

export function estimateLayerBox(layer, viewW, viewH, scale, options = {}) {
  const fontSize = Math.max(12, (layer.fontSize ?? 88) * scale)
  const spacing = (Number(layer.letterSpacing) || 0) * scale
  const lineHeight = Math.max(0.8, Math.min(2.5, Number(layer.lineHeight) || 1.2))
  const font = resolveBoxFont(layer, options)
  const { x, y } = layerAnchor(layer, viewW, viewH)

  if (layer.type === 'seal') {
    const size = Math.max(28, fontSize * 2.2 * 0.32)
    const pad = BOX_SAFETY_PAD + 4
    return {
      x,
      y,
      w: size + pad * 2,
      h: size + pad * 2,
      rotation: ((layer.rotation ?? 0) * Math.PI) / 180,
    }
  }

  const ctx = metricsContext()
  let contentW
  let contentH
  if (ctx && font) {
    applyTypeface(ctx, { font, fontSize, fontWeight: layer.fontWeight })
    const block = lineBlock(ctx, layer.text, spacing, fontSize, lineHeight, layer.align)
    const overflow = glyphOverflow(ctx, block)
    const lineCount = Math.max(1, block.layouts.length)
    contentW = Math.max(block.maxW, overflow.left + overflow.right)
    contentH = Math.max(
      block.lh * lineCount * 1.08,
      (lineCount - 1) * block.lh + overflow.ascent + overflow.descent,
      fontSize * lineHeight * lineCount,
    )
  } else {
    const lines = textLines(layer.text)
    const longest = Math.max(...lines.map((line) => [...line].length), 1)
    contentW = Math.max(fontSize * 1.3, longest * fontSize * 0.62 + Math.abs(spacing) * Math.max(0, longest - 1))
    contentH = fontSize * lineHeight * Math.max(1, lines.length) * 1.08
  }

  const domBox = measureDomTextBox(layer, font, fontSize, spacing, lineHeight)
  if (domBox) {
    contentW = Math.max(contentW, domBox.w)
    contentH = Math.max(contentH, domBox.h)
  }

  const strokePad = Math.max(0, ((Number(layer.strokeWidth) || 0) + (Number(layer.strokeWidth2) || 0)) * scale)
  const shadowPad = Math.max(0, Number(layer.shadowBlur) || 0)
  const curvePad = curveExtraPad(fontSize, layer.curveAmount)
  const preset = resolveBoxPreset(layer, options)
  const deco = shaderDecorationPad(
    preset?.shader,
    fontSize,
    contentW,
    contentH,
    viewW,
    viewH,
    options.stickerOn,
  )
  const padX = BOX_SAFETY_PAD + strokePad + shadowPad + deco.extraX + curvePad * 0.35
  const padY = BOX_SAFETY_PAD + strokePad + shadowPad + deco.extraY + curvePad

  return {
    x,
    y,
    w: contentW + padX * 2,
    h: contentH + padY * 2,
    rotation: ((layer.rotation ?? 0) * Math.PI) / 180,
  }
}

export function layerPaintRank(layer, index = 0) {
  const base = layer?.role === 'main' ? 20 : layer?.role === 'sub' ? 10 : 12
  return base + index / 1000
}

function layersInPaintOrder(layers) {
  return (layers || [])
    .map((layer, index) => ({ layer, index, rank: layerPaintRank(layer, index) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
}

export function hitTestStudio(layers, px, py, viewW, viewH, scale, options = {}) {
  const stacked = layersInPaintOrder(layers)
  for (let cursor = stacked.length - 1; cursor >= 0; cursor -= 1) {
    const layer = stacked[cursor].layer
    if (layer.visible === false) continue
    const box = estimateLayerBox(layer, viewW, viewH, scale, options)
    const dx = px - box.x
    const dy = py - box.y
    const cos = Math.cos(-box.rotation)
    const sin = Math.sin(-box.rotation)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    const rx = box.w / 2
    const ry = box.h / 2
    if (Math.hypot(lx, ly + ry + ROTATE_PIN_GAP) <= 9) return { layer, box, handle: 'rotate' }
    if (Math.hypot(lx - rx, ly - ry) <= 9) return { layer, box, handle: 'scale' }
    if (Math.abs(lx) <= rx + 8 && Math.abs(ly) <= ry + 8) return { layer, box, handle: 'move' }
  }
  return null
}

function drawGrid(ctx, viewW, viewH) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  const step = 48
  for (let i = step; i < viewW; i += step) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, viewH)
    ctx.stroke()
  }
  for (let i = step; i < viewH; i += step) {
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(viewW, i)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(34,211,238,0.18)'
  ctx.beginPath()
  ctx.moveTo(viewW / 2, 0)
  ctx.lineTo(viewW / 2, viewH)
  ctx.moveTo(0, viewH / 2)
  ctx.lineTo(viewW, viewH / 2)
  ctx.stroke()
  ctx.restore()
}

function drawCheckerPlate(ctx, viewW, viewH, size = 16) {
  ctx.fillStyle = '#2a2a36'
  ctx.fillRect(0, 0, viewW, viewH)
  ctx.fillStyle = '#1a1a24'
  for (let y = 0; y < viewH; y += size) {
    for (let x = 0; x < viewW; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) ctx.fillRect(x, y, size, size)
    }
  }
}

function drawBackgroundPlate(ctx, viewW, viewH, transparent, bgImage, background, previewBg = 'dark') {
  ctx.clearRect(0, 0, viewW, viewH)
  if (transparent && !bgImage) return
  if (!bgImage) {
    if (previewBg === 'checker') {
      drawCheckerPlate(ctx, viewW, viewH)
    } else if (previewBg === 'light') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, viewW, viewH)
    } else {
      ctx.fillStyle = '#0f1117'
      ctx.fillRect(0, 0, viewW, viewH)
    }
    return
  }
  if (previewBg === 'checker') drawCheckerPlate(ctx, viewW, viewH)
  else if (previewBg === 'light') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, viewW, viewH)
  } else {
    ctx.fillStyle = '#0f1117'
    ctx.fillRect(0, 0, viewW, viewH)
  }
  ctx.save()
  ctx.globalAlpha = background?.opacity ?? 1
  ctx.filter = `blur(${background?.blur ?? 0}px)`
  ctx.globalCompositeOperation = background?.blend ?? 'source-over'
  const iw = bgImage.naturalWidth || bgImage.width
  const ih = bgImage.naturalHeight || bgImage.height
  const cover = Math.max(viewW / iw, viewH / ih)
  const dw = iw * cover
  const dh = ih * cover
  ctx.drawImage(bgImage, (viewW - dw) / 2, (viewH - dh) / 2, dw, dh)
  ctx.restore()
}

function resolveLayerPreset(layer, fallbackPreset, extras) {
  if (layer.presetId && extras?.presetsById?.[layer.presetId]) return extras.presetsById[layer.presetId]
  if (layer.role === 'main') return fallbackPreset
  return null
}

function paintStudioLayer(ctx, layer, font, preset, extras, viewW, viewH, scale, mask) {
  const display = displayText(layer.text)
  const fontSize = Math.max(10, layer.fontSize * scale)
  const letterSpacing = (layer.letterSpacing ?? 0) * scale
  const layerPreset = resolveLayerPreset(layer, preset, extras)
  const { x, y } = layerAnchor(layer, viewW, viewH)
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1))
  ctx.translate(x, y)
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180)
  applyTypeface(ctx, { font, fontSize, fontWeight: layer.fontWeight })
  const block = lineBlock(ctx, display, letterSpacing, fontSize, layer.lineHeight, layer.align)
  if (layer.type === 'seal') {
    paintSealStamp(ctx, 0, 0, fontSize * 2.4, display, mask)
    ctx.restore()
    return
  }
  const paintOne = (layout, lx, ly) => {
    const curve = Number(layer.curveAmount) || 0
    const useCurve = Math.abs(curve) >= 2
    const strokeStyle = {
      strokeStyle: layer.strokeWidth > 0 ? layer.strokeColor : undefined,
      lineWidth: layer.strokeWidth > 0 ? layer.strokeWidth * scale : 0,
      stroke2Style: layer.strokeWidth2 > 0 ? (layer.strokeColor2 || '#0f172a') : undefined,
      lineWidth2: layer.strokeWidth2 > 0 ? layer.strokeWidth2 * scale : 0,
      curve: useCurve ? curve : 0,
    }
    if (mask) {
      if (layerPreset && TYPO_SHADERS.has(layerPreset.shader) && !useCurve) {
        paintShader(ctx, layout, lx, ly, letterSpacing, fontSize, layerPreset, viewW, viewH, true, { ...extras, text: display })
      } else {
        ctx.fillStyle = '#ffffff'
        if (useCurve) {
          paintLayer(ctx, layout, lx, ly, letterSpacing, { fillStyle: '#ffffff', curve })
        } else {
          fillSpaced(ctx, layout, lx, ly, letterSpacing)
        }
      }
      return
    }
    if (layerPreset && !useCurve) {
      paintShader(ctx, layout, lx, ly, letterSpacing, fontSize, layerPreset, viewW, viewH, false, { ...extras, text: display })
    }
    if (layer.shadowBlur > 0) {
      paintLayer(ctx, layout, lx, ly, letterSpacing, {
        fillStyle: layer.color || '#f8fafc',
        shadowColor: layer.shadowColor || '#000000',
        shadowBlur: layer.shadowBlur,
        curve: strokeStyle.curve,
      })
    }
    if (!layerPreset || useCurve) {
      paintLayer(ctx, layout, lx, ly, letterSpacing, {
        fillStyle: layer.color || '#f8fafc',
        ...strokeStyle,
      })
    } else if (layer.strokeWidth > 0 || layer.strokeWidth2 > 0) {
      paintLayer(ctx, layout, lx, ly, letterSpacing, strokeStyle)
    }
  }
  block.layouts.forEach((layout, index) => {
    paintOne(
      layout,
      alignedX(block.align, block.maxW, layout.total),
      block.startY + index * block.lh,
    )
  })
  ctx.restore()
}

function paintOverlayBox(ctx, box, accent = 'main') {
  const stroke = accent === 'sub' ? 'rgba(232,121,249,0.95)' : accent === 'extra' ? 'rgba(250,204,21,0.95)' : 'rgba(34,211,238,0.95)'
  const fill = accent === 'sub' ? '#e879f9' : accent === 'extra' ? '#facc15' : '#67e8f9'
  ctx.save()
  ctx.translate(box.x, box.y)
  ctx.rotate(box.rotation)
  ctx.strokeStyle = stroke
  ctx.shadowColor = stroke
  ctx.shadowBlur = 12
  ctx.lineWidth = 1.6
  ctx.setLineDash([6, 4])
  ctx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h)
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(0, -box.h / 2)
  ctx.lineTo(0, -box.h / 2 - ROTATE_PIN_GAP)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(0, -box.h / 2 - ROTATE_PIN_GAP, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(box.w / 2 - 5, box.h / 2 - 5, 10, 10)
  ctx.restore()
}

function paintSealStampAtOrigin(ctx, fontSize, text, mask) {
  const size = Math.max(28, fontSize * 0.32)
  const glyph = [...text].find((ch) => /[\u4e00-\u9fff\uac00-\ud7af]/.test(ch)) || '印'
  ctx.save()
  ctx.rotate(-0.08)
  ctx.fillStyle = mask ? '#ffffff' : 'rgba(185, 28, 28, 0.92)'
  ctx.strokeStyle = mask ? '#ffffff' : '#7f1d1d'
  ctx.lineWidth = 2
  ctx.fillRect(-size / 2, -size / 2, size, size)
  ctx.strokeRect(-size / 2, -size / 2, size, size)
  ctx.fillStyle = mask ? '#000000' : '#fff5f5'
  ctx.font = `700 ${Math.round(size * 0.52)}px "Nanum Myeongjo", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, 0, 2)
  ctx.restore()
}

async function drawStudioScene(ctx, options) {
  const {
    layers,
    fontsById,
    preset,
    viewMode,
    width: viewW,
    height: viewH,
    scale,
    transparent,
    bgImage,
    background,
    gridOn,
    selectedId,
    showOverlay,
    stickerOn,
    stickerTheme,
    chiselDepth,
    roughness,
    inkDensity,
    dryBrush,
  } = options
  const extras = {
    stickerOn,
    stickerTheme,
    chiselDepth,
    roughness,
    inkDensity,
    dryBrush,
    sealOn: false,
    presetsById: options.presetsById,
  }
  const mask = viewMode === 'mask'
  if (mask) {
    ctx.clearRect(0, 0, viewW, viewH)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, viewW, viewH)
  } else {
    drawBackgroundPlate(ctx, viewW, viewH, transparent, bgImage, background, options.previewBg || 'dark')
    if (gridOn) drawGrid(ctx, viewW, viewH)
  }
  for (const { layer } of layersInPaintOrder(layers)) {
    if (layer.visible === false) continue
    const font = fontsById?.[layer.fontId] ?? options.font
    if (font) await ensureFont(font, layer.fontSize * scale, layer.fontWeight)
    if (layer.type === 'seal') {
      const { x, y } = layerAnchor(layer, viewW, viewH)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180)
      paintSealStampAtOrigin(ctx, layer.fontSize * scale * 2.2, layer.text || '印', mask)
      ctx.restore()
      continue
    }
    paintStudioLayer(ctx, layer, font, preset, extras, viewW, viewH, scale, mask)
  }
  if (showOverlay && selectedId && !mask) {
    const selected = layers.find((item) => item.id === selectedId)
    if (selected) {
      const accent = selected.role === 'sub' ? 'sub' : selected.role === 'main' ? 'main' : 'extra'
      paintOverlayBox(ctx, estimateLayerBox(selected, viewW, viewH, scale, {
        fontsById,
        font: options.font,
        presetsById: extras.presetsById,
        stickerOn: extras.stickerOn,
        preset,
      }), accent)
    }
  }
}

export async function drawLivePreview(canvas, options) {
  if (!canvas) return
  const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : { width: 0, height: 0 }
  const cssW = Math.max(1, Math.round(canvas.clientWidth || rect.width || 512))
  const cssH = Math.max(1, Math.round(canvas.clientHeight || rect.height || 512))
  const dpr = hqPixelRatio()
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  const ctx = canvas.getContext('2d', { alpha: true })
  primeHqContext(ctx)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const scale = Math.min(cssW, cssH) / 512

  if (options.layers?.length) {
    await drawStudioScene(ctx, {
      ...options,
      width: cssW,
      height: cssH,
      scale,
      transparent: true,
      showOverlay: options.showOverlay !== false,
    })
    if (options.viewEdit) {
      const processed = applyViewEdit(canvas, options.viewEdit, {
        letterbox: true,
        skipCrop: options.skipCrop === true,
      })
      if (processed !== canvas) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(processed, 0, 0)
      }
    }
    return
  }

  await ensureFont(options.font, options.fontSize, options.fontWeight)
  const scaled = {
    ...options,
    fontSize: options.fontSize * (cssW / 512),
    letterSpacing: options.letterSpacing * (cssW / 512),
    transparent: true,
    width: cssW,
    height: cssH,
  }
  if (options.viewMode === 'mask') drawMask(ctx, scaled)
  else drawStyled(ctx, scaled)
}

export async function renderStyledText(options) {
  const exportW = options.exportW || EXPORT_SIZE
  const exportH = options.exportH || EXPORT_SIZE
  const scale = Math.min(exportW, exportH) / 512

  if (options.layers?.length) {
    for (const layer of options.layers) {
      const font = options.fontsById?.[layer.fontId] ?? options.font
      if (font) await ensureFont(font, layer.fontSize * scale, layer.fontWeight)
    }
    const transparent = document.createElement('canvas')
    transparent.width = exportW
    transparent.height = exportH
    const transparentCtx = transparent.getContext('2d')
    primeHqContext(transparentCtx)
    await drawStudioScene(transparentCtx, {
      ...options,
      width: exportW,
      height: exportH,
      scale,
      transparent: true,
      showOverlay: false,
      gridOn: false,
      viewMode: 'graphic',
    })
    const graphic = options.viewEdit
      ? applyViewEdit(transparent, options.viewEdit, { letterbox: false, skipCrop: false })
      : transparent
    if (graphic !== transparent) {
      transparent.width = graphic.width
      transparent.height = graphic.height
      const copyCtx = transparent.getContext('2d')
      primeHqContext(copyCtx)
      copyCtx.drawImage(graphic, 0, 0)
    }
    const mask = document.createElement('canvas')
    mask.width = exportW
    mask.height = exportH
    const maskCtx = mask.getContext('2d')
    primeHqContext(maskCtx)
    await drawStudioScene(maskCtx, {
      ...options,
      width: exportW,
      height: exportH,
      scale,
      showOverlay: false,
      gridOn: false,
      viewMode: 'mask',
      bgImage: null,
    })
    if (options.viewEdit) {
      const geometry = {
        ...options.viewEdit,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        vignette: 0,
        ink: 0,
      }
      const processedMask = applyViewEdit(mask, geometry, { letterbox: false, skipCrop: false })
      if (processedMask !== mask) {
        mask.width = processedMask.width
        mask.height = processedMask.height
        const maskCopy = mask.getContext('2d')
        primeHqContext(maskCopy)
        maskCopy.drawImage(processedMask, 0, 0)
      }
    }
    const [transparentUrl, maskUrl] = await Promise.all([
      canvasToUrl(transparent),
      canvasToUrl(mask),
    ])
    return { transparentUrl, maskUrl, graphic: transparent, maskCanvas: mask }
  }

  await ensureFont(options.font, options.fontSize, options.fontWeight)
  const exportOptions = {
    ...options,
    fontSize: options.fontSize * scale,
    letterSpacing: options.letterSpacing * scale,
  }
  const transparent = document.createElement('canvas')
  transparent.width = exportW
  transparent.height = exportH
  const plainCtx = transparent.getContext('2d')
  primeHqContext(plainCtx)
  drawStyled(plainCtx, {
    ...exportOptions,
    transparent: true,
    width: exportW,
    height: exportH,
  })
  const mask = document.createElement('canvas')
  mask.width = exportW
  mask.height = exportH
  const plainMask = mask.getContext('2d')
  primeHqContext(plainMask)
  drawMask(plainMask, {
    ...exportOptions,
    width: exportW,
    height: exportH,
    preset: options.preset,
  })
  const [transparentUrl, maskUrl] = await Promise.all([
    canvasToUrl(transparent),
    canvasToUrl(mask),
  ])
  return { transparentUrl, maskUrl, graphic: transparent, maskCanvas: mask }
}
