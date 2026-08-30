import { useRef, useState } from 'react'
import { checkTransparencyHealth, purgeFakeBackground } from '../lib/fakeBackgroundPurge.js'

export function useTransparencyGate() {
  const [open, setOpen] = useState(false)
  const jobRef = useRef(null)

  const runOrAsk = async (canvases, proceed) => {
    const list = (Array.isArray(canvases) ? canvases : [canvases]).filter((item) => item?.width)
    const blocked = list.some((item) => !checkTransparencyHealth(item).isHealthy)
    if (!blocked) {
      await proceed({ purged: false, canvases: list })
      return
    }
    jobRef.current = { list, proceed }
    setOpen(true)
  }

  const confirmPurge = async () => {
    const job = jobRef.current
    setOpen(false)
    if (!job) return
    job.list.forEach((item) => purgeFakeBackground(item))
    await job.proceed({ purged: true, canvases: job.list })
    jobRef.current = null
  }

  const confirmAsIs = async () => {
    const job = jobRef.current
    setOpen(false)
    if (!job) return
    await job.proceed({ purged: false, canvases: job.list })
    jobRef.current = null
  }

  const cancel = () => {
    jobRef.current = null
    setOpen(false)
  }

  return { open, runOrAsk, confirmPurge, confirmAsIs, cancel }
}
