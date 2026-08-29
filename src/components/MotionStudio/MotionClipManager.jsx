import { magnify } from '../MenuMagnifierHUD.jsx'
import { openCheckerboardPreview } from '../../utils/encoder/MotionEncoderEngine.js'
import { isPermanentClip } from '../../utils/encoder/BatchExportEngine.js'
import { useMotionStudio } from './motionStudioContext.jsx'

export default function MotionClipManager() {
  const studio = useMotionStudio()
  const clips = (studio?.clips || []).filter(isPermanentClip)

  const removeOne = (event, id) => {
    event.preventDefault()
    event.stopPropagation()
    studio?.removeClip?.(id)
  }

  return (
    <div className="ms-clips" data-motion-clips="1" aria-label="모션 클립">
      <div className="ms-clips-head">
        <p className="ms-kicker">클립 {clips.length}</p>
        {clips.length ? (
          <button
            type="button"
            className="ms-btn ms-clip-clear"
            data-clip-clear="1"
            onClick={() => studio.clearClips?.()}
            {...magnify('전체 비우기', '보관함의 모든 클립을 한 번에 지우고 시퀀서를 기본 상태로 되돌립니다')}
          >
            🗑️ 전체 비우기
          </button>
        ) : null}
      </div>
      {clips.length ? (
        <ul className="ms-clip-gallery">
          {clips.map((clip, index) => (
            <li key={clip.id} className="ms-clip-card" data-motion-clip={index} data-clip-id={clip.id}>
              <button
                type="button"
                className="ms-clip-thumb checkerboard-bg"
                onClick={() => clip.blob && openCheckerboardPreview(clip.blob)}
                {...magnify(clip.fileName || `${index + 1}`, '체커보드 새 창에서 이 클립을 다시 봅니다')}
              >
                {clip.url ? <img src={clip.url} alt={clip.fileName || `클립 ${index + 1}`} /> : null}
                <span>{clip.fileName || `클립 ${index + 1}`}</span>
              </button>
              <button
                type="button"
                className="ms-clip-del"
                data-clip-del="1"
                aria-label="삭제"
                onClick={(event) => removeOne(event, clip.id)}
                {...magnify('삭제', '이 클립만 보관함에서 제거합니다. 작업 중 클립이면 시퀀서가 기본 상태로 돌아갑니다')}
              >
                ❌
              </button>
              <div className="ms-clip-card-ops">
                <button
                  type="button"
                  onClick={() => studio.applyClip(clip)}
                  {...magnify('수정', '이 클립의 타임라인·효과·속도를 시퀀서에 다시 불러옵니다')}
                >
                  수정
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ms-empty">클립 저장으로 쌓입니다.</p>
      )}
    </div>
  )
}
