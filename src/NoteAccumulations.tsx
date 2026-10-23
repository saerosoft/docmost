import { useEffect, useState } from 'react';
import type { NoteAccumulation, NoteApi, Page } from './model';
import { NoteAccumulationChange } from './NoteAccumulationChange';
import { webUrl } from './webOrigin';

const date = (value: string) => new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const operationLabels: Record<string, string> = { CREATE_NOTE: '노트 생성', APPEND_NOTE: '사실 추가', REPLACE_NOTE: '현재 정리 갱신' };

export function NoteAccumulations({ api, noteId }: { api: NoteApi; noteId: string }) {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page<NoteAccumulation>>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setPage(undefined); setError('');
    api.accumulations(noteId, offset ? String(offset) : null).then(result => { if (alive) setPage(result); })
      .catch(failure => { if (alive) setError((failure as Error).message); });
    return () => { alive = false; };
  }, [api, noteId, offset, attempt]);
  return <section className="context-card note-accumulations" aria-label="현재 정리">
    <h2>현재 정리</h2>
    <p className="context-muted">반영된 변경과 당시 근거를 최신순으로 보여 줍니다. 사람이 작성한 본문과 이전 개정은 보존됩니다.</p>
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>현재 정리 다시 읽기</button></p>}
    {!page && !error && <p role="status">현재 정리를 읽는 중…</p>}
    {page && <>
      {!page.items.length && <p>반영된 정리가 없습니다.</p>}
      {page.items.map(item => <Accumulation key={item.id} api={api} item={item}/>)}
      <nav className="context-pagination" aria-label="누적 이력 페이지">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>이전 반영 내역</button>
        <span>{offset / 20 + 1}쪽</span>
        <button type="button" disabled={!page.nextCursor} onClick={() => setOffset(Number(page.nextCursor))}>다음 반영 내역</button>
      </nav>
    </>}
  </section>;
}

function Accumulation({ api, item }: { api: NoteApi; item: NoteAccumulation }) {
  const [expanded, setExpanded] = useState(false);
  const path = `/spaces/${encodeURIComponent(item.spaceId)}`;
  return <article className="accumulation-item">
    <div className="accumulation-heading"><span>{operationLabels[item.kind] || item.kind}</span><span>개정 {item.resultRevision}</span></div>
    <h3>{item.title}</h3>
    <p className="preserve">{item.preview}</p>
    <p className="context-muted">반영 시각 <time dateTime={item.appliedAt}>{date(item.appliedAt)}</time> · {item.actorName || '알 수 없는 사용자'} · {item.automatic ? '정책에 따라 자동 반영' : `${item.reviewerName || '알 수 없는 사용자'} 검토 후 반영`}</p>
    {item.evidence.map(evidence => <section key={evidence.id} className="note-evidence" data-visibility={evidence.visibility} aria-label={`${evidence.title} 근거`}>
      <div className="evidence-heading">
        <a href={webUrl(`/spaces/${encodeURIComponent(evidence.spaceId)}/source-revisions/${encodeURIComponent(evidence.revisionId)}`)} target="_blank" rel="noreferrer">{evidence.title}</a>
        {evidence.visibility !== 'SPACE' && <span className="visibility-label">{evidence.visibility === 'PRIVATE' ? '본인만' : '관리자 전용'}</span>}
      </div>
      <blockquote>{evidence.quote}</blockquote>
      {evidence.quoteTruncated && <p className="context-muted">원문 일부입니다. 전체 내용은 원본에서 확인해 주세요.</p>}
      <p className="context-muted">{evidence.locator}</p>
      <p className="context-muted">{evidence.occurredAt ? `원본 발생 ${date(evidence.occurredAt)}` : '원본 발생 시점 미상'} · {evidence.effectiveAt ? `효력 시점 ${date(evidence.effectiveAt)}` : '효력 시점 미상'}</p>
    </section>)}
    {item.evidenceCount > item.evidence.length && <p className="context-muted">열람 가능한 근거 {item.evidence.length}개를 표시했습니다. 전체 반영 기록에서 나머지 근거를 확인해 주세요.</p>}
    <p className="applied-rules">적용 규칙: {item.rules.length ? item.rules.map(rule => <a key={rule.versionId} href={webUrl(`${path}/rules?stage=history&ruleset=${encodeURIComponent(rule.rulesetId)}&version=${encodeURIComponent(rule.versionId)}`)} target="_blank" rel="noreferrer">{rule.name} v{rule.versionNumber}</a>) : '적용 기록 없음'}</p>
    <div className="context-actions">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '변경 전후·반영 기준 닫기' : '변경 전후·반영 기준 보기'}</button>
      <a href={webUrl(`${path}/reviews?changeSet=${encodeURIComponent(item.changeSetId)}`)} target="_blank" rel="noreferrer">반영 기록</a>
      <a href={webUrl(`${path}/rules?stage=improvements`)} target="_blank" rel="noreferrer">규칙 개선 제안</a>
    </div>
    {expanded && <NoteAccumulationChange api={api} id={item.id}/>}
  </article>;
}
