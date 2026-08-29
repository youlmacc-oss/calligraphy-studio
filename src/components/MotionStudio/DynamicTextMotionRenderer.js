import { SEQUENCE_VIEW_SIZE, captionLoopIndex } from './motionSequencer.js'
import { buildCaptionPose } from './dynamicTextMotion.js'

const BAND_RATIO = 0.32
const FONT_AT_360 = 30

export function clearPreviewCaptionBand(ctx, size) {
  if (!ctx) return
  const edge = Math.max(2, Math.round(Number(size) || SEQUENCE_VIEW_SIZE))
  const band = Math.round(edge * BAND_RATIO)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, edge - band, edge, band)
  ctx.restore()
}

export function paintDynamicTextMotion(ctx, { size, pose } = {}) {
  const label = String(pose?.text || '').trim()
  if (!ctx?.strokeText || !ctx?.fillText || !label) return
  const edge = Math.max(2, Math.round(Number(size) || SEQUENCE_VIEW_SIZE))
  const band = Math.round(edge * BAND_RATIO)
  const fontPx = Math.max(12, Math.round(Number(pose.fontPx) || FONT_AT_360 * (edge / SEQUENCE_VIEW_SIZE)))
  const strokeScale = edge / SEQUENCE_VIEW_SIZE
  const stroke = String(pose.strokeStyle || '#000000')

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.translate(
    edge / 2 + (Number(pose.x) || 0),
    edge - Math.round(band * 0.42) + (Number(pose.y) || 0),
  )
  ctx.rotate(Number(pose.rotation) || 0)
  ctx.scale(Number(pose.scale) || 1, Number(pose.scale) || 1)
  ctx.globalAlpha = Number.isFinite(Number(pose.opacity)) ? Number(pose.opacity) : 1
  ctx.font = `bold ${fontPx}px "Pretendard", "Apple SD Gothic Neo", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.shadowColor = 'rgba(255, 236, 150, 0.92)'
  ctx.shadowBlur = Math.max(8, Math.round(fontPx * 0.45))
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(3, Math.round(8 * strokeScale))
  ctx.strokeText(label, 0, 0)
  ctx.lineWidth = Math.max(2, Math.round(5 * strokeScale))
  ctx.strokeText(label, 0, 0)
  ctx.lineWidth = Math.max(1, Math.round(3 * strokeScale))
  ctx.strokeText(label, 0, 0)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

export function paintLiveCaptionLayer(ctx, live = {}, time01 = 0, edge = SEQUENCE_VIEW_SIZE) {
  if (!ctx) return false
  const enabled = live.isTextEnabled === true || live.enabled === true || live.captionOn === true
  const custom = live.customText !== undefined
    ? live.customText
    : (live.text ?? live.captionText ?? '')
  const sized = Math.max(2, Math.round(Number(edge) || SEQUENCE_VIEW_SIZE))
  const clock = live.index != null
    ? { index: live.index, total: Math.max(1, Number(live.total) || 1) }
    : captionLoopIndex(time01, live.fps, live.loopSeconds, live.speed)
  const pose = buildCaptionPose({
    enabled,
    text: custom,
    customText: custom,
    effect: live.effect,
    index: clock.index,
    total: clock.total,
    sizeId: live.sizeId || live.captionSize || 'md',
    strokeId: live.strokeId || live.captionStroke || 'black',
    edge: sized,
  })
  if (!pose) return false
  paintDynamicTextMotion(ctx, { size: sized, pose })
  return true
}

export function renderDynamicTextMotion(ctx, options) {
  paintDynamicTextMotion(ctx, options)
}

export default function DynamicTextMotionRenderer(ctx, options) {
  paintDynamicTextMotion(ctx, options)
}
