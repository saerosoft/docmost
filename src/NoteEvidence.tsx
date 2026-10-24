import type { NoteAccumulation } from './model';
import { webUrl } from './webOrigin';

const date = (value: string) => new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export function NoteEvidence({ evidence, evidenceCount }: Pick<NoteAccumulation, 'evidence' | 'evidenceCount'>) {
  return <>
    {evidence.map(item => <section key={item.id} className="note-evidence" data-visibility={item.visibility} aria-label={`${item.title} 근거`}>
      <div className="evidence-heading">
        <a href={webUrl(`/spaces/${encodeURIComponent(item.spaceId)}/source-revisions/${encodeURIComponent(item.revisionId)}`)} target="_blank" rel="noreferrer">{item.title}</a>
        {item.visibility !== 'SPACE' && <span className="visibility-label">{item.visibility === 'PRIVATE' ? '본인만' : '관리자 전용'}</span>}
      </div>
      <blockquote>{item.quote}</blockquote>
      {item.quoteTruncated && <p className="context-muted">원문 일부입니다. 전체 내용은 원본에서 확인해 주세요.</p>}
      <p className="context-muted">{item.locator}</p>
      <p className="context-muted">{item.occurredAt ? `원본 발생 ${date(item.occurredAt)}` : '원본 발생 시점 미상'} · {item.effectiveAt ? `효력 시점 ${date(item.effectiveAt)}` : '효력 시점 미상'}</p>
    </section>)}
    {evidenceCount > evidence.length && <p className="context-muted">열람 가능한 근거 {evidence.length}개를 표시했습니다. 전체 반영 기록에서 나머지 근거를 확인해 주세요.</p>}
  </>;
}
