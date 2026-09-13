# UI — 레이아웃 · 라벨 · 동결 규격

**메인 3단 레이아웃은 100% 동결.** 사이드바 폭 공식, 버튼 크기, 해당 패널 Tailwind/CSS를 “보기 좋게” 바꾸지 않는다. 뷰포트에 맞춰 줄어드는 것만 허용한다.

모든 뷰어/팝업 배경: 클래스 `checkerboard-bg`. `bg-white` 금지.

라벨 격리: 버튼 **Children**과 **`data-tooltip`**을 분리한다. 긴 설명은 툴팁/돋보기 HUD만.

---

## 1. 메인 스타일러 (App.jsx)

```
┌ left 480px ┐┌──────── center ≥360 ────────┐┌ right 340px ┐
│ 설정 카드   ││  100vh  1:1 캔버스           ││ 익스포트     │
│ 폰트/색     ││  하단 슬림 인포 36~42px      ││ PNG GIF ICO  │
│ 슬라이더    ││  [투명][다크][라이트]        ││              │
└──── 8px ───┴──────────────────────────────┴──── 8px ─────┘
```

- 가로 100%. 좌·우 세로 분할선 드래그 220~1100. 더블클릭 → 480 / 기본 우폭.
- 접기 ◀/▶ 시 해당 열 폭 0, 중앙이 가로를 채움.
- 시작 폭 480은 메인 포커스 단추가 잘리지 않게 하기 위함. 예전 500px 상한 없음.
- 16인치 1080p 100%에서 인포 바가 잘리면 실패.
- 상단: `❓ 빠른 시작 투어`, 화면비 1:1 / 16:9 / 9:16, `🧩 이모티콘 시트 분할기`, 모션 스튜디오 진입(툴팁: `움직이는 무한루프 GIF 제작 스튜디오 열기`).
- 호버 시 22px 돋보기 HUD (`MenuMagnifierHUD`).
- 빌드 칩: `APP_BUILD` (`2026.09.14-v2.4.1`).

### 1.1 공장 룩

- 텍스트: 龍 Dragon 풀점 (`DEFAULT_TEXT` in `presets.js`)
- 프리셋: 키치 스티커 콜라주
- 폰트: 배민 잘난체
- 크기: 70px (슬라이더 10~130, 70이 정중앙)
- 플레이트: 체커보드

### 1.2 단축키

방향키 1px, Shift+방향키 10px, Ctrl+Z / Ctrl+Y, Delete는 추가 레이어만.

---

## 2. 이모티콘 분할기

- 셸: 약 92vw × 86vh. 개발 뷰 1600 스케일.
- 기본 줌 35%, 휠/버튼 5% (10~200).
- 드롭존 + 그리드 슬라이더 + 모드 A / 모드 B.
- 버튼 예: `자동 28구 분할`, `원본 유지 | 벡터 오버레이 | 스마트 리컬러`, `🔪 배경 투명화 확인사살`, `📋 진단 로그 복사`, `📦 n종 ZIP`.
- 썸네일 클릭 → 640px 확대, 배경 `checkerboard-bg`.
- 첫 진입 PNG 가이드 모달 → 확인 후 빈 상태 `data-split-empty`.

---

## 3. 모션 GIF 스튜디오 (3열 동결)

권장 셸: 본체 분할기와 같이 와이드 모달. 내부 노스크롤 + 패널 스크롤.

```
┌ 헤더: 🎬 AI 모션 GIF 스튜디오 PRO     [💾 작업 저장] [📂 불러오기] [전체 ZIP] [✕] ┐
├──────────────┬──────────────────────────────┬────────────────────┤
│ SOURCES      │ 중앙 스테이지 + 시퀀서         │ MOTION PRESETS     │
│ 본체 그래픽   │  프리뷰 정사각 ≤44vh          │  & CONTROLS        │
│ 이모티콘 컷   │  재생 / 줌 − % +              │ 10 프리셋 토글      │
│ 내 PC 업로드  │  자막 ON 입력 폰트 꼬리        │ 루프·강도·FPS      │
│              │  컷 뱅크 / 타임라인            │ 캐릭터 자동 추출    │
│              │  채팅 시뮬 / 스펙 HUD          │ 픽셀 추출 / 원본복원│
│              │  [클립][GIF][WebP]            │ 캔버스 규격 select │
│              │                               │ 배경 합성 Layer 0  │
├──────────────┴──────────────────────────────┴────────────────────┤
│ 상태 / 자가진단 HUD                     [🚀 초고화질 무한루프 GIF 다운로드] │
└──────────────────────────────────────────────────────────────────┘
```

좌·중·우 폭과 이 버튼들의 패딩/높이를 바꾸지 말 것. 노트북에서 하단 3버튼이 잘리면 **뷰포트 스케일만** 조정 (이미 `data-studio-fit`).

### 3.1 헤더

| 요소 | data / 동작 |
|---|---|
| 제목 | `#mgs-title` `🎬 AI 모션 GIF 스튜디오 PRO` |
| 저장 | `data-session-save` |
| 불러오기 | `data-session-load` |
| 저장됨 표시 | `data-session-ind` |
| 이어하기 배너 | `data-session-resume` `[이어하기]` `data-session-resume-yes` / `[새로 시작]` `data-session-fresh` |
| 닫기 | 백드롭 클릭 **무시**. ✕·Esc → `data-close-confirm` → `data-close-save` / `data-close-discard` / `data-close-cancel` |

### 3.2 좌측 SOURCES

- `data-source-tab="canvas|cuts|drop"`
- 탭 라벨: `본체 그래픽` / `이모티콘 컷` / `내 PC 업로드`
- 드롭: `data-pc-dropzone`, 스테이지 `data-pc-stage-drop`, input `id="mgs-pc-upload"` multiple

### 3.3 중앙

- 스테이지 캔버스 `.mgs-preview-canvas`
- 재생 `data-play-toggle="stage"` `data-playing="run|pause"`
- 시퀀서 `data-still-loop="1"` (단일 소스)
- 툴바 2줄: (모션 텍스트 5 + 파티클 4) / (자막 ON `data-caption-on` · `data-caption-input` · 폰트 `data-caption-font` · 크기 · 색 · `data-caption-tail`)
- 텍스트 효과 `data-text-effect="none|bounce|shake|pulse|typewriter"`
- 파티클 `data-particle="sparkle|hearts|sweat|tears"`
- 컷 `data-seq-cut`, 제거 `data-seq-remove`
- 채팅 `data-chat-sim` `data-chat-mirror`
- 내보내기 `data-motion-export`
  - `data-clip-save` `💾 클립 저장`
  - `data-encode-fmt="gif"` `🎬 GIF로 내보내기`
  - `data-encode-fmt="webp"` `✨ WebP(투명) 내보내기`
  - busy 라벨 `⏳ 변환 중...`
- 진행 팝업 `data-encode-progress` `data-encode-gauge` `data-encode-state` `data-encode-pct`
- 알파 게이트 `data-alpha-gate` `data-alpha-export-as-is`

프리뷰 배경 CSS 체커보드는 **화면용**. GIF 픽셀에 넣지 않음.

### 3.4 우측

- 제목 고정: `MOTION PRESETS & CONTROLS`
- 프리셋 버튼 `data-motion-preset="{id}"` 다시 누르면 `none`
- `🪄 캐릭터 영역 자동 추출` `data-sprite-isolate` — 1.5초 네온 점선 후 isolate
- `✨ 초정밀 픽셀 추출` `data-pixel-studio-open`
- `🔄 원본 복원` `data-pixel-restore`
- 캔버스 규격 select (카카오 360 기본 등)
- `배경 합성 (Layer 0)` `data-bg-layer` `data-bg-select`

배경 옵션 라벨 (순서 고정):

1. 🏁 투명 (기본값)
2. 💡 화이트 스튜디오
3. 🎬 다크 스튜디오
4. 🌅 노을 그라데이션
5. 🌃 사이버 네온
6. 🌌 오로라 블루
7. ☁️ 파스텔 스카이
8. 💥 코믹 팝 옐로우
9. 📁 내 이미지 배경...

### 3.5 하단 HQ 버튼

- 클래스 `mgs-download` (크기 변경 금지)
- `data-hq-gif="1"`
- 라벨: `🚀 초고화질 무한루프 GIF 다운로드`
- 툴팁: `GIF로 내보내기와 같은 자동 투명·360 인코더로 저장합니다`
- 동작: GIF 내보내기와 **동일**. 변환 중 `⏳ 변환 중...`
- 옆에 자가진단 HUD. 단계 수는 `DIAG_STEPS.length`. “13단계” 금지.

### 3.6 픽셀 에디터 팝업

- `data-pixel-studio` 가로 최대, z-index ≥ 90
- `data-pixel-col="left|right"` 폭 **128px 1:1**
- 중앙 `data-pixel-canvas` object-contain, 강제 정사각 크롭 없음
- 돋보기 `data-pixel-loupe` 50×50
- 적용 `data-pixel-apply`

### 3.7 말풍선 핸들

- 미리보기만: 청록 P3, 노란 P1·P2, 히트 반경 12px (`TAIL_HANDLE_RADIUS`)
- GIF/WebP: `showHandles: false`

---

## 4. 자막 폰트 셀렉터 (10선, 순서 고정)

| id | 화면 이름 |
|---|---|
| Jua | 주아체 (귀여움) |
| Do Hyeon | 도현체 (굵은 강조) |
| CookieRun | 쿠키런체 (통통발랄) |
| TmonMonsori | 몬소리체 (임팩트) |
| GmarketSansBold | G마켓 산스 (모던) |
| Binggrae | 빙그레체 (부드러움) |
| Yeon Sung | 연성체 (손글씨) |
| GabiaBombaram | 봄바람체 (발랄) |
| NEXONLv1GothicBold | 배찌체 (아기자기) |
| Pretendard | 프리텐다드 (깔끔) |

상업용 무료 (Google Fonts / 눈누). `document.fonts.ready` 후 선로드. 인코더도 `ensureEmoticonFontsReady`.

---

## 5. 모션 프리셋 카드 라벨

| id | 라벨 |
|---|---|
| jellyBounce | ① Jelly Bounce |
| neonPulse | ② Neon Pulse |
| cuteWiggle | ③ Cute Wiggle |
| cinematicGlitch | ④ Cinematic Glitch |
| softFloating | ⑤ Soft Floating |
| angryShake | ⑥ Angry Shake |
| rollingTilt | ⑦ Rolling Tilt |
| squashStretch | ⑧ Squash Stretch |
| heartbeat | ⑨ Heartbeat |
| zoomPunch | ⑩ Zoom Punch |

---

## 6. 토큰

- 체커: `repeating-conic` 또는 프로젝트 기존 `.checkerboard-bg`
- 다크 플레이트: `#0f1117` / `#12121a`
- 화이트 스튜디오: `#f7f4ef` + warm vignette
- 다크 스튜디오: `#18181b` + dark vignette
- 악센트 청록: `#06b6d4` / `#22d3ee` (가이드·핸들)
- 본문 폰트 스택: Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic

---

## 7. 반응형 규칙

- 1920×1080과 1366×768에서 **버튼 박스 크기 동일**, 중앙 프리뷰 높이만 ≤44vh로 줄어 시퀀서/내보내기가 잘리지 않음.
- 좁은 개발 뷰: 1600 레이아웃을 축소해 브라우저 100%와 같은 3열 유지 (`data-studio-fit="1"`).
- 새 창/탭 무한 오픈 금지. Vite `server.open: false`.
