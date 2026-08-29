# 🔄 ALL-IN-ONE PRODUCTION PROTOCOL (2원화 검증 모드)

## 🎯 Target Configuration
- **[Mode]**: `VISUAL` (UI/화면 작업 ➔ 캡처 후 승인 대기) | `LOGIC` (알고리즘/인코더 ➔ 테스트 100% 자율 루프)
- **[Objective]**: 여기에 구체적인 작업 목표를 1~3줄로 입력하세요.

---

## 🛠️ Pre-Flight Bootstrap
1. `VISUAL` 모드: Playwright 및 `scripts/loop-test.js` 확인.
2. `LOGIC` 모드: `vitest`/`jest` 단위 테스트 러너 및 `*.test.js` 확인.

---

## 🔍 Pre-Flight Architecture Audit
1. **검증된 고품질 엔진/소프트웨어 우선 채택**: 안정성 검증 도구 우선 적용.
2. **상호 의존성 전수 조사**: 분할기 ➔ 모션 스튜디오 ➔ 인코더 데이터 흐름 확인.
3. **유기적 연계 수정(Coordinated Refactoring)**: 인터페이스 최신 규격 동기화.
4. **사이드 이펙트 사전 차단**: 최소 침습 패치 전략 준수.

---

## 🛡️ Immutable Global Rules
1. **전체 시스템 연계 정합성**: 파이프라인 무중단 유지.
2. **투명 체커보드 기본값 강제**: `checkerboard-bg` 유지.
3. **ROI Bounding Box 격리**: 비수정 영역 오염 0.00%.
4. **순수 Canvas 2D 벡터 엔진**: 브라우저 내장 Canvas 2D 유지.
5. **UI 라벨 격리**: 라벨과 툴팁 분리.
6. **Git 안전성**: Git 명령어 실행 금지.

---

## ⚡ Mode-Specific Execution
- **🅰️ VISUAL 모드**: 수정 ➔ `npm run test:loop` ➔ 요약 보고 ➔ 고정 안내문 출력 후 **사용자 승인 대기**.
- **🅱️ LOGIC 모드**: 테스트 작성 ➔ `npm test` ➔ 100% Pass(0 Failures) 달성 시까지 자율 루프 ➔ 결과 보고 후 승인 대기.