import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export default function ApiSettingsModal({ open, initialKeys, onClose, onSave }) {
  const [keys, setKeys] = useState(initialKeys)

  useEffect(() => {
    if (open) setKeys(initialKeys)
  }, [open, initialKeys])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#101018]/92 p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.16em] text-cyan-300/80 uppercase">AI Engine</p>
            <h2 className="text-lg font-semibold text-white">API 키 설정</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              키는 이 브라우저 localStorage에만 저장됩니다. 서버로 전송되지 않습니다.
            </p>
          </div>
          <button type="button" className="rounded-xl p-2 text-zinc-400 hover:bg-white/5" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block text-xs text-zinc-400">
          공급자
          <select
            className="ctrl-select mt-1.5"
            value={keys.provider}
            onChange={(event) => setKeys((prev) => ({ ...prev, provider: event.target.value }))}
          >
            <option value="local">로컬 캔버스 렌더 (기본)</option>
            <option value="fal">Fal.ai Flux</option>
            <option value="replicate">Replicate</option>
            <option value="grok">Grok / xAI</option>
          </select>
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Fal.ai Key
          <input
            type="password"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            value={keys.falKey}
            onChange={(event) => setKeys((prev) => ({ ...prev, falKey: event.target.value }))}
          />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Replicate Token
          <input
            type="password"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            value={keys.replicateKey}
            onChange={(event) => setKeys((prev) => ({ ...prev, replicateKey: event.target.value }))}
          />
        </label>
        <label className="mt-3 block text-xs text-zinc-400">
          Grok / xAI Key
          <input
            type="password"
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            value={keys.grokKey}
            onChange={(event) => setKeys((prev) => ({ ...prev, grokKey: event.target.value }))}
          />
        </label>
        <button
          type="button"
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 py-3 text-sm font-semibold text-zinc-950"
          onClick={() => {
            onSave(keys)
            onClose()
          }}
        >
          로컬에 저장
        </button>
      </div>
    </div>
  )
}
