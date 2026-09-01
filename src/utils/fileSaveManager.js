export function shouldUseSavePicker() {
  if (typeof window === 'undefined') return false
  if (window.navigator?.webdriver) return false
  return typeof window.showSaveFilePicker === 'function'
}

function mimeFromName(name, fallback = 'image/gif') {
  const ext = String(name || '').split('.').pop()?.toLowerCase()
  if (ext === 'webp') return 'image/webp'
  if (ext === 'png') return 'image/png'
  if (ext === 'zip') return 'application/zip'
  if (ext === 'gif') return 'image/gif'
  return fallback
}

function downloadFallback(blob, defaultName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = defaultName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return { success: true, method: 'fallback', url }
}

export async function saveFileWithFolderPicker(blob, defaultName = 'motion.gif', mimeType = '') {
  if (!blob) return { success: false, reason: 'empty' }
  const name = String(defaultName || 'motion.gif')
  const mime = mimeType || blob.type || mimeFromName(name)
  const ext = (name.split('.').pop() || 'gif').toLowerCase()
  if (shouldUseSavePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{
          description: `${ext.toUpperCase()} 파일`,
          accept: { [mime]: [`.${ext}`] },
        }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return { success: true, method: 'picker' }
    } catch (err) {
      if (err?.name === 'AbortError') return { success: false, reason: 'cancelled', method: 'picker' }
    }
  }
  return downloadFallback(blob, name)
}
