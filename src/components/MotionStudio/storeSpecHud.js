import { clampSequenceFps, pingPongCycleLength } from './motionSequencer.js'

export const KAKAO_MAX_KB = 2048
export const KAKAO_TIME_MIN = 0.8
export const KAKAO_TIME_MAX = 2.4
const SPEC_SIZE = 360

export function estimateStoreSpec({
  frameCount = 0,
  fps = 8,
  speed = 1,
  pingPong = false,
} = {}) {
  const source = Math.max(0, Math.round(Number(frameCount) || 0))
  const playFrames = pingPong ? pingPongCycleLength(source) : source
  const rate = Math.max(1, clampSequenceFps(fps) * (Number(speed) || 1))
  const seconds = playFrames > 0 ? playFrames / rate : 0
  const kb = playFrames > 0
    ? Math.round((SPEC_SIZE * SPEC_SIZE * playFrames * 0.18) / 1024)
    : 0
  const okKb = kb > 0 && kb <= KAKAO_MAX_KB
  const okTime = seconds >= KAKAO_TIME_MIN && seconds <= KAKAO_TIME_MAX
  const pass = playFrames > 0 && okKb && okTime
  return {
    frames: playFrames,
    source,
    fps: Math.round(rate),
    seconds: Math.round(seconds * 10) / 10,
    kb,
    okKb,
    okTime,
    pass,
    badge: pass ? '규격 OK' : '규격 주의',
  }
}
