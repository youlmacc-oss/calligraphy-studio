import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, ChevronDown, Star, Upload } from 'lucide-react'
import { DEFAULT_TEXT, FONT_CATEGORIES, FONT_TAB_LABELS, FONT_TAB_TOOLTIPS, FONTS, getFontMeta } from '../presets.js'
import { resolveWeight } from '../lib/renderStyle.js'
import { CUSTOM_FONT_GROUP, isFontFile } from '../lib/customFonts.js'

const SAMPLE = '가나다 / Aa / 龍'
const SCROLL_EDGE = 4
const FAVORITES_GROUP = {
  id: 'favorites',
  tag: '⭐ 즐겨찾기',
  label: '⭐ 즐겨찾기',
  hint: '즐겨찾기한 글꼴만 빠르게 고릅니다',
  tooltip: '즐겨찾기한 글꼴만 빠르게 고릅니다',
}

function CategoryTabButton({ cat, active, onSelect }) {
  const label = FONT_TAB_LABELS[cat.id] || cat.label
  const tooltip = FONT_TAB_TOOLTIPS[cat.id] || cat.tooltip
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={clsx('font-cat-tab', active && 'is-on', cat.id === 'favorites' && 'is-fav')}
      data-tooltip={tooltip}
      onClick={() => onSelect(cat.id)}
    >
      {label}
    </button>
  )
}

function pickerGroups() {
  return [FAVORITES_GROUP, CUSTOM_FONT_GROUP, ...FONT_CATEGORIES]
}

function CategoryTabRail({ groups, activeId, onSelect }) {
  const scrollerRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [thumb, setThumb] = useState({ left: 0, width: 100, overflow: false })

  const syncScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const overflow = max > SCROLL_EDGE
    const ratio = el.scrollWidth > 0 ? el.clientWidth / el.scrollWidth : 1
    const width = overflow ? Math.max(22, ratio * 100) : 100
    const left = overflow && max > 0 ? (el.scrollLeft / max) * (100 - width) : 0
    setCanPrev(overflow && el.scrollLeft > SCROLL_EDGE)
    setCanNext(overflow && el.scrollLeft < max - SCROLL_EDGE)
    setThumb({ left, width, overflow })
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    const frame = requestAnimationFrame(syncScroll)
    const observer = new ResizeObserver(syncScroll)
    observer.observe(el)
    el.addEventListener('scroll', syncScroll, { passive: true })
    window.addEventListener('resize', syncScroll)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      el.removeEventListener('scroll', syncScroll)
      window.removeEventListener('resize', syncScroll)
    }
  }, [syncScroll, groups])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return undefined
    const onWheel = (event) => {
      if (el.scrollWidth <= el.clientWidth + SCROLL_EDGE) return
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (!delta) return
      event.preventDefault()
      el.scrollLeft += delta
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const active = scrollerRef.current?.querySelector('.font-cat-tab.is-on')
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeId])

  const slideBy = (direction) => {
    const el = scrollerRef.current
    if (!el) return
    const amount = Math.max(140, el.clientWidth * 0.72)
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
  }

  const scrollToRatio = (clientX) => {
    const el = scrollerRef.current
    const track = trackRef.current
    if (!el || !track) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 0) return
    const rect = track.getBoundingClientRect()
    const thumbWidth = (thumb.width / 100) * rect.width
    const usable = Math.max(1, rect.width - thumbWidth)
    const x = Math.max(0, Math.min(usable, clientX - rect.left - thumbWidth / 2))
    el.scrollLeft = (x / usable) * max
  }

  const onTrackPointerDown = (event) => {
    if (!thumb.overflow) return
    event.preventDefault()
    dragRef.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    scrollToRatio(event.clientX)
  }

  const onTrackPointerMove = (event) => {
    if (!dragRef.current) return
    scrollToRatio(event.clientX)
  }

  const onTrackPointerUp = () => {
    dragRef.current = false
  }

  return (
    <div className="font-cat-rail">
      <button
        type="button"
        className={clsx('font-cat-arrow', !canPrev && 'is-disabled')}
        aria-label="이전 카테고리"
        data-tooltip="◀ 이전 카테고리"
        disabled={!canPrev}
        onClick={() => slideBy(-1)}
      >
        ◀
      </button>

      <div className="font-cat-scroll-wrap">
        <div className="font-cat-tabs" ref={scrollerRef} role="tablist" aria-label="폰트 카테고리">
          {groups.map((cat) => (
            <CategoryTabButton
              key={cat.id}
              cat={cat}
              active={activeId === cat.id}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div
          ref={trackRef}
          className={clsx('font-cat-slider', !thumb.overflow && 'is-idle')}
          role="scrollbar"
          aria-label="카테고리 가로 스크롤"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(thumb.left)}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={onTrackPointerUp}
          onPointerCancel={onTrackPointerUp}
        >
          <span
            className="font-cat-slider-thumb"
            style={{ left: `${thumb.left}%`, width: `${thumb.width}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        className={clsx('font-cat-arrow', !canNext && 'is-disabled')}
        aria-label="다음 카테고리"
        data-tooltip="다음 카테고리 ▶"
        disabled={!canNext}
        onClick={() => slideBy(1)}
      >
        ▶
      </button>
    </div>
  )
}

export default function FontPicker({
  value,
  text,
  onChange,
  onHoverFont,
  weight = 400,
  preferredGroup = 'kr-calli',
  favoriteIds = [],
  onToggleFavorite,
  extraFonts = [],
  onAddFontFile,
}) {
  const catalog = extraFonts.length ? [...extraFonts, ...FONTS] : FONTS
  const current = catalog.find((item) => item.id === value) ?? FONTS[0]
  const previewLine = String(text || '').split('\n')[0].trim()
  const currentGroup = current.group || preferredGroup
  const groups = pickerGroups()
  const favoriteSet = new Set(favoriteIds)
  const [open, setOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState(currentGroup)
  const [hoverId, setHoverId] = useState(null)
  const [card, setCard] = useState(null)
  const [dropOver, setDropOver] = useState(false)
  const [fontNote, setFontNote] = useState('')
  const rootRef = useRef(null)
  const fileRef = useRef(null)
  const rafRef = useRef(0)
  const hovered = catalog.find((item) => item.id === hoverId) ?? null
  const guideFont = hovered ?? current
  const currentMeta = current.custom
    ? { tag: '📂 내 글꼴', mood: '내 PC에서 올린 글꼴', use: '이 레이어에 즉시 적용', blurb: 'FontFace로 등록된 커스텀 폰트입니다.', guide: '업로드한 글꼴은 이 브라우저 세션에서 바로 쓰입니다.' }
    : getFontMeta(current)
  const guideMeta = guideFont.custom
    ? { tag: '📂 내 글꼴', mood: '내 PC에서 올린 글꼴', use: '이 레이어에 즉시 적용', blurb: 'FontFace로 등록된 커스텀 폰트입니다.', guide: '업로드한 글꼴은 이 브라우저 세션에서 바로 쓰입니다.' }
    : getFontMeta(guideFont)

  useEffect(() => {
    setOpenGroup((prev) => (prev === 'favorites' ? 'favorites' : (current.group || preferredGroup)))
    setHoverId(null)
    setCard(null)
  }, [value, current.group, preferredGroup])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setHoverId(null)
        setCard(null)
        onHoverFont?.(null)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setHoverId(null)
        setCard(null)
        onHoverFont?.(null)
      }
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onHoverFont])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const frame = requestAnimationFrame(() => {
      rootRef.current?.querySelector('.font-picker-item.is-selected')?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, value, openGroup])

  const selectGroup = (groupId) => {
    if (!groupId) return
    setOpenGroup(groupId)
    setHoverId(null)
    setCard(null)
    onHoverFont?.(null)
  }

  const previewHover = (font, event) => {
    const nextId = font?.id ?? null
    const target = event.currentTarget
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setHoverId(nextId)
      onHoverFont?.(nextId)
      if (!font || !target) {
        setCard(null)
        return
      }
      const rect = target.getBoundingClientRect()
      const width = 300
      const left = rect.right + 12 + width > window.innerWidth ? rect.left - width - 12 : rect.right + 12
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - 268))
      setCard({ left, top })
    })
  }

  const leaveList = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setHoverId(null)
      setCard(null)
      onHoverFont?.(null)
    })
  }

  const pickFont = (item) => {
    onChange(item.id)
    if (openGroup !== 'favorites') setOpenGroup(item.group)
    setHoverId(null)
    setCard(null)
    onHoverFont?.(null)
  }

  const takeFontFile = async (file) => {
    if (!file) return
    if (!isFontFile(file)) {
      setFontNote('TTF / OTF / WOFF 파일만 올릴 수 있습니다.')
      return
    }
    try {
      const item = await onAddFontFile?.(file)
      setFontNote(item?.label ? `${item.label} 등록 완료` : '글꼴을 등록했습니다.')
      if (item?.group) setOpenGroup(item.group)
    } catch (error) {
      setFontNote(error.message || '글꼴 등록에 실패했습니다.')
    }
  }

  const currentFav = favoriteSet.has(current.id)

  return (
    <div className="font-picker" ref={rootRef}>
      <button
        type="button"
        className="font-picker-trigger allow-long-text"
        data-label-exempt="true"
        data-tooltip="이 레이어에 쓸 글꼴을 고릅니다. 목록은 미리보기로 확인하세요."
        onClick={() => {
          if (open) {
            setHoverId(null)
            setCard(null)
            onHoverFont?.(null)
          } else {
            setOpenGroup(current.group || preferredGroup)
          }
          setOpen((wasOpen) => !wasOpen)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="font-picker-current-tag">
            {currentFav ? '⭐ ' : ''}{currentMeta.tag}
          </span>
          <span className="font-picker-name mt-1" style={{ fontFamily: current.family, fontWeight: weight }}>
            {current.label}
          </span>
          <span className="font-picker-sample" style={{ fontFamily: current.family }}>
            {previewLine || SAMPLE}
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={clsx('h-5 w-5 shrink-0 text-cyan-300 transition', open && 'rotate-180')} />
      </button>

      <div className={clsx('font-guide', hovered && 'is-hover')}>
        <div className="font-guide-head">
          <p className="font-guide-kicker">📖 Font Guide{hovered ? ' · 미리보기' : ''}</p>
          <span className="font-preview-tag">{guideMeta.tag}</span>
        </div>
        <p className="font-guide-name" style={{ fontFamily: guideFont.family, fontWeight: resolveWeight(guideFont, weight) }}>
          {guideFont.label}
        </p>
        <p className="font-guide-mood">{guideMeta.mood}</p>
        <p className="font-guide-use">🎯 {guideMeta.use}</p>
        <p className="font-guide-blurb">{guideMeta.blurb}</p>
        <div
          className="font-guide-sample"
          style={{ fontFamily: guideFont.family, fontWeight: resolveWeight(guideFont, weight) }}
        >
          {previewLine || DEFAULT_TEXT}
        </div>
      </div>

      {open && (
        <div className="font-picker-panel" role="listbox" data-no-magnifier>
          <div
            className={clsx('font-drop', dropOver && 'is-over')}
            onDragOver={(event) => {
              event.preventDefault()
              setDropOver(true)
            }}
            onDragLeave={() => setDropOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDropOver(false)
              takeFontFile(event.dataTransfer.files?.[0])
            }}
          >
            <Upload className="h-4 w-4" />
            <div>
              <strong>내 PC 폰트 올리기</strong>
              <p>TTF / OTF / WOFF를 끌어다 놓거나 선택</p>
            </div>
            <button
              type="button"
              className="mini-btn"
              data-tooltip="TTF/OTF/WOFF 글꼴 파일을 이 브라우저에 등록"
              onClick={() => fileRef.current?.click()}
            >
              파일 선택
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
              onChange={(event) => {
                takeFontFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
          {fontNote ? <p className="font-drop-note">{fontNote}</p> : null}
          <CategoryTabRail
            groups={groups}
            activeId={openGroup}
            onSelect={selectGroup}
          />

          {groups.map((cat) => {
            const expanded = openGroup === cat.id
            const fonts = cat.id === 'favorites'
              ? catalog.filter((item) => favoriteSet.has(item.id))
              : cat.id === 'custom'
                ? extraFonts
                : FONTS.filter((item) => item.group === cat.id)
            return (
              <div key={cat.id} className={clsx('font-picker-group', expanded && 'is-open')}>
                <button
                  type="button"
                  className="font-acc-head"
                  data-tooltip={FONT_TAB_TOOLTIPS[cat.id] || cat.tooltip}
                  aria-expanded={expanded}
                  onClick={() => selectGroup(cat.id)}
                >
                  {FONT_TAB_LABELS[cat.id] || cat.label}
                  <span className="font-acc-chevron" aria-hidden="true" />
                </button>
                {expanded && (
                  <div className="font-acc-body" onMouseLeave={leaveList}>
                    {fonts.length ? fonts.map((item) => {
                      const selected = item.id === value
                      const active = item.id === hoverId
                      const favored = favoriteSet.has(item.id)
                      return (
                        <div
                          key={item.id}
                          className={clsx('font-picker-item', selected && 'is-selected', active && 'is-hover')}
                          onMouseEnter={(event) => previewHover(item, event)}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className="font-picker-pick allow-long-text"
                            data-label-exempt="true"
                            data-tooltip={`${item.label} 글꼴 적용`}
                            onFocus={(event) => previewHover(item, event)}
                            onClick={() => pickFont(item)}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="font-picker-name" style={{ fontFamily: item.family }}>
                                {item.label}
                              </span>
                              <span className="font-picker-sample" style={{ fontFamily: item.family }}>
                                {previewLine || SAMPLE}
                              </span>
                            </span>
                            {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-300" /> : null}
                          </button>
                          <button
                            type="button"
                            className={clsx('font-fav-btn', favored && 'is-on')}
                            aria-label={favored ? `${item.label} 즐겨찾기 해제` : `${item.label} 즐겨찾기 추가`}
                            aria-pressed={favored}
                            data-tooltip={favored ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              onToggleFavorite?.(item.id)
                            }}
                          >
                            <Star aria-hidden="true" className="h-4 w-4" fill={favored ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      )
                    }) : (
                      <p className="font-fav-empty">
                        {cat.id === 'custom'
                          ? '위쪽에 TTF/OTF/WOFF를 올리면 이 목록에 나타납니다.'
                          : '아직 즐겨찾기가 없습니다. 다른 탭에서 글꼴 우측 ⭐를 누르면 여기에 모입니다.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {open && hovered && card
        ? createPortal(
            <div className="font-preview-card" style={{ left: card.left, top: card.top }} data-no-magnifier>
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-semibold text-white">{hovered.label}</p>
                <span className="font-preview-tag">{hovered.custom ? '📂 내 글꼴' : getFontMeta(hovered).tag}</span>
              </div>
              <div
                className="font-preview-sample"
                style={{ fontFamily: hovered.family, fontWeight: resolveWeight(hovered, weight) }}
              >
                {previewLine || DEFAULT_TEXT}
              </div>
              <p className="mt-2 text-[14px] leading-6 text-slate-100">{hovered.custom ? 'FontFace로 등록된 커스텀 폰트입니다.' : getFontMeta(hovered).guide}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
