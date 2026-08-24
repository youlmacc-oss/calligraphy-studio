import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  CheckCircle2,
  Copy,
  Download,
  Hourglass,
  Loader2,
  Sparkles,
  Timer,
  X,
} from 'lucide-react'
import { useProgressTimer } from '../hooks/useProgressTimer'
import { formatClock, getStageMessage } from '../lib/formatTime'
import { ESTIMATED_DURATION_MS } from '../presets'

export default function ProgressModal({
  open,
  sessionId,
  preset,
  isReady,
  estimatedMs = ESTIMATED_DURATION_MS,
  onClose,
  onDownloadMask,
  onDownloadPng,
  promptText = '',
}) {
  const [copied, setCopied] = useState(false)
  const { elapsedMs, remainingMs, progress, isComplete } = useProgressTimer({
    active: open,
    sessionId,
    isReady,
    estimatedMs,
  })

  useEffect(() => {
    setCopied(false)
  }, [sessionId])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape' && isComplete) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isComplete, onClose])

  if (!open) return null

  const percent = isComplete ? 100 : Math.min(99, Math.floor(progress))
  const barWidth = isComplete ? 100 : Math.min(99, progress)
  const stage = getStageMessage(isComplete ? 100 : progress)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xl"
        onClick={isComplete ? onClose : undefined}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#101018]/85 shadow-[0_0_80px_rgba(34,211,238,0.12),0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
                  isComplete
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                    : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-cyan-300/80 uppercase">
                  {preset?.themeLabel ?? '26종 프리셋'}
                </p>
                <h2
                  id="progress-modal-title"
                  className="text-lg font-semibold tracking-tight text-white"
                >
                  {preset?.name ?? '프리셋 렌더링'}
                </h2>
                <p className="text-sm text-zinc-400">{preset?.subtitle}</p>
              </div>
            </div>
            {isComplete && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-7 flex items-center gap-4">
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400"
                style={{
                  width: `${barWidth}%`,
                  boxShadow:
                    '0 0 16px rgba(34,211,238,0.65), 0 0 28px rgba(167,139,250,0.35)',
                  transition: 'width 100ms linear',
                }}
              >
                {!isComplete && (
                  <span className="progress-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                )}
              </div>
            </div>
            <span className="w-14 text-right font-mono text-lg font-semibold tabular-nums text-white">
              {percent}%
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-zinc-400">
                <Timer className="h-3.5 w-3.5 text-cyan-300" />
                진행 시간
              </div>
              <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-white">
                {formatClock(elapsedMs)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-zinc-400">
                <Hourglass className="h-3.5 w-3.5 text-violet-300" />
                예상 남은 시간
              </div>
              <p className="mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-white">
                약 {formatClock(isComplete ? 0 : remainingMs)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            {isComplete ? (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            ) : (
              <span className="glow-pulse mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
            )}
            <p className="text-sm leading-6 text-zinc-300">{stage}</p>
          </div>

          {isComplete && (
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={onDownloadMask}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                🎭 1024x1024 AI 흑백 마스크 다운로드
              </button>
              <button
                type="button"
                onClick={onDownloadPng}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:brightness-110"
              >
                <Download className="h-4 w-4" />
                🖼️ 투명 PNG 다운로드
              </button>
              {promptText ? (
                <div className="prompt-box">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium tracking-wide text-zinc-400">Grok / Flux 프롬프트</p>
                    <button
                      type="button"
                      className="prompt-copy"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(promptText)
                          setCopied(true)
                          window.setTimeout(() => setCopied(false), 1600)
                        } catch {
                          setCopied(false)
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <pre className="prompt-pre">{promptText}</pre>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
