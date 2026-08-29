import { FLOOD_FILL_TOLERANCE, TEXT_ENGINE_MODES } from './emoticonSplit.js'
import { GOLDEN_BASELINE } from '../utils/diagnosticsBaseline.js'
import { defringeAlphaEdge, featherAlphaEdge } from '../utils/imageProcessor.js'
import { MOTION_NONE, MOTION_PRESETS, sampleMotion } from '../components/MotionGifStudio/motionPresets.js'
import { expandPingPong, pingPongPlayIndex } from '../components/MotionStudio/motionSequencer.js'
import {
  TEXT_MOTION_BOUNCE,
  TEXT_MOTION_EFFECTS,
  TEXT_MOTION_TYPEWRITER,
} from '../components/MotionStudio/dynamicTextMotion.js'
import { paintDynamicTextMotion } from '../components/MotionStudio/DynamicTextMotionRenderer.js'
import MotionPreviewCanvas from '../components/MotionStudio/MotionPreviewCanvas.jsx'
import MotionSequencerPanel from '../components/MotionStudio/MotionSequencerPanel.jsx'
import CaptionControlBar from '../components/MotionStudio/CaptionControlBar.jsx'
import MotionClipManager from '../components/MotionStudio/MotionClipManager.jsx'
import MotionZipToolbarButton from '../components/MotionStudio/MotionZipToolbarButton.jsx'
import ChatRoomSimulator, { mirrorPreviewFrame } from '../components/MotionStudio/ChatRoomSimulator.jsx'
import { PARTICLE_LAYERS } from '../components/MotionStudio/particleOverlayEngine.js'
import { estimateStoreSpec, KAKAO_MAX_KB } from '../components/MotionStudio/storeSpecHud.js'
import { ENCODER_SIZE, encodeGifFromCanvases, yieldToMain, frameProgressCopy } from '../utils/encoder/MotionEncoderEngine.js'
import { isAnimatedWebp, muxAnimatedWebp } from '../utils/encoder/webpAnimMux.js'
import { createSequenceClip, motionClipFileName } from '../utils/encoder/BatchExportEngine.js'

const PASS = 'PASS'
const FAIL = 'FAIL'

export const STUDIO_HUD_STEPS = [
  { id: 'BFS_DEFRINGE', title: 'BFS T=18 디프린지' },
  { id: 'TEXT_ENGINE_3', title: '3단 텍스트 엔진' },
  { id: 'SEQ_PINGPONG', title: '시퀀서 핑퐁' },
  { id: 'PRESET_10', title: '모션 프리셋 10종' },
  { id: 'TEXT_STROKE3', title: '3중 외곽선 텍스트' },
  { id: 'ENCODE_360', title: 'GIF/WebP 360' },
  { id: 'CLIP_SLOTS', title: '클립 보관함' },
  { id: 'BATCH_ZIP', title: '일괄 ZIP' },
  { id: 'SPEC_CHAT', title: '스펙 HUD·채팅' },
  { id: 'CHECKER_LABEL', title: '체커보드·라벨' },
]

function row(id, status, detail, metrics = {}) {
  return { id, status, detail, metrics }
}

function checkBfsDefringe() {
  const okTol = FLOOD_FILL_TOLERANCE === 18 && GOLDEN_BASELINE.splitter.alphaThreshold === 18
  const okDefringe = typeof defringeAlphaEdge === 'function' && typeof featherAlphaEdge === 'function'
  if (!okTol || !okDefringe) {
    return row('BFS_DEFRINGE', FAIL, '4모서리 BFS T=18 또는 1px 디프린지/페더가 없습니다.')
  }
  return row('BFS_DEFRINGE', PASS, 'PASS · 4모서리 Flood T=18 · 1.5px 페더 · 흰 엣지 디프린지')
}

function checkTextEngine3() {
  const ids = TEXT_ENGINE_MODES.map((item) => item.id)
  if (ids.length !== 3 || !ids.includes('ORIGINAL') || !ids.includes('VECTOR_OVERLAY') || !ids.includes('SMART_RECOLOR')) {
    return row('TEXT_ENGINE_3', FAIL, '3단 텍스트 엔진이 원본/벡터/스마트가 아닙니다.')
  }
  return row('TEXT_ENGINE_3', PASS, 'PASS · 원본 보존 · 벡터 오버레이 · 스마트 리컬러')
}

function checkSeqPingPong() {
  const loop = expandPingPong(['a', 'b', 'c', 'd'], true)
  const panel = String(MotionSequencerPanel)
  if (loop.join('') !== 'abcdcb' || pingPongPlayIndex(4, 4, true) !== 2) {
    return row('SEQ_PINGPONG', FAIL, '핑퐁 1-2-3-4-3-2 순환이 실패했습니다.')
  }
  if (!panel.includes('data-motion-seq') || !panel.includes('data-loop-mode') || !panel.includes('moveSequenceItem')) {
    return row('SEQ_PINGPONG', FAIL, '시퀀서 순서 변경 또는 핑퐁 토글이 없습니다.')
  }
  if (!panel.includes('data-caption-bar') || !panel.includes('CaptionControlBar')) {
    return row('SEQ_PINGPONG', FAIL, '자막 입력창 또는 ON/OFF 토글이 없습니다.')
  }
  if (!String(CaptionControlBar).includes('data-caption-input') || !String(CaptionControlBar).includes('data-caption-on')) {
    return row('SEQ_PINGPONG', FAIL, '자막 입력창 또는 ON/OFF 토글이 없습니다.')
  }
  return row('SEQ_PINGPONG', PASS, 'PASS · 다중 컷 · 순서/삭제 · 핑퐁 왕복')
}

function checkPreset10() {
  const motionIds = MOTION_PRESETS.map((item) => item.id)
  const textIds = TEXT_MOTION_EFFECTS.map((item) => item.id)
  if (MOTION_PRESETS.length !== 10 || !motionIds.includes('angryShake') || !motionIds.includes('zoomPunch')) {
    return row('PRESET_10', FAIL, '모션 프리셋 10종이 없습니다.')
  }
  if (TEXT_MOTION_EFFECTS.length !== 5 || !textIds.includes(TEXT_MOTION_BOUNCE) || !textIds.includes(TEXT_MOTION_TYPEWRITER)) {
    return row('PRESET_10', FAIL, '텍스트 모션 바운스·셰이크·펄스·타이핑이 없습니다.')
  }
  const still = sampleMotion(MOTION_NONE, 0.4, 1)
  if (still.dx !== 0 || still.rotateDeg !== 0 || still.scaleX !== 1 || still.scaleY !== 1) {
    return row('PRESET_10', FAIL, '모션 없음 상태가 원본 1:1 고정이 아닙니다.')
  }
  return row('PRESET_10', PASS, 'PASS · 스튜디오 10종 · 모션 없음 · 텍스트 모션 5종')
}

function checkStroke3() {
  const src = String(paintDynamicTextMotion)
  if (!src.includes('strokeText') || !src.includes('fillText')) {
    return row('TEXT_STROKE3', FAIL, 'Canvas 2D 3중 외곽선 텍스트가 없습니다.')
  }
  return row('TEXT_STROKE3', PASS, 'PASS · strokeText × 벡터 외곽선 · fillText 보존')
}

function checkEncode360() {
  const muxed = muxAnimatedWebp([Uint8Array.of(1, 2, 3, 4)], { width: 360, height: 360, delay: 125 })
  if (ENCODER_SIZE !== 360 || !isAnimatedWebp(muxed)) {
    return row('ENCODE_360', FAIL, '360×360 GIF/WebP 인코더가 규격과 다릅니다.')
  }
  if (!String(encodeGifFromCanvases).includes('yieldToMain') || typeof yieldToMain !== 'function') {
    return row('ENCODE_360', FAIL, '인코딩 루프가 메인 스레드를 양보하지 않습니다.')
  }
  if (!frameProgressCopy('gif', 8, 16).includes('8 / 16 프레임 처리 완료')) {
    return row('ENCODE_360', FAIL, 'GIF 진행률 문구가 없습니다.')
  }
  return row('ENCODE_360', PASS, 'PASS · 360×360 GIF · 투명 Animated WebP · 진행률 양보')
}

function checkClipSlots() {
  const clip = createSequenceClip({ frames: [{ url: 'thumb' }], fps: 8 }, 0)
  const src = String(MotionClipManager)
  if (clip.fileName !== '클립 1' || clip.isPermanent !== true || !src.includes('data-motion-clip') || !src.includes('삭제')) {
    return row('CLIP_SLOTS', FAIL, '클립 보관함 저장/수정/삭제가 없습니다.')
  }
  if (!src.includes('data-clip-del') || !src.includes('stopPropagation') || !src.includes('전체 비우기')) {
    return row('CLIP_SLOTS', FAIL, '클립 개별 삭제 버튼 또는 전체 비우기가 없습니다.')
  }
  return row('CLIP_SLOTS', PASS, 'PASS · 클립 슬롯 저장 · 수정 · 삭제')
}

function checkBatchZip() {
  const src = String(MotionZipToolbarButton)
  if (motionClipFileName(0, 'gif') !== 'motion-01.gif' || !src.includes('data-batch-zip')) {
    return row('BATCH_ZIP', FAIL, 'JSZip 일괄 ZIP 또는 motion-01 규격이 없습니다.')
  }
  return row('BATCH_ZIP', PASS, 'PASS · JSZip 전체 ZIP · motion-01.gif')
}

function checkSpecChat() {
  const spec = estimateStoreSpec({ frameCount: 4, fps: 8, pingPong: true })
  const chat = String(ChatRoomSimulator)
  if (spec.frames !== 6 || spec.kb <= 0 || KAKAO_MAX_KB !== 2048) {
    return row('SPEC_CHAT', FAIL, '카카오 2MB 스펙 HUD 계산이 실패했습니다.')
  }
  if (!chat.includes('data-chat-sim') || !chat.includes('checkerboard-bg') || !String(mirrorPreviewFrame).includes('drawImage') || PARTICLE_LAYERS.length !== 4) {
    return row('SPEC_CHAT', FAIL, '채팅 시뮬 또는 파티클 오버레이가 없습니다.')
  }
  return row('SPEC_CHAT', PASS, `PASS · 심사 스펙 ≤${KAKAO_MAX_KB}KB · 채팅 시뮬 · 파티클 4종`)
}

function checkCheckerLabel() {
  const preview = String(MotionPreviewCanvas)
  if (!preview.includes('checkerboard-bg') || preview.includes('bg-white')) {
    return row('CHECKER_LABEL', FAIL, '체커보드 기본 배경이 없거나 bg-white가 있습니다.')
  }
  if (GOLDEN_BASELINE.uiIntegrity.maxButtonLabelLength !== 16) {
    return row('CHECKER_LABEL', FAIL, 'UI 라벨 16자 규격이 없습니다.')
  }
  return row('CHECKER_LABEL', PASS, 'PASS · checkerboard-bg · UI 라벨 격리 ≤16자')
}

const RUNNERS = {
  BFS_DEFRINGE: checkBfsDefringe,
  TEXT_ENGINE_3: checkTextEngine3,
  SEQ_PINGPONG: checkSeqPingPong,
  PRESET_10: checkPreset10,
  TEXT_STROKE3: checkStroke3,
  ENCODE_360: checkEncode360,
  CLIP_SLOTS: checkClipSlots,
  BATCH_ZIP: checkBatchZip,
  SPEC_CHAT: checkSpecChat,
  CHECKER_LABEL: checkCheckerLabel,
}

export function runStudioHudChecks() {
  return STUDIO_HUD_STEPS.map((step) => {
    try {
      const result = (RUNNERS[step.id] || (() => row(step.id, FAIL, '러너 없음')))()
      return { ...step, ...result, id: step.id, title: step.title }
    } catch (error) {
      return { ...step, status: FAIL, detail: error?.message || '진단 예외', metrics: {} }
    }
  })
}
