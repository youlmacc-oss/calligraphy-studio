import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createMotionClip, createSequenceClip, isPermanentClip } from '../../utils/encoder/BatchExportEngine.js'

export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2]

const MotionStudioContext = createContext(null)

function revokeClipUrl(clip) {
  if (clip?.url && !clip.sharedUrl && String(clip.url).startsWith('blob:')) {
    URL.revokeObjectURL(clip.url)
  }
}

export function useMotionStudio() {
  return useContext(MotionStudioContext)
}

export function MotionStudioProvider({ children }) {
  const [clips, setClips] = useState([])
  const [speed, setSpeed] = useState(1)
  const [restore, setRestore] = useState(null)
  const [fallbackSeq, setFallbackSeq] = useState(0)
  const activeClipIdRef = useRef('')

  const addPackedClip = useCallback((packed, meta) => {
    setClips((prev) => {
      const clip = createMotionClip(packed, meta, prev.length)
      return [...prev, { ...clip, isPermanent: false }]
    })
  }, [])

  const saveSequenceClip = useCallback((meta) => {
    let saved = null
    setClips((prev) => {
      const slot = prev.filter(isPermanentClip).length
      saved = createSequenceClip(meta, slot)
      return [...prev, saved]
    })
    return saved
  }, [])

  const purgeTempClips = useCallback(() => {
    setClips((prev) => {
      prev.forEach((clip) => {
        if (!isPermanentClip(clip)) revokeClipUrl(clip)
      })
      return prev.filter(isPermanentClip)
    })
  }, [])

  const removeClip = useCallback((id) => {
    if (!id) return
    setClips((prev) => {
      const gone = prev.find((item) => item.id === id)
      revokeClipUrl(gone)
      return prev.filter((item) => item.id !== id)
    })
    setRestore((cur) => (cur?.id === id ? null : cur))
    if (activeClipIdRef.current === id) {
      activeClipIdRef.current = ''
      setFallbackSeq((value) => value + 1)
    }
  }, [])

  const clearClips = useCallback(() => {
    setClips((prev) => {
      prev.forEach(revokeClipUrl)
      return []
    })
    activeClipIdRef.current = ''
    setRestore(null)
    setFallbackSeq((value) => value + 1)
  }, [])

  const applyClip = useCallback((clip) => {
    if (!clip) return
    activeClipIdRef.current = clip.id || ''
    setRestore({ ...clip, token: Date.now() })
  }, [])

  const clearRestore = useCallback(() => setRestore(null), [])

  const value = useMemo(() => ({
    clips,
    speed,
    setSpeed,
    restore,
    fallbackSeq,
    addPackedClip,
    saveSequenceClip,
    removeClip,
    clearClips,
    purgeTempClips,
    applyClip,
    clearRestore,
  }), [clips, speed, restore, fallbackSeq, addPackedClip, saveSequenceClip, removeClip, clearClips, purgeTempClips, applyClip, clearRestore])

  return (
    <MotionStudioContext.Provider value={value}>
      {children}
    </MotionStudioContext.Provider>
  )
}
