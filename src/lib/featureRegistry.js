import {
  checkAiMask,
  checkBackground,
  checkBuffers,
  checkDragEngine,
  checkEdit,
  checkEncoders,
  checkFavorites,
  checkFonts,
  checkGpu,
  checkHistory,
  checkLayerIsolation,
  checkLiveStatusHud,
  checkGifEngine,
  checkEmoticonSlicer,
  checkProEngine,
  checkFpsPipeline,
  checkTypography,
  checkZStack,
} from './diagnosticChecks.js'
import { GUIDE_SAMPLES } from './guideSamples.js'

export const GUIDE_CHAPTERS = [
  { id: 'basics', no: '01', label: '간단 설정 요약', depth: 'summary' },
  { id: 'canvas', no: '02', label: '캔버스·레이어 실전', depth: 'deep' },
  { id: 'crop', no: '03', label: '크롭·회전·필터', depth: 'deep' },
  { id: 'blend', no: '04', label: '배경 합성·블렌드', depth: 'deep' },
  { id: 'ai', no: '06', label: 'AI 마스크 실전 파이프라인', depth: 'deep' },
]

function feature(entry) {
  return {
    diagnosticFunction: null,
    guideContent: null,
    ...entry,
  }
}

export const APP_FEATURES_REGISTRY = [
  feature({
    id: 'gpu',
    name: 'Canvas 2D 하드웨어 가속',
    description: '브라우저 GPU 렌더링 컨텍스트 무결성 검증',
    diagnosticFunction: checkGpu,
  }),
  feature({
    id: 'buffer',
    name: '다중 해상도 픽셀 버퍼',
    description: '1:1 (1024×1024), 16:9 (1920×1080), 9:16 (1080×1920) 캔버스 메모리 할당 테스트',
    diagnosticFunction: checkBuffers,
  }),
  feature({
    id: 'fonts',
    name: '웹폰트 전수 스캔',
    description: '한글 서예/목각/영문 웹폰트 document.fonts.check() 개별 검사 및 미로드 폰트 캐싱',
    diagnosticFunction: checkFonts,
  }),
  feature({
    id: 'layers',
    name: '메인/서브 상태 독립성',
    description: '메인 타이틀과 서브 타이틀 간 상호 간섭 없는 독립 State 격리 무결성 검사',
    diagnosticFunction: checkLayerIsolation,
  }),
  feature({
    id: 'drag',
    name: '마우스 드래그 좌표 엔진',
    description: '캔버스 2D Transform, 장식 패딩 바운딩 박스, 히트박스 연산 테스트',
    diagnosticFunction: checkDragEngine,
  }),
  feature({
    id: 'type',
    name: '멀티라인 & 타이포 연산',
    description: '엔터 줄바꿈, 행간, 3단 텍스트 정렬 연산 정밀도 검사',
    diagnosticFunction: checkTypography,
  }),
  feature({
    id: 'stack',
    name: '레이어 Z-Index 스택',
    description: '서브(10) → 추가 → 메인(20) 페인트 랭크와 선택 박스 최상단 검증',
    diagnosticFunction: checkZStack,
  }),
  feature({
    id: 'history',
    name: 'Undo/Redo 무결성',
    description: '히스토리 스택 버퍼 크기 및 Ctrl+Z / Ctrl+Y 상태 롤백 동작 테스트',
    diagnosticFunction: checkHistory,
  }),
  feature({
    id: 'bg',
    name: '배경 합성 & 이미지 로더',
    description: 'FileReader 로컬 배경 이미지 로드, 블렌드 모드, 미리보기 투명/다크/라이트 플레이트 바인딩',
    diagnosticFunction: checkBackground,
  }),
  feature({
    id: 'edit',
    name: '그래픽 편집 & 크롭',
    description: '캔버스 자르기 좌표 연산, 회전/반전 및 필터(대비/채도/흑백) 엔진 검사',
    diagnosticFunction: checkEdit,
  }),
  feature({
    id: 'export',
    name: '익스포트 인코더 무결성',
    description: '투명 PNG, JPEG, 모션 GIF, .ICO 파비콘 인코더 동작 검증',
    diagnosticFunction: checkEncoders,
  }),
  feature({
    id: 'ai',
    name: 'AI 마스크 & 프롬프트 빌더',
    description: '순수 흑백 1024 마스크 추출 및 실시간 프롬프트 템플릿 정합성 테스트',
    diagnosticFunction: checkAiMask,
  }),
  feature({
    id: 'favorites',
    name: '폰트 즐겨찾기 & 로컬 스토리지',
    description: 'localStorage 즐겨찾기 직렬화 상태 및 폰트 카탈로그 매칭 무결성',
    diagnosticFunction: checkFavorites,
    guideContent: {
      chapterId: 'basics',
      order: 20,
      title: '⭐ 즐겨찾기',
      summary: [
        { title: '등록', body: '폰트 목록 우측 ⭐를 누르면 전역 목록과 localStorage에 즉시 저장됩니다.' },
        { title: '꺼내기', body: '메인/서브 선택기 첫 탭 [⭐ 즐겨찾기]에서 고릅니다. 적용은 지금 카드의 레이어에만 됩니다.' },
        { title: '주의', body: 'Ctrl+Z는 타이포만 되돌립니다. 별표 목록은 유지됩니다. 애용 글꼴 3~5종만 담으세요.' },
      ],
    },
  }),
  feature({
    id: 'live-hud',
    name: '실시간 텍스트 인포 바',
    description: '선택 레이어 글자 수·폰트·좌표 HUD, 1080p 슬림 도킹, 중앙 캔버스 뷰포트 정렬 검사',
    diagnosticFunction: checkLiveStatusHud,
    guideContent: {
      chapterId: 'canvas',
      order: 15,
      sectionId: 'hud',
      sectionLabel: 'Live HUD',
      title: '실시간 텍스트 인포 바',
      play: [
        {
          title: '캔버스 아래 슬림 인포 바를 본다',
          body: '미리보기 바로 아래에 36~42px 슬림 바가 도킹됩니다. [👑 메인] / [✨ 서브] 배지, 글자 수/줄 수, 폰트명·크기·자간·행간, 좌표·회전·투명도, 프리셋, FPS가 가로 1줄에 들어갑니다. 16인치 1080p·100% 배율에서는 페이지 스크롤 없이 한 화면에 보입니다.',
          params: ['슬림 바 36~42px', '글자 수 / 줄 수', '폰트 · px · 자간 · 행간', 'X/Y · 회전 · 투명도', '프리셋 · FPS'],
          tip: '레이어 카드를 바꾸거나 캔버스에서 글자를 클릭하면 HUD가 그 레이어로 바뀝니다. 폰트 목록에 호버하면 미리보기 폰트명도 따라갑니다.',
          fail: '바가 화면 아래로 잘리면 브라우저 확대가 100%인지 확인하세요. 캔버스는 상단 툴바·하단 바를 뺀 높이에 맞춰 줄어듭니다.',
        },
        {
          title: '해상도가 달라도 캔버스는 가운데',
          body: '스튜디오는 100vh 안에 3단 레이아웃을 고정합니다. 중앙 열은 툴바와 하단 인포 바를 뺀 나머지 높이에 캔버스를 aspect-fit으로 맞춥니다. #main-canvas-area가 좌표 기준점이라, 모니터 배율이나 창 크기가 달라도 글자가 좌상단으로 쏠리지 않습니다.',
          params: ['100vh / overflow hidden', 'max-height: calc(100vh - 220px)', '#main-canvas-area = 상대 좌표 원점'],
          tip: '다른 PC에서 글자가 한쪽으로 붙거나 인포 바가 잘리면 자가진단의 인포 바/뷰포트 항목을 먼저 돌려 보세요.',
          fail: '브라우저 확대만 과도하면 칩이 가로로 스크롤됩니다. 인포 바 높이는 유지되고, 좁은 화면에서도 2~3열로 쌓이지 않습니다.',
        },
      ],
    },
  }),
  feature({
    id: 'gif-engine',
    name: 'GIF 모션 엔진 & 렌더러',
    description: '네온 펄스·소프트 플로팅·시네마틱 페이드 프리셋, 프레임 버퍼, 인코더 로드 검증',
    diagnosticFunction: checkGifEngine,
    guideContent: {
      chapterId: 'ai',
      order: 8,
      sectionId: 'gif',
      sectionLabel: 'GIF 모션',
      title: '🎬 GIF 애니메이션 활용 팁 및 프롬프트 연동 가이드',
      sample: GUIDE_SAMPLES['neon-cyber'],
      play: [
        {
          title: '모션 프리셋을 고른 뒤 GIF를 받는다',
          body: '중앙 툴바 [🎬 GIF 다운로드] 또는 우측 [움직이는 GIF]를 누릅니다. 생성 중 캔버스 한가운데에 0~100% 진행 바가 뜨고, 끝나면 파일이 자동 저장됩니다. 루프는 약 2초입니다.',
          params: ['네온 펄스', '소프트 플로팅', '시네마틱 페이드'],
          tip: '쇼츠 썸네일은 네온 펄스, 채널 배너는 소프트 플로팅, 릴스 인트로는 시네마틱 페이드가 잘 맞습니다.',
          fail: '진행 바가 멈추면 글자가 너무 크거나 해상도가 높을 수 있습니다. 화면 맞춤으로 줄인 뒤 다시 시도하세요.',
        },
        {
          title: 'Grok 프롬프트에 모션 키워드를 붙인다',
          body: '마스크+영문 프롬프트를 복사한 뒤, 움직이는 결과물을 원할 때 키워드를 덧붙입니다. 네온 펄스: looping neon glow, breathing outline light. 소프트 플로팅: gentle vertical float, soft hover title. 시네마틱 페이드: cinematic fade in-out, scale pulse intro.',
          params: ['looping neon glow', 'gentle vertical float', 'cinematic fade in-out'],
          tip: 'Grok 프로 대화에는 마스크를 먼저 첨부하고, 마법 문장 뒤에 위 키워드를 한 줄로 붙이세요. 이 앱 GIF는 타이포 모션용, Grok은 질감 합성용입니다.',
          fail: '프롬프트에 "video, 24fps film"만 넣고 마스크를 빼면 글자 형태가 녹습니다. 항상 흑백 마스크를 함께 보내세요.',
        },
      ],
    },
  }),
  feature({
    id: 'emoticon-slicer',
    name: '🧩 이모티콘 슬라이서 & ZIP 엔진 상태',
    description: '2열 와이드 모달, 가이드 1:1 픽셀 매핑, 360 안전여백 contain-fit, 하단 텍스트 보존, JSZip 점검',
    diagnosticFunction: checkEmoticonSlicer,
    guideContent: {
      chapterId: 'ai',
      order: 12,
      sectionId: 'emoticon',
      sectionLabel: '이모티콘 시트',
      title: '🧩 AI 이모티콘 30종 시트 생성 및 원클릭 분할 가이드',
      sample: GUIDE_SAMPLES['kakao-sticker'],
      play: [
        {
          title: 'AI에서 균일한 30종 시트를 뽑는다',
          body: 'Grok / Midjourney / DALL·E에 흰 배경 그리드 시트를 요청합니다. 추천 영문: white background, sticker sheet, kawaii emoticons, even spacing, 5x6 grid array of 30 unique stickers, no text, no watermark, square cells. 행과 열이 흔들리면 모드 B에서 절단선을 드래그해 칸을 맞추는 편이 정확합니다.',
          params: ['white background', 'sticker sheet', '5x6 grid array', '30 unique stickers'],
          tip: '셀 사이 여백이 충분해야 스마트 자동 감지가 잘 됩니다. 붙어 있거나 칸이 들쭉날쭉한 시트는 모드 B에서 절단선을 드래그해 맞추세요.',
          fail: '복잡한 사진 배경 시트는 객체가 한 덩어리로 잡힙니다. 반드시 흰 배경 또는 투명 배경 시트를 쓰세요.',
        },
        {
          title: '분할 후 카카오 스튜디오에 올린다',
          body: '상단 [🧩 이모티콘 시트 분할기]는 가로가 긴 2열 스튜디오입니다. 오른쪽 절단선은 미리보기 줌/팬과 무관하게 0~1 비율로 원본 픽셀에 1:1 매핑됩니다. 각 칸은 360×360에 종횡비를 유지한 채 최대 88%(상하좌우 약 20px 안전 여백) 안에 들어가 하단 글자가 테두리에 잘리지 않습니다. 왼쪽에서 시트 업로드·모드 A/B·ZIP·썸네일을 다루고, 호버 시 다크 네온 설명 툴팁만 뜹니다. [텍스트 가독성]은 하단 35% 글자만 바꿉니다.',
          params: ['가이드 1:1 픽셀 매핑', '360 contain · 6% 안전 여백', '하단 텍스트 보존', '독립 플로팅 툴팁', '3× 슈퍼샘플링'],
          tip: '가로 절단선은 글자 아래까지 내려 맞추세요. 잘릴 듯하면 하단 경계를 조금 더 내리면 캡션이 칸에 포함됩니다.',
          fail: '카카오에 JPG나 직사각형 원본을 올리면 거절될 수 있습니다. 반드시 이 분할기가 만든 360 정사각 PNG를 쓰세요.',
        },
      ],
    },
  }),
  feature({
    id: 'pro-engine',
    name: '⚡ 고급 편의 엔진 (스냅/단축키/곡선/JSON/커스텀폰트)',
    description: '자석 스냅, 방향키 너지, 곡선 텍스트, 2중 외곽선, 프로젝트 JSON, FontFace 커스텀 폰트, 1x/2x/4x 스케일',
    diagnosticFunction: checkProEngine,
    guideContent: {
      chapterId: 'canvas',
      order: 22,
      sectionId: 'pro',
      sectionLabel: '전문가 단축키',
      title: '⚡ 전문가 단축키 & 고급 타이포그래피(곡선/2중외곽선/JSON)',
      play: [
        {
          title: '방향키·자석 스냅으로 1px 맞춘다',
          body: '선택한 레이어를 방향키로 1px, Shift+방향키로 10px 옮깁니다. 드래그하면 캔버스 정중앙(X/Y 50%) 근처에서 네온 가이드가 뜨며 붙습니다. Delete는 추가 레이어만 지우고, 메인/서브는 잠겨 있습니다. Ctrl+Z / Ctrl+Y와 같이 히스토리에 남습니다.',
          params: ['↑↓←→ = 1px', 'Shift+방향키 = 10px', '중앙 자석 스냅', 'Delete = 추가 레이어'],
          tip: '입력창에 커서가 있으면 단축키가 글자 입력으로 갑니다. 캔버스나 빈 곳을 한 번 클릭한 뒤 방향키를 쓰세요.',
          fail: '[🔒 위치 잠금]이 켜져 있으면 방향키와 드래그가 무시됩니다.',
        },
        {
          title: '곡선 텍스트와 2중 외곽선을 켠다',
          body: '왼쪽 카드의 [🌙 곡선 텍스트]를 -180°~+180°로 밀면 원형/반원 아치가 됩니다. [2차 외곽선] 색과 두께로 유튜브 썸네일형 이중 테두리를 칩니다. 바깥 테두리가 먼저, 안쪽 테두리와 본문 색이 그 위에 올라갑니다.',
          params: ['곡선 -180° ~ +180°', '1차 외곽선', '2차 외곽선'],
          tip: '프리셋 쉐이더와 곡선을 동시에 쓰면 곡선 경로의 단색+외곽선이 우선입니다. 네온 프리셋을 유지하려면 곡선을 0에 두세요.',
          fail: '곡선이 과하면 글자가 잘립니다. 크기를 줄이거나 곡선을 90° 근처로 낮추세요.',
        },
        {
          title: '커스텀 폰트·JSON·고해상도·스타일 프롬프트',
          body: '폰트 선택창 상단에 TTF/OTF/WOFF를 올리면 FontFace로 즉시 등록됩니다. 우측에서 프로젝트 JSON 저장/불러오기, PNG 1x/2x/4x 배율, [⚡ 스타일 프롬프트 복사]로 지금 색·타이포 무드를 Grok/Midjourney에 붙여넣습니다. 캔버스 모서리 [투명/다크/라이트]를 누르면 미리보기 래퍼 배경이 바로 바뀝니다. 투명=체커보드, 다크=#0f1117, 라이트=#ffffff. 글자 픽셀만 캔버스에 그리고 플레이트는 CSS라 검정이 고정되지 않습니다. 투명 PNG 내보내기는 그대로입니다.',
          params: ['FontFace 업로드', 'JSON 입출력', '1x / 2x / 4x PNG', '스타일 프롬프트'],
          tip: '4x는 16:9에서 7680×4320까지 커질 수 있습니다. 글자가 많으면 2x부터 시도하세요.',
          fail: 'JSON에 레이어 배열이 없으면 불러오기가 거절됩니다. 이 앱에서 저장한 파일만 쓰세요.',
        },
      ],
    },
  }),
  feature({
    id: 'fps-pipeline',
    name: '⚡ 실시간 렌더링 FPS 및 파이프라인 레이턴시 감시',
    description: 'requestAnimationFrame 델타와 캔버스 페인트 지연시간(ms)을 실시간 점검',
    diagnosticFunction: checkFpsPipeline,
    guideContent: {
      chapterId: 'canvas',
      order: 24,
      sectionId: 'fps',
      sectionLabel: 'FPS 감시',
      title: '⚡ 실시간 렌더링 FPS 및 파이프라인 레이턴시',
      play: [
        {
          title: '하단 HUD에서 60FPS를 확인한다',
          body: '캔버스 아래 인포 바의 [엔진] 칸에 `60 FPS / 지연시간 14ms (안정적)`처럼 표시됩니다. rAF 델타로 화면 갱신률을, 미리보기 페인트 시간으로 파이프라인 지연을 잽니다. 50FPS 이상·24ms 이하면 안정적입니다.',
          params: ['rAF 델타 = FPS', 'drawLivePreview 시간 = 지연(ms)', '안정적 / 주의 / 지연'],
          tip: '좌우 패널을 접어 캔버스를 넓혀도 FPS 칸은 그대로 보입니다. 4x 내보내기는 미리보기 FPS와 별개입니다. 상단 [🩺 시스템 정밀 자가진단] → [🚀 전체 정밀 진단 시작]은 레지스트리 전 단계를 120ms 간격으로 순차 실행하며, 게이지가 [1/N]부터 [N/N] 100% 완료까지 멈추지 않아야 합니다.',
          fail: '노트북 전원 절약 모드에서는 30FPS로 떨어질 수 있습니다. 성능 모드로 바꾸거나 격자/스티커를 잠시 끄세요. 자가진단이 1단계에서 멈추면 창을 닫지 말고 다시 시작하세요. 단계 시간 초과 시 해당 카드는 WARN으로 넘어가고 나머지 검사는 계속됩니다.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-basics',
    name: '간단 설정 요약',
    description: '폰트, 컬러, 슬라이더, 레이아웃, 내보내기 압축 안내',
    guideContent: {
      chapterId: 'basics',
      order: 10,
      title: '📖 챕터 1. 간단 설정 요약 — 폰트·컬러·슬라이더',
      sample: GUIDE_SAMPLES['gold-dragon'],
      kicker: '매일 쓰는 기본 조작만 한 장에 모았습니다. 배치·크롭·합성·AI는 다음 챕터에서 단계별로 다룹니다.',
      visuals: [
        { tone: 'layout', chips: ['왼쪽 설정', '|', '중앙 캔버스', '우측 익스포트'], split: true },
      ],
      summary: [
        { title: '3단 레이아웃', body: '왼쪽↔캔버스 사이 세로선을 드래그하면 폭이 바뀌고, 더블클릭하면 360px로 돌아갑니다. 패널 모서리 [◀]/[▶]로 좌·우 패널을 접으면 캔버스가 넓어집니다. 상단 [❓ 빠른 시작 투어]는 핵심 버튼 4곳을 짚어 줍니다. 버튼 위에 마우스를 올리면 22px 돋보기 HUD가 뜹니다. 상단 1:1 / 16:9 / 9:16으로 미리보기 화면비를 바꿉니다. 스튜디오는 100vh에 맞춰 스크롤 없이 한 화면에 두고, 캔버스는 하단 슬림 인포 바(36~42px)를 밀어내지 않게 세로로 줄어듭니다. 16인치 1080p·100% 배율에서 인포 바가 잘리지 않아야 합니다. 캔버스 모서리 [투명]/[다크]/[라이트]는 미리보기 플레이트를 즉시 바꿉니다. 투명은 체커보드, 다크는 #0f1117, 라이트는 흰색이며 투명 PNG 내보내기는 그대로입니다.' },
        { title: '폰트 선택', body: '레이어 카드의 폰트 버튼을 열고 카테고리 탭을 고른 뒤 항목에 호버하면 캔버스가 미리봅니다. 클릭하면 그 레이어에만 적용됩니다. 메인과 서브는 서로 간섭하지 않습니다.' },
        { title: '컬러 픽커', body: '카드 하단 [텍스트 / 외곽선 / 그림자] 색 칸을 누릅니다. 외곽선 두께 0이면 테두리가 없고, 2~6이 포스터에 무난합니다. 그림자 블러는 8~18이 읽기 좋습니다.' },
        { title: '슬라이더', body: '크기·자간·줄간격·회전·투명도·가로/세로 위치는 드래그만으로 반영됩니다. 손을 떼면 히스토리에 남으므로 Ctrl+Z로 되돌릴 수 있습니다. 줄간격 권장 구간은 챕터 2를 보세요.' },
        { title: '프리셋 원클릭', body: '🎨 올인원 / ✍️ 캘리그라피 / 🪵 목각 탭에서 카드를 누르면 그 레이어 스타일만 바뀝니다. 키치 스티커는 올인원에서 해당 프리셋을 고른 뒤 하단에 나타납니다.' },
        { title: '내보내기·단축키', body: '우측에서 투명 PNG, JPEG, 모션 GIF, ICO를 고릅니다. PNG는 1x/2x/4x 배율을 고른 뒤 받습니다. GIF는 네온 펄스·소프트 플로팅·시네마틱 페이드 중 하나를 고른 뒤 [🎬 GIF 다운로드]로 받습니다. AI 이모티콘 시트는 상단 [🧩 이모티콘 시트 분할기] 2열 와이드 스튜디오에서 줌/팬으로 칸을 맞춘 뒤, 하단 텍스트만 색 보정한 360×360 ZIP으로 받습니다. 방향키 1px, Shift+방향키 10px, Ctrl+Z 실행 취소, Ctrl+Y 다시 실행, Delete는 추가 레이어만 지웁니다(메인/서브 잠금).' },
      ],
    },
  }),
  feature({
    id: 'guide-canvas-place',
    name: '자유 배치 및 바운딩 박스',
    description: '드래그 이동, 스케일, 회전, 정중앙 복구',
    guideContent: {
      chapterId: 'canvas',
      order: 10,
      sectionId: 'place',
      sectionLabel: '자유 배치',
      title: '📖 챕터 2. 캔버스 인터랙티브 조작 & 레이어 고급 편집',
      kicker: '글자를 마우스로 붙잡고, 시 구절로 줄을 나누고, 낙관을 글자 뒤로 깔아 한 장의 작품처럼 쌓는 실전 순서입니다.',
      visuals: [
        { chips: ['좌클릭 드래그 = 이동', '모서리 = Scale', '위쪽 점 = Rotation', '🎯 정중앙'] },
      ],
      play: [
        {
          title: '레이어를 선택해 바운딩 박스를 켠다',
          body: '왼쪽에서 👑 메인 또는 ✨ 서브 카드를 누르거나, 캔버스 위 글자를 한 번 클릭합니다. 선택되면 청록(메인) 또는 핑크(서브) 점선 상자가 글자·외곽선·그림자·스티커까지 여유 패딩을 두고 감쌉니다. 상자가 안 보이면 위치 잠금이 켜져 있는지 확인하세요.',
          params: ['커서가 grab이면 이동 가능', '🔒 위치 잠금 OFF', '안전 패딩 14px + 장식 여백'],
          tip: '여러 레이어가 겹치면 메인 타이틀이 서브보다 앞에 그려집니다. 안 잡히면 왼쪽 카드를 눌러 선택을 확정하세요.',
          fail: '상단 [🔒 위치 잠금]이 켜져 있으면 드래그가 무시됩니다. 버튼을 다시 눌러 해제하세요.',
        },
        {
          title: '좌클릭 후 드래그로 위치 이동',
          body: '상자 안쪽(글자 몸통)을 누른 채 마우스를 옮깁니다. 좌표는 캔버스 중앙을 원점(0,0)으로 하는 상대값이라, 화면비가 바뀌어도 비율이 유지됩니다. 정밀 이동은 왼쪽 카드의 가로/세로 위치 슬라이더를 함께 쓰세요.',
          params: ['이동 핸들 = 상자 내부', '격자 ON이면 시각 가이드'],
          tip: '📐 격자/눈금을 켜 두면 중앙 십자와 48px 칸이 보여 여백을 맞추기 쉽습니다.',
          fail: '가장자리 빈 픽셀을 잡으면 선택이 풀리거나 다른 레이어로 넘어갑니다. 글자 획이 있는 곳을 누르세요.',
        },
        {
          title: '모서리 핸들로 실시간 Scale',
          body: '상자 오른쪽 아래 작은 네모를 잡고 바깥으로 끌면 글자가 커지고, 안쪽으로 끌면 작아집니다. 슬라이더 범위는 20~350px이며, [📏 화면 맞춤]을 누르면 캔버스 가로의 약 85% 안에 들어오도록 자동 축소됩니다. 너무 키우면 가장자리에서 잘리므로 크롭 전에 여백을 남기세요.',
          params: ['크기 20~350px', '화면 맞춤 = 폭 85%', '낙관도 동일 범위'],
          tip: '크기만 바꾸고 위치는 유지하려면 스케일 핸들만 쓰고, 상자 내부를 다시 드래그하지 마세요.',
          fail: '회전 점(위쪽 원)과 스케일 네모를 혼동하면 각도가 틀어집니다. 크기만 바꿀 때는 반드시 모서리 네모입니다.',
        },
        {
          title: '위쪽 원 핸들로 Rotation',
          body: '상자 위쪽 작은 원을 좌우로 끌면 그 레이어만 회전합니다. 미세 각도는 카드의 🔄 회전 슬라이더(-180~180°)가 더 정확합니다. 시는 보통 -6~6°, 낙관은 -12~12°가 자연스럽습니다.',
          params: ['시 타이포 -6~6°', '낙관 -12~12°'],
          tip: '전체를 90° 돌리고 싶다면 레이어 회전이 아니라 상단 [🔄 90° 시계방향]을 쓰세요. 그건 배경+글자 전체를 돌립니다.',
          fail: '레이어 회전과 캔버스 90° 회전을 겹치면 방향이 예측과 달라집니다. 먼저 🎯으로 리셋한 뒤 하나만 적용하세요.',
        },
        {
          title: '[🎯 정중앙 정렬]로 1초 복구',
          body: '좌표가 밖으로 나가거나 기울기가 꼬이면 캔버스 위 [🎯 정중앙 정렬]을 누릅니다. 현재 선택된 레이어의 위치 오프셋이 0으로 돌아가 화면 한가운데에 놓입니다. 회전값까지 0으로 맞추려면 왼쪽 회전 슬라이더를 0으로 돌리세요.',
          params: ['대상 = 현재 선택 레이어', 'Undo로 직전 좌표 복구 가능'],
          tip: '메인만 가운데 두고 서브는 아래에 두려면, 메인을 선택한 채 🎯을 누른 다음 서브를 따로 아래로 드래그하세요.',
          fail: '다른 레이어가 선택된 채로 🎯을 누르면 그 레이어만 이동합니다. 카드의 포커스 배지를 보고 대상을 확인하세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-canvas-type',
    name: '멀티라인 시 타이포 연산',
    description: '엔터 줄바꿈, 행간, 좌중우 정렬',
    guideContent: {
      chapterId: 'canvas',
      order: 20,
      sectionId: 'poem',
      sectionLabel: '시 타이포',
      title: '멀티라인 시(詩) 타이포 연산',
      play: [
        {
          title: 'Enter로 구절을 나눈다',
          body: '메인/서브 입력칸에서 Enter를 누르면 줄이 바뀝니다(\\n). 한 줄에 우겨 넣지 말고 호흡 단위로 2~4행을 만드세요. 미리보기 상자는 가장 긴 줄을 기준으로 폭을 잡습니다.',
          params: ['2~4행 권장', '행당 4~10자(한글)'],
          tip: '짧은 행과 긴 행을 섞으면 중앙 정렬이 시처럼 보입니다. 좌측 정렬은 일기·캡션에 맞습니다.',
          fail: '스페이스만으로 줄을 맞추면 폰트가 바뀔 때 전부 어긋납니다. 반드시 Enter로 나누세요.',
        },
        {
          title: 'Line-Height(행간) 1.2~1.8배를 고른다',
          body: '카드의 ↕️ 줄간격 슬라이더 범위는 0.8~2.5배입니다. 캘리그라피·시는 1.2~1.8배가 안정적입니다. 1.0 이하는 획이 겹치고, 2.0 이상은 구절이 따로 노는 포스터가 됩니다.',
          params: ['권장 1.2~1.8배', '제목 1줄: 1.15 전후', '3행 시: 1.45 전후'],
          tip: '획이 굵은 잘난체·주아는 1.5 근처, 가는 명조·필기체는 1.25~1.4가 읽기 좋습니다.',
          fail: '행간을 키운 뒤 스케일까지 키우면 화면 밖으로 나갑니다. 행간 → 위치 → 크기 순으로 맞추세요.',
        },
        {
          title: '좌 / 중 / 우 정렬을 구절에 맞춘다',
          body: '입력칸 아래 [⬅️ 좌측 정렬] [⏺️ 중앙 정렬] [➡️ 우측 정렬]은 여러 줄의 가로 기준점만 바꿉니다. 시는 ⏺️ 중앙, 캡션·주소는 ⬅️ 좌측, 낙관 옆 작은 문구는 ➡️ 우측이 잘 맞습니다.',
          params: ['시·포스터: 중앙', '정보 문구: 좌측', '서명: 우측'],
          tip: '메인 중앙 + 서브 우측처럼 레이어마다 다르게 두면 포스터 계층이 살아납니다.',
          fail: '정렬은 레이어 단위입니다. 메인만 바꾸고 서브가 그대로면 의도한 대칭이 아닙니다. 양쪽 카드를 각각 확인하세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-canvas-z',
    name: '레이어 Z-Index 겹침',
    description: '메인, 서브, 낙관의 앞뒤 배치',
    guideContent: {
      chapterId: 'canvas',
      order: 30,
      sectionId: 'stack',
      sectionLabel: 'Z-Index',
      title: '레이어 앞뒤 겹침 (Z-Index)',
      play: [
        {
          title: '그리는 순서 = 화면의 앞뒤',
          body: '카드 화살표로 배열 순서를 바꿀 수 있습니다. 렌더는 역할 랭크를 따릅니다. 격자/배경 z-index 1, 가이드 5, 서브 타이틀 10, 추가 레이어 12, 메인 타이틀 20, 선택 바운딩 박스 30, 하단 인포 바 40입니다. 그래서 메인 글자가 서브·장식 아래로 숨지 않습니다.',
          params: ['서브 = 10', '메인 = 20', '선택 박스 = 30', '인포 바 = 40'],
          tip: '카드를 눌러 대상을 고른 다음 화살표를 누르세요. 메인/서브도 순서를 바꿀 수 있지만 삭제는 잠겨 있습니다.',
          fail: '다른 카드가 선택된 채 화살표를 누르면 엉뚱한 레이어가 이동합니다. 포커스 배지를 보고 누르세요.',
        },
        {
          title: '붉은 낙관을 글자 뒤로 깔기',
          body: '[낙관] 버튼을 눌러 인장 레이어를 만든 뒤, 한 글자(예: 印, 壽)만 넣고 캔버스 오른쪽 아래로 옮깁니다. 낙관 카드에서 [⬇️ 한 단계 아래로] 또는 [🔄 맨 뒤로]를 눌러 메인/서브보다 아래에 두면, 먹글씨 뒤로 도장이 비칩니다. 반대로 도장을 글자 위에 찍으려면 낙관을 [🔝 맨 앞으로] 하세요.',
          params: ['아래 깔기: 낙관 맨 뒤로', '위에 찍기: 낙관 맨 앞으로', '낙관 투명도 70~90%'],
          tip: '전통 작품은 도장이 글자를 살짝 가리게 위에 두는 경우가 많습니다. 수묵 포스터는 뒤로 깔아 번짐처럼 보이게 합니다.',
          fail: '낙관 폰트 크기가 메인보다 크면 앞뒤와 관계없이 화면을 집어삼킵니다. 먼저 크기를 줄인 뒤 Z-Index를 조정하세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-crop',
    name: '고급 자르기 Crop',
    description: '오버레이 구도, 비율 프리셋, 적용',
    guideContent: {
      chapterId: 'crop',
      order: 10,
      sectionId: 'crop',
      sectionLabel: '자르기',
      title: '📖 챕터 3. 캔버스 자르기 · 회전 · 그래픽 필터',
      kicker: '구도를 확정하고, 앵글을 비틀고, 명암을 밀어 글자가 배경에서 떠오르게 만드는 편집 파이프라인입니다.',
      visuals: [
        { chips: ['✂️ 자유 자르기', '1:1 / 16:9 / 자유', '✓ 크롭 적용'] },
      ],
      play: [
        {
          title: '[✂️ 자유 자르기 / 크롭]을 켠다',
          body: '캔버스 위 편집 툴바에서 가위 버튼을 누릅니다. 노란 오버레이가 뜨고 아래 안내가 “크롭 박스를 드래그해 영역을 잡고 ✓ 적용 / ✕ 취소를 누르세요”로 바뀝니다. 글자 드래그는 이 동안 잠시 쉬고, 박스만 움직입니다.',
          params: ['모드 ON = 노란 박스', '글자 드래그 일시 정지'],
          tip: '크롭은 미리보기에서 레터박스로 보이고, 저장·마스크에는 잘린 실제 픽셀이 들어갑니다. 적용 전에 1:1 화면비로 맞춰 두면 AI 마스크와 구도가 일치합니다.',
          fail: '크롭을 켠 채 레이어를 옮기려 하면 박스만 움직입니다. 글자를 옮기려면 ✕ 취소로 크롭을 끄세요.',
        },
        {
          title: '오버레이를 드래그해 구도를 잡는다',
          body: '박스 안을 드래그하면 영역이 통째로 이동합니다. 모서리·변 핸들을 끌면 크기만 바뀝니다. 남기고 싶은 글자와 여백이 상자 안에 들어오게 맞추세요. 너무 타이트하면 획 끝이 잘립니다.',
          params: ['내부 드래그 = 이동', '핸들 = 리사이즈', '여백 4~8% 권장'],
          tip: '인물 사진 배경이면 얼굴이 잘리지 않게 상단 여백을 더 주세요. 타이포 포스터는 글자 주변에 숨 쉴 공간을 남깁니다.',
          fail: '박스가 글자보다 작으면 PNG/마스크에서 획이 잘립니다. 적용 전 마스크 뷰로 한 번 확인하세요.',
        },
        {
          title: '비율 프리셋을 고른다',
          body: '크롭 툴바에서 [1:1 정사각형] [16:9 썸네일] [4:3] [자유 비율]을 고릅니다. 1:1은 인스타·AI 마스크, 16:9는 유튜브 썸네일, 자유는 기존 구도를 살릴 때 씁니다. 비율을 바꾸면 상자가 그 비에 맞춰 다시 잡힙니다.',
          params: ['AI/인스타: 1:1', '유튜브: 16:9', '실험 구도: 자유'],
          tip: '상단 스튜디오 화면비(1:1/16:9/9:16)와 크롭 비율을 같게 두면 미리보기와 저장본 느낌이 일치합니다.',
          fail: '화면비는 9:16인데 크롭만 16:9로 두면 저장 구도가 미리보기와 다릅니다. 둘을 맞춰 주세요.',
        },
        {
          title: '[✓ 크롭 적용]으로 확정한다',
          body: '구도가 끝나면 [✓ 크롭 적용]을 누릅니다. [✕ 취소]는 이번 시도만 버리고, [크롭 해제]는 이미 적용된 자르기를 없앱니다. 적용 후 마음에 안 들면 Ctrl+Z로 되돌릴 수 있습니다.',
          params: ['✓ 적용 = 확정', '✕ 취소 = 이번만 포기', '크롭 해제 = 기존 크롭 삭제'],
          tip: 'AI 마스크를 뽑기 직전에 크롭을 확정하세요. 마스크와 컬러본의 구도가 같아집니다.',
          fail: '적용하지 않고 다른 메뉴만 누르면 박스가 남아 혼란스럽습니다. 확정 또는 취소 중 하나는 꼭 누르세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-rotate-filter',
    name: '회전 반전 그래픽 필터',
    description: '90도, 플립, 밝기 대비 채도 수묵',
    guideContent: {
      chapterId: 'crop',
      order: 20,
      sectionId: 'filter',
      sectionLabel: '회전·필터',
      title: '회전 · 반전 · 그래픽 필터',
      play: [
        {
          title: '90° 회전으로 앵글을 만든다',
          body: '[🔄 90° 시계방향]은 글자만이 아니라 배경 포함 전체 캔버스를 오른쪽으로 돌립니다. 세로 사진을 썸네일 가로 구도로 바꾸거나, 목각 타이포를 세로 현판처럼 세울 때 한 번(또는 세 번) 누르세요.',
          params: ['1클릭 = +90°', '4클릭 = 원위치'],
          tip: '레이어 회전 슬라이더와 겹치면 방향이 꼬입니다. 전체 앵글은 90° 버튼, 한 글자만 기울이려면 카드의 회전 슬라이더를 쓰세요.',
          fail: '크롭 상태에서 회전하면 상자가 구도와 어긋날 수 있습니다. 크롭을 확정하거나 취소한 뒤 회전하세요.',
        },
        {
          title: '좌우/상하 반전으로 시선을 뒤집는다',
          body: '[↔ 좌우 반전]은 거울처럼 가로로, [↕ 상하 반전]은 세로로 뒤집습니다. 캘리그래피가 왼쪽 여백이 넓을 때 좌우 반전하면 시선이 글자로 모입니다. 배경 인물이 글자를 가리면 좌우 반전으로 빈 쪽으로 보낼 수 있습니다.',
          params: ['좌우 = 거울', '상하 = 뒤집기', '둘 다 ON = 180°와 유사하나 다름'],
          tip: '한자·세로쓰기는 좌우 반전 시 획 방향이 어색해질 수 있습니다. 한글 헤드라인은 대체로 안전합니다.',
          fail: '반전 후 낙관 위치가 반대편으로 갑니다. 도장만 다시 드래그해 오른쪽 아래로 되돌리세요.',
        },
        {
          title: '필터로 글자/배경 명도 대비를 극대화한다',
          body: '[🎨 그래픽 필터]를 열어 슬라이더를 조합합니다. 기본값은 밝기 100, 대비 100, 채도 100, 비네팅 0, 수묵 0입니다. 글자가 배경에 묻히면 대비를 올리고 배경은 왼쪽 패널에서 어둡게, 글자는 밝은 색으로 갑니다.',
          params: [
            '밝기 88~110',
            '대비 118~145 (텍스트 가독)',
            '채도 70~90 (사진), 120~150 (네온)',
            '비네팅 18~35',
            '수묵 흑백화 0 (컬러) / 70~100 (수묵)',
          ],
          tip: '수묵 작품: 수묵 80 + 대비 130 + 채도 0에 가깝게. 네온: 수묵 0, 채도 140, 대비 120, 비네팅 25. 필터 초기화로 언제든 100/100/100으로 돌아갑니다.',
          fail: '밝기만 올리면 글자와 배경이 같이 하얘져 대비가 죽습니다. 밝기는 소폭, 대비를 먼저 올리세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-blend',
    name: '커스텀 배경 합성 블렌딩',
    description: '업로드, 불투명도, 블러, Multiply Screen Overlay',
    guideContent: {
      chapterId: 'blend',
      order: 10,
      sectionId: 'upload',
      sectionLabel: '업로드·가독성',
      title: '📖 챕터 4. 커스텀 배경 합성 & 블렌딩 기법',
      kicker: '내 사진을 올리고, 투명도와 블러로 글자를 살린 다음, 블렌드 모드로 질감을 입히는 순서입니다.',
      visuals: [
        { chips: ['파일 로드', '불투명도 40~70%', '블러 3~8px', 'Multiply / Screen / Overlay'] },
      ],
      play: [
        {
          title: '왼쪽에서 사진 파일을 로드한다',
          body: '좌측 [📁 배경 이미지 업로드] → [배경 이미지 선택]으로 JPG/PNG를 고릅니다. 이미지는 캔버스를 덮도록 확대됩니다. 마음에 안 들면 [🗑️ 배경 이미지 삭제]로 지우고 다시 올리세요.',
          params: ['권장: 2000px 이상', '형식: JPG / PNG'],
          tip: '인물·음식 사진은 글자가 얼굴·접시 위에 올라가지 않게 미리 빈 공간을 남겨 촬영하면 크롭이 수월합니다.',
          fail: '용량이 매우 큰 원본은 저장 시 스튜디오 자동저장에서 배경이 빠질 수 있습니다. 4K 이하로 줄여 올리세요.',
        },
        {
          title: '불투명도 40~70%로 글자 자리를 만든다',
          body: '[배경 불투명도] 기본은 약 85%라 사진이 강합니다. 복잡한 배경에서는 40~70%로 낮춰 글자색이 드러나게 하세요. 어두운 네온 글자면 배경을 55% 전후, 검은 캘리그래피면 45~60%가 무난합니다.',
          params: ['기본 ≈ 85%', '가독 구간 40~70%', '네온 50~60%', '수묵 45~60%'],
          tip: '불투명도를 낮춘 뒤에도 글자가 묻히면 다음 단계에서 블러를 올리고, 그래도 안 되면 필터 대비를 올리세요.',
          fail: '0%로 내리면 배경이 사라져 합성 의미가 없습니다. 20% 아래는 텍스처만 남고 사진 정보가 거의 없습니다.',
        },
        {
          title: '블러 3~8px로 초점을 글자에 둔다',
          body: '[배경 블러] 범위는 0~20px입니다. 3~8px면 사진 디테일은 남고 획이 읽힙니다. 작은 글씨(서브 32px)는 6~8px, 큰 메인 타이틀은 3~5px면 충분합니다. 15px 이상은 배경이 안개처럼 변합니다.',
          params: ['권장 3~8px', '서브 타이틀 6~8px', '대형 헤드 3~5px'],
          tip: '블러와 불투명도를 동시에 올리지 마세요. 불투명도 55% + 블러 5px처럼 한쪽만 강하게 가는 편이 깨끗합니다.',
          fail: '블러를 최대로 두면 GPU가 무거워지고 미리보기가 버벅일 수 있습니다. 8px를 넘기기 전에 크롭으로 산만한 영역을 먼저 자르세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-blend-modes',
    name: '블렌드 모드 실전',
    description: 'Multiply Screen Overlay 사용 장면',
    guideContent: {
      chapterId: 'blend',
      order: 20,
      sectionId: 'modes',
      sectionLabel: '블렌드 모드',
      title: '블렌드 모드 실전 활용',
      play: [
        {
          title: 'Multiply (곱하기) — 한지·수채화 질감',
          body: '블렌드 모드에서 Multiply를 고르면 배경의 어두운 결이 글자 쪽으로 곱해집니다. 한지, 수채 번짐, 목판 스캔을 올렸을 때 흰 종이가 투명해지고 결만 남습니다. 밝은 배경 + 어두운 먹글씨 조합이 정석입니다.',
          params: ['배경: 밝은 한지/수채', '글자: 짙은 먹(#111~#222)', '불투명도 50~70%'],
          tip: '수묵 흑백화 필터를 20~40만 얹으면 색 잡티가 줄어 더 한지처럼 보입니다.',
          fail: '이미 어두운 야경 사진에 Multiply를 쓰면 전체가 죽처럼 어두워집니다. 야경은 Screen을 쓰세요.',
        },
        {
          title: 'Screen (스크린) — 네온을 어둠 위에',
          body: 'Screen은 밝은 픽셀을 남기고 어두운 픽셀을 투과시킵니다. 밤거리, 블랙 스튜디오, 우주 배경 위에 사이버 네온·크롬 글자를 올릴 때 선택하세요. 글자색은 시안/마젠타처럼 밝게, 배경 불투명도는 55~70%가 빛납니다.',
          params: ['배경: 어두운 사진', '글자: 네온 밝은 색', '채도 필터 120~150'],
          tip: '비네팅 20~30을 주면 가장자리가 더 어두워져 중앙 네온이 살아납니다.',
          fail: '흰 하늘 사진에 Screen을 쓰면 글자가 날아갑니다. 하이키 사진은 Normal 또는 Overlay가 안전합니다.',
        },
        {
          title: 'Overlay (오버레이) — 유화·목판을 강하게 융합',
          body: 'Overlay는 중간 톤은 살리고 명암을 과장합니다. 유화 질감, 대장경 목판, 콘크리트  Graffiti 배경을 글자와 한 덩어리로 붙일 때 씁니다. 대비가 세지므로 글자 외곽선을 1~2만 남기거나 0으로 두세요.',
          params: ['질감 강한 스캔본', '대비 필터 110~125', '외곽선 0~2'],
          tip: '목각 프리셋 + Overlay 배경이 가장 잘 맞습니다. 결이 글자 획 안으로 스며듭니다.',
          fail: '이미 대비 높은 셀카에 Overlay를 쓰면 피부가 타고 글자 에일리어싱이 도드라집니다. 그런 사진은 Soft-Light나 Normal로 내리세요.',
        },
      ],
    },
  }),
  feature({
    id: 'guide-ai-grok-pro',
    name: 'Grok 프로 무과금 3단계 워크플로',
    description: '구독자 전용 마스크 첨부 + 마법 문장 + 렌더 저장',
    guideContent: {
      chapterId: 'ai',
      order: 1,
      sectionId: 'grok-pro',
      sectionLabel: 'Grok 프로',
      title: '📖 챕터 6. AI 마스크 실전 파이프라인',
      kicker: '형태는 이 앱에서 확정하고, 질감은 Grok 프로 대화창 또는 외부 모델·앱 안 원클릭으로 입힙니다.',
      workflow: {
        banner: '⭐ 추천 워크플로우: Grok 프로(무과금/구독자 전용) 완벽 활용 가이드',
        subtitle: 'Grok Pro Workflow Example · API 키 없이 구독만으로 완성',
        cards: [
          {
            n: '1',
            icon: '🎭',
            title: '1단계: 마스크 & 프롬프트 추출',
            lines: [
              '우측 패널에서 [🎭 1024×1024 AI 흑백 마스크 다운로드]를 클릭합니다. 검은 배경에 흰색 글자 형태의 무손실 PNG가 저장됩니다.',
              '[📋 AI 프롬프트 전체 복사] 또는 [📋 프롬프트 전체 복사]를 눌러 현재 프리셋·문구에 맞춰 자동 생성된 영문 Positive/Negative를 클립보드에 담습니다.',
            ],
          },
          {
            n: '2',
            icon: '📎',
            title: '2단계: Grok 프로에 이미지 업로드 및 프롬프트 전송',
            lines: [
              'Grok 대화창에 방금 받은 흑백 마스크 이미지를 첨부(업로드)합니다. 컬러 미리보기가 아니라 마스크 파일이어야 자형이 유지됩니다.',
              '복사한 영문 프롬프트 앞에 아래 한국어 마법 문장을 덧붙여 한 번에 입력합니다.',
            ],
            quote: '첨부된 흑백 이미지의 흰색 글자 형태와 외곽선을 그대로 유지하면서, 다음 프롬프트 스타일로 고화질 아트워크를 렌더링해줘: [복사한 영문 프롬프트]',
          },
          {
            n: '3',
            icon: '🖼️',
            title: '3단계: 렌더링 완성 및 다운로드',
            lines: [
              'Grok이 흰색 글자 실루엣을 가이드라인으로 삼아 지정 질감(수묵화, 3D 액체 크롬, 목각 판화, 키치 스티커 등)을 입힙니다.',
              '타이포 외곽선이 무너지지 않았는지 확인한 뒤 고화질 결과 이미지를 저장합니다. 형태가 녹으면 1단계 마스크를 굵은 폰트로 다시 뽑으세요.',
            ],
          },
        ],
        badge: '💡 API 키를 따로 발급받거나 추가 결제할 필요 없이, 기존 Grok 프로 구독만으로 가장 간편하게 고화질 아트워크를 생성할 수 있습니다.',
      },
    },
  }),
  feature({
    id: 'guide-ai-a',
    name: '외부 AI 툴 마스크 파이프라인',
    description: '마스크 다운로드, 프롬프트 복사, ControlNet 설정',
    guideContent: {
      chapterId: 'ai',
      order: 10,
      sectionId: 'method-a',
      sectionLabel: '방법 A',
      title: '방법 A. 외부 툴 (Flux / SDXL / Midjourney)',
      kicker: 'ControlNet이 있는 생성기는 같은 마스크·프롬프트를 파라미터로 고정해 넣습니다. 마스크와 설명이 어긋나면 글자가 녹으니 순서를 지키세요.',
      visuals: [
        { chips: ['🎭 마스크 PNG', '📋 프롬프트 복사', 'Weight 0.85~1.0', 'CFG 5.0'] },
      ],
      methods: [
        {
          id: 'A',
          title: '방법 A. 외부 툴 (Grok / Flux / Midjourney / SDXL)',
          intro: 'ControlNet Inpainting 또는 이미지-투-이미지에 넣을 순수 흑백 마스크와, 현재 프리셋·문구에 맞춘 영문 프롬프트를 이 앱에서 추출합니다.',
          steps: [
            {
              title: '우측 [🎭 1024×1024 AI 흑백 마스크] 다운로드',
              body: '화면비를 1:1로 맞춘 뒤 버튼을 누릅니다. 글자=순수 흰색(#FFFFFF), 배경=순수 검정(#000000) PNG가 저장됩니다. 이것이 ControlNet / Inpainting의 형태 입력입니다. 받기 전 상단 [AI 흑백 마스크 뷰]로 실루엣이 깨지지 않았는지 확인하세요.',
              params: ['권장 화면비 1:1', '글자 흰색 / 배경 검정', '크롭 확정 후 다운로드'],
              tip: '얇은 필기체는 마스크에서 획이 끊길 수 있습니다. 외곽선 두께를 1~2 올리거나 글자 크기를 키운 뒤 다시 받으세요.',
              fail: '회색 안티앨리어싱이 많으면 모델이 글자 경계를 흐립니다. 마스크 뷰에서 가장자리가 번지면 폰트를 굵은 고딕·목각으로 바꾸세요.',
            },
            {
              title: '[📋 프롬프트 전체 복사] 또는 [📋 AI 프롬프트 원클릭 복사]',
              body: '우측 프롬프트 패널의 전체 복사로 Positive+Negative를 클립보드에 담습니다. Midjourney용이 필요하면 아래 칩 [Midjourney용 (--ar …)]을 누르세요. 프롬프트는 현재 메인 문구, 프리셋, 폰트 분위기를 반영해 자동 생성됩니다.',
              params: ['full = Positive+Negative', 'mj 칩 = --ar 포함'],
              tip: '복사전 메인 텍스트와 프리셋을 확정하세요. 복사 후 글을 바꾸면 마스크와 설명이 어긋납니다.',
              fail: '한글만 붙여 넣으면 모델이 글자를 다시 그리려 합니다. 앱이 만든 영문 프롬프트를 그대로 쓰고, 글자 내용은 마스크가 담당하게 하세요.',
            },
            {
              title: '외부 툴에 마스크+프롬프트를 올리고 생성 파라미터를 고정한다',
              body: 'Flux / SDXL ControlNet Inpainting: 마스크를 형태 이미지로 올리고 프롬프트를 붙여 넣습니다. ControlNet Weight 0.85~1.0이면 글자 실루엣이 유지되고, 0.6 이하면 글자가 녹습니다. CFG 5.0 전후가 질감과 형태 균형에 좋습니다. Grok 이미지에도 마스크를 참조로 넣고 같은 프롬프트를 붙이세요. Midjourney는 --ar을 이미 붙인 칩을 쓰고, 마스크는 별도 워크플로(또는 앱 내 생성)를 병행하세요.',
              params: ['ControlNet Weight 0.85~1.0', 'CFG 5.0', 'Steps 28~36 (SDXL)', 'Denoise 0.45~0.65 (i2i)'],
              tip: '형태가 흔들리면 Weight를 0.95~1.0으로, 질감이 안 입혀지면 0.85와 denoise를 살짝 올립니다. Seed를 고정하면 같은 구도로 질감만 비교할 수 있습니다.',
              fail: '컬러 미리보기 PNG를 마스크 슬롯에 넣으면 형태가 깨집니다. 반드시 흑백 마스크 파일을 넣으세요. Weight 1.0 + denoise 0.9는 글자를 새로 그려 타이포가 붕괴합니다.',
            },
          ],
        },
      ],
    },
  }),
  feature({
    id: 'guide-ai-b',
    name: '앱 내부 원클릭 AI 생성',
    description: '모달에서 엔진 선택, 키 입력, 생성 시작',
    guideContent: {
      chapterId: 'ai',
      order: 20,
      sectionId: 'method-b',
      sectionLabel: '방법 B',
      title: '방법 B. 앱 내부 원클릭 AI 생성 모달',
      methods: [
        {
          id: 'B',
          title: '방법 B. [🚀 AI 실제 렌더링 생성] 워크플로',
          intro: '마스크와 프롬프트를 브라우저에서 바로 Fal.ai / Replicate / Grok로 보냅니다. 키는 이 기기 localStorage에 난독화되어 저장되며 서버로 수집되지 않습니다.',
          steps: [
            {
              title: '우측 [🚀 AI 실제 렌더링 생성하기]를 연다',
              body: 'API 설정 & 실제 렌더링 모달이 열립니다. 열기 전에 1:1 구도, 크롭, 텍스트를 확정하세요. 모달은 현재 마스크와 최적화 프롬프트를 함께 전송합니다.',
              params: ['사전 확정: 텍스트·프리셋·크롭'],
              tip: '먼저 마스크 뷰로 실루엣을 확인하고 모달을 열면 실패율이 줄어듭니다.',
              fail: '빈 텍스트나 너무 가는 획으로 생성하면 결과물이 얼룩만 남습니다. 메인 타이틀을 먼저 채우세요.',
            },
            {
              title: '엔진을 고르고 API Key를 입력한다',
              body: 'API 엔드포인트에서 Fal.ai (FLUX.1 ControlNet), Replicate (SDXL), Grok / Custom, 또는 키 없는 로컬 시뮬레이션을 고릅니다. 해당 칸에 키를 넣고 생성하면 브라우저에만 저장됩니다. 키가 없거나 원격이 실패하면 로컬 고화질 시뮬레이션으로 대체됩니다.',
              params: ['Fal.ai Key', 'Replicate Token', 'Grok / xAI Key', 'Custom URL 선택 사항'],
              tip: '테스트는 로컬 시뮬레이션으로 타이밍·게이지를 확인한 뒤, 실제 키로 한 장만 뽑아 보세요.',
              fail: '키를 채팅창이나 스크린샷에 올리지 마세요. 공용 PC라면 사용 후 키 칸을 비우세요.',
            },
            {
              title: '[✨ 원클릭 AI 변환 시작] 후 게이지를 보고 다운로드한다',
              body: '버튼을 누르면 실시간 타이머와 프로그레스 게이지가 올라갑니다(경과 시간 / 남은 시간 / %). 완료되면 미리보기와 [고화질 완성본 다운로드]가 나타납니다. 생성 중에는 모달을 닫지 마세요.',
              params: ['버튼: ✨ 원클릭 AI 변환 시작', '완료: 고화질 완성본 다운로드'],
              tip: '노란 안내가 보이면 원격 실패 후 로컬 시뮬레이션 결과입니다. 키와 네트워크를 점검한 뒤 다시 시도하세요.',
              fail: '생성 중 새로고침하면 작업이 끊깁니다. 게이지가 100%가 될 때까지 기다리세요.',
            },
          ],
        },
      ],
    },
  }),
]

export function getDiagnosticFeatures() {
  return APP_FEATURES_REGISTRY.filter((item) => typeof item.diagnosticFunction === 'function')
}

export const DIAG_STEPS = getDiagnosticFeatures().map((item) => ({
  id: item.id,
  title: item.name,
  hint: item.description,
}))

export function getGuidebookChapters() {
  return GUIDE_CHAPTERS.map((chapter) => {
    const features = APP_FEATURES_REGISTRY
      .filter((item) => item.guideContent?.chapterId === chapter.id)
      .sort((a, b) => (a.guideContent.order ?? 100) - (b.guideContent.order ?? 100))
    const title = features.find((item) => item.guideContent.title)?.guideContent.title
      || `📖 ${chapter.label}`
    const sections = features
      .filter((item) => item.guideContent.sectionId)
      .map((item) => ({
        id: item.guideContent.sectionId,
        label: item.guideContent.sectionLabel || item.name,
      }))
    return { ...chapter, title, features, sections }
  })
}
