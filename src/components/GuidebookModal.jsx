import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { magnify } from './MenuMagnifierHUD.jsx'
import { getGuidebookChapters } from '../lib/featureRegistry.js'

function ChipRow({ visual }) {
  const chips = visual.chips || []
  return (
    <div className={clsx('guide-visual', visual.tone && `is-${visual.tone}`)}>
      {chips.map((chip, index) => (
        visual.split && chip === '|' ? (
          <span key={`split-${index}`} className="guide-split-line" />
        ) : (
          <span
            key={`${chip}-${index}`}
            className={clsx(
              'guide-chip',
              visual.chipTones?.[index] === 'cyan' && 'is-cyan',
              visual.chipTones?.[index] === 'pink' && 'is-pink',
            )}
          >
            {chip}
          </span>
        )
      ))}
    </div>
  )
}

function Callouts({ tip, fail, params }) {
  return (
    <div className="guide-callouts">
      {params?.length ? (
        <p className="guide-params">
          {params.map((item) => <span key={item}>{item}</span>)}
        </p>
      ) : null}
      {tip ? <p className="guide-tip"><strong>실무 팁</strong> {tip}</p> : null}
      {fail ? <p className="guide-fail"><strong>실패 예방</strong> {fail}</p> : null}
    </div>
  )
}

function PlayStep({ n, step }) {
  return (
    <article className="guide-play">
      <span className="guide-play-n">{String(n).padStart(2, '0')}</span>
      <div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <Callouts tip={step.tip} fail={step.fail} params={step.params} />
      </div>
    </article>
  )
}

function MethodBlock({ method }) {
  return (
    <section className={clsx('guide-method', method.id === 'B' && 'is-b')}>
      <header>
        <span className="guide-method-id">{method.id}</span>
        <div>
          <h3>{method.title}</h3>
          {method.intro ? <p>{method.intro}</p> : null}
        </div>
      </header>
      {(method.steps || []).map((step, index) => (
        <PlayStep key={step.title} n={index + 1} step={step} />
      ))}
    </section>
  )
}

function WorkflowBoard({ workflow }) {
  return (
    <div className="guide-workflow">
      <div className="guide-workflow-banner">
        <p className="guide-workflow-kicker">{workflow.subtitle}</p>
        <h4>{workflow.banner}</h4>
      </div>
      <div className="guide-workflow-grid">
        {workflow.cards.map((card) => (
          <article key={card.n} className="guide-workflow-card">
            <div className="guide-workflow-card-head">
              <span className="guide-workflow-n">{card.n}</span>
              <span className="guide-workflow-icon" aria-hidden="true">{card.icon}</span>
              <h5>{card.title}</h5>
            </div>
            {(card.lines || []).map((line) => (
              <p key={line}>{line}</p>
            ))}
            {card.quote ? (
              <blockquote className="guide-workflow-quote">
                {card.quote}
              </blockquote>
            ) : null}
          </article>
        ))}
      </div>
      {workflow.badge ? (
        <p className="guide-workflow-badge">{workflow.badge}</p>
      ) : null}
    </div>
  )
}

function FeatureBlock({ feature, startNo, onApplySample }) {
  const content = feature.guideContent
  let next = startNo
  const play = content.play || []
  return (
    <section
      id={`guide-sec-${content.sectionId || feature.id}`}
      className="guide-feature"
      data-guide-pipeline={content.sectionId === 'pipeline' ? '1' : undefined}
    >
      {content.title ? <h3 className="guide-feature-title">{content.title}</h3> : null}
      {content.kicker ? <p className="guide-kicker">{content.kicker}</p> : null}
      {content.sample ? (
        <button
          type="button"
          className="guide-sample-btn"
          onClick={() => onApplySample?.(content.sample)}
        >
          💡 이 스타일 캔버스에 즉시 적용
          <span>{content.sample.label}</span>
        </button>
      ) : null}
      {(content.visuals || []).map((visual, index) => (
        <ChipRow key={`${feature.id}-v-${index}`} visual={visual} />
      ))}
      {content.summary?.length ? (
        <div className="guide-summary-grid">
          {content.summary.map((item) => (
            <article key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      ) : null}
      {content.workflow ? <WorkflowBoard workflow={content.workflow} /> : null}
      {play.map((step) => {
        const n = next
        next += 1
        return <PlayStep key={`${feature.id}-${step.title}`} n={n} step={step} />
      })}
      {(content.methods || []).map((method) => (
        <MethodBlock key={method.id} method={method} />
      ))}
    </section>
  )
}

function ChapterPane({ chapter, onApplySample }) {
  let startNo = 1
  return (
    <div className="guide-pane">
      {chapter.features.map((feature) => {
        const playCount = feature.guideContent.play?.length || 0
        const block = (
          <FeatureBlock
            key={feature.id}
            feature={feature}
            startNo={startNo}
            onApplySample={onApplySample}
          />
        )
        startNo += playCount
        return block
      })}
    </div>
  )
}

export default function GuidebookModal({ open, onClose, onApplySample }) {
  const chapters = useMemo(() => getGuidebookChapters(), [])
  const [tab, setTab] = useState(chapters[0]?.id || 'basics')
  const contentRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!chapters.some((item) => item.id === tab) && chapters[0]) setTab(chapters[0].id)
  }, [chapters, tab])

  const selectChapter = (id) => {
    setTab(id)
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const jumpSection = (sectionId) => {
    const root = contentRef.current
    const target = root?.querySelector(`#guide-sec-${sectionId}`)
    if (!root || !target) return
    const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
    root.scrollTo({ top: Math.max(0, top - 10), behavior: 'smooth' })
  }

  if (!open) return null
  const current = chapters.find((item) => item.id === tab) ?? chapters[0]

  return (
    <div className="studio-modal-root" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="studio-modal-backdrop" onClick={onClose} />
      <div className="studio-modal-card guide-master">
        <header className="studio-modal-head">
          <div>
            <p className="studio-modal-kicker">Field Manual · Step-by-Step</p>
            <h2 id="guide-title">📖 실무형 마스터 가이드북</h2>
          </div>
          <button type="button" className="studio-modal-close" onClick={onClose} aria-label="닫기" {...magnify('닫기', '가이드북을 닫습니다')}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="guide-master-body">
          <nav className="guide-chapters" aria-label="가이드 챕터">
            {chapters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx('guide-chapter', tab === item.id && 'is-on', item.depth === 'deep' && 'is-deep')}
                onClick={() => selectChapter(item.id)}
                {...magnify(`챕터 ${item.no}`, item.label)}
              >
                <span>{item.no}</span>
                <span className="guide-chapter-copy">
                  {item.label}
                  <em>{item.depth === 'deep' ? '심층 실전' : '압축 요약'}</em>
                </span>
              </button>
            ))}
          </nav>
          <div className="guide-master-content" ref={contentRef}>
            {current?.sections?.length > 1 ? (
              <div className="guide-jump">
                {current.sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className="guide-jump-btn"
                    onClick={() => jumpSection(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            ) : null}
            {current ? <ChapterPane chapter={current} onApplySample={onApplySample} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
