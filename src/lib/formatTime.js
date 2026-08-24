function pad2(value) {
  return String(value).padStart(2, '0')
}

/** Format milliseconds as `00:02.4s` (mm:ss.t). */
export function formatClock(ms) {
  const tenthsTotal = Math.max(0, Math.round(ms / 100))
  const tenths = tenthsTotal % 10
  const totalSeconds = Math.floor(tenthsTotal / 10)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  return `${pad2(minutes)}:${pad2(seconds)}.${tenths}s`
}

export function getStageMessage(progress) {
  if (progress >= 100) return '렌더링 완료! 다운로드 준비가 끝났습니다.'
  if (progress >= 90) return '초고화질 업스케일링 및 후처리 렌더링 중...'
  if (progress >= 65) return 'AI 텍스처 맵핑 및 알파 채널 하드 클리핑 중...'
  if (progress >= 25) return '선택한 26종 프리셋 질감 셰이더 및 반사광 연산 중...'
  return '텍스트 벡터 외곽선 및 1024x1024 마스크 추출 중...'
}
