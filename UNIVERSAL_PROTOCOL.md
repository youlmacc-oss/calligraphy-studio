# 🔄 UNIVERSAL PRODUCTION PROTOCOL (단일 루프 승인 대기)

## 🎯 Target Objective
> **[작업 목표]**: 여기에 구체적인 작업 목표를 1~3줄로 입력하세요.

---

## 🛠️ Pre-Flight Bootstrap (환경 자동 점검)
1. **Playwright 의존성**: `@playwright/test` 미설치 시 자동 설치 (`npm install -D playwright @playwright/test && npx playwright install chromium`).
2. **캡처 스크립트**: `scripts/loop-test.js` 검증 및 `public/test-result.png` 갱신 파이프라인 확인.
3. **NPM 스크립트**: `package.json` 내 `"test:loop": "node scripts/loop-test.js"` 확인.

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

---

## ⚡ Execution Cycle
1. **[Step 1]** 연계 계획 및 검증 엔진 기반 일괄 정밀 패치 (디스크 저장).
2. **[Step 2]** 터미널 명령 `npm run test:loop` 실행으로 `public/test-result.png` 갱신.
3. **[Step 3]** 수정 파일 목록, 적용 엔진, 연계 모듈 동기화 내역 2줄 요약 보고.
4. **[Step 4]** 고정 문구 출력 후 승인 대기 (Human-in-the-Loop):
   > **"📸 1회 수정 및 화면 캡처(`public/test-result.png`)가 완료되었습니다. 브라우저 화면(또는 캡처 이미지)을 확인해 주세요.**  
   > **[1: 승인 및 종료] / [2: 추가 수정 필요 (피드백 입력)] 중 선택해 주세요."**