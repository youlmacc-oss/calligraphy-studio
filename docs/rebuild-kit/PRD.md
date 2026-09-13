# PRD — Calligraphy Studio / AI Motion GIF Studio PRO

버전: **2.4.1** (`APP_BUILD = 2026.09.14-v2.4.1`)  
플랫폼: 브라우저 SPA (Vite + React). 백엔드 인코더 없음.

---

## 1. 문제와 목표

카카오/라인 이모티콘 제작자가 **투명 PNG 시트 → 컷 분할 → 360 모션 GIF/WebP**를 한 화면에서 끝내게 한다. 외부 API 비용 없이 Canvas 2D와 `gifenc`로 인코딩한다.

성공 조건: 다른 PC에서 이 MD 세트만으로 아래 3대 모듈이 **동일 규격·동일 라벨·동일 파이프라인**으로 동작한다.

| 모듈 | 역할 |
|---|---|
| 메인 텍스트 스타일러 | 키치/서예 타이포 편집, 투명 PNG/JPEG/GIF/ICO 내보내기 |
| 이모티콘 시트 분할기 | 4×5(20) 기본, 7×4(28) 등 그리드, 무손실 바이패스, T=18 투명화 |
| 모션 GIF 스튜디오 | 3소스 탭, 10종 모션, 자막 10선, 3점 꼬리, 360 GIF/WebP |

---

## 2. 사용자

- 역할: 이모티콘/스티커 제작자 (한국어 UI)
- 환경: Windows 데스크톱·13~15인치 노트북. 브라우저 Edge/Chrome
- 비목표: 모바일 전용 앱, 서버 렌더, 유료 폰트 번들

---

## 3. 기능 요구사항

### 3.1 메인 스타일러

- 첫 실행 기본 텍스트는 **龍 Dragon 풀점**. 기본 프리셋 **키치 스티커 콜라주** (`kitsch-sticker`), 기본 폰트 **배민 잘난체** (`jalnan`), 기본 크기 70px.
- 3단 레이아웃: 왼쪽 설정 / 중앙 1:1 캔버스 / 우측 익스포트. 좌 기본 480px, 우 기본 340px, 리사이저 220~1100px, 중앙 최소 360px.
- 화면비 1:1 / 16:9 / 9:16. 스튜디오 100vh, 스크롤 없이 한 화면.
- 미리보기 플레이트: 체커보드 / 다크 `#0f1117` / 라이트. **투명 PNG 픽셀은 바꾸지 않음.**
- 레이어: 메인(잠금 삭제 금지) + 서브 + 추가 레이어. Undo/Redo.
- 폰트 탭: 헤드라인/본문/명조/영문/스크립트/디스플레이. 버튼 Children과 `data-tooltip` 분리. 크롬 라벨 ≤16자(면제 클래스 제외).
- 내보내기: 투명 PNG 1x/2x/4x, JPEG, 본체 GIF(네온 펄스·소프트 플로팅·시네마틱 페이드), ICO.
- 모션 스튜디오로 넘길 때 `exportCleanCanvas`로 가이드/격자/플레이트를 뺀 순수 투명 PNG만 전달.
- localStorage 키 `styler-studio-pro-v6`. 공장 리비전 `2026.08.29-kitsch-text`.
- AI 생성 모달(원격/시뮬), API 키는 `styler-api-keys-v1`.

### 3.2 이모티콘 시트 분할기

- 권장 시트: 투명 PNG **4행 × 5열 = 20컷**. 프리셋 7×4(28), 6×4(24), 4×4(16).
- 투명 시트: **무손실 바이패스** — 원본을 360×360 중앙에 올림. 픽셀 깎기 금지.
- 불투명 시트: **4모서리 BFS T=18**, 폐곡선(ㅇ·눈동자) 비관통, 1.5px 페더, 1px 디프린지.
- 텍스트 엔진 3단: 원본 유지 / 벡터 오버레이 / 스마트 리컬러. 기본 원본 유지.
- 모드 A: CCA 스마트 감지. 모드 B: 0.5mm 가이드 + Y1~Y2 칼재단. **모드 B 기하 재작성 금지.**
- 내부 고립 구멍 투명화 기본 OFF. 글자 바운딩 박스 보호.
- 결과 360×360 투명 PNG. ZIP 일괄. 확대 팝업은 `checkerboard-bg`, `bg-white` 금지.
- `[📋 진단 로그 복사]`로 3대 모듈 JSON 리포트.

### 3.3 모션 GIF 스튜디오

**소스 3탭** (정규화: `main→canvas`, `emoticon→cuts`, `upload→drop`)

| 탭 | 동작 |
|---|---|
| 본체 그래픽 | 스타일러 스냅샷. 컷 뱅크/분할기 숨김 |
| 이모티콘 컷 | 분할 컷만 뱅크에 표시. 클릭 시 타임라인 추가 |
| 내 PC 업로드 | 다중 PNG/JPG/WebP 클릭·드롭. 상단 컷만 추가, 타임라인은 별도 클릭 |

**모션 프리셋 10종 + 없음**

`none`(기본, 토글 해제), `jellyBounce`, `neonPulse`, `cuteWiggle`, `cinematicGlitch`(`rgbGlitch` 별칭), `softFloating`, `angryShake`, `rollingTilt`, `squashStretch`, `heartbeat`, `zoomPunch`.

파라미터: 루프 0.5~4s(기본 2), 강도 10~100(기본 70), 시퀀서 FPS 4~24(기본 8), 배속 0.5/1/1.5/2.

**레이어**

- Layer 0 배경: 투명(기본), 화이트 스튜디오 `#f7f4ef`, 다크 스튜디오 `#18181b`, 그라데이션 5종, 사용자 이미지(360 Cover 1회 캐시).
- Layer 1 캐릭터 모션 24fps 프리뷰 / 출력 FPS 별도.
- Layer 2 자막: 폰트 10선(기본 주아체), ON/OFF, 빈 입력이면 예시 문구 합성 금지. 말풍선 꼬리 3점(P1·P2 노란 부착, P3 청록 끝). 내보내기에는 핸들 없음.

**텍스트 모션 5종:** 없음 / 바운스 / 쉐이크 / 펄스 / 타이핑.  
**파티클 4종:** 반짝이 / 하트 / 땀방울 / 눈물 (다중 선택).  
**핑퐁:** 1-2-3-4-3-2.

**픽셀 추출:** 가로 최대 팝업, 좌우 툴바 128px 1:1, 중앙 원본비 contain. 브러시/지우개 1·2·4·8·16, 매직완드, 50×50 정밀확대.

**세션:** 키 `MOTION_STUDIO_ACTIVE_SESSION`, IndexedDB `calligraphy-studio-session`, 24시간. 이어하기는 탭 유지. 저장 안 함/새로 시작은 `canvas` 리셋. 바깥 클릭으로 닫기 금지. ✕/Esc는 저장 후 닫기 / 저장 안 함 / 취소.

**내보내기 (동일 파이프라인)**

`[🎬 GIF로 내보내기]`, `[✨ WebP(투명) 내보내기]`, `[🚀 초고화질 무한루프 GIF 다운로드]` 세 버튼 중 GIF 두 개는 **같은 함수**(`MotionExportPanel.requestExport('gif')`).

공통 단계: 투명 게이트 → `sanitizeExportFrames` → `composeStillMotionCanvases`/`composeSequenceCanvases` → 360×360 `gifenc` + Floyd-Steinberg, `dispose:2`, `transparentIndex: 0x00`, NETSCAPE 무한루프. 저장은 `showSaveFilePicker`(webdriver면 기본 다운로드).

클립 저장은 영구 슬롯만 ZIP. 파일명 `motion-01.gif`.

---

## 4. 비기능 요구

- Zero-Layout-Shift: 메인 3단 컨테이너·버튼 크기 Tailwind/CSS 변경 금지. 뷰포트만 유연.
- 체커보드 강제: 뷰어/팝업 `checkerboard-bg`, `bg-white` 금지.
- 순수 Canvas 2D. 텍스트는 `fillText`/`strokeText`.
- 인코더는 프레임마다 `setTimeout(0)`/`yieldToMain`으로 메인 스레드 양보. 진행률 100% 완주.
- HUD 단계 수는 하드코드 금지. `DIAG_STEPS.length` 사용.
- 개발 서버: 포트 5173, `server.open: false`, 기존 브라우저 탭 재사용.

---

## 5. 수용 기준 (요약)

상세는 `ACCEPTANCE.md`. 최소:

1. `npm run diagnose` 전 항목 PASS (`tests/autoRepair.test.js`).
2. `npm run test:loop` — 분할 28칸, 픽셀 에디터, GIF+WebP 인코드, 드롭 탭 세션, 닫기 컨펌.
3. 노트북 1366×768과 1920×1080에서 시퀀서 3버튼(클립/GIF/WebP)이 뷰포트 안에 보임.
4. 스타일러 → 스튜디오 알파 전달 시 체커보드가 GIF에 구워지지 않음.
5. HQ 무한루프 버튼과 GIF 내보내기 결과 인코더가 동일.

---

## 6. 명시적 비범위

- 메인 3단 폭/버튼 리디자인
- T=18, 모드 B 기하, `gifMotion.js` 샘플 공식, 인코더 360, 픽셀 엔진, 자막 10선/3점 꼬리 엔진 **재작성**
- gifenc를 다른 GIF 라이브러리로 교체
- Git 자동 커밋 (백업·배포 문구로 잠금 해제하기 전)
