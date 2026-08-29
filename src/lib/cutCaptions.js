export const CUT_CAPTION_CYCLE = ['아파요', '냠냠', '감사합니다', '어리둥절', '좋아요', '미안해', '축하해']

export const CUT_CAPTIONS = Array.from({ length: 28 }, (_, index) => (
  index === 14 ? '어리둥절' : CUT_CAPTION_CYCLE[index % CUT_CAPTION_CYCLE.length]
))

export function captionForCutIndex(index) {
  const i = Math.round(Number(index))
  if (i === 14) return '어리둥절'
  if (i >= 0 && i < CUT_CAPTIONS.length) return CUT_CAPTIONS[i]
  return CUT_CAPTION_CYCLE[((i % 7) + 7) % 7]
}
