export const PLATFORM_PRESETS = [
  { id: 'kakao', label: '카카오 이모티콘 360 × 360 (여백 자동 정렬)', width: 360, height: 360, fps: 24 },
  { id: 'line', label: '라인 스티커 320 × 270', width: 320, height: 270, fps: 12 },
  { id: 'emoji', label: '디스코드 / 슬랙 128 × 128', width: 128, height: 128, fps: 12 },
  { id: 'hd', label: 'HD 마케팅 배너 500 × 500', width: 500, height: 500, fps: 12 },
  { id: 'original', label: '원본 크기 유지 (Source Match)' },
]

export function resolvePlatformSize(sizeId, image) {
  const preset = PLATFORM_PRESETS.find((item) => item.id === sizeId) || PLATFORM_PRESETS[0]
  if (preset.id === 'original') {
    const width = image?.naturalWidth || image?.width || 360
    const height = image?.naturalHeight || image?.height || 360
    const scale = Math.min(1, 1024 / Math.max(width, height, 1))
    return {
      id: preset.id,
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      fps: null,
    }
  }
  return {
    id: preset.id,
    width: preset.width,
    height: preset.height,
    fps: preset.fps || null,
  }
}
