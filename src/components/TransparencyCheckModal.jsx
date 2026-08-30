import { createPortal } from 'react-dom'

export default function TransparencyCheckModal({
  open = false,
  onPurgeAndExport,
  onExportAsIs,
  onCancel,
}) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    (
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md"
        data-alpha-gate="1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alpha-gate-title"
        style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.85)' }}
      >
        <div className="flex max-w-[520px] flex-col gap-3 rounded-2xl border border-amber-300/40 bg-slate-950 p-4">
          <h3 id="alpha-gate-title" className="text-base font-bold text-amber-100">⚠️ [배경 투명화 점검]</h3>
          <p className="mgs-hint">
            이미지에 불투명 배경(또는 가짜 격자)이 남아있는 것으로 감지되었습니다. 그대로 진행하시겠습니까?
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="mgs-tab is-on" data-alpha-purge-export="1" onClick={() => onPurgeAndExport?.()}>
              🧹 자동 투명화 후 내보내기
            </button>
            <button type="button" className="mgs-tab" data-alpha-export-as-is="1" onClick={() => onExportAsIs?.()}>
              그대로 내보내기
            </button>
            <button type="button" className="mgs-tab" data-alpha-cancel="1" onClick={() => onCancel?.()}>
              취소
            </button>
          </div>
        </div>
      </div>
    ),
    document.documentElement,
  )
}
