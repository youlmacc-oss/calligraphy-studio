import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Rocket, Sparkles, X } from 'lucide-react'
import { magnify } from './MenuMagnifierHUD.jsx'
import { DIAG_STEPS, optimizeStudio, runLiveDiagnostics } from '../lib/selfDiagnostic.js'

function idleCards() {
  return DIAG_STEPS.map((step) => ({
    ...step,
    phase: 'idle',
    status: null,
    detail: '대기 중',
    ms: null,
  }))
}

function verdictLabel(item) {
  if (item.phase === 'run') return 'SCAN'
  if (item.status === 'ok') return 'PASS ✅'
  if (item.status === 'warn') return 'WARN'
  if (item.status === 'error') return 'FAIL'
  return 'IDLE'
}

export default function SelfDiagnosticModal({
  open,
  onClose,
  promptPack,
  apiKeys,
  onRevoke,
  studio,
  history,
  favoriteFonts,
}) {
  const [busy, setBusy] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [cards, setCards] = useState(idleCards)
  const [logs, setLogs] = useState([])
  const [stepIndex, setStepIndex] = useState(0)
  const [report, setReport] = useState(null)
  const logBoxRef = useRef(null)
  const abortRef = useRef(null)
  const total = DIAG_STEPS.length

  const pushLog = (entry) => {
    setLogs((prev) => [...prev.slice(-80), entry])
  }

  const scan = async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    setReport(null)
    setStepIndex(0)
    setCards(idleCards())
    setLogs([])
    try {
      const next = await runLiveDiagnostics({
        promptPack,
        apiKeys,
        studio,
        history,
        favoriteFonts,
        signal: ac.signal,
        onLog: pushLog,
        onStep: ({ id, phase, item, index }) => {
          setStepIndex(index)
          setCards((prev) => prev.map((card) => {
            if (card.id !== id) return card
            if (phase === 'run') return { ...card, phase: 'run', status: null, detail: '검사 중…' }
            return { ...card, phase: 'done', ...item }
          }))
        },
      })
      if (!ac.signal.aborted) setReport(next)
    } catch (error) {
      pushLog({ at: '--', level: 'ERROR', message: error.message || '진단 실패' })
    } finally {
      setBusy(false)
      setCards((prev) => prev.map((card) => (
        card.phase === 'run' ? { ...card, phase: 'idle', detail: '대기 중' } : card
      )))
    }
  }

  useEffect(() => {
    if (open) return undefined
    abortRef.current?.abort()
    return undefined
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight })
  }, [logs])

  if (!open) return null

  const doneCount = cards.filter((card) => card.phase === 'done').length
  const running = cards.some((card) => card.phase === 'run')
  const finished = Boolean(report) && report.checks?.length === total
  const progress = finished ? 100 : Math.min(99, Math.round(((doneCount + (running ? 0.45 : 0)) / Math.max(1, total)) * 100))
  const current = finished ? total : (busy ? Math.max(stepIndex, doneCount, running ? 1 : 0) : doneCount)

  return (
    <div className="studio-modal-root" role="dialog" aria-modal="true" aria-labelledby="diag-title">
      <div className="studio-modal-backdrop" onClick={onClose} />
      <div className="studio-modal-card diag-hud">
        <header className="studio-modal-head">
          <div>
            <p className="studio-modal-kicker">Live Diagnostic HUD · HUD1~{total} 파이프라인 동기화</p>
            <h2 id="diag-title">🩺 {total}단계 시스템 정밀 자가진단</h2>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기" {...magnify('닫기', '모니터링 창을 닫습니다')}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="diag-hud-actions">
          <button type="button" className="diag-run" disabled={busy} onClick={scan} {...magnify('정밀 진단 시작', `${total}단계를 레지스트리 순서로 실시간 스캔합니다`)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            🚀 전체 정밀 진단 시작
          </button>
          <button
            type="button"
            className="diag-optimize"
            disabled={busy || optimizing}
            onClick={async () => {
              setOptimizing(true)
              try {
                const message = await optimizeStudio({ onRevoke, onLog: pushLog })
                pushLog({ at: '--', level: 'INFO', message })
              } finally {
                setOptimizing(false)
              }
            }}
            {...magnify('자동 최적화', '폰트 캐시와 즐겨찾기 저장소를 정리합니다. 작업본은 유지됩니다')}
          >
            {optimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            ⚡ 시스템 자동 최적화 & 캐시 재설정
          </button>
        </div>

        <div className="diag-gauge">
          <div className="diag-gauge-meta">
            <span>진행 단계: [ {current} / {total} ]{finished ? ' 100% 완료' : ''}</span>
            <strong>{finished ? '100% 완료' : `${progress}%`}</strong>
          </div>
          <div className="diag-bar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
          {report ? (
            <p className="diag-health">
              시스템 건강 지수 배지 · 정상 {report.score.ok} / 주의 {report.score.warn} / 오류 {report.score.error}
              {' '}· 종합 건강 지수: {report.health}% · 평균 지연시간 {report.avg}ms
              {finished ? ' · 전체 단계 완료' : ''}
            </p>
          ) : (
            <p className="diag-health is-idle">레지스트리 {total}항목이 대기 중입니다. 시작하면 카드가 PASS/FAIL 애니메이션으로 바뀌고 콘솔에 로그가 흐릅니다.</p>
          )}
        </div>

        <div className="diag-grid diag-grid-2">
          {cards.map((item, index) => (
            <article
              key={item.id}
              className={clsx(
                'diag-item',
                item.phase === 'idle' && 'is-wait',
                item.phase === 'run' && 'is-run',
                item.status === 'ok' && 'is-ok is-pass',
                item.status === 'warn' && 'is-warn',
                item.status === 'error' && 'is-error is-fail',
              )}
            >
              <div className="diag-item-top">
                <span className="diag-mark">
                  {item.phase === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {item.phase === 'idle' ? `${index + 1}` : null}
                  {item.status === 'ok' ? '✅' : item.status === 'warn' ? '⚠️' : item.status === 'error' ? '❌' : null}
                </span>
                <h3>{item.title}</h3>
                <span className={clsx('diag-verdict', item.status && `is-${item.status}`)}>{verdictLabel(item)}</span>
                <span className="diag-ms">{item.ms != null ? `${item.ms}ms` : item.phase === 'run' ? '…' : '—'}</span>
              </div>
              <p>{item.detail || item.hint}</p>
            </article>
          ))}
        </div>

        <section className="diag-terminal" aria-live="polite">
          <p className="diag-terminal-head">Live Log Box</p>
          <pre ref={logBoxRef} className="diag-terminal-body">
            {logs.length
              ? logs.map((line) => `[${line.at}] [${line.level}] ${line.message}`).join('\n')
              : `[READY] HUD standby. Press 🚀 to start the ${total}-step registry scan.`}
          </pre>
        </section>
      </div>
    </div>
  )
}
