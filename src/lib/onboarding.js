export const ONBOARD_STORAGE_KEY = 'styler-onboard-v1'

export const ONBOARD_STEPS = [
  {
    id: 'emo',
    target: '[data-tour="emo-split"]',
    title: '🧩 이모티콘 30종 분할기',
    body: 'AI가 만든 스티커 시트를 올리면 360×360 PNG와 ZIP으로 한 번에 나눕니다. 모드 B에서는 1px 절단선과 외곽 재단선을 드래그하고, 선을 추가·삭제할 수 있습니다.',
  },
  {
    id: 'gif',
    target: '[data-tour="gif-export"]',
    title: '🎬 GIF 애니메이션 내보내기',
    body: '네온 펄스·소프트 플로팅·시네마틱 페이드 중 하나를 고른 뒤 이 버튼으로 움직이는 GIF를 받습니다. 우측 허브에도 같은 기능이 있습니다.',
  },
  {
    id: 'keys',
    target: '[data-tour="nudge"]',
    title: '⌨️ 키보드 단축키 & 자석 스냅',
    body: '방향키는 1px, Shift+방향키는 10px입니다. 글자를 드래그하면 캔버스 정중앙에서 네온 가이드가 붙습니다. Ctrl+Z / Ctrl+Y로 되돌리세요.',
  },
  {
    id: 'hud',
    target: '[data-tour="live-hud"]',
    title: '📊 하단 실시간 인포 바',
    body: '선택한 레이어의 글자 수, 폰트, 좌표, 프리셋과 캔버스 FPS/지연시간이 캔버스 아래 슬림 바에 바로 반영됩니다. 16인치 화면에서도 잘리지 않게 한 줄로 도킹됩니다.',
  },
]

export function loadOnboardDone() {
  try {
    return localStorage.getItem(ONBOARD_STORAGE_KEY) === 'done'
  } catch {
    return false
  }
}

export function saveOnboardDone() {
  try {
    localStorage.setItem(ONBOARD_STORAGE_KEY, 'done')
  } catch {
    /* ignore */
  }
}
