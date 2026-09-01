import { execFile } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'
import { promisify } from 'node:util'
import { createCanvas } from 'canvas'
import { chromium } from 'playwright'
import { refreshDev } from './refresh-dev.js'

const execFileAsync = promisify(execFile)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

async function playBeep(type = 'primary') {
  try {
    if (process.platform === 'win32') {
      await execFileAsync('powershell', [
        '-STA',
        '-NoProfile',
        '-File',
        join(ROOT, 'scripts', 'play-headset-sound.ps1'),
        '-Type',
        type === 'reminder' ? 'reminder' : 'primary',
      ])
      return
    }
    if (process.platform === 'darwin') {
      const times = type === 'reminder' ? 2 : 3
      for (let i = 0; i < times; i += 1) {
        await execFileAsync('afplay', ['/System/Library/Sounds/Glass.aiff'])
      }
      return
    }
    process.stdout.write(type === 'reminder' ? '\x07\x07' : '\x07\x07\x07')
  } catch {
    process.stdout.write(type === 'reminder' ? '\x07\x07' : '\x07\x07\x07')
  }
}

async function waitForApprovalWithReminder() {
  await playBeep('primary')
  console.log('\n🎧 [알림음이 헤드셋으로 전송되었습니다]')
  console.log('🎧 [BEEP!] 캐시 삭제, 자동 재실행 및 화면 캡처(public/test-result.png)가 완료되었습니다.')
  console.log('[1: 승인 및 종료] / [2: 추가 수정 필요 (피드백 입력)] 중 선택해 주세요: ')

  let answered = false
  let reminderTimer = 0
  const reminderDone = new Promise((resolve) => {
    reminderTimer = setTimeout(async () => {
      if (!answered) {
        await playBeep('reminder')
        if (!answered) {
          process.stdout.write('\n🔔 [5초 경과 알림] 확인을 기다리고 있습니다. 번호를 입력해 주세요: ')
        }
      }
      resolve()
    }, 5000)
  })

  if (!process.stdin.isTTY) {
    await reminderDone
    return ''
  }

  const answer = await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question('', (value) => {
      answered = true
      clearTimeout(reminderTimer)
      rl.close()
      resolve(String(value || '').trim())
    })
  })
  return answer
}

async function encodeUntilDone(page, fmt) {
  await page.waitForSelector(`[data-encode-fmt="${fmt}"]:not([disabled])`, { timeout: 8000 })
  await page.locator(`[data-encode-fmt="${fmt}"]`).scrollIntoViewIfNeeded()
  const download = page.waitForEvent('download', { timeout: 180000 }).catch(() => null)
  await page.locator(`[data-encode-fmt="${fmt}"]`).click()
  await page.waitForSelector('[data-encode-progress="1"], [data-alpha-gate="1"]', { timeout: 15000 })
  if (await page.locator('[data-alpha-gate="1"]').count()) {
    await page.locator('[data-alpha-export-as-is="1"]').click()
    await page.waitForSelector('[data-encode-progress="1"]', { timeout: 15000 })
  }
  const outcome = await page.waitForFunction(() => {
    const el = document.querySelector('[data-encode-progress="1"]')
    const state = el?.getAttribute('data-encode-state')
    if (state === 'error') return 'error'
    if (state === 'done' || Number(el?.getAttribute('data-encode-pct') || 0) >= 100) return 'done'
    if (/내보내기 완료/.test(document.querySelector('[data-clip-toast="1"]')?.textContent || '')) return 'done'
    if (/paintMotionFrame is not defined/i.test(el?.textContent || '')) return 'error'
    return null
  }, null, { timeout: 180000 })
  const state = await outcome.jsonValue()
  if (state !== 'done') {
    const msg = await page.locator('[data-encode-progress="1"] .ms-enc-msg').textContent().catch(() => '')
    throw new Error(`${fmt} encode did not finish: ${state || 'unknown'} ${msg || ''}`)
  }
  await download
  await page.waitForFunction(() => !document.querySelector('[data-encode-progress="1"]'), null, { timeout: 4000 }).catch(() => {})
}

const SHEET_PATH = join(ROOT, 'public', 'sample-emoticon-sheet.png')
const GRID_SHOT = join(ROOT, 'public', 'test-result-grid.png')
const SPLIT_SHOT = join(ROOT, 'public', 'test-result.png')
const STUDIO_SHOT = join(ROOT, 'public', 'test-result-studio.png')
const PIXEL_SHOT = join(ROOT, 'public', 'test-result-pixel.png')

function writeSampleSheet() {
  const cols = 7
  const rows = 4
  const cellW = 248
  const cellH = 268
  const gap = 36
  const pad = 40
  const width = pad * 2 + cols * cellW + (cols - 1) * gap
  const height = pad * 2 + rows * cellH + (rows - 1) * gap
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = pad + col * (cellW + gap)
      const y = pad + row * (cellH + gap)
      const cx = x + cellW / 2
      ctx.fillStyle = '#ff8866'
      ctx.beginPath()
      ctx.ellipse(cx, y + 98, 74, 64, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#7c3aed'
      ctx.beginPath()
      ctx.arc(cx, y + 92, 36, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#141414'
      ctx.fillRect(cx - 22, y + 74, 16, 16)
      ctx.fillRect(cx + 6, y + 74, 16, 16)
      ctx.fillStyle = '#ffb48c'
      ctx.fillRect(x + 36, y + 124, 36, 26)
      ctx.fillStyle = '#ff5a8a'
      ctx.fillRect(x + cellW - 78, y + 116, 42, 32)
      ctx.fillStyle = '#ff8866'
      ctx.fillRect(cx - 16, y + 160, 32, 44)
      ctx.font = 'bold 32px "Malgun Gothic", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#111111'
      ctx.lineWidth = 8
      ctx.strokeText('안녕!', cx, y + cellH - 36)
      ctx.fillStyle = '#ffffff'
      ctx.fillText('안녕!', cx, y + cellH - 36)
    }
  }

  writeFileSync(SHEET_PATH, canvas.toBuffer('image/png'))
  return SHEET_PATH
}

async function setGridSize(page, cols, rows) {
  const inputs = page.locator('.emo-grid-ctrls input[type="range"]')
  await inputs.nth(0).evaluate((el, value) => {
    el.value = String(value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, cols)
  await inputs.nth(1).evaluate((el, value) => {
    el.value = String(value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, rows)
}

async function runVisualCheck() {
  await refreshDev({ openBrowser: true })
  const sheetPath = writeSampleSheet()
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  })
  await context.route('**/*', (route) => {
    const headers = {
      ...route.request().headers(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    }
    return route.continue({ headers })
  })
  const page = await context.newPage()
  page.on('dialog', (dialog) => dialog.dismiss())

  await page.addInitScript(() => {
    try {
      localStorage.setItem('styler-onboard-v1', 'done')
    } catch {
      /* ignore */
    }
  })

  const studioUrl = `http://localhost:5173/calligraphy-studio/?v=${Date.now()}`
  await page.goto(studioUrl, { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-guide-book="1"]', { timeout: 15000 })
  await page.locator('[data-guide-book="1"]').click()
  await page.waitForSelector('[data-guide-pipeline="1"]', { timeout: 10000 })
  await page.waitForTimeout(350)
  await page.screenshot({ path: SPLIT_SHOT, fullPage: false, timeout: 60000 })
  await page.locator('.guide-master .studio-modal-close').click()
  await page.waitForFunction(() => !document.querySelector('[data-guide-pipeline="1"]'), { timeout: 8000 })

  await page.waitForSelector('[data-tour="emo-split"]', { timeout: 15000 })
  await page.locator('[data-tour="emo-split"]').click()
  await page.waitForSelector('#emo-split-title', { timeout: 10000 })
  await page.waitForSelector('[data-png-guide="1"]', { timeout: 10000 })
  await page.locator('[data-png-guide-ok]').click()
  await page.waitForFunction(() => !document.querySelector('[data-png-guide="1"]'), { timeout: 8000 })
  await page.waitForSelector('[data-split-empty="1"]', { timeout: 8000 })

  await page.locator('.emo-drop input[type="file"]').setInputFiles(sheetPath)
  await page.waitForSelector('.emo-thumbs li', { timeout: 120000 })
  await page.getByRole('button', { name: '자동 28구 분할' }).click()
  await page.waitForFunction(() => {
    const note = document.querySelector('.emo-split-note')?.textContent || ''
    return !note.includes('처리 중') && document.querySelectorAll('.emo-thumbs li').length > 0
  }, { timeout: 120000 })

  let cutCount = await page.locator('.emo-thumbs li').count()
  if (cutCount !== 28) {
    await page.getByRole('button', { name: '모드 B' }).click()
    await setGridSize(page, 7, 4)
    await page.waitForFunction(() => {
      const note = document.querySelector('.emo-split-note')?.textContent || ''
      return !note.includes('처리 중') && document.querySelectorAll('.emo-thumbs li').length === 28
    }, { timeout: 120000 })
    cutCount = await page.locator('.emo-thumbs li').count()
  }

  await page.waitForTimeout(400)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForFunction(() => document.documentElement.getAttribute('data-studio-fit') === '1', { timeout: 5000 })
  await page.waitForSelector('[data-grid-detect]', { timeout: 8000 })
  await page.waitForTimeout(300)
  await page.locator('.emo-thumbs li').nth(14).locator('.emo-thumb-open').click()
  await page.waitForSelector('.emo-lightbox-stage', { timeout: 10000 })
  await page.waitForTimeout(400)
  await page.locator('.emo-lightbox-x').click()

  await page.locator('[data-text-engine="VECTOR_OVERLAY"]').click()
  await page.waitForFunction(() => {
    const note = document.querySelector('.emo-split-note')?.textContent || ''
    const on = document.querySelector('[data-text-engine="VECTOR_OVERLAY"]')?.classList.contains('is-on')
    return Boolean(on) && !note.includes('처리 중') && !note.includes('나누는 중') && document.querySelectorAll('.emo-thumbs li').length === 28
  }, { timeout: 120000 })
  await page.locator('[data-purge-bg]').click()
  await page.waitForSelector('[data-purge-toast="1"]', { timeout: 8000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: GRID_SHOT, fullPage: false, timeout: 60000 })

  await page.locator('.emo-split-card .studio-modal-close').click()
  await page.locator('[data-tour="gif-export"]').click()
  await page.waitForSelector('#mgs-title', { timeout: 10000 })
  await page.waitForSelector('[data-session-save]', { timeout: 8000 })
  await page.waitForSelector('[data-session-load]', { timeout: 5000 })
  await page.waitForTimeout(250)
  const resumeFresh = page.locator('[data-session-fresh]')
  if (await resumeFresh.count()) {
    await resumeFresh.click()
    await page.waitForFunction(() => !document.querySelector('[data-session-resume="1"]'), null, { timeout: 5000 })
  }
  await page.getByRole('button', { name: '본체 그래픽' }).click()
  await page.waitForFunction(() => {
    const sources = document.querySelector('[data-source-tab="canvas"]')
    return Boolean(sources)
      && !document.querySelector('#emo-split-title')
      && !document.querySelector('[data-cut-bank="1"]')
      && !document.querySelector('.mgs-cuts')
  }, null, { timeout: 8000 })
  await page.waitForSelector('.mgs-preview-canvas:not([hidden])', { timeout: 15000 })
  await page.waitForSelector('[data-still-loop="1"]', { timeout: 10000 })
  await page.waitForSelector('[data-bg-select]', { timeout: 8000 })
  await page.locator('[data-bg-select]').scrollIntoViewIfNeeded()
  await page.selectOption('[data-bg-select]', 'white_studio')
  await page.waitForFunction(() => document.querySelector('[data-bg-select]')?.value === 'white_studio', { timeout: 5000 })
  await page.locator('.mgs-root .studio-modal-backdrop').click({ position: { x: 6, y: 6 }, force: true })
  await page.locator('#mgs-title').waitFor({ state: 'attached', timeout: 8000 })
  await page.locator('.mgs-card .studio-modal-close').click()
  await page.waitForSelector('[data-close-confirm]', { timeout: 5000 })
  await page.locator('[data-close-cancel]').click()
  await page.waitForFunction(() => !document.querySelector('[data-close-confirm]'), { timeout: 5000 })
  await page.waitForSelector('#mgs-title')
  await page.locator('.mgs-card .studio-modal-close').click()
  await page.waitForSelector('[data-close-confirm]', { timeout: 5000 })
  await page.locator('[data-close-save]').click()
  await page.waitForFunction(() => !document.querySelector('#mgs-title'), { timeout: 8000 })
  await page.locator('[data-tour="gif-export"]').click()
  await page.waitForSelector('#mgs-title', { timeout: 10000 })
  await page.waitForSelector('[data-session-resume="1"]', { timeout: 8000 })
  await page.locator('[data-session-resume-yes]').click()
  await page.waitForFunction(() => !document.querySelector('[data-session-resume="1"]'), { timeout: 8000 })
  await page.waitForFunction(() => document.querySelector('[data-bg-select]')?.value === 'white_studio', { timeout: 8000 })
  await page.waitForSelector('.mgs-preview-canvas:not([hidden])', { timeout: 15000 })
  await page.waitForFunction(() => {
    const btn = document.querySelector('[data-sprite-isolate]')
    return Boolean(btn) && !btn.disabled
  }, { timeout: 15000 })
  await page.locator('[data-particle="sparkle"]').click()
  await page.locator('[data-particle="hearts"]').click()
  await page.waitForFunction(() => {
    return document.querySelector('[data-particle="sparkle"]')?.classList.contains('is-on')
      && document.querySelector('[data-particle="hearts"]')?.classList.contains('is-on')
  }, { timeout: 5000 })
  await page.waitForSelector('[data-sprite-isolate="1"]', { timeout: 8000 })
  const isolateBtn = page.locator('[data-sprite-isolate]')
  await isolateBtn.scrollIntoViewIfNeeded()
  await isolateBtn.click()
  await page.waitForSelector('[data-detect-outline="1"]', { timeout: 8000 })
  await page.waitForSelector('[data-isolate-toast="1"]', { state: 'attached', timeout: 8000 })
  const pixelBtn = page.locator('[data-pixel-studio-open]')
  await pixelBtn.scrollIntoViewIfNeeded()
  await pixelBtn.click({ force: true })
  const pixelOverlay = page.locator('[data-pixel-studio="1"]')
  await pixelOverlay.waitFor({ state: 'visible', timeout: 8000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-pixel-studio="1"]')
    if (!el) return false
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    return rect.width >= 240
      && rect.height >= 240
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number.parseInt(style.zIndex, 10) >= 90
  }, null, { timeout: 8000 })
  await page.waitForSelector('[data-pixel-ready="1"]', { timeout: 8000 })
  await page.waitForSelector('[data-pixel-col="left"]', { timeout: 5000 })
  await page.waitForSelector('[data-pixel-col="right"]', { timeout: 5000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-pixel-canvas]')
    const apply = document.querySelector('[data-pixel-apply]')
    const badge = document.querySelector('[data-pixel-zoom]')
    const shell = document.querySelector('[data-pixel-shell]')
    const body = document.querySelector('[data-pixel-body]')
    const left = document.querySelector('[data-pixel-col="left"]')
    const right = document.querySelector('[data-pixel-col="right"]')
    if (!canvas || !apply || !shell || !body || !left || !right || !/맞춤/.test(String(badge?.textContent || ''))) return false
    const cr = canvas.getBoundingClientRect()
    const ar = apply.getBoundingClientRect()
    const sr = shell.getBoundingClientRect()
    const br = body.getBoundingClientRect()
    const lr = left.getBoundingClientRect()
    const rr = right.getBoundingClientRect()
    return cr.width >= 80
      && cr.height >= 80
      && cr.bottom <= ar.top + 8
      && sr.width >= Math.min(900, window.innerWidth * 0.7)
      && Math.abs(br.width - sr.width) <= 48
      && lr.left <= sr.left + 28
      && rr.right >= sr.right - 28
      && Math.abs(lr.width - rr.width) <= 2
  }, null, { timeout: 8000 })
  await page.locator('[data-pixel-loupe-open]').click()
  await page.locator('[data-pixel-canvas]').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect()
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width * 0.5,
      clientY: rect.top + rect.height * 0.42,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
    }))
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width * 0.5,
      clientY: rect.top + rect.height * 0.42,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 0,
    }))
  })
  await page.waitForSelector('[data-pixel-loupe="1"]', { timeout: 8000 })
  await page.screenshot({ path: PIXEL_SHOT, fullPage: false, timeout: 60000 })
  await page.locator('[data-pixel-loupe-close]').click()
  await page.waitForFunction(() => !document.querySelector('[data-pixel-loupe="1"]'), null, { timeout: 5000 })
  await page.locator('[data-pixel-wand]').click()
  await page.locator('[data-pixel-canvas]').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect()
    const fire = (type, xr, yr, buttons) => {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width * xr,
        clientY: rect.top + rect.height * yr,
        pointerId: 1,
        pointerType: 'mouse',
        buttons,
      }))
    }
    fire('pointerdown', 0.5, 0.42, 1)
    fire('pointerup', 0.5, 0.42, 0)
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-pixel-canvas]')
    const btn = document.querySelector('[data-pixel-apply]')
    return Number(canvas?.getAttribute('data-pixel-selected') || 0) > 20 && Boolean(btn) && !btn.disabled
  }, null, { timeout: 8000 })
  await page.evaluate(() => document.querySelector('[data-pixel-apply]')?.click())
  await page.waitForFunction(() => !document.querySelector('[data-pixel-studio="1"]'), null, { timeout: 8000 })
  await page.locator('[data-pixel-restore]').click()
  await page.waitForSelector('[data-restore-toast="1"]', { timeout: 5000 })
  await page.locator('[data-motion-preset="jellyBounce"]').click()
  await page.waitForFunction(() => document.querySelector('[data-motion-preset="jellyBounce"]')?.classList.contains('is-on'), { timeout: 5000 })
  const playBtn = page.locator('[data-play-toggle="stage"]')
  await playBtn.click()
  await page.waitForFunction(() => document.querySelector('[data-play-toggle="stage"]')?.getAttribute('data-playing') === 'pause', { timeout: 5000 })
  await playBtn.click()
  await page.waitForFunction(() => document.querySelector('[data-play-toggle="stage"]')?.getAttribute('data-playing') === 'run', { timeout: 5000 })
  await page.locator('[data-chat-sim]').scrollIntoViewIfNeeded()
  await page.waitForSelector('[data-chat-mirror]', { timeout: 10000 })
  await page.waitForFunction(() => {
    const chat = document.querySelector('[data-chat-mirror]')
    const main = document.querySelector('[data-preview-canvas]')
    if (!chat || !main) return false
    const ctx = chat.getContext('2d')
    if (!ctx) return false
    const w = chat.width || 0
    const h = chat.height || 0
    if (w < 8 || h < 8) return false
    const sx = Math.max(0, Math.floor(w / 2 - 12))
    const sy = Math.max(0, Math.floor(h / 2 - 12))
    const sample = ctx.getImageData(sx, sy, Math.min(24, w - sx), Math.min(24, h - sy))
    for (let i = 3; i < sample.data.length; i += 4) {
      if (sample.data[i] > 8) return true
    }
    return false
  }, { timeout: 10000 })
  await page.locator('[data-caption-input]').scrollIntoViewIfNeeded()
  await page.waitForSelector('[data-caption-input]', { timeout: 10000 })
  await page.waitForFunction(() => {
    const toggle = document.querySelector('[data-caption-on]')
    const input = document.querySelector('[data-caption-input]')
    return toggle?.getAttribute('data-caption-on') === '0' && String(input?.value || '') === ''
  }, { timeout: 5000 })
  await page.locator('[data-caption-on]').click()
  await page.waitForFunction(() => document.querySelector('[data-caption-on]')?.getAttribute('data-caption-on') === '1', { timeout: 5000 })
  await page.locator('[data-caption-input]').fill('안녕')
  await page.locator('[data-text-effect="bounce"]').click()
  await page.waitForFunction(() => {
    const input = document.querySelector('[data-caption-input]')
    const bounce = document.querySelector('[data-text-effect="bounce"]')
    return String(input?.value || '') === '안녕' && bounce?.classList.contains('is-on')
  }, { timeout: 5000 })
  await page.waitForTimeout(500)
  await encodeUntilDone(page, 'gif')
  await encodeUntilDone(page, 'webp')
  await page.locator('[data-clip-save]').click()
  await page.waitForSelector('[data-motion-clip="0"]', { timeout: 8000 })
  await page.waitForSelector('[data-clip-del]', { timeout: 5000 })
  await page.waitForSelector('[data-clip-clear]', { timeout: 5000 })
  await page.getByRole('button', { name: '이모티콘 컷' }).click()
  await page.waitForSelector('[data-source-tab="cuts"]', { timeout: 8000 })
  await page.waitForSelector('.mgs-cuts button', { timeout: 10000 })
  await page.waitForSelector('[data-cut-bank="1"]', { timeout: 8000 })
  await page.locator('[data-seq-cut="0"]').click()
  await page.waitForSelector('[data-seq-remove="0"]', { timeout: 8000 })
  await page.locator('[data-seq-remove="0"]').click()
  await page.waitForFunction(() => !document.querySelector('[data-seq-index="0"]'), null, { timeout: 5000 })
  await page.waitForFunction(() => {
    const save = document.querySelector('[data-clip-save]')
    const gif = document.querySelector('[data-encode-fmt="gif"]')
    const webp = document.querySelector('[data-encode-fmt="webp"]')
    const viewH = window.innerHeight
    return [save, gif, webp].every((btn) => {
      if (!btn) return false
      const r = btn.getBoundingClientRect()
      return r.height >= 24 && r.top >= 0 && r.bottom <= viewH + 2
    })
  }, { timeout: 8000 })
  await page.setViewportSize({ width: 1920, height: 900 })
  await page.waitForFunction(() => {
    const save = document.querySelector('[data-clip-save]')
    const gif = document.querySelector('[data-encode-fmt="gif"]')
    const webp = document.querySelector('[data-encode-fmt="webp"]')
    const viewH = window.innerHeight
    return [save, gif, webp].every((btn) => {
      if (!btn) return false
      const r = btn.getBoundingClientRect()
      return r.height >= 20 && r.top >= 0 && r.bottom <= viewH + 4
    })
  }, { timeout: 8000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: STUDIO_SHOT, fullPage: false, timeout: 60000 })

  const chooserPromise = page.waitForEvent('filechooser', { timeout: 8000 })
  await page.getByRole('button', { name: '내 PC 업로드' }).click()
  const chooser = await chooserPromise
  await page.waitForSelector('[data-pc-dropzone="1"]', { timeout: 8000 })
  if (!chooser.isMultiple()) {
    throw new Error('PC upload file picker is not multiple')
  }
  await chooser.setFiles([sheetPath, sheetPath])
  await page.waitForSelector('.mgs-upload-card', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelectorAll('.mgs-upload-card').length >= 2, { timeout: 20000 })
  await page.waitForFunction(() => document.querySelector('[data-source-tab]')?.getAttribute('data-source-tab') === 'drop', null, { timeout: 5000 })
  await page.locator('[data-session-save]').click()
  await page.waitForFunction(() => document.querySelector('[data-session-ind="1"]'), null, { timeout: 15000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: SPLIT_SHOT, fullPage: false, timeout: 60000 })
  await page.locator('.mgs-card .studio-modal-close').click()
  await page.waitForSelector('[data-close-confirm]', { timeout: 8000 })
  await page.locator('[data-close-save]').click()
  await page.waitForFunction(() => !document.querySelector('#mgs-title'), null, { timeout: 8000 })
  await page.locator('[data-tour="gif-export"]').click()
  await page.waitForSelector('#mgs-title', { timeout: 10000 })
  await page.waitForSelector('[data-session-resume="1"]', { timeout: 8000 })
  await page.locator('[data-session-resume-yes]').click()
  await page.waitForFunction(() => document.querySelector('[data-source-tab]')?.getAttribute('data-source-tab') === 'drop', null, { timeout: 25000 })
  await page.locator('.mgs-card .studio-modal-close').click()
  await page.waitForSelector('[data-close-confirm]', { timeout: 8000 })
  await page.locator('[data-close-discard]').click()
  await page.waitForFunction(() => !document.querySelector('#mgs-title'), null, { timeout: 8000 })
  await page.locator('[data-tour="gif-export"]').click()
  await page.waitForSelector('#mgs-title', { timeout: 10000 })
  const resumeAfterDiscard = page.locator('[data-session-fresh]')
  if (await resumeAfterDiscard.count()) await resumeAfterDiscard.click()
  await page.waitForFunction(() => document.querySelector('[data-source-tab]')?.getAttribute('data-source-tab') === 'canvas', null, { timeout: 8000 })

  const heading = await page.locator('#mgs-title').textContent()
  const stillLoop = await page.locator('[data-motion-seq]').getAttribute('data-still-loop')
  const playing = await page.locator('[data-play-toggle="stage"]').getAttribute('data-playing')
  const jellyOn = await page.locator('[data-motion-preset="jellyBounce"]').evaluate((el) => el.classList.contains('is-on'))
  const specText = await page.locator('[data-store-spec]').innerText()
  console.log('\n=============================================')
  console.log(`📸 [그리드 캡처]: public/test-result-grid.png (${cutCount}칸)`)
  console.log(`📸 [초정밀 픽셀 에디터 E2E]: public/test-result-pixel.png`)
  console.log(`📸 [내 PC 업로드]: public/test-result.png`)
  console.log(`📸 [모션 스튜디오]: public/test-result-studio.png (${heading || '모션 스튜디오'} · stillLoop=${stillLoop} · jelly=${jellyOn} · playing=${playing})`)
  console.log(`🔍 [시각 검증 완료]: 텍스트 끄기(빈 입력) · 채팅 미리보기 실시간 미러 · 스펙 ${specText.replace(/\s+/g, ' ').trim()} · 체커보드`)
  console.log('=============================================\n')

  await browser.close()
  await waitForApprovalWithReminder()
}

runVisualCheck().catch((error) => {
  console.error(error)
  process.exit(1)
})
