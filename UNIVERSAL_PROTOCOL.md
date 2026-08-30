# 🔄 UNIVERSAL PRODUCTION PROTOCOL (단일 루프 승인 대기)

## 🎯 Target Objective
> **[작업 목표]**: 여기에 구체적인 작업 목표를 1~3줄로 입력하세요.

---

## 🛠️ Pre-Flight Bootstrap (환경 자동 점검)
1. **Playwright 의존성**: `@playwright/test` 미설치 시 자동 설치 (`npm install -D playwright @playwright/test && npx playwright install chromium`).
2. **재실행 파이프라인**: `scripts/refresh-dev.js`와 `scripts/loop-test.js` 확인. `npm run test:loop`는 내부에서 `refreshDev()`를 호출하므로, 에이전트가 캐시 삭제/서버 재기동을 따로 생략하면 안 된다.
3. **NPM 스크립트 확인**:
   - `"refresh": "node scripts/refresh-dev.js"` — 5173 종료 → 캐시 삭제 → `vite --force --port 5173` → Windows 기본 설정 브라우저(기존 창/탭 재사용)로 스튜디오 URL 오픈 (무한 새창 오픈 차단)
   - `"diagnose": "vitest run tests/autoRepair.test.js"`
   - `"test:loop": "node scripts/loop-test.js"` — refresh + Playwright Hard Reload E2E + 띠리릭 2단 알림
   - `"verify": "npm run diagnose && npm run test:loop"` — 보완 완료 후 기본 명령

---

## 🔍 Pre-Flight Architecture Audit (사전 분석 & 연계 계획)
1. **검증된 고품질 엔진/소프트웨어 우선 채택**: 조잡한 자체 코딩 배제, 검증된 라이브러리/알고리즘 우선 도입.
2. **상호 의존성 전수 조사**: 대상 모듈과 연결된 상·하위 컴포넌트, Props, Context, 데이터 파이프라인 흐름 파악.
3. **유기적 연계 수정(Coordinated Refactoring)**: 한쪽 모듈 변경 시 연결된 모듈의 인터페이스/렌더러도 최신 규격으로 동기화 수정.
4. **사이드 이펙트 사전 차단**: Layout Shift, 메모리 누수, 무한 렌더 루프 차단.

---

## 🛡️ Immutable Global Rules (불변 규약)
1. **시스템 정합성**: 전체 파이프라인(스타일러-분할기-모션-인코더) 데이터 규격 일치.
2. **투명 체커보드 기본값 강제**: 모든 뷰어/팝업 배경은 `checkerboard-bg` 고정 (`bg-white` 금지).
3. **ROI Bounding Box 격리**: 비수정 영역 읽기 전용 유지 (픽셀 오염 0.00%).
4. **순수 Canvas 2D 엔진 유지**: 비트맵 조작 배제, 순수 `fillText`/`strokeText` 사용.
5. **외곽 BFS 투명화 보존**: 4모서리 기반 BFS(T=18) 유지, 폐곡선/내부 하이라이트 보호.
6. **UI 라벨 격리 (`UI_LABEL_INTEGRITY`)**: 버튼명(Children)과 설명문(`data-tooltip`) 분리.
7. **Git 안전성**: Git 명령어 일체 실행 금지.
8. **보완 완료 루프 생략 금지**: 소리/문구/여백/프로토콜 MD 등 소규모 보완이어도 코드 저장 후 반드시 `npm run diagnose`와 `npm run test:loop`(또는 `npm run verify`)를 실행한다. `sound-test.js`만 돌리거나 진단만 하고 끝내면 실패로 본다.

---

## ⚡ Execution Cycle
### ⚡ 1회 루프 실행 프로토콜 (캐시 삭제 · 프로그램 재실행 · 헤드셋 2단 알림 필수)

코드 저장 직후 아래를 **건너뛰지 말고 순서대로** 수행한다. 수동으로 캐시 폴더만 지우고 끝내는 것은 금지. Vite가 켜진 채 `node_modules/.vite`를 지우면 파일이 잠겨 삭제가 실패한다.

1. 요청된 기능/수정 사항을 코드에 반영 후 디스크 저장.
2. **빌드 캐시 자동 삭제 (서버 중지 선행)**: `scripts/refresh-dev.js`가 5173 LISTENING 프로세스를 `taskkill`한 뒤 `node_modules/.vite` · `.next/cache` · `node_modules/.cache`를 지운다. 콘솔에 `🧹 [캐시 삭제]` 로그가 나와야 한다.
3. **프로그램 자동 재실행 (Windows 기본 브라우저 단일 창 재사용)**: 같은 스크립트가 `vite --force --port 5173`을 재기동하고 `http://localhost:5173/calligraphy-studio/` 가 응답할 때까지 기다린 다음 브라우저를 연다. `vite.config.js`의 `server.open`은 `false`로 두어 Vite가 창을 추가로 열지 않게 한다. 매 루프마다 새 창/새 탭을 무한 증식시키는 것을 엄격히 금지하며, **Windows 기본 설정 브라우저(Edge/Chrome 등)의 기존 열려있는 창/탭을 우선 재사용**하여 연결한다. 콘솔에 `🔄 [프로그램 재실행]` · `🌐 [기본 브라우저 연결]` 로그가 나와야 한다.
4. **테스트 자동 재실행**: `npm run diagnose` 후 `npm run test:loop`. Playwright는 `Cache-Control: no-cache`와 Hard Reload로 대상 버튼을 클릭하고 모달/결과를 E2E 검증한 뒤 `public/test-result.png`를 갱신한다. `test:loop`가 이미 `refreshDev()`를 포함하므로, 에이전트가 refresh를 빼 두고 Playwright만 돌리면 안 된다.
5. **사운드카드 1차 알림음 즉시 출력**: 기본 오디오 장치로 `scripts/notify-primary.wav`를 MediaPlayer 경로로 재생한다. 약 2초 띠리릭이며 시스템 기본 알림보다 크다.
6. **5초 무반응 시 2차 리마인드**: `scripts/notify-reminder.wav`(약 2초 띠리릭)를 1회 추가 재생한다.
7. 최종 화면 확인 및 승인 대기 문구 출력:

> **"🎧 [BEEP!] 캐시 삭제, 자동 재실행 및 화면 캡처(`public/test-result.png`)가 완료되었습니다.**  
> **[1: 승인 및 종료] / [2: 추가 수정 필요 (피드백 입력)] 중 선택해 주세요."**
