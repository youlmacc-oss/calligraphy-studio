import { encodeMotionExport, yieldToMain } from './encoder/MotionEncoderEngine.js'
import { prepareEncodeBackground, yieldEncoderTick } from './gifOptimizer.js'
import { sanitizeExportFrames } from '../lib/fakeBackgroundPurge.js'

export { sanitizeExportFrames }

/**
 * Yielding GIF/WebP export wrapper. Pre-scales a heavy background once,
 * then uses the existing 360 encoder so the progress bar can reach 100%.
 * Frames are purged of baked checkerboard before compose, matching HQ loop GIF.
 */
export async function exportCompositeGif(frames, bgConfig, subtitleConfig = {}, options = {}, onProgress) {
  const cleanFrames = await sanitizeExportFrames(frames)
  const prepared = await prepareEncodeBackground(bgConfig, options.width || 360, options.height || 360)
  await yieldEncoderTick()
  return encodeMotionExport(cleanFrames.length ? cleanFrames : frames, {
    ...options,
    ...subtitleConfig,
    bgConfig: prepared,
    onProgress: async (info) => {
      onProgress?.(info?.percent ?? 0, info)
      await yieldToMain()
    },
  })
}

export async function exportCompositeWebp(frames, bgConfig, subtitleConfig = {}, options = {}, onProgress) {
  return exportCompositeGif(frames, bgConfig, subtitleConfig, { ...options, format: 'webp' }, onProgress)
}
