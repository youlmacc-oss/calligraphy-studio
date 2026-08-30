import { useEffect, useRef, useState } from 'react'
import { buildCaptionPose, TEXT_MOTION_NONE, normalizeTextMotionEffect } from './dynamicTextMotion.js'
import { captionBubbleBox, paintDynamicTextMotion } from './DynamicTextMotionRenderer.js'
import { setupSpeechBubbleDragger } from './speechBubbleDrag.js'
import { SEQUENCE_VIEW_SIZE, captionLoopIndex, clampSequenceFps, clampStillLoopSeconds, pingPongPlayIndex } from './motionSequencer.js'
import { applyDefringeToContext } from '../../utils/imageProcessor.js'
import { paintParticleOverlay, normalizeParticleLayers } from './particleOverlayEngine.js'
import { paintMotionFrame } from '../MotionGifStudio/motionPresets.js'
import { mirrorPreviewFrame } from './ChatRoomSimulator.jsx'

function loadFrame(url) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('empty'))
      return
    }
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('frame'))
    image.src = url
  })
}

function paintFrame(ctx, image, size) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, size, size)
  if (!image) return
  const sw = image.naturalWidth || image.width || 1
  const sh = image.naturalHeight || image.height || 1
  const scale = Math.min(size / sw, size / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh)
  applyDefringeToContext(ctx, size, size)
}

function paintOverlay(ctx, {
  edge,
  motion,
  index,
  total,
  time01,
  layers,
  captionOn,
  captionText,
  captionSize,
  captionStroke,
  captionFont,
  captionPos,
  bubbleRef,
}) {
  const pose = buildCaptionPose({
    enabled: captionOn,
    text: captionText,
    effect: motion,
    index,
    total: Math.max(1, total),
    sizeId: captionSize,
    strokeId: captionStroke,
    fontId: captionFont,
    edge,
    posX: captionPos?.posX,
    posY: captionPos?.posY,
  })
  if (pose) {
    paintDynamicTextMotion(ctx, { size: edge, pose })
    if (bubbleRef) bubbleRef.current = captionBubbleBox(pose, edge)
  } else if (bubbleRef) {
    bubbleRef.current = { visible: false, x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 }
  }
  if (layers.length) {
    paintParticleOverlay(ctx, {
      size: edge,
      time01,
      layers,
    })
  }
}

export default function MotionPreviewCanvas({
  frames = [],
  fps = 8,
  playing = true,
  size = SEQUENCE_VIEW_SIZE,
  effect = TEXT_MOTION_NONE,
  speed = 1,
  pingPong = false,
  particles = [],
  stillLoop = false,
  motionPreset = 'none',
  isolateSprite = true,
  intensity = 70,
  loopSeconds = 2,
  onTick,
  mirrorRef,
  captionOn = false,
  captionText = '',
  captionSize = 'md',
  captionStroke = 'black',
  captionFont,
  captionPos = { posX: 0, posY: 0 },
  onCaptionPos,
}) {
  const canvasRef = useRef(null)
  const cacheRef = useRef(new Map())
  const stepRef = useRef(0)
  const timeRef = useRef(0)
  const clockRef = useRef({ startedAt: 0 })
  const tickRef = useRef(onTick)
  const mirrorHoldRef = useRef(mirrorRef)
  const [cacheRev, setCacheRev] = useState(0)
  const bubbleRef = useRef({ visible: false })
  const dragRef = useRef(null)
  tickRef.current = onTick
  mirrorHoldRef.current = mirrorRef

  useEffect(() => {
    dragRef.current = setupSpeechBubbleDragger(
      canvasRef,
      () => bubbleRef.current,
      (posX, posY) => onCaptionPos?.({ posX, posY }),
      () => ({ width: size, height: size }),
    )
  }, [onCaptionPos, size])

  useEffect(() => {
    let alive = true
    const urls = frames.map((item) => item.url).filter(Boolean)
    urls.forEach((url) => {
      if (cacheRef.current.has(url)) return
      loadFrame(url).then((image) => {
        if (!alive) return
        cacheRef.current.set(url, image)
        setCacheRev((value) => value + 1)
      }).catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [frames])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined
    const edge = Math.max(2, Math.round(Number(size) || SEQUENCE_VIEW_SIZE))
    if (canvas.width !== edge || canvas.height !== edge) {
      canvas.width = edge
      canvas.height = edge
    }
    const motion = normalizeTextMotionEffect(effect)
    const layers = normalizeParticleLayers(particles)
    const useStill = stillLoop || frames.length === 1

    const blit = () => {
      mirrorPreviewFrame(canvas, mirrorHoldRef.current?.current)
    }

    const drawStill = (time01) => {
      const item = frames[0]
      const image = item?.url ? cacheRef.current.get(item.url) : null
      const clock = captionLoopIndex(time01, fps, loopSeconds, speed)
      if (image) {
        paintMotionFrame(ctx, image, {
          width: edge,
          height: edge,
          time01,
          preset: motionPreset,
          intensity,
          isolate: isolateSprite,
        })
        applyDefringeToContext(ctx, edge, edge)
      } else {
        ctx.clearRect(0, 0, edge, edge)
      }
      paintOverlay(ctx, {
        edge,
        motion,
        item,
        index: clock.index,
        total: clock.total,
        time01,
        layers,
        captionOn,
        captionText,
        captionSize,
        captionStroke,
        captionFont,
        captionPos,
        bubbleRef,
      })
      blit()
      tickRef.current?.(0, item?.url || '')
    }

    const drawStep = (step) => {
      const index = pingPongPlayIndex(step, frames.length, pingPong)
      const item = frames[index]
      const image = item?.url ? cacheRef.current.get(item.url) : null
      paintFrame(ctx, image, edge)
      paintOverlay(ctx, {
        edge,
        motion,
        item,
        index,
        total: frames.length,
        time01: frames.length ? index / frames.length : 0,
        layers,
        captionOn,
        captionText,
        captionSize,
        captionStroke,
        captionFont,
        captionPos,
        bubbleRef,
      })
      blit()
      tickRef.current?.(index, item?.url || '')
    }

    if (!frames.length) {
      ctx.clearRect(0, 0, edge, edge)
      blit()
      tickRef.current?.(0, '')
      return undefined
    }

    if (useStill) {
      drawStill(timeRef.current || 0)
      if (!playing) return undefined
      clockRef.current.startedAt = 0
      const seconds = clampStillLoopSeconds(loopSeconds)
      let raf = 0
      const step = (now) => {
        if (!clockRef.current.startedAt) {
          clockRef.current.startedAt = now - timeRef.current * seconds * 1000
        }
        const raw = (((now - clockRef.current.startedAt) / 1000) % seconds) / seconds
        timeRef.current = raw
        drawStill(raw)
        raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      return () => cancelAnimationFrame(raf)
    }

    drawStep(stepRef.current)

    if (!playing) return undefined
    const delay = Math.max(20, Math.round(1000 / Math.max(2, clampSequenceFps(fps) * (Number(speed) || 1))))
    const timer = window.setInterval(() => {
      stepRef.current += 1
      drawStep(stepRef.current)
    }, delay)
    return () => window.clearInterval(timer)
  }, [frames, fps, playing, size, effect, speed, pingPong, particles, stillLoop, motionPreset, isolateSprite, intensity, loopSeconds, cacheRev, captionOn, captionText, captionSize, captionStroke, captionFont, captionPos])

  return (
    <div className="ms-preview-stage checkerboard-bg">
      <canvas
        ref={canvasRef}
        className="ms-preview-canvas checkerboard-bg"
        width={size}
        height={size}
        data-still-loop={stillLoop || frames.length === 1 ? '1' : '0'}
        data-preview-canvas="1"
        data-caption-drag="1"
        aria-label="모션 시퀀스 미리보기"
        onMouseDown={(event) => dragRef.current?.handleMouseDown(event)}
        onMouseMove={(event) => dragRef.current?.handleMouseMove(event)}
        onMouseUp={() => dragRef.current?.handleMouseUp()}
        onMouseLeave={() => dragRef.current?.handleMouseUp()}
        onTouchStart={(event) => dragRef.current?.handleMouseDown(event)}
        onTouchMove={(event) => dragRef.current?.handleMouseMove(event)}
        onTouchEnd={() => dragRef.current?.handleMouseUp()}
      />
    </div>
  )
}
