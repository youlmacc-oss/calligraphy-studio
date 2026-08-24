import { useEffect, useState } from 'react'
import { Download, Loader2, Sparkles, X } from 'lucide-react'
import { useProgressTimer } from '../hooks/useProgressTimer'
import { formatClock } from '../lib/formatTime'
import { ESTIMATED_DURATION_MS } from '../presets.js'

export default function AiGenerateModal({
  open,
  keys,
  onChangeKeys,
  onClose,
  onGenerate,
  busy,
  isReady,
  sessionId,
  resultUrl,
  fallbackUsed,
  onDownloadResult,
  promptPreview,
}) {
  const { elapsedMs, remainingMs, progress, isComplete } = useProgressTimer({
    active: open && (busy || isReady),
    sessionId,
    isReady,
    estimatedMs: ESTIMATED_DURATION_MS,
  })

  const [localKeys, setLocalKeys] = useState(keys)

  useEffect(() => {
    if (open) setLocalKeys(keys)
  }, [open, keys])

  if (!open) return null

  const percent = isComplete ? 100 : Math.min(99, Math.floor(progress))

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={busy ? undefined : onClose} />
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-auto rounded-3xl border border-white/10 bg-[#101018]/92 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-cyan-300/80 uppercase">AI Generation Hub</p>
            <h2 className="text-lg font-semibold text-white">API 설정 & 실제 렌더링</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              키는 이 브라우저에만 난독화되어 저장됩니다. 흑백 마스크와 최적화 프롬프트를 함께 전송합니다.
            </p>
          </div>
          <button type="button" className="rounded-xl p-2 text-zinc-400 hover:bg-white/5" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-xs text-zinc-400">
          API 엔드포인트
          <select
            className="ctrl-select mt-1.5"
            value={localKeys.provider}
            onChange={(event) => {
              const next = { ...localKeys, provider: event.target.value }
              setLocalKeys(next)
              onChangeKeys(next)
            }}
          >
            <option value="local">로컬 시뮬레이션 (키 없음 / 테스트)</option>
            <option value="fal">Fal.ai (FLUX.1 ControlNet)</option>
            <option value="replicate">Replicate (SDXL)</option>
            <option value="grok">Grok / Custom API</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </label>

        <label className="mt-3 block text-xs text-zinc-400">
          Fal.ai Key
          <input type="password" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={localKeys.falKey} onChange={(event) => setLocalKeys((prev) => ({ ...prev, falKey: event.target.value }))} />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Replicate Token
          <input type="password" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={localKeys.replicateKey} onChange={(event) => setLocalKeys((prev) => ({ ...prev, replicateKey: event.target.value }))} />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Grok / xAI Key
          <input type="password" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={localKeys.grokKey} onChange={(event) => setLocalKeys((prev) => ({ ...prev, grokKey: event.target.value }))} />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Custom Endpoint URL
          <input type="url" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" value={localKeys.customUrl} onChange={(event) => setLocalKeys((prev) => ({ ...prev, customUrl: event.target.value }))} placeholder="https://..." />
        </label>

        <p className="mt-3 max-h-16 overflow-auto text-[10px] leading-4 text-zinc-500">{promptPreview}</p>

        {(busy || isReady) && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{busy ? '생성 중' : '완료'}</span>
              <span className="font-mono text-white">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" style={{ width: `${isComplete ? 100 : Math.min(99, progress)}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
              <p>경과 {formatClock(elapsedMs)}</p>
              <p>남은 약 {formatClock(isComplete ? 0 : remainingMs)}</p>
            </div>
          </div>
        )}

        {resultUrl && (
          <div className="ai-result mt-4">
            <img src={resultUrl} alt="AI 생성 결과" className="ai-result-img" />
            {fallbackUsed ? <p className="mt-2 text-[10px] text-amber-200/80">API 키 없음 또는 원격 실패 → 로컬 고화질 시뮬레이션 결과입니다.</p> : null}
            <button type="button" className="export-btn mt-3 w-full" onClick={onDownloadResult}>
              <Download className="h-3.5 w-3.5" /> 고화질 완성본 다운로드
            </button>
          </div>
        )}

        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-70"
          disabled={busy}
          onClick={() => {
            onChangeKeys(localKeys)
            onGenerate(localKeys)
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          ✨ 원클릭 AI 변환 시작
        </button>
      </div>
    </div>
  )
}
