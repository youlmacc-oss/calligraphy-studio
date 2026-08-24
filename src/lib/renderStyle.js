import { paintStickers } from './stickers.js'
import { applyViewEdit } from './viewEdit.js'

const EXPORT_SIZE = 1024

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
    paint(ch, cursor, y)
    cursor += layout.widths[index] + letterSpacing
  })
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
  if (style.strokeStyle) {
    ctx.strokeStyle = style.strokeStyle
    ctx.lineWidth = style.lineWidth ?? 2
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    strokeSpaced(ctx, layout, x + (style.ox ?? 0), y + (style.oy ?? 0), letterSpacing)
  }
  if (style.fillStyle) {
    ctx.fillStyle = style.fillStyle
    fillSpaced(ctx, layout, x + (style.ox ?? 0), y + (style.oy ?? 0), letterSpacing)
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

export function estimateLayerBox(layer, viewW, viewH, scale) {
  const fontSize = Math.max(12, (layer.fontSize ?? 88) * scale)
  const lines = textLines(layer.text)
  const longest = Math.max(...lines.map((line) => [...line].length), 1)
  const spacing = Math.abs(layer.letterSpacing ?? 0) * scale
  const width = Math.max(fontSize * 1.3, longest * fontSize * 0.62 + spacing * Math.max(0, longest - 1))
  const lineHeight = Math.max(0.8, Math.min(2.5, Number(layer.lineHeight) || 1.2))
  const height = fontSize * lineHeight * (layer.type === 'seal' ? 1 : Math.max(1, lines.length)) * (layer.type === 'seal' ? 1.1 : 1.08)
  const { x, y } = layerAnchor(layer, viewW, viewH)
  return {
    x,
    y,
    w: width,
    h: height,
    rotation: ((layer.rotation ?? 0) * Math.PI) / 180,
  }
}

export function hitTestStudio(layers, px, py, viewW, viewH, scale) {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index]
    if (layer.visible === false) continue
    const box = estimateLayerBox(layer, viewW, viewH, scale)
    const dx = px - box.x
    const dy = py - box.y
    const cos = Math.cos(-box.rotation)
    const sin = Math.sin(-box.rotation)
    const lx = dx * cos - dy * sin
    const ly = dx * sin + dy * cos
    const rx = box.w / 2
    const ry = box.h / 2
    if (Math.hypot(lx, ly + ry + 22) <= 9) return { layer, box, handle: 'rotate' }
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

function drawBackgroundPlate(ctx, viewW, viewH, transparent, bgImage, background) {
  ctx.clearRect(0, 0, viewW, viewH)
  if (transparent && !bgImage) return
  const x = viewW / 2
  const y = viewH / 2
  const plate = ctx.createRadialGradient(x, viewH * 0.4, 20, x, y, Math.max(viewW, viewH) * 0.72)
  plate.addColorStop(0, '#161622')
  plate.addColorStop(1, '#07070c')
  ctx.fillStyle = plate
  ctx.fillRect(0, 0, viewW, viewH)
  if (!bgImage) return
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
    if (mask) {
      if (layerPreset && TYPO_SHADERS.has(layerPreset.shader)) {
        paintShader(ctx, layout, lx, ly, letterSpacing, fontSize, layerPreset, viewW, viewH, true, { ...extras, text: display })
      } else {
        ctx.fillStyle = '#ffffff'
        fillSpaced(ctx, layout, lx, ly, letterSpacing)
      }
      return
    }
    if (layerPreset) {
      paintShader(ctx, layout, lx, ly, letterSpacing, fontSize, layerPreset, viewW, viewH, false, { ...extras, text: display })
    }
    if (layer.shadowBlur > 0) {
      paintLayer(ctx, layout, lx, ly, letterSpacing, {
        fillStyle: layer.color || '#f8fafc',
        shadowColor: layer.shadowColor || '#000000',
        shadowBlur: layer.shadowBlur,
      })
    }
    if (!layerPreset) {
      paintLayer(ctx, layout, lx, ly, letterSpacing, {
        fillStyle: layer.color || '#f8fafc',
        strokeStyle: layer.strokeWidth > 0 ? layer.strokeColor : undefined,
        lineWidth: layer.strokeWidth > 0 ? layer.strokeWidth * scale : undefined,
      })
    } else if (layer.strokeWidth > 0) {
      paintLayer(ctx, layout, lx, ly, letterSpacing, {
        strokeStyle: layer.strokeColor,
        lineWidth: layer.strokeWidth * scale,
      })
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
  ctx.lineTo(0, -box.h / 2 - 22)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(0, -box.h / 2 - 22, 5, 0, Math.PI * 2)
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
    drawBackgroundPlate(ctx, viewW, viewH, transparent, bgImage, background)
    if (gridOn) drawGrid(ctx, viewW, viewH)
  }
  for (const layer of layers) {
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
      paintOverlayBox(ctx, estimateLayerBox(selected, viewW, viewH, scale), accent)
    }
  }
}

export async function drawLivePreview(canvas, options) {
  if (!canvas) return
  const cssW = Math.max(1, Math.round(canvas.clientWidth || 512))
  const cssH = Math.max(1, Math.round(canvas.clientHeight || 512))
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const scale = Math.min(cssW, cssH) / 512

  if (options.layers?.length) {
    await drawStudioScene(ctx, {
      ...options,
      width: cssW,
      height: cssH,
      scale,
      transparent: false,
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
    transparent: false,
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
    await drawStudioScene(transparent.getContext('2d'), {
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
      transparent.getContext('2d').drawImage(graphic, 0, 0)
    }
    const mask = document.createElement('canvas')
    mask.width = exportW
    mask.height = exportH
    await drawStudioScene(mask.getContext('2d'), {
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
        mask.getContext('2d').drawImage(processedMask, 0, 0)
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
  drawStyled(transparent.getContext('2d'), {
    ...exportOptions,
    transparent: true,
    width: exportW,
    height: exportH,
  })
  const mask = document.createElement('canvas')
  mask.width = exportW
  mask.height = exportH
  drawMask(mask.getContext('2d'), {
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
