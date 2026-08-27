const listeners = new Set()
let snapshot = []

export function getEmoticonCuts() {
  return snapshot.slice()
}

export function subscribeEmoticonCuts(listener) {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  listener(getEmoticonCuts())
  return () => listeners.delete(listener)
}

export function publishEmoticonCuts(slices = []) {
  snapshot = (Array.isArray(slices) ? slices : []).map((item, index) => {
    const url = item?.preview || item?.url || item?.dataUrl || ''
    if (!url && item?.canvas?.toDataURL) {
      try {
        return {
          id: item.id || `cut-${index + 1}`,
          name: item.name || `cut-${String(index + 1).padStart(2, '0')}.png`,
          url: item.canvas.toDataURL('image/png'),
        }
      } catch {
        return null
      }
    }
    if (!url) return null
    return {
      id: item.id || `cut-${index + 1}`,
      name: item.name || `cut-${String(index + 1).padStart(2, '0')}.png`,
      url,
    }
  }).filter(Boolean)
  listeners.forEach((listener) => listener(getEmoticonCuts()))
}
