import { magnify } from '../MenuMagnifierHUD.jsx'

export default function FrameSequencerTrack({
  items = [],
  selectedId = '',
  onSelect,
  onMove,
  onRemove,
}) {
  if (!items.length) {
    return <p className="ms-empty">컷을 누르면 타임라인에 쌓입니다.</p>
  }

  return (
    <ol className="ms-timeline" aria-label="프레임 타임라인">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="ms-clip"
          data-seq-index={index}
          data-seq-active={selectedId === item.id ? '1' : '0'}
          onClick={() => onSelect?.(item.id)}
        >
          <span className="ms-clip-no">{index + 1}</span>
          {item.url ? <img src={item.url} alt={`${item.label}번`} /> : null}
          <button
            type="button"
            className="ms-clip-del"
            data-seq-remove={index}
            onClick={(event) => {
              event.stopPropagation()
              onRemove?.(item.id)
            }}
            {...magnify('×', '이 프레임만 타임라인에서 빼습니다')}
          >
            ×
          </button>
          <div className="ms-clip-ops">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove?.(index, -1)}
              {...magnify('앞', '이 프레임을 한 칸 앞으로 옮깁니다')}
            >
              앞
            </button>
            <button
              type="button"
              disabled={index === items.length - 1}
              onClick={() => onMove?.(index, 1)}
              {...magnify('뒤', '이 프레임을 한 칸 뒤로 옮깁니다')}
            >
              뒤
            </button>
            <button
              type="button"
              onClick={() => onRemove?.(item.id)}
              {...magnify('삭제', '이 프레임을 타임라인에서 빼습니다')}
            >
              삭제
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
