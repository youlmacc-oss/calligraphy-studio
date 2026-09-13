# ACCEPTANCE — 원본과 100% 동일한지 판정

재구축이 끝나면 아래를 **전부** 통과해야 한다. 일부만 되면 실패다.

---

## A. 자동화 (필수)

```bash
npm run diagnose    # tests/autoRepair.test.js 14테스트(원본 기준) PASS
npm run test:loop   # refresh + Playwright Hard Reload + 캡처
```

`test:loop`가 확인하는 것(원본 스크립트와 동일하게 구현):

1. 가이드북 모달 오픈
2. 분할기 시트 업로드 → 28칸 (실패 시 모드 B 7×4)
3. 벡터 오버레이 + 배경 퍼지 토스트
4. 모션 스튜디오 오픈. 이어하기 배너가 있으면 새로 시작
5. 본체 그래픽 탭. 컷 뱅크 숨김
6. 백드롭 클릭해도 창 유지
7. 닫기 컨펌 취소 / 저장 후 닫기 / 재오픈 이어하기 + 화이트 스튜디오 복원
8. 파티클 sparkle+hearts, isolate, 픽셀 에디터 128px 좌우, 50×50 루페, 적용, 원본 복원
9. jellyBounce, 재생 토글, 채팅 미러에 픽셀
10. 자막 OFF·빈 입력 → ON + `안녕` + bounce
11. `[data-hq-gif]` 활성, GIF 인코드 100%, WebP 인코드 100%
12. 클립 저장, 이모티콘 컷 타임라인 추가/삭제
13. 1366급·1920에서 클립/GIF/WebP 버튼이 뷰포트 안
14. 내 PC 업로드 multiple, 세션 저장, 재오픈 드롭 탭 유지, discard 후 canvas

헤드셋 1차 → 5초 후 2차.

---

## B. 수동 스모크

| ID | 확인 |
|---|---|
| TC-01 | 1920과 1366에서 3단 폭·버튼 크기가 같고 프리뷰만 줄어듦 |
| TC-02 | 스타일러 체커보드가 GIF에 안 들어감 |
| TC-03 | GIF/WebP에 가짜 격자 사각 없음 |
| TC-04 | 16프레임 인코드가 3%에서 안 멈추고 100% |
| TC-05 | 저장 시 OS 폴더 선택 (자동화 브라우저는 기본 다운로드) |
| TC-06 | 드롭 탭 저장 → 이어하기 시 드롭 유지 |
| TC-07 | 저장 안 함 → 다음 진입 본체 그래픽 |
| TC-08 | 바깥 클릭으로 안 닫힘 |
| TC-09 | 화이트/다크 스튜디오에서도 모션 루프 |
| TC-10 | 3점 꼬리 드래그, 폰트 10선, 내보내기에 핸들 없음 |
| TC-11 | HQ 무한루프 버튼과 GIF 내보내기 파일이 같은 인코더(360·투명 게이트) |
| TC-12 | 공장 룩 龍 Dragon 키치, 빌드 칩 `2026.09.14-v2.4.1` |

---

## C. 소스 잠금 문자열 (원본 autoRepair와 맞출 것)

재구현 후 진단이 실패하면 다음이 빠졌을 가능성이 크다.

- `SESSION_KEY = 'MOTION_STUDIO_ACTIVE_SESSION'`
- `SOURCE_TABS = ['canvas', 'cuts', 'drop']`
- `showSaveFilePicker`, `webdriver`
- `data-close-confirm` / save / discard / cancel
- 백드롭 `onClick={requestClose}` 없음
- `id: 'white_studio'`, `type: 'solid'`, `destination-over`
- `gifExportApiRef`, `requestExport?.('gif')`, `data-hq-gif`
- `exportApiRef`, `sanitizeExportFrames`, `loadCleanExportImage`
- `dispose: 2`, `transparentIndex: 0`
- `SIDEBAR_BOX`, `width: 128`
- `drawSpeechBubbleWithTail`, `TAIL_HANDLE_RADIUS`
- `checkerboard-bg` 있고 `bg-white` 없음 (라이트박스·프리뷰·진행창·클립)

---

## D. 동일하지 않은 것 (허용)

- GitHub 계정·Pages URL
- `VITE_APP_BUILD`에 심긴 commit sha
- E2E 캡처 PNG의 픽셀 노이즈
- OS 폰트 힌팅

허용하지 않는 것: 라벨 문구, 탭 id, 프리셋 id, 360 규격, T=18, 3열 구조, HQ≠GIF 인코더.
