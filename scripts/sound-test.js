import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'play-headset-sound.ps1')
const PRIMARY = join(ROOT, 'scripts', 'notify-primary.wav')
const REMINDER = join(ROOT, 'scripts', 'notify-reminder.wav')

async function playType(type, label, wav) {
  console.log(`[sound-test] ${label}`)
  console.log(`  file exists: ${existsSync(wav)}`)
  try {
    const { stdout, stderr } = await execFileAsync('powershell', [
      '-STA',
      '-NoProfile',
      '-File',
      SCRIPT,
      '-Type',
      type,
    ])
    console.log(`  stdout: ${String(stdout || '').trim() || '(empty)'}`)
    if (stderr) console.log(`  stderr: ${String(stderr).trim()}`)
  } catch (error) {
    console.log(`  failed: ${error.message}`)
    if (error.stdout) console.log(`  stdout: ${String(error.stdout).trim()}`)
    if (error.stderr) console.log(`  stderr: ${String(error.stderr).trim()}`)
  }
}

console.log('[sound-test] 띠리릭 알림음(고음량, 2초)을 재생합니다.')
await playType('primary', '1차 완료음 (띠리릭)', PRIMARY)
await new Promise((resolve) => setTimeout(resolve, 400))
await playType('reminder', '2차 리마인드 (띠리릭)', REMINDER)
console.log('[sound-test] done')
