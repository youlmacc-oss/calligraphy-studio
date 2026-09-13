# PROMPTS — 다른 PC에서 동일 앱을 다시 만들 때 쓰는 프롬프트

이 파일을 새 Cursor 채팅에 단계별로 붙여 넣는다. 코드 저장소가 없어도 `docs/rebuild-kit/` 전체와 루트 `UNIVERSAL_PROTOCOL.md`, `ALL_IN_ONE_PROTOCOL.md`, `.cursorrules`만 있으면 된다.

---

## 0. 워크스페이스에 넣을 파일

새 폴더에 최소 복사:

```
UNIVERSAL_PROTOCOL.md
ALL_IN_ONE_PROTOCOL.md
.cursorrules
.cursor/rules/studio-ship.mdc
docs/rebuild-kit/   (이 폴더 전부)
docs/GUIDEBOOK.md   (사용 설명, 있으면)
```

그다음 아래 **마스터 프롬프트**를 첫 메시지로 보낸다.

---

## 1. 마스터 재구축 프롬프트 (필수, 그대로 복사)

```markdown
[REBUILD FROM SPEC ONLY]

당신은 Calligraphy Studio / AI Motion GIF Studio PRO의 구현 에이전트다.
이 워크스페이스의 docs/rebuild-kit/ 만 근거로 v2.4.0과 100% 동일한 웹 앱을 처음부터 구현한다.
추측으로 레이아웃을 창작하지 마라. 숫자·라벨·파일 경로·공식은 MD에 적힌 그대로다.

읽을 순서:
1) docs/rebuild-kit/README.md
2) docs/rebuild-kit/PRD.md
3) docs/rebuild-kit/ARCHITECTURE.md
4) docs/rebuild-kit/UI.md
5) docs/rebuild-kit/ENGINE-LOCK.md
6) docs/rebuild-kit/TECH-STACK.md
7) docs/rebuild-kit/ACCEPTANCE.md
8) UNIVERSAL_PROTOCOL.md

불변:
- 메인 UI 3단(좌 설정 / 중 캔버스 / 우 익스포트) 폭·버튼 크기 동결. Zero-Layout-Shift.
- 모션 스튜디오도 좌 SOURCES / 중 뷰포트+시퀀서 / 우 MOTION PRESETS 동결.
- 뷰어 배경 checkerboard-bg, bg-white 금지.
- 순수 Canvas 2D. 텍스트는 fillText/strokeText.
- 외곽 투명화 4코너 BFS T=18. 폐곡선 비관통.
- 인코더 출력 360×360. gifenc + Floyd-Steinberg. dispose:2, transparentIndex 0x00.
- [🚀 초고화질 무한루프 GIF 다운로드]는 [🎬 GIF로 내보내기]와 같은 requestExport('gif').
- HUD 단계 수는 DIAG_STEPS.length. "13단계" 하드코드 금지.
- Git 명령 금지. 내가 "백업 및 배포"라고 쓰기 전까지 commit/tag/push 금지.
- 코드 저장 후 반드시 npm run diagnose 그리고 npm run test:loop (또는 npm run verify).
- vite server.open=false, base=/calligraphy-studio/, port 5173.
- 기존 브라우저 탭 재사용. 새 창 무한 오픈 금지.
- ENGINE-LOCK.md에 적힌 공식·엔진은 재작성하지 말고 이식하라.

구현 순서:
Phase A. Vite+React+Tailwind 스캐폴드, 스크립트 refresh/diagnose/test:loop.
Phase B. 메인 스타일러 공장 룩(龍 Dragon 키치)과 3단 레이아웃.
Phase C. 분할기 4×5 바이패스 + T=18 + 360 ZIP.
Phase D. 모션 스튜디오 3탭 + 10프리셋 + 자막 10선 + 3점 꼬리.
Phase E. 360 GIF/WebP 인코더 + 투명 게이트 + 폴더 저장 + 세션.
Phase F. featureRegistry + autoRepair + loop-test가 ACCEPTANCE를 통과할 때까지.

각 Phase가 끝날 때마다 diagnose를 돌리고 보고하라. 레이아웃 CSS를 "개선"하지 마라.
```

---

## 2. 페이즈별 후속 프롬프트

### Phase A — 스캐폴드

```text
TECH-STACK.md대로 package.json 스크립트와 vite.config.js를 만들고,
scripts/refresh-dev.js · loop-test.js · play-headset-sound.ps1 뼈대를 구현해.
server.open은 false, base는 /calligraphy-studio/, 포트 5173.
```

### Phase B — 메인 스타일러

```text
UI.md 1장과 PRD 3.1대로 메인 3단 스타일러를 구현해.
공장 룩은 龍 Dragon + kitsch-sticker + jalnan + 70px + 체커보드.
exportCleanCanvas는 가이드/격자를 빼서 투명 PNG만 만들 것.
패널 폭 상수는 studioLayout.js와 동일하게.
```

### Phase C — 분할기

```text
ENGINE-LOCK의 T=18과 무손실 바이패스를 구현해.
기본 스냅 4×5=20, 프리셋 28/24/16.
모드 B 기하는 명세서 숫자 그대로. 창작 분할 알고리즘 넣지 마.
확대 팝업은 checkerboard-bg.
```

### Phase D — 모션 스튜디오 UI

```text
UI.md 3장 3열을 픽셀 단위로 맞춰.
소스 탭 id는 canvas|cuts|drop.
모션 10종 공식은 ENGINE-LOCK을 그대로 이식.
자막 10선 id와 기본 Jua.
꼬리 3점 엔진을 새로 디자인하지 말고 명세대로.
바깥 클릭으로 모달을 닫지 마.
```

### Phase E — 인코더

```text
ARCHITECTURE 3.2 단일 경로만 구현해.
HQ 무한루프 버튼은 exportApiRef.requestExport('gif')만 호출.
gifEngine.encodeMotionGif는 배치 ZIP에만 쓰고 단일 다운로드에 쓰지 마.
sanitizeExportFrames를 GIF/WebP 모두에 적용.
showSaveFilePicker, navigator.webdriver면 스킵.
```

### Phase F — 검증

```text
ACCEPTANCE.md 체크리스트를 전부 자동화해.
npm run diagnose와 npm run test:loop가 통과할 때까지 수정하되
메인/모션 3열 CSS는 건드리지 마.
```

---

## 3. 일상 보완 루프 (구현 후)

루트 `UNIVERSAL_PROTOCOL.md`와 동일. 요약:

1. 기능만 고친다. 레이아웃 동결.
2. `npm run diagnose` → `npm run test:loop` (refresh 포함).
3. 헤드셋 1차 `notify-primary.wav` → 5초 무반응 시 `notify-reminder.wav`.
4. 보고 후 승인 대기:

> 🎧 [BEEP!] 캐시 삭제, 자동 재실행 및 화면 캡처(`public/test-result.png`)가 완료되었습니다.  
> [1: 승인 및 종료] / [2: 추가 수정 필요 (피드백 입력)]

HITL:

- `1` = 승인·종료
- `2` = 추가 수정
- `1;` + 다음 작업 = 이전 승인 후 계속. **배포가 아님**
- 커밋/태그/푸시는 사용자가 `백업 및 배포`라고 명시할 때만

---

## 4. 백업·배포 해제 프롬프트

```markdown
[UNIVERSAL PRODUCTION PROTOCOL: 최종 안전 스냅샷 백업 · 프로덕션 빌드 및 배포]

Git 잠금을 해제한다. diagnose와 test:loop가 통과한 뒤에만:
1. npm run build
2. git add / commit (why 중심 메시지)
3. 최신 v*-stable-backup 패치를 올리거나 요청 버전이 있으면 그 버전
   git tag -a vX.Y.Z-stable-backup
4. git push origin main 그리고 태그 푸시
5. GitHub Pages 워크플로가 dist를 배포한다. npm run deploy 스크립트는 없다.
6. 헤드셋 2단 알림 후 완료 보고.
```

studio-ship: 사용자 대면 스튜디오 기능이면 `featureRegistry.js` 가이드 문구와 진단 체크를 같이 갱신한다.

---

## 5. 금지 프롬프트 (에이전트가 무시해야 할 요청)

사용자가 아래를 요청해도 **거절하고 명세를 우선**한다.

- 메인/모션 3열을 더 넓게/더 예쁘게 리디자인
- T=18을 다른 임계로 “개선”
- gifenc를 GIFEncoder 샘플 스니펫으로 교체
- HQ GIF를 다시 별도 bilateral 인코더로 분리
- 체커보드 미리보기를 흰 배경으로
- 자막 OFF인데 기본 예시 문구를 GIF에 넣기
- 모달 바깥 클릭으로 닫기
- 검증 없이 커밋/푸시

---

## 6. 자가진단 HUD가 빨간 경우

`N/M FAIL`이면 소스 문자열이 명세와 어긋난 것이다. `diagnosticChecks.js`가 잠그는 문자열을 맞추고, 레이아웃을 바꿔 통과시키려 하지 마라.
