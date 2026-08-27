# [ARCHITECTURE] 독립형 AI 모션 GIF 스튜디오 PRO 시스템 아키텍처 및 렌더링 파이프라인 명세서

관련 문서: `docs/MOTION_GIF_STUDIO_PRD.md`, `docs/MOTION_GIF_STUDIO_UI_SPEC.md`

본 문서는 향후 `src/components/MotionGifStudio/` 에만 구현될 독립 모듈의 설계 계약이다. 본 프로그램(`src/App.jsx`, 이모티콘 분할기, 텍스트 스타일러, 18단계 HUD)의 기존 소스는 변경하지 않는다.

---

## 1. 모듈 격리 & 샌드박스 원칙

### 1.1 디렉토리 경계

모든 신규 코드는 아래 트리 안에만 둔다. 본체 `src/lib/`, `src/App.jsx`, 기존 컴포넌트에 import 역류를 넣지 않는다.

```
src/components/MotionGifStudio/
  index.js                 # 공개 엔트리 (MotionGifStudioModal)
  MotionGifStudioModal.jsx
  ingest/                  # DataURL / Blob / File / Self Text
  canvas/                  # Virtual Offscreen Canvas, rAF loop
  motion/                  # 5대 프리셋 이징 / 프레임 생성기
  encoder/                 # gifenc 래퍼 (Quantize + Alpha + NETSCAPE2.0)
  ui/                      # 좌·중·우·하단 패널 (UI_SPEC)
```

본체와의 유일한 접점은 모달 마운트 1회와 아래 Props이다. 본체 전역 스토어, 히스토리 스택, 레이어 배열, 슬라이서 박스 리스트를 직접 mutate 하지 않는다.

### 1.2 본체 상태 오염 0%

| 영역 | 규칙 |
| --- | --- |
| React state | 스튜디오 내부 `useState` / `useRef` 만 사용. 본체 `studio` 모델에 쓰기 금지. |
| Canvas | 본체 `#main-canvas` 및 슬라이서 crop canvas를 읽기 전용으로만 스냅샷. 그리기/clearRect 금지. |
| rAF | 스튜디오 전용 `requestAnimationFrame` 루프. 모달 `onClose` 시 반드시 `cancelAnimationFrame`. |
| 메모리 | Offscreen / 프레임 버퍼는 모듈 스코프 싱글톤이 아니라 인스턴스 ref. 언마운트 시 `width=height=0` 릴리스. |

### 1.3 독립 가상 캔버스

프리뷰와 인코딩은 본체와 분리된 Virtual Offscreen Canvas(또는 동일 역할의 비가시 `canvas`)에서만 수행한다. 화면의 60fps 뷰포트는 이 버퍼를 `drawImage`로 복사할 뿐, 모션 수학의 원본이 아니다.

---

## 2. 데이터 파이프라인 흐름

```
Ingest ──► Bitmap Snapshot ──► Virtual Canvas Loop (rAF 60fps)
                                      │
                                      ├─► Viewport (표시 전용, 배경 플레이트 CSS)
                                      └─► Encoder (gifenc, 출력 FPS 12/24)
                                               │
                                               └─► Blob (infinite loop GIF)
```

### 2.1 Ingest (입력 4종)

| 소스 ID | 페이로드 | 정규화 |
| --- | --- | --- |
| `Main Canvas DataURL` | 본체 타이포 미리보기 `toDataURL('image/png')` 또는 PNG Blob | ImageBitmap → 내부 스냅샷 캔버스 |
| `Emoticon Sheet Crop Blob` | 이모티콘 28종 개별 컷 PNG Blob (360 슬라이스) | 동일. 본체 슬라이스 배열은 복사본만 수신 |
| `User Dropped File` | 로컬 PNG/JPG File | `createImageBitmap(file)` |
| `Self Text` | 스튜디오 내 자체 텍스트 + 폰트/색 | 스튜디오 전용 텍스트 레이어 캔버스에만 그림 |

`initialSource`가 없으면 단독 실행 모드: 드롭존 + Self Text만 활성.

정규화 이후 원본 File/Blob 참조는 해제하고, 스튜디오는 `ImageBitmap` 또는 내부 스냅샷 캔버스만 보유한다.

### 2.2 Virtual Canvas Loop

- 드라이버: `requestAnimationFrame`.
- 목표 표시 프레임: **60fps** 무한루프 프리뷰.
- 루프 시각 `t`는 `performance.now()` 기반이며, 프리셋 이징은 `loopDuration` (0.5s~3.0s)으로 모듈로 랩핑한다.
- 모션 강도(1%~100%)는 이징 진폭 스칼라이다.
- 일시정지 시 rAF는 멈추고 마지막 프레임을 뷰포트에 유지한다.
- 인코딩 시에는 동일 이징 함수를 **출력 FPS(12 / 24)** 샘플로 재평가한다. 프리뷰 60fps와 출력 FPS는 분리한다.

### 2.3 Encoder (gifenc)

인코딩은 워커 또는 메인 스레드 배치로 프레임을 뽑은 뒤 `gifenc`에 넘긴다.

| 단계 | 규격 |
| --- | --- |
| Quantization | gifenc 팔레트 양자화. 프레임 간 팔레트 재사용 가능 시 재사용. |
| Alpha | 투명 픽셀을 GIF 투명 인덱스에 매핑. 카카오 360 출력에서 배경 Alpha 무손실 보존을 목표로 한다. (GIF89a 1-bit 투명 한계는 구현 노트로 명시) |
| Loop | **NETSCAPE2.0** Application Extension, loop count `0` (무한). |
| 패키징 | `Uint8Array` → `Blob({ type: 'image/gif' })` → 다운로드. |
| 목표 지연 | 브라우저 로컬, 외부 API 0. 전형적 360² / 12~24fps / 0.5~3s 루프에서 약 1초 내외. |

출력 해상도 프리셋: 카카오 이모티콘 **360×360**, 1:1 **500×500**, 원본 비율 유지(긴 변 클램프).

---

## 3. 인터페이스 & Props 규격

공개 컴포넌트: `MotionGifStudioModal`

```ts
type InitialSource =
  | { kind: 'dataUrl'; dataUrl: string; label?: string }
  | { kind: 'blob'; blob: Blob; label?: string }
  | { kind: 'canvas'; canvas: HTMLCanvasElement; label?: string }
  | { kind: 'file'; file: File; label?: string }
  | { kind: 'emoticonCuts'; cuts: Array<{ id: string; blob: Blob; preview: string }> }
  | null

type MotionGifStudioProps = {
  isOpen: boolean
  onClose: () => void
  initialSource?: InitialSource
}
```

| Prop | 필수 | 의미 |
| --- | --- | --- |
| `isOpen` | 예 | `true`일 때만 모달 마운트 또는 표시. `false`가 되면 rAF·인코딩 작업을 abort하고 버퍼를 비운다. |
| `onClose` | 예 | 사용자가 닫기/ESC/백드롭을 눌렀을 때 본체에 알림. 본체 state만 닫힘 처리. |
| `initialSource` | 아니오 | 본체에서 넘기는 이미지. 없으면 드롭/Self Text 단독 모드. |

통신 방향: 본체 → 스튜디오는 `initialSource` 스냅샷 1회. 스튜디오 → 본체는 `onClose`만. GIF Blob을 본체 캔버스에 다시 쓰지 않는다(다운로드는 스튜디오 내부).

---

## 4. 성능 & 메모리 관리

### 4.1 캔버스 메모리 릭 방지

- 모달 닫힘 / `isOpen===false` / 언마운트 훅에서:
  1. `cancelAnimationFrame(loopId)`
  2. 진행 중 gifenc 작업 `AbortController.abort()`
  3. Offscreen·스냅샷 캔버스 `width = 0`, `height = 0`
  4. `ImageBitmap.close()` (존재 시)
  5. 프레임 `ImageData` 풀 참조 해제
- 소스 교체 시 이전 비트맵을 먼저 close 한 뒤 새 ingest를 시작한다.

### 4.2 프레임 버퍼 재사용 전략

- 프리뷰: 고정 크기 뷰포트 버퍼 1장 + 모션 합성 버퍼 1장. 매 프레임 `getImageData` 신규 할당을 피하고, 가능하면 동일 `ImageData`에 덮어쓴다.
- 인코딩: 출력 해상도×프레임 수만큼의 픽셀을 순차 양자화하고, 완료된 프레임의 raw RGBA는 즉시 폐기한다. 전체 프레임 PNG 배열을 RAM에 쌓지 않는다.
- 해상도/FPS/루프 시간 변경 시 풀 크기를 다시 계산하고 초과 버퍼는 drop한다.
- 동시 인코딩은 1건. 재클릭은 이전 잡을 cancel 후 시작한다.

### 4.3 성능 가드레일

- 프리뷰는 60fps를 목표로 하되, 한 프레임 페인트가 24ms를 넘으면 내부적으로 스킵 프레임(표시만).
- 인코딩 해상도 500², 24fps, 3.0s = 최대 72프레임. 이 상한을 넘기지 않는다.
- 워커를 쓸 경우 본체 메인 스레드 타이포 렌더와 경합하지 않도록 워커는 스튜디오 모듈 전용으로만 import한다.
