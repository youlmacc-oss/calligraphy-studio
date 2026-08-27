import { DIAG_STEPS, getDiagnosticFeatures } from './featureRegistry.js'
import { enrichDiagnosticWithPipeline } from './diagnosticChecks.js'
import { saveFavoriteFonts, loadFavoriteFonts } from './fontFavorites.js'
import { inspectStudioFonts, preloadStudioFonts } from './fontPreload.js'

export { DIAG_STEPS }

const PROBE_KEY = 'styler-diag-probe-v1'
const STEP_GAP_MS = 120
const STEP_TIMEOUT_MS = 4000

function stamp() {
  const now = new Date()
  const pad = (value, size = 2) => String(value).padStart(size, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
}

function yieldUi(ms = STEP_GAP_MS) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function withTimeout(work, ms, fallback) {
  let timer
  const timeout = new Promise((resolve) => {
    timer = window.setTimeout(() => resolve(fallback), ms)
  })
  const job = Promise.resolve()
    .then(work)
    .catch((error) => ({ status: 'error', detail: error?.message || '예외' }))
  return Promise.race([job, timeout]).finally(() => {
    window.clearTimeout(timer)
  })
}

export async function runLiveDiagnostics({
  promptPack,
  apiKeys,
  studio,
  history,
  favoriteFonts,
  onLog,
  onStep,
  signal,
} = {}) {
  const steps = getDiagnosticFeatures()
  const ctx = { promptPack, apiKeys, studio, history, favoriteFonts }
  const log = (message, level = 'INFO') => {
    onLog?.({ at: stamp(), level, message })
  }
  log(`Live Diagnostic HUD online. ${steps.length}-step registry scan started.`)
  const checks = []
  for (let index = 0; index < steps.length; index += 1) {
    if (signal?.aborted) break
    const step = steps[index]
    const cursor = index + 1
    onStep?.({ id: step.id, phase: 'run', index: cursor, total: steps.length })
    log(`[${cursor}/${steps.length}] ${step.name}...`)
    await yieldUi(STEP_GAP_MS)
    if (signal?.aborted) break
    const started = performance.now()
    let result
    try {
      result = await withTimeout(
        () => step.diagnosticFunction(ctx, log),
        STEP_TIMEOUT_MS,
        { status: 'warn', detail: `IDLE · ${STEP_TIMEOUT_MS}ms 내 응답이 없어 다음 단계로 넘어갑니다.` },
      )
    } catch (error) {
      result = { status: 'error', detail: error.message || '예외' }
    }
    if (!result || !result.status) {
      result = { status: 'warn', detail: 'IDLE · 진단 결과가 비어 다음 단계로 진행합니다.' }
    }
    result = enrichDiagnosticWithPipeline(step.id, result)
    const ms = Math.max(1, Math.round((performance.now() - started) * 10) / 10)
    const item = {
      id: step.id,
      title: step.name,
      hint: step.description,
      status: result.status,
      detail: result.detail,
      ms,
    }
    checks.push(item)
    onStep?.({ id: step.id, phase: 'done', item, index: cursor, total: steps.length })
    log(`${step.name} ${result.status.toUpperCase()} in ${ms}ms — ${result.detail}`, result.status === 'error' ? 'ERROR' : result.status === 'warn' ? 'WARN' : 'INFO')
    await yieldUi(STEP_GAP_MS)
  }
  const score = {
    ok: checks.filter((item) => item.status === 'ok').length,
    warn: checks.filter((item) => item.status === 'warn').length,
    error: checks.filter((item) => item.status === 'error').length,
  }
  const avg = checks.length
    ? Math.round((checks.reduce((sum, item) => sum + item.ms, 0) / checks.length) * 10) / 10
    : 0
  const health = Math.round(((score.ok + score.warn * 0.6) / Math.max(1, checks.length)) * 100)
  const aborted = Boolean(signal?.aborted)
  if (aborted) {
    log(`Scan aborted at ${checks.length}/${steps.length}.`, 'WARN')
  } else {
    log(`Scan complete. [${steps.length}/${steps.length}] 100% · Health ${health}% · avg ${avg}ms`)
  }
  return { checks, score, avg, health, ranAt: Date.now(), total: steps.length, aborted }
}

export async function optimizeStudio({ onRevoke, onLog } = {}) {
  onLog?.({ at: stamp(), level: 'INFO', message: 'Optimizing font cache, favorites store, and temp keys...' })
  await preloadStudioFonts()
  await inspectStudioFonts()
  saveFavoriteFonts(loadFavoriteFonts())
  try {
    localStorage.removeItem(PROBE_KEY)
  } catch {
    /* ignore */
  }
  onRevoke?.()
  onLog?.({ at: stamp(), level: 'INFO', message: 'Optimize done. Project data and favorites kept.' })
  return '폰트 재캐시, 즐겨찾기 정규화, 진단 임시키 삭제를 마쳤습니다. 작업 내용과 별표 목록은 그대로입니다.'
}
