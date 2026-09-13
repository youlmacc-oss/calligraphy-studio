# ARCHITECTURE — 모듈 · 데이터 파이프라인 · 파일 지도

기준: v2.4.0. 재구현 시 **이 파일 경로와 export 이름을 그대로** 맞춘다.

---

## 1. 런타임 개요

```
브라우저
  Vite SPA  base=/calligraphy-studio/  port=5173
    App.jsx (메인 스타일러 3단)
      ├─ EmoticonSplitterModal
      ├─ MotionGifStudioModal
      │    ├─ MotionStudioProvider
      │    ├─ 좌: SOURCES (canvas|cuts|drop)
      │    ├─ 중: 스테이지 + MotionSequencerPanel
      │    └─ 우: MOTION PRESETS & CONTROLS
      ├─ GuidebookModal / SelfDiagnosticModal / AiGenerateModal
      └─ 우측 익스포트 (PNG/JPEG/GIF/ICO)
```

인코딩은 전부 클라이언트. GitHub Actions는 `npm run build` 후 Pages에 `dist/`만 올린다.

---

## 2. 디렉터리 지도

```
src/
  App.jsx                         메인 셸·레이어·히스토리·모달 마운트
  presets.js                      본체 폰트/프리셋/DEFAULT_TEXT
  main.jsx
  lib/
    studioModel.js                레이어·localStorage v6·FACTORY_REV
    studioLayout.js               좌우 패널 폭 상수·clamp
    renderStyle.js                drawLivePreview / exportCleanCanvas / renderStyledText
    exportFormats.js              PNG/JPEG/GIF/ICO
    gifMotion.js                  본체 GIF 3종 (재작성 금지)
    emoticonSplit.js              그리드·바이패스·T=18 연동
    fakeBackgroundPurge.js        enforceTransparencyPurge / sanitizeExportFrames
    motionBackground.js           Layer 0 프리셋·normalizeBgConfig·applyBackgroundUnder
    sessionManager.js             MOTION_STUDIO_ACTIVE_SESSION + IndexedDB
    featureRegistry.js            HUD + 가이드 + DIAG_STEPS
    diagnosticChecks.js           자가진단 함수
    emoticonFonts.js              자막 10선
    appBuild.js                   2026.09.14-v2.4.1
  components/
    EmoticonSplitterModal.jsx
    MotionGifStudio/
      MotionGifStudioModal.jsx    3열 모달·세션·HQ 버튼 → GIF export API
      motionPresets.js            10종 포즈 공식 (재작성 금지)
      gifEngine.js                배치 ZIP용 구 경로 (단일 HQ 버튼은 사용 안 함)
      gifEncodeCore.js            워커/동기 RGBA 인코드
      PixelSelectionModal.jsx     좌우 128px
      spriteIsolate.js            Auto-Trim
      motionPcUpload.js           다중 파일·드롭 가드
    MotionStudio/
      MotionSequencerPanel.jsx
      MotionExportPanel.jsx       requestExport gif|webp + exportApiRef
      MotionPreviewCanvas.jsx     rAF + paintMotionFrame + 자막
      speechBubbleTail.js         drawSpeechBubbleWithTail / hitTestTailHandle
      speechBubbleDrag.js
      dynamicTextMotion.js        텍스트 모션 5종
      particleOverlayEngine.js    파티클 4종
      motionSequencer.js          stillLoop / pingPong / FPS
    TransparencyCheckModal.jsx
  utils/
    encoder/MotionEncoderEngine.js   ENCODER_SIZE=360, compose*, encodeGif/Webp
    encoder/floydSteinberg.js
    encoder/webpAnimMux.js
    gifExporter.js                exportCompositeGif = sanitize + encodeMotionExport
    gifOptimizer.js               배경 360 Cover, yieldEncoderTick
    fileSaveManager.js            showSaveFilePicker, webdriver 스킵
    hqRender.js                   primeHqContext
    imageProcessor.js             defringe / bilateral (HQ 구경로만 bilateral)
  hooks/useTransparencyGate.js
scripts/
  refresh-dev.js                  5173 kill → 캐시 삭제 → vite --force
  loop-test.js                    Playwright E2E + 헤드셋
  play-headset-sound.ps1
.github/workflows/deploy.yml
```

---

## 3. 파이프라인

### 3.1 스타일러 → 스튜디오

```
본체 캔버스
  exportCleanCanvas()          가이드·격자·플레이트 OFF
       │
       ▼
MotionGifStudioModal initialSource / ingestUrl
  enforceTransparencyPurge()   가짜 체커·다크 플레이트·시안 가이드 외곽 제거
       │
       ▼
imageRef + sourceUrl (data URL 또는 blob URL)
  resolvePlaybackFrames(sequence, sourceUrl)
       │ stillLoop=true 이면 가상 1프레임
       ▼
프리뷰 rAF / 인코더 compose*
```

거대한 `cleanSourceUrl` data URL을 시퀀서 `sourceUrl`에 넣으면 `canvasFromUrl`이 멈춰 Playwright가 진행률을 못 본다. **금지.**

### 3.2 GIF/WebP 내보내기 (단일 경로)

```
MotionExportPanel.requestExport(format)
  canvasFromUrl(frames[0])
  useTransparencyGate.runOrAsk
  sanitizeExportFrames(expandPingPong(frames))
  exportCompositeGif → prepareEncodeBackground
  encodeMotionExport
    composeSequenceCanvases
      stillLoop|1장 → composeStillMotionCanvases
        loadCleanExportImage → sanitizeExportSource
        paintMotionFrame(..., isolate)
        applyBackgroundUnder
        paintTextAndParticles (핸들 없음)
    format=gif → encodeGifFromCanvases
      maskOpaqueRgb ALPHA_CUT=16
      quantize 255 rgb565
      floydSteinbergIndex
      transparentIndex 0x00, dispose 2, repeat 0
    format=webp → encodeWebpFromCanvases + muxAnimatedWebp
  triggerBlobDownload → saveFileWithFolderPicker
  purgeTempClips
```

`[🚀 초고화질 무한루프 GIF 다운로드]`는 `gifExportApiRef.current.requestExport('gif')`만 호출한다. `gifEngine.encodeMotionGif`는 **배치 ZIP** 전용.

### 3.3 분할기

```
시트 업로드
  모서리 알파 비어 있음 → Lossless Bypass → 360 중앙
  불투명 → Mode A CCA 또는 Mode B 그리드
  T=18 4코너 BFS + 브릿지 실링
  destination-in
  디프린지
  썸네일 / ZIP / cutSnapshot → 모션 스튜디오 컷 탭
```

---

## 4. 상태와 저장소

| 저장소 | 키/이름 | 내용 |
|---|---|---|
| localStorage | `styler-studio-pro-v6` | 본체 레이어·뷰 |
| localStorage | `styler-factory-rev` | `2026.08.29-kitsch-text` — 다르면 공장 룩 리셋 |
| localStorage | `styler-left-panel-width-v2` / `styler-right-panel-width` | 패널 폭 |
| localStorage | `styler-onboard-v1` | 투어 완료 |
| localStorage | `styler-api-keys-v1` | AI 키 |
| localStorage | `MOTION_STUDIO_ACTIVE_SESSION` | 모션 메타(탭, 프리셋, 자막, bgConfig) |
| IndexedDB | `calligraphy-studio-session` / `assets` | 큰 이미지·픽셀 스프라이트·커스텀 프레임(최대 12) |

세션 TTL 24h. `normalizeSourceTab`, `normalizeBgConfig`(solid 포함). solid를 transparent로 지우면 화이트 스튜디오가 복원되지 않는다.

`MotionStudioContext`: clips, speed, saveSequenceClip, purgeTempClips. 임시 인코드 클립은 내보내기 후 삭제.

---

## 5. 상수 (재구현 시 숫자 고정)

| 이름 | 값 |
|---|---|
| `ENCODER_SIZE` | 360 |
| `ENCODER_ALPHA_CUT` | 16 |
| Flood-fill T | 18 |
| 시퀀서 FPS | min 4 / default 8 / max 24 |
| `stillLoopFrameCount` | max(8, round(fps*speed*clamp(loop,1..2))) — 8fps·2s·1x = **16** |
| 자막 폰트 기본 | `Jua` |
| 픽셀 사이드바 | 128px |
| 좌 패널 | default 480, min 220, max 1100 |
| 우 패널 | default 340, min 220, max 1100 |
| 중앙 최소 | 360 |
| 프리뷰 줌 | 50~200, 스텝 10, 기본 100 |
| 분할기 기본 줌 | 35%, 스텝 5%, 10~200 |
| SPRITE_FIT | 0.8 |

---

## 6. 공개 인터페이스

```js
<MotionGifStudioModal isOpen onClose initialSource />
// initialSource: canvas | dataURL | { cuts } | File

exportApiRef.current.requestExport('gif' | 'webp')
```

본체는 스튜디오 내부 state를 mutate하지 않는다. 컷은 `cutSnapshot` 구독으로 복사본만 받는다.

---

## 7. 검증 훅

- `src/lib/featureRegistry.js`의 `diagnosticFunction`이 있는 항목만 `DIAG_STEPS`.
- `tests/autoRepair.test.js`가 소스 문자열·세션·배경·인코더 시그니처를 잠근다.
- `scripts/loop-test.js`가 실제 클릭·인코드·세션을 잠근다.

새 기능을 넣으면 **기존 진단 스텝을 확장**하고, 새 `diagnosticFunction`은 기존 체크로 못 덮을 때만 추가한다. HUD에 "13단계" 하드코드 금지.

---

## 8. 동시성·메모리

- rAF는 모달 전용. `onClose` 시 `cancelAnimationFrame`.
- 인코드 루프는 프레임마다 `yieldToMain` (`setTimeout(0)`).
- 캔버스 폐기 시 `width=height=0`.
- blob URL은 objectUrlsRef에 모아 revoke.
- 4K 배경은 `optimizeBackgroundImage`로 360 Cover 1회.

---

## 9. 배포

`main` 푸시 → `.github/workflows/deploy.yml` → Node 20 → `npm ci --ignore-scripts` → `vite build` (`VITE_APP_BUILD=sha`) → `actions/upload-pages-artifact` path `./dist`.  
`npm run deploy` 스크립트는 없다.
