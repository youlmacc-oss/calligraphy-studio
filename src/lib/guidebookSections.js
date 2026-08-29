export const GUIDEBOOK_SECTIONS = [
  {
    id: 'step1-generate',
    title: '1단계: AI 이모티콘 시트 생성 (권장 규격)',
    badge: '생성 팁',
    icon: '✨',
    quote: '최상의 품질을 위해 배경이 투명한 4행 × 5열 (총 20개) PNG 시트를 기본 규격으로 생성하세요.',
    lines: [
      '최고 화질 권장 규격: 배경이 투명한 4행 × 5열 (총 20개) PNG 시트',
      '프롬프트 팁: Transparent background, PNG format, clean grid 4 rows by 5 columns',
      '캐릭터와 하단 글자(안녕!, 화이팅!) 사이에 간격을 두면 분할이 정확합니다.',
    ],
    content: [
      '- 최고 화질 권장 규격: 배경이 투명한 4행 × 5열 (총 20개) PNG 시트',
      '- 투명 배경 생성 프롬프트 팁: Transparent background, PNG format, clean grid 4 rows by 5 columns',
      '- 여백 확보: 캐릭터 본체와 하단 텍스트 사이에 적절한 간격을 두세요.',
    ].join('\n'),
  },
  {
    id: 'step2-split',
    title: '2단계: 스마트 시트 분할 및 무손실 추출',
    badge: '분할 가이드',
    icon: '✂️',
    quote: '투명 시트는 무손실 바이패스(Lossless Bypass)로 즉시 4×5 자동 스냅되며, 비투명 시트도 텍스트 보호 마스킹으로 글자 파임 없이 분할됩니다.',
    lines: [
      '투명 PNG 무손실 바이패스(Bypass-First): 원본 화질을 360×360 중앙에 그대로 올립니다.',
      '4×5 (20개) 자동 스냅. 다른 배열은 프리셋 24/28/16 또는 모드 B로 바꿉니다.',
      '흰색/단색 시트도 글자 내부(ㅇ, ㅁ, ㅎ) 파임을 막는 마스킹이 동작합니다.',
    ],
    content: [
      '- 투명 PNG 무손실 바이패스 (Bypass-First): 인공적인 픽셀 깎기 없이 원본 화질 100%를 360×360 규격으로 중앙 정렬합니다.',
      '- 4×5 (20개) 자동 스냅: 업로드 즉시 20개 컷으로 정합되며, 프리셋(24/28/16)과 모드 B를 쓸 수 있습니다.',
      '- 텍스트 폐곡선 보호: 흰색/단색 배경에서도 글자 내부 파임을 차단합니다.',
    ].join('\n'),
  },
  {
    id: 'step3-motion',
    title: '3단계: 모션 합성 및 카카오 규격 내보내기',
    badge: '완성 및 제출',
    icon: '🎬',
    quote: '분할된 360×360 투명 PNG 20종을 모션 스튜디오로 가져가 애니메이션을 적용하거나 즉시 일괄 ZIP으로 다운로드하세요.',
    lines: [
      '카카오 표준 규격: 모든 컷은 360×360 정사각 투명 PNG로 패딩됩니다.',
      '모션 스튜디오에서 GIF/WebP 움짤을 바로 만들 수 있습니다.',
      '[📦 n종 ZIP]으로 감지된 컷을 한 번에 저장합니다.',
    ],
    content: [
      '- 카카오 표준 규격: 추출된 모든 에셋은 360×360 px 정사각 투명 PNG로 자동 패딩됩니다.',
      '- 모션 스튜디오 연계: 분할된 컷에 부드러운 움직임(GIF/WebP)을 즉시 적용할 수 있습니다.',
      '- 일괄 ZIP 다운로드: 감지된 컷 수만큼 ZIP으로 한 번에 저장합니다.',
    ].join('\n'),
  },
  {
    id: 'diagnostics-guide',
    title: '시스템 3대 모듈 자가진단 활용법',
    badge: '품질 보증',
    icon: '📋',
    quote: '상단 [📋 진단 로그 복사]로 메인 스튜디오·시트 분할기·시트 생성기 상태를 표준 리포트로 복사합니다.',
    lines: [
      '분할기 상단 [📋 진단 로그 복사]를 누르면 3대 모듈 점검이 클립보드에 복사됩니다.',
      '점검 항목: 투명도 감지, 4×5 그리드 정합성, 텍스트 보호, Canvas 2D 렌더러 무결성.',
      '토스트 「전사 진단 리포트가 복사되었습니다」가 뜨면 메모장에 붙여 넣으세요.',
    ],
    content: [
      '- 상단 [📋 진단 로그 복사]를 누르면 메인 스튜디오, 시트 분할기, 시트 생성기의 3대 핵심 모듈 상태(투명도 감지, 그리드 정합성, 텍스트 보호, 렌더러 무결성)가 클립보드에 표준 리포트로 복사됩니다.',
    ].join('\n'),
  },
]

export function guidebookWorkflow() {
  return {
    subtitle: 'Kakao 360 Pipeline',
    banner: '생성 → 분할 → 모션/ZIP',
    badge: '기본 스냅 4행 × 5열 = 20개 · 체커보드 미리보기',
    cards: GUIDEBOOK_SECTIONS.map((section, index) => ({
      n: String(index + 1).padStart(2, '0'),
      icon: section.icon,
      title: section.title,
      lines: section.lines,
      quote: section.quote,
    })),
  }
}
