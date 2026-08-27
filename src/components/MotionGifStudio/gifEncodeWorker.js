import { encodeRgbaFrames } from './gifEncodeCore.js'

self.onmessage = (event) => {
  const { id, width, height, delay, transparent, buffers } = event.data || {}
  try {
    const frames = (buffers || []).map((buffer) => ({
      data: new Uint8ClampedArray(buffer),
      width,
      height,
    }))
    const uint8 = encodeRgbaFrames(frames, {
      width,
      height,
      delay,
      transparent,
      onProgress: (pct, index, total) => {
        self.postMessage({ id, type: 'progress', pct, index, total })
      },
    })
    self.postMessage({ id, type: 'done', buffer: uint8.buffer, byteLength: uint8.byteLength }, [uint8.buffer])
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error?.message || 'GIF 인코딩에 실패했습니다.' })
  }
}
