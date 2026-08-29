import { useState } from 'react'
import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import EncodeProgressModal from './EncodeProgressModal.jsx'
import { zipMotionClips, isPermanentClip } from '../../utils/encoder/BatchExportEngine.js'
import { useMotionStudio } from './motionStudioContext.jsx'

export default function MotionZipToolbarButton() {
  const studio = useMotionStudio()
  const clips = (studio?.clips || []).filter(isPermanentClip)
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('run')
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const ready = clips.length > 0 && state !== 'run'

  const runZip = async () => {
    if (!clips.length) return
    setOpen(true)
    setState('run')
    setPercent(0)
    setError('')
    setMessage('ZIP 압축 중... 0%')
    try {
      await zipMotionClips(clips, {
        fileName: 'motion-clips.zip',
        onProgress: (info) => {
          setPercent(info.percent || 0)
          setMessage(info.message || 'ZIP 압축 중...')
        },
      })
      setPercent(100)
      setState('done')
      setMessage('ZIP 압축 중... 100%')
    } catch (err) {
      setState('error')
      setError(err?.message || 'ZIP 압축에 실패했습니다')
    }
  }

  return (
    <>
      <button
        type="button"
        className={clsx('mgs-icon-btn', clips.length && 'is-on')}
        disabled={!clips.length}
        data-batch-zip="1"
        onClick={runZip}
        {...magnify('전체 ZIP', '모션 전체 ZIP 일괄 다운로드. 보관 클립을 motion-01.gif 순으로 묶습니다')}
      >
        📦 전체 ZIP
      </button>
      <EncodeProgressModal
        open={open}
        state={state}
        message={message}
        percent={percent}
        previewUrl=""
        error={error}
        onDownload={ready ? runZip : undefined}
        onPreview={undefined}
        onClose={() => {
          if (state === 'run') return
          setOpen(false)
        }}
      />
    </>
  )
}
