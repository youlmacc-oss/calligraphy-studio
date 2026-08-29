import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas } from 'canvas'
import { chromium } from 'playwright'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHEET_PATH = join(ROOT, 'public', 'sample-emoticon-sheet.png')
const GRID_SHOT = join(ROOT, 'public', 'test-result-grid.png')
const SPLIT_SHOT = join(ROOT, 'public', 'test-result.png')
const STUDIO_SHOT = join(ROOT, 'public', 'test-result-studio.png')

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
  const sheetPath = writeSampleSheet()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })

  await page.addInitScript(() => {
    try {
      localStorage.setItem('styler-onboard-v1', 'done')
    } catch {
      /* ignore */
    }
  })

  await page.goto('http://localhost:5173/calligraphy-studio/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-guide-book="1"]', { timeout: 15000 })
  await page.locator('[data-guide-book="1"]').click()
  await page.waitForSelector('[data-guide-pipeline="1"]', { timeout: 10000 })
  await page.waitForTimeout(350)
  await page.screenshot({ path: SPLIT_SHOT, fullPage: false })
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
  await page.waitForTimeout(300)
  await page.screenshot({ path: GRID_SHOT, fullPage: false })

  await page.locator('.emo-split-card .studio-modal-close').click()
  await page.locator('[data-tour="gif-export"]').click()
  await page.waitForSelector('#mgs-title', { timeout: 10000 })
  await page.getByRole('button', { name: '본체 그래픽' }).click()
  await page.waitForSelector('.mgs-preview-canvas:not([hidden])', { timeout: 15000 })
  await page.waitForSelector('[data-still-loop="1"]', { timeout: 10000 })
  await page.locator('[data-particle="sparkle"]').click()
  await page.locator('[data-particle="hearts"]').click()
  await page.waitForFunction(() => {
    return document.querySelector('[data-particle="sparkle"]')?.classList.contains('is-on')
      && document.querySelector('[data-particle="hearts"]')?.classList.contains('is-on')
  }, { timeout: 5000 })
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
    const sample = ctx.getImageData(0, 0, Math.min(chat.width, 24), Math.min(chat.height, 24))
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
  await page.locator('[data-clip-save]').click()
  await page.waitForSelector('[data-motion-clip="0"]', { timeout: 8000 })
  await page.waitForSelector('[data-clip-del]', { timeout: 5000 })
  await page.waitForSelector('[data-clip-clear]', { timeout: 5000 })
  await page.getByRole('button', { name: '이모티콘 컷' }).click()
  await page.waitForSelector('.mgs-cuts button', { timeout: 10000 })
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
  await page.screenshot({ path: STUDIO_SHOT, fullPage: false })

  const heading = await page.locator('#mgs-title').textContent()
  const stillLoop = await page.locator('[data-motion-seq]').getAttribute('data-still-loop')
  const playing = await page.locator('[data-play-toggle="stage"]').getAttribute('data-playing')
  const jellyOn = await page.locator('[data-motion-preset="jellyBounce"]').evaluate((el) => el.classList.contains('is-on'))
  const specText = await page.locator('[data-store-spec]').innerText()
  console.log('\n=============================================')
  console.log(`📸 [그리드 캡처]: public/test-result-grid.png (${cutCount}칸)`)
  console.log(`📸 [가이드북 3단계]: public/test-result.png`)
  console.log(`📸 [모션 스튜디오]: public/test-result-studio.png (${heading || '모션 스튜디오'} · stillLoop=${stillLoop} · jelly=${jellyOn} · playing=${playing})`)
  console.log(`🔍 [시각 검증 완료]: 텍스트 끄기(빈 입력) · 채팅 미리보기 실시간 미러 · 스펙 ${specText.replace(/\s+/g, ' ').trim()} · 체커보드`)
  console.log('=============================================\n')

  await browser.close()
}

runVisualCheck().catch((error) => {
  console.error(error)
  process.exit(1)
})
