# ENGINE-LOCK — 재작성 금지 공식

이 파일의 함수·숫자는 **그대로 이식**한다. “더 좋은 이징”으로 바꾸면 미리보기와 GIF가 원본과 달라진다.

---

## 1. 모션 프리셋 (`motionPresets.js`)

공통:

```
TAU = 2π
wrap01(t) = ((t % 1) + 1) % 1
clamp01(i) = 0..1, 기본 0.7
identityPose = { dx:0, dy:0, scaleX:1, scaleY:1, rotateDeg:0, alpha:1, glowRadius:0, rgbShift:0, sliceShift:0 }
SPRITE_FIT = 0.8
GLITCH_WINDOWS = [0.20..0.25], [0.70..0.73]
none / null / off → identity
paintMotionFrame: `amp = intensity > 1 ? intensity/100 : clamp01(intensity)`. 슬라이더 70 → 0.7.
```

원본 `clampIntensity`는 10~100 정수. `paintMotionFrame`에 넘기기 전 스케일은 현 코드와 동일하게 유지.

| id | 공식 |
|---|---|
| jellyBounce | `air=sin(uπ)`, `land=(1-air)²`, `k=0.2i`, `dy=air*-28i`, `scaleX=1+land*k-air*0.07i`, `scaleY=1-land*k+air*0.12i` |
| neonPulse | `wave=0.5+0.5sin(uτ)`, `alpha=1-0.18i(1-wave)`, `glowRadius=(6+28i)*wave` |
| cuteWiggle | `rotateDeg=sin(uτ*2)*8i`, `dy=sin(uτ)*-8i` |
| cinematicGlitch | 윈도우 밖 identity. 안이면 `rgbShift=24i`, `sliceShift=26i` |
| softFloating | `dy=sin(uτ)*16i` |
| angryShake | `dx=sin(uτ*16)*7i`, `dy=cos(uτ*21)*6i`, `rotate=sin(uτ*14)*3.2i`, scale ±`0.045i` |
| rollingTilt | `rotateDeg=sin(uτ)*12i`, `dx=sin(uτ)*4i` |
| squashStretch | `hop=sin(uτ)`, squash=max(0,-hop), stretch=max(0,hop), `dy=hop*-18i`, scaleX `1+0.32i squash-0.14i stretch`, scaleY `1-0.32i squash+0.26i stretch` |
| heartbeat | `exp(-((u-0.18)*18)²) + 0.72*exp(-((u-0.38)*16)²)`, pop=`beat*0.22i`, scaleXY `1+pop` |
| zoomPunch | `punch=sin(uπ)^1.35`, `k=punch*0.42i`, scale `1+k`, `dy=punch*-8i` |

`rgbGlitch`는 `cinematicGlitch` 별칭.

그리기: `clearRect` → isolate면 crop sprite → 캔버스 중앙 변환 후 pose 적용 → `drawImage` contain 0.8. 프레임마다 clearRect 필수.

루프 클램프: 초 0.5~4 기본 2, 강도 10~100 기본 70, 줌 50~200 스텝 10.

---

## 2. 시퀀서 시간

```
clampSequenceFps: 4..24, 기본 8
clampStillLoopSeconds: 1..2
stillLoopFrameCount = max(8, round(fps * speed * seconds))
8fps · 2s · 1x = 16
captionLoopIndex(0.5, 8, 2, 1) → { index:8, total:16 }
pingPong: n>=2 이면 n*2-2 사이클, 왕복 인덱스
```

텍스트 모션:

- none: x=0 y=0 scale=1, 텍스트 그대로
- bounce: Y 진폭 > 0
- pulse: scale 0.9~1.15
- typewriter: 프레임에 따라 글자 슬라이스 (`ABCD` index 0 / total 4 → `A`)
- 자막 OFF 또는 공백 → 합성 문자열 `''`. 기본 예시 문구 금지

---

## 3. 투명화 T=18

- 4모서리에서 BFS. 임계 **T=18**.
- 1px 브릿지 실링. ㅇ·눈동자 등 폐곡선 내부로 새지 않음.
- 페더 1.2~1.5px. 흰 엣지 디프린지 1px.
- 내부 고립 구멍 토글 기본 OFF. 글자 bbox 보호.
- `enforceTransparencyPurge` / `sanitizeExportSource`로 가짜 체커·다크 플레이트·시안 가이드를 외곽부터 Alpha=0.

이 임계와 BFS 4방향을 “개선”하지 말 것.

---

## 4. 인코더 360

```
ENCODER_SIZE = 360
ENCODER_ALPHA_CUT = 16
GIF89a
quantize(masked, 255, { format: 'rgb565' })
index: raw===255 → 0x00 else raw+1
palette = [[0,0,0], ...colors].slice(0,256)
writeFrame: delay=max(20, round(1000/fps)), repeat 첫 프레임만 0, dispose:2, transparent:true, transparentIndex:0x00
```

출력 해상도가 360이 아니면 throw.

WebP: 프레임 `toBlob('image/webp', 0.92)` + ALPH 없으면 uncompressed ALPH 청크 + ANIM/ANMF mux.

배경은 `destination-over`로 캐릭터 **아래**에만 (`applyBackgroundUnder`).

---

## 5. 말풍선 꼬리

- 본체 사각형 + 꼬리를 **한 `beginPath`**.
- 점 3개: tip, baseStart, baseEnd.
- `hitTestTailHandle` 거리 우선. 기본 `enabled:false`.
- 미리보기 `showHandles:true`, 인코더 `false`.
- `TAIL_HANDLE_RADIUS` (히트 약 12px).

폰트 문자열: `captionCanvasFont(30,'Jua')`에 `Jua` 포함. weight+px+family.

---

## 6. 본체 GIF (`gifMotion.js`)

메인 스타일러 우측 GIF 3종: pulse / float / fade. **샘플 공식 재작성 금지.** 모션 스튜디오 10종과 다른 모듈이다.

---

## 7. 모드 B

Y1~Y2 칼재단, 0.5mm 가이드, 4방향 외곽 재단선, 인접 셀 침범 0%. 기하를 새로 유도하지 말 것.

---

## 8. 픽셀 에디터

좌우 툴바 `width: 128` 상수 `SIDEBAR_BOX`. 중앙 강제 300% 줌·정사각 크롭 없음. 매직완드/브러시 엔진을 다른 라이브러리로 바꾸지 말 것 (현 구현 `pixelSelectionEngine.js`).
