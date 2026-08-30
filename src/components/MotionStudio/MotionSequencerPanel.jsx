import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { magnify } from '../MenuMagnifierHUD.jsx'
import ChatRoomSimulator from './ChatRoomSimulator.jsx'
import FrameSequencerTrack from './FrameSequencerTrack.jsx'
import MotionClipManager from './MotionClipManager.jsx'
import MotionEffectSelector from './MotionEffectSelector.jsx'
import MotionExportPanel from './MotionExportPanel.jsx'
import MotionPreviewCanvas from './MotionPreviewCanvas.jsx'
import ParticleOverlayBar from './ParticleOverlayBar.jsx'
import StoreSpecHud from './StoreSpecHud.jsx'
import { DEFAULT_EMOTICON_FONT_ID, normalizeEmoticonFontId } from '../../lib/emoticonFonts.js'
import { TEXT_MOTION_NONE } from './dynamicTextMotion.js'
import CaptionControlBar from './CaptionControlBar.jsx'
import { PLAYBACK_SPEEDS, useMotionStudio } from './motionStudioContext.jsx'
import {
  SEQUENCE_FPS_DEFAULT,
  SEQUENCE_FPS_MAX,
  SEQUENCE_FPS_MIN,
  clampSequenceFps,
  cutFrameUrl,
  makeSequenceItem,
  moveSequenceItem,
  removeSequenceItem,
  resolvePlaybackFrames,
  stillLoopFrameCount,
} from './motionSequencer.js'
import './motionStudio.css'

function speedLabel(value) {
  return `${Number(value).toFixed(1)}x`
}

export default function MotionSequencerPanel({
  cuts = [],
  injectFrames = null,
  showCutBank = true,
  cutBankEmpty = '분할기에서 28컷을 먼저 만드세요.',
  sourceUrl = '',
  playing: playingProp,
  onPlayingChange,
  motionPreset = 'none',
  isolateSprite = true,
  intensity = 70,
  loopSeconds = 2,
  overlayRef,
  captionLiveRef,
  onCaptionLive,
}) {
  const studio = useMotionStudio()
  const [sequence, setSequence] = useState([])
  const [localPlaying, setLocalPlaying] = useState(true)
  const [fps, setFps] = useState(SEQUENCE_FPS_DEFAULT)
  const [effect, setEffect] = useState(TEXT_MOTION_NONE)
  const [localSpeed, setLocalSpeed] = useState(1)
  const [pingPong, setPingPong] = useState(false)
  const [particles, setParticles] = useState([])
  const [chatTheme, setChatTheme] = useState('light')
  const [liveUrl, setLiveUrl] = useState('')
  const [captionOn, setCaptionOn] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [captionSize, setCaptionSize] = useState('md')
  const [captionStroke, setCaptionStroke] = useState('black')
  const [captionFont, setCaptionFont] = useState(DEFAULT_EMOTICON_FONT_ID)
  const [captionPos, setCaptionPos] = useState({ posX: 0, posY: 0 })
  const [selectedSeqId, setSelectedSeqId] = useState('')
  const chatMirrorRef = useRef(null)
  const injectStampRef = useRef('')
  const speed = studio?.speed ?? localSpeed
  const setSpeed = studio?.setSpeed ?? setLocalSpeed
  const slot = sequence.length
  const timelineFrames = useMemo(() => sequence.filter((item) => item.url), [sequence])
  const playback = useMemo(
    () => resolvePlaybackFrames(sequence, sourceUrl),
    [sequence, sourceUrl],
  )
  const frames = playback.frames
  const stillLoop = playback.stillLoop
  const playing = typeof playingProp === 'boolean' ? playingProp : localPlaying
  const hudFrames = stillLoop
    ? stillLoopFrameCount(fps, loopSeconds, speed)
    : timelineFrames.length

  if (overlayRef) overlayRef.current = particles
  if (captionLiveRef) {
    const prev = captionLiveRef.current
    captionLiveRef.current = {
      enabled: captionOn,
      isTextEnabled: captionOn,
      captionOn,
      text: captionText,
      customText: captionText,
      captionText,
      sizeId: captionSize,
      captionSize,
      strokeId: captionStroke,
      captionStroke,
      fontId: captionFont,
      captionFont,
      posX: captionPos.posX,
      posY: captionPos.posY,
      setPos: (next, maybeY) => {
        if (next && typeof next === 'object') {
          setCaptionPos({ posX: Number(next.posX) || 0, posY: Number(next.posY) || 0 })
          return
        }
        setCaptionPos({ posX: Number(next) || 0, posY: Number(maybeY) || 0 })
      },
      visible: captionOn && Boolean(String(captionText || '').trim()),
      bubble: prev?.bubble,
      effect,
      fps,
      speed,
      loopSeconds,
    }
  }

  const setPlaying = (next) => {
    const value = typeof next === 'function' ? next(playing) : next
    onPlayingChange?.(value)
    if (typeof playingProp !== 'boolean') setLocalPlaying(value)
  }

  useEffect(() => {
    const clip = studio?.restore
    if (!clip) return
    const next = Array.isArray(clip.frames)
      ? clip.frames.map((item, index) => ({
        ...item,
        id: `${item.cutId || 'cut'}-seq-${index}-${Date.now().toString(36)}`,
      }))
      : []
    setSequence(next.filter((item) => !item.virtual))
    if (clip.fps) setFps(clampSequenceFps(clip.fps))
    if (clip.effect) setEffect(clip.effect)
    if (clip.speed) setSpeed(clip.speed)
    if (typeof clip.pingPong === 'boolean') setPingPong(clip.pingPong)
    if (Array.isArray(clip.particles)) setParticles(clip.particles)
    if (typeof clip.captionOn === 'boolean') setCaptionOn(clip.captionOn)
    if (typeof clip.captionText === 'string') setCaptionText(clip.captionText)
    if (clip.captionSize) setCaptionSize(clip.captionSize)
    if (clip.captionStroke) setCaptionStroke(clip.captionStroke)
    if (clip.captionFont) setCaptionFont(normalizeEmoticonFontId(clip.captionFont))
    if (Number.isFinite(Number(clip.posX)) || Number.isFinite(Number(clip.posY))) {
      setCaptionPos({ posX: Number(clip.posX) || 0, posY: Number(clip.posY) || 0 })
    }
    setPlaying(true)
    studio.clearRestore?.()
  }, [studio, studio?.restore, setSpeed])

  useEffect(() => {
    const token = studio?.fallbackSeq
    if (!token) return
    setSequence([])
    setEffect(TEXT_MOTION_NONE)
    setParticles([])
    setPingPong(false)
    setCaptionOn(false)
    setCaptionText('')
    setCaptionSize('md')
    setCaptionStroke('black')
    setCaptionFont(DEFAULT_EMOTICON_FONT_ID)
    setCaptionPos({ posX: 0, posY: 0 })
    setFps(SEQUENCE_FPS_DEFAULT)
  }, [studio?.fallbackSeq])

  useEffect(() => {
    onCaptionLive?.()
  }, [captionOn, captionText, captionSize, captionStroke, captionFont, captionPos, effect, fps, speed, loopSeconds, onCaptionLive])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Delete' && event.key !== 'Del') return
      if (!selectedSeqId) return
      const tag = String(event.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (document.querySelector('[data-pixel-studio="1"]')) return
      event.preventDefault()
      setSequence((prev) => removeSequenceItem(prev, selectedSeqId))
      setSelectedSeqId('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedSeqId])

  useEffect(() => {
    if (!Array.isArray(injectFrames) || !injectFrames.length) return
    const stamp = injectFrames.map((item) => item.id || item.url).join('|')
    if (!stamp || injectStampRef.current === stamp) return
    injectStampRef.current = stamp
  }, [injectFrames])

  const appendCut = (cut, index) => {
    const url = cutFrameUrl(cut)
    if (!url) return
    setSequence((prev) => [...prev, makeSequenceItem(cut, index, prev.length || slot)])
    setPlaying(true)
  }

  return (
    <section
      className="ms-root overflow-hidden overflow-y-hidden"
      data-motion-seq="1"
      data-caption-bar="1"
      data-still-loop={stillLoop ? '1' : '0'}
      data-playing={playing ? 'run' : 'pause'}
      aria-label="프레임 시퀀서"
    >
      <header className="ms-head">
        <h3>프레임 시퀀서</h3>
        <div className="ms-transport">
          <button
            type="button"
            className={clsx('ms-btn', playing && 'is-on')}
            disabled={!frames.length}
            data-play-toggle="seq"
            onClick={() => setPlaying(!playing)}
            {...magnify(playing ? '일시정지' : '재생', '타임라인 루프를 재생하거나 멈춥니다')}
          >
            {playing ? '일시정지' : '재생'}
          </button>
          <button
            type="button"
            className={clsx('ms-btn', !pingPong && 'is-on')}
            data-loop-mode="forward"
            onClick={() => setPingPong(false)}
            {...magnify('정방향', '1-2-3-4 순으로만 순환합니다')}
          >
            정방향
          </button>
          <button
            type="button"
            className={clsx('ms-btn', pingPong && 'is-on')}
            data-loop-mode="pingpong"
            onClick={() => setPingPong(true)}
            {...magnify('핑퐁', '1-2-3-4-3-2 왕복으로 끊김 없이 순환합니다')}
          >
            핑퐁
          </button>
          <label className="ms-fps" {...magnify('FPS', '루프 재생 속도입니다. 4~24, 기본 8')}>
            <span>FPS {fps}</span>
            <input
              type="range"
              min={SEQUENCE_FPS_MIN}
              max={SEQUENCE_FPS_MAX}
              step="1"
              value={fps}
              onChange={(event) => setFps(clampSequenceFps(event.target.value))}
            />
          </label>
          <div className="ms-speed" role="group" aria-label="재생 배속">
            {PLAYBACK_SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                className={clsx('ms-btn', speed === value && 'is-on')}
                data-play-speed={value}
                onClick={() => setSpeed(value)}
                {...magnify(speedLabel(value), '시퀀서 미리보기와 인코딩 배속입니다')}
              >
                {speedLabel(value)}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="ms-toolbar" data-seq-toolbar="1">
        <div className="ms-toolbar-row">
          <MotionEffectSelector value={effect} onChange={setEffect} />
          <ParticleOverlayBar value={particles} onChange={setParticles} />
        </div>
        <CaptionControlBar
          enabled={captionOn}
          text={captionText}
          sizeId={captionSize}
          strokeId={captionStroke}
          fontId={captionFont}
          onEnabled={setCaptionOn}
          onText={setCaptionText}
          onSize={setCaptionSize}
          onStroke={setCaptionStroke}
          onFont={setCaptionFont}
        />
      </div>

      <div className="ms-body">
        <MotionPreviewCanvas
          frames={frames}
          fps={fps}
          playing={playing}
          effect={effect}
          speed={speed}
          pingPong={pingPong}
          particles={particles}
          stillLoop={stillLoop}
          motionPreset={motionPreset}
          isolateSprite={isolateSprite}
          intensity={intensity}
          loopSeconds={loopSeconds}
          mirrorRef={chatMirrorRef}
          captionOn={captionOn}
          captionText={captionText}
          captionSize={captionSize}
          captionStroke={captionStroke}
          captionFont={captionFont}
          captionPos={captionPos}
          onCaptionPos={setCaptionPos}
          onTick={(_index, url) => setLiveUrl(url)}
        />
        <div className="ms-tracks">
          {showCutBank ? (
            <>
              <p className="ms-kicker">컷 선택</p>
              {cuts.length ? (
                <div className="ms-cut-bank" role="list" data-cut-bank="1">
                  {cuts.map((cut, index) => {
                    const url = cutFrameUrl(cut)
                    return (
                      <button
                        key={cut.id || index}
                        type="button"
                        className="ms-cut"
                        disabled={!url}
                        data-seq-cut={index}
                        onClick={() => appendCut(cut, index)}
                        {...magnify(`${index + 1}번`, '이 컷을 타임라인 끝에 추가합니다')}
                      >
                        {url ? <img src={url} alt={`${index + 1}번`} /> : null}
                        <span>{index + 1}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="ms-empty" data-cut-bank-empty="1">{cutBankEmpty}</p>
              )}
            </>
          ) : null}
          <p className="ms-kicker">타임라인 {timelineFrames.length}</p>
          <FrameSequencerTrack
            items={sequence}
            selectedId={selectedSeqId}
            onSelect={setSelectedSeqId}
            onMove={(index, delta) => setSequence((prev) => moveSequenceItem(prev, index, delta))}
            onRemove={(id) => {
              setSequence((prev) => removeSequenceItem(prev, id))
              setSelectedSeqId((prev) => (prev === id ? '' : prev))
            }}
          />
        </div>
      </div>
      <div className="ms-dock">
        <ChatRoomSimulator
          frameUrl={liveUrl || frames[0]?.url || ''}
          theme={chatTheme}
          onTheme={setChatTheme}
          canvasRef={chatMirrorRef}
        />
        <StoreSpecHud
          frameCount={hudFrames}
          fps={fps}
          speed={speed}
          pingPong={!stillLoop && pingPong}
        />
      </div>
      <MotionClipManager />
      <MotionExportPanel
        frames={frames}
        sequence={stillLoop ? frames : sequence}
        fps={fps}
        speed={speed}
        effect={effect}
        pingPong={!stillLoop && pingPong}
        particles={particles}
        stillLoop={stillLoop}
        motionPreset={motionPreset}
        isolateSprite={isolateSprite}
        intensity={intensity}
        loopSeconds={loopSeconds}
        captionOn={captionOn}
        captionText={captionText}
        captionSize={captionSize}
        captionStroke={captionStroke}
        captionFont={captionFont}
        captionPos={captionPos}
      />
    </section>
  )
}
