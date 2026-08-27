import { DEFAULT_TEXT, FONTS, PRESETS } from '../presets.js'
import { defaultViewEdit } from './viewEdit.js'

export const STORAGE_KEY = 'styler-studio-pro-v1'
export const API_STORAGE_KEY = 'styler-api-keys-v1'

let layerSeq = 1

export function createLayer(partial = {}) {
  layerSeq += 1
  return {
    id: `layer-${Date.now()}-${layerSeq}`,
    role: 'sub',
    type: 'text',
    name: '서브 타이틀',
    text: 'Calligraphy Studio',
    fontId: FONTS[0].id,
    fontSize: 42,
    letterSpacing: 0,
    lineHeight: 1.2,
    align: 'center',
    fontWeight: 400,
    rotation: 0,
    presetId: '',
    ox: 0,
    oy: 0.22,
    color: '#f8fafc',
    strokeColor: '#22d3ee',
    strokeWidth: 0,
    strokeColor2: '#0f172a',
    strokeWidth2: 0,
    curveAmount: 0,
    shadowColor: '#000000',
    shadowBlur: 0,
    visible: true,
    opacity: 1,
    ...partial,
  }
}

export function createDefaultLayers() {
  return [
    createLayer({
      role: 'main',
      name: '메인 타이틀',
      text: DEFAULT_TEXT,
      fontId: PRESETS[0].fontId,
      presetId: PRESETS[0].id,
      fontSize: 104,
      fontWeight: 700,
      opacity: 1,
      oy: 0,
    }),
    createLayer({
      name: '서브 타이틀',
      text: 'AI Text Styler',
      fontId: 'great-vibes',
      presetId: '',
      fontSize: 40,
      opacity: 1,
      oy: 0.24,
      color: '#e0f2fe',
    }),
  ]
}

export function defaultStudioState() {
  const layers = createDefaultLayers()
  return {
    layers,
    activeLayerId: layers[0].id,
    presetId: PRESETS[0].id,
    studioTab: 'allinone',
    viewMode: 'graphic',
    aspectId: '1:1',
    stickerOn: true,
    stickerTheme: 'fnb',
    chiselDepth: 6,
    roughness: 48,
    inkDensity: 70,
    dryBrush: 30,
    sealOn: false,
    gridOn: true,
    bgLocked: false,
    layerLocked: false,
    background: {
      dataUrl: '',
      opacity: 0.85,
      blur: 0,
      blend: 'source-over',
    },
    viewEdit: defaultViewEdit(),
    gifMotion: 'pulse',
    previewBg: 'dark',
    exportScale: 1,
  }
}

export function studioFromParsed(parsed) {
  const base = defaultStudioState()
  if (!parsed || typeof parsed !== 'object') return base
  const layers = Array.isArray(parsed.layers) && parsed.layers.length
    ? parsed.layers.map((layer) => createLayer({
      ...layer,
      presetId: layer.presetId ?? (layer.role === 'main' ? (parsed.presetId || PRESETS[0].id) : ''),
      opacity: layer.opacity ?? 1,
      lineHeight: layer.lineHeight ?? 1.2,
      align: layer.align ?? 'center',
      curveAmount: layer.curveAmount ?? 0,
      strokeWidth2: layer.strokeWidth2 ?? 0,
      strokeColor2: layer.strokeColor2 ?? '#0f172a',
    }))
    : base.layers
  if (!layers.some((layer) => layer.role === 'main')) {
    layers.unshift(createDefaultLayers()[0])
  }
  if (!layers.some((layer) => layer.role === 'sub')) {
    layers.splice(1, 0, createDefaultLayers()[1])
  }
  const mainId = layers.find((item) => item.role === 'main')?.id ?? layers[0]?.id ?? null
  const exportScale = [1, 2, 4].includes(Number(parsed.exportScale)) ? Number(parsed.exportScale) : 1
  const previewBg = ['checker', 'dark', 'light'].includes(parsed.previewBg) ? parsed.previewBg : 'dark'
  return {
    ...base,
    ...parsed,
    layers,
    previewBg,
    exportScale,
    background: { ...base.background, ...(parsed.background ?? {}) },
    viewEdit: { ...base.viewEdit, ...(parsed.viewEdit ?? {}) },
    activeLayerId: mainId,
  }
}

export function loadStudioState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStudioState()
    return studioFromParsed(JSON.parse(raw))
  } catch {
    return defaultStudioState()
  }
}

export function saveStudioState(state) {
  try {
    const payload = {
      ...state,
      layers: state.layers,
      background: {
        ...state.background,
        dataUrl: (state.background?.dataUrl || '').length > 1_400_000 ? '' : state.background?.dataUrl,
      },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota or private mode */
  }
}

const KEY_SALT = 'styler-studio-pro-v1-obf'

function encodeSecret(value) {
  if (!value) return ''
  const mixed = [...value].map((ch, index) => ch.charCodeAt(0) ^ KEY_SALT.charCodeAt(index % KEY_SALT.length))
  return btoa(String.fromCharCode(...mixed))
}

function decodeSecret(value) {
  if (!value) return ''
  try {
    const raw = atob(value)
    return [...raw].map((ch, index) => String.fromCharCode(ch.charCodeAt(0) ^ KEY_SALT.charCodeAt(index % KEY_SALT.length))).join('')
  } catch {
    return value
  }
}

export function defaultApiKeys() {
  return {
    provider: 'local',
    falKey: '',
    replicateKey: '',
    grokKey: '',
    customUrl: '',
  }
}

export function loadApiKeys() {
  try {
    const parsed = JSON.parse(localStorage.getItem(API_STORAGE_KEY) || '{}')
    return {
      ...defaultApiKeys(),
      provider: parsed.provider || 'local',
      falKey: decodeSecret(parsed.falKey || ''),
      replicateKey: decodeSecret(parsed.replicateKey || ''),
      grokKey: decodeSecret(parsed.grokKey || ''),
      customUrl: parsed.customUrl || '',
    }
  } catch {
    return defaultApiKeys()
  }
}

export function saveApiKeys(keys) {
  localStorage.setItem(API_STORAGE_KEY, JSON.stringify({
    provider: keys.provider,
    falKey: encodeSecret(keys.falKey),
    replicateKey: encodeSecret(keys.replicateKey),
    grokKey: encodeSecret(keys.grokKey),
    customUrl: keys.customUrl || '',
  }))
}

export function snapshotOf(state) {
  return JSON.stringify({
    layers: state.layers,
    presetId: state.presetId,
    studioTab: state.studioTab,
    aspectId: state.aspectId,
    stickerOn: state.stickerOn,
    stickerTheme: state.stickerTheme,
    chiselDepth: state.chiselDepth,
    roughness: state.roughness,
    inkDensity: state.inkDensity,
    dryBrush: state.dryBrush,
    sealOn: state.sealOn,
    layerLocked: state.layerLocked,
    background: state.background,
    viewEdit: state.viewEdit,
    previewBg: state.previewBg,
    exportScale: state.exportScale,
  })
}
