export const SESSION_KEY = 'MOTION_STUDIO_ACTIVE_SESSION'
export const SESSION_VERSION = '1.0'
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const SESSION_DB_NAME = 'calligraphy-studio-session'
export const SESSION_STORE = 'assets'

const ASSET_SOURCE = 'sourceImage'
const ASSET_PIXEL = 'pixelSprite'
const ASSET_FRAMES = 'customFrames'
const MAX_FRAMES = 12

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* private mode */
  }
  return null
}

export function isFreshSession(session, maxAge = SESSION_MAX_AGE_MS) {
  const stamp = Number(session?.timestamp)
  if (!Number.isFinite(stamp) || stamp <= 0) return false
  return Date.now() - stamp <= maxAge
}

export function normalizeMotionStudioSession(raw) {
  if (!raw || typeof raw !== 'object') return null
  const params = raw.motionParams && typeof raw.motionParams === 'object' ? raw.motionParams : {}
  const sub = raw.subtitleConfig && typeof raw.subtitleConfig === 'object' ? raw.subtitleConfig : {}
  const tail = sub.tail && typeof sub.tail === 'object' ? sub.tail : {}
  const frames = Array.isArray(raw.customFrames) ? raw.customFrames.filter((item) => typeof item === 'string' && item).slice(0, MAX_FRAMES) : []
  return {
    version: SESSION_VERSION,
    timestamp: Number(raw.timestamp) || Date.now(),
    sourceImage: typeof raw.sourceImage === 'string' ? raw.sourceImage : null,
    pixelSprite: typeof raw.pixelSprite === 'string' ? raw.pixelSprite : null,
    activeSourceTab: typeof raw.activeSourceTab === 'string' ? raw.activeSourceTab : 'canvas',
    selectedPreset: typeof raw.selectedPreset === 'string' ? raw.selectedPreset : 'none',
    motionParams: {
      loopDuration: Number(params.loopDuration) || 2,
      motionIntensity: Number(params.motionIntensity) || 70,
      fps: Number(params.fps) || 24,
      canvasSpec: typeof params.canvasSpec === 'string' ? params.canvasSpec : 'kakao',
    },
    subtitleConfig: {
      text: String(sub.text || ''),
      fontFamily: String(sub.fontFamily || 'Jua'),
      fontSize: sub.fontSize || 'md',
      color: String(sub.color || 'black'),
      bubbleEnabled: Boolean(sub.bubbleEnabled),
      posX: Number(sub.posX) || 0,
      posY: Number(sub.posY) || 0,
      effect: String(sub.effect || 'none'),
      tail: {
        enabled: Boolean(tail.enabled),
        tip: pointOf(tail.tip, { x: -18, y: 56 }),
        baseStart: pointOf(tail.baseStart, { x: -14, y: 20 }),
        baseEnd: pointOf(tail.baseEnd, { x: 14, y: 20 }),
      },
    },
    customFrames: frames,
    sequenceMeta: Array.isArray(raw.sequenceMeta) ? raw.sequenceMeta.slice(0, MAX_FRAMES) : [],
    particles: Array.isArray(raw.particles) ? raw.particles : [],
    pingPong: Boolean(raw.pingPong),
    seqFps: Number(raw.seqFps) || 8,
    isolateOn: raw.isolateOn !== false,
    viewBg: typeof raw.viewBg === 'string' ? raw.viewBg : 'checker',
    zoom: Number(raw.zoom) || 100,
  }
}

function pointOf(value, fallback) {
  return {
    x: Number.isFinite(Number(value?.x)) ? Number(value.x) : fallback.x,
    y: Number.isFinite(Number(value?.y)) ? Number(value.y) : fallback.y,
  }
}

export function saveCurrentSession(sessionData, storage = defaultStorage()) {
  try {
    if (!storage) return false
    const payload = normalizeMotionStudioSession({
      ...sessionData,
      timestamp: Date.now(),
    })
    if (!payload) return false
    const lean = stripHeavyAssets(payload)
    storage.setItem(SESSION_KEY, JSON.stringify(lean))
    return true
  } catch (err) {
    console.warn('LocalStorage 용량 초과 또는 저장 실패:', err)
    return false
  }
}

export function loadSavedSession(storage = defaultStorage()) {
  try {
    if (!storage) return null
    const raw = storage.getItem(SESSION_KEY)
    if (!raw) return null
    return normalizeMotionStudioSession(JSON.parse(raw))
  } catch (err) {
    console.error('세션 복원 파싱 실패:', err)
    return null
  }
}

export function clearSavedSession(storage = defaultStorage()) {
  try {
    storage?.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  void clearSessionAssets()
}

function stripHeavyAssets(session) {
  return {
    ...session,
    sourceImage: session.sourceImage ? ASSET_SOURCE : null,
    pixelSprite: session.pixelSprite ? ASSET_PIXEL : null,
    customFrames: session.customFrames.length ? [ASSET_FRAMES] : [],
    _hasSource: Boolean(session.sourceImage),
    _hasPixel: Boolean(session.pixelSprite),
    _frameCount: session.customFrames.length,
  }
}

function openSessionDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const req = indexedDB.open(SESSION_DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SESSION_STORE)) {
        req.result.createObjectStore(SESSION_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function idbPut(key, value) {
  const db = await openSessionDb()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(SESSION_STORE, 'readwrite')
    tx.objectStore(SESSION_STORE).put(value, key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

async function idbGet(key) {
  const db = await openSessionDb()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(SESSION_STORE, 'readonly')
    const req = tx.objectStore(SESSION_STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

async function clearSessionAssets() {
  const db = await openSessionDb()
  if (!db) return
  try {
    db.transaction(SESSION_STORE, 'readwrite').objectStore(SESSION_STORE).clear()
  } catch {
    /* ignore */
  }
}

export async function persistMotionStudioSession(sessionData, storage = defaultStorage()) {
  const payload = normalizeMotionStudioSession({
    ...sessionData,
    timestamp: Date.now(),
  })
  if (!payload) return false
  const idbOk = await Promise.all([
    payload.sourceImage ? idbPut(ASSET_SOURCE, payload.sourceImage) : Promise.resolve(true),
    payload.pixelSprite ? idbPut(ASSET_PIXEL, payload.pixelSprite) : Promise.resolve(true),
    payload.customFrames.length ? idbPut(ASSET_FRAMES, payload.customFrames) : Promise.resolve(true),
  ])
  if (idbOk.every(Boolean)) {
    return saveCurrentSession(payload, storage)
  }
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify(payload))
    return true
  } catch (err) {
    console.warn('LocalStorage 용량 초과 또는 저장 실패:', err)
    return saveCurrentSession(payload, storage)
  }
}

export async function hydrateSavedSession(storage = defaultStorage()) {
  const meta = loadSavedSession(storage)
  if (!meta) return null
  const sourceImage = meta._hasSource ? (await idbGet(ASSET_SOURCE)) || null : (typeof meta.sourceImage === 'string' && meta.sourceImage.startsWith('data:') ? meta.sourceImage : null)
  const pixelSprite = meta._hasPixel ? (await idbGet(ASSET_PIXEL)) || null : null
  const frames = meta._frameCount ? (await idbGet(ASSET_FRAMES)) || [] : []
  return normalizeMotionStudioSession({
    ...meta,
    sourceImage,
    pixelSprite,
    customFrames: Array.isArray(frames) ? frames : [],
  })
}

export function canvasToPngDataUrl(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return null
  try {
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function urlToDataUrl(url) {
  if (!url || typeof url !== 'string') return ''
  if (url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

export function peekFreshSession(storage = defaultStorage()) {
  const session = loadSavedSession(storage)
  if (!session || !isFreshSession(session)) return null
  return session
}
