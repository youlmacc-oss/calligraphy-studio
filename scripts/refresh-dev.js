import { execFile, spawn } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5173
const STUDIO_URL = `http://localhost:${PORT}/calligraphy-studio/`
const BROWSER_LOCK = join(tmpdir(), 'calligraphy-studio-default-browser.lock')

const CACHE_DIRS = [
  join(ROOT, 'node_modules', '.vite'),
  join(ROOT, '.next', 'cache'),
  join(ROOT, 'node_modules', '.cache'),
]

export function clearBuildCaches() {
  console.log('🧹 [캐시 삭제] 빌드 캐시를 지웁니다.')
  for (const dir of CACHE_DIRS) {
    try {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true })
        console.log(`🧹 [캐시 삭제] ${dir}`)
      } else {
        console.log(`🧹 [캐시 없음] ${dir}`)
      }
    } catch (error) {
      console.log(`🧹 [캐시 잠김] ${dir} (${error.message})`)
    }
  }
}

async function killPort(port = PORT) {
  if (process.platform !== 'win32') {
    try {
      await execFileAsync('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill -9`])
    } catch {
      /* ignore */
    }
    return
  }
  try {
    const { stdout } = await execFileAsync('netstat', ['-ano'])
    const pids = new Set()
    for (const line of String(stdout).split(/\r?\n/)) {
      if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue
      const pid = line.trim().split(/\s+/).pop()
      if (pid && pid !== '0') pids.add(pid)
    }
    for (const pid of pids) {
      console.log(`🔄 [프로그램 중지] port ${port} pid ${pid}`)
      try {
        await execFileAsync('taskkill', ['/PID', pid, '/F'])
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* ignore */
  }
}

async function waitForStudio(timeoutMs = 40000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(STUDIO_URL, { cache: 'no-store' })
      if (res.ok || res.status === 304) return
    } catch {
      /* not ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Vite did not become ready at ${STUDIO_URL}`)
}

function startVite() {
  const viteJs = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [viteJs, '--force', '--port', String(PORT)], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  console.log(`🔄 [프로그램 재실행] vite --force --port ${PORT} (pid ${child.pid || '?'})`)
}

async function openStudio() {
  const url = STUDIO_URL
  if (existsSync(BROWSER_LOCK)) {
    console.log(`🌐 [기본 브라우저 연결] 기존 창/탭 재사용 ${url}`)
    return
  }
  try {
    if (process.platform === 'win32') {
      try {
        await execFileAsync('powershell', ['-NoProfile', '-Command', `Start-Process '${url}'`])
      } catch {
        await execFileAsync('cmd', ['/c', 'start', '', url])
      }
    } else if (process.platform === 'darwin') {
      await execFileAsync('open', [url])
    } else {
      await execFileAsync('xdg-open', [url])
    }
    writeFileSync(BROWSER_LOCK, url)
    console.log(`🌐 [기본 브라우저 연결] ${url}`)
  } catch (error) {
    console.log(`🌐 [브라우저 열기 실패] ${error.message}`)
  }
}

export async function refreshDev({ openBrowser = true } = {}) {
  console.log('🔄 [재실행 파이프라인] 캐시 삭제 → Vite --force 재기동')
  await killPort(PORT)
  await new Promise((resolve) => setTimeout(resolve, 600))
  clearBuildCaches()
  startVite()
  await waitForStudio()
  console.log(`🔄 [프로그램 준비] ${STUDIO_URL}`)
  if (openBrowser) await openStudio()
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  refreshDev().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
