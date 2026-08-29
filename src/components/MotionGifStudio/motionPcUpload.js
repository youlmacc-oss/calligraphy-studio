export const PC_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
export const PC_IMAGE_MAX = 48

export function isPcImageFile(file) {
  const name = String(file?.name || '').toLowerCase()
  const type = String(file?.type || '').toLowerCase()
  return /\.(png|jpe?g|webp)$/.test(name)
    || ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'].includes(type)
}

export function listPcImageFiles(fileList, max = PC_IMAGE_MAX) {
  return [...(fileList || [])].filter(isPcImageFile).slice(0, max)
}

export function createPcDragGuard(depthRef, setDragging) {
  return {
    onDragEnter(event) {
      event.preventDefault()
      event.stopPropagation()
      depthRef.current += 1
      setDragging(true)
    },
    onDragOver(event) {
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    },
    onDragLeave(event) {
      event.preventDefault()
      event.stopPropagation()
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setDragging(false)
    },
    reset() {
      depthRef.current = 0
      setDragging(false)
    },
  }
}
