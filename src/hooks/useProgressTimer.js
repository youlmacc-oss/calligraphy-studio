import { useEffect, useRef, useState } from 'react'
import { ESTIMATED_DURATION_MS } from '../presets'

/**
 * Real-time conversion timer.
 * Elapsed is measured from Date.now() every 100ms.
 * Remaining is derived from estimated duration × leftover progress.
 * On completion the interval is cleared and elapsed is frozen.
 */
export function useProgressTimer({
  active,
  sessionId,
  isReady,
  estimatedMs = ESTIMATED_DURATION_MS,
}) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const isReadyRef = useRef(isReady)

  useEffect(() => {
    isReadyRef.current = isReady
  }, [isReady])

  useEffect(() => {
    if (!active) return undefined

    const start = Date.now()
    let finished = false

    const intervalId = setInterval(() => {
      if (finished) return

      const elapsed = Date.now() - start
      const raw = (elapsed / estimatedMs) * 100

      if (raw >= 100 && isReadyRef.current) {
        finished = true
        clearInterval(intervalId)
        setElapsedMs(elapsed)
        setProgress(100)
        setIsComplete(true)
        return
      }

      setElapsedMs(elapsed)
      setProgress(Math.min(99, raw))
    }, 100)

    return () => {
      finished = true
      clearInterval(intervalId)
    }
  }, [active, sessionId, estimatedMs])

  const remainingMs = Math.max(0, estimatedMs * (1 - progress / 100))

  return { elapsedMs, remainingMs, progress, isComplete }
}
