import { useEffect, useState } from 'react';
import type { CurrentKnowledgeItem, CurrentKnowledgePage, NoteApi } from './model';
import { NoteEvidence } from './NoteEvidence';
import { NoteAccumulationChange } from './NoteAccumulationChange';
import { webUrl } from './webOrigin';
import { useNoteDateTime } from './dateTime';

const claims: Record<CurrentKnowledgeItem['claimKind'], string> = {
  CONFIRMED_FACT: '확정 사실', REQUEST: '제안·요청', INFERENCE: '추정 · 확인 전', UNSPECIFIED: '확정 여부 미분류',
};

export function NoteCurrentKnowledge({ api, noteId, spaceId }: { api: NoteApi; noteId: string; spaceId: string }) {
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<CurrentKnowledgePage>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true; setPage(undefined); setError('');
    api.currentKnowledge(noteId, offset ? String(offset) : null).then(value => { if (alive) setPage(value); })
      .catch(failure => { if (alive) setError((failure as Error).message); });
    return () => { alive = false; };
  }, [api, noteId, offset, attempt]);
  return <section className="context-card note-current" aria-label="현재 정리">
    <h2>현재 정리</h2>
    <p className="context-muted">현재 유효한 항목입니다. 제안·요청과 추정은 확정 사실과 구분합니다. 이전 내용과 근거는 누적 이력에 보존됩니다.</p>
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>현재 정리 다시 읽기</button></div>}
    {!page && !error && <p role="status">현재 정리를 읽는 중…</p>}
    {page && <>
      <p className="context-muted">노트 개정 {page.revision} 기준</p>
      {page.bodyOrigin === 'LEGACY_UNCLASSIFIED' && <p className="legacy-body-notice">기존 본문은 작성 구분과 유효성을 확인해야 합니다.</p>}
      {!page.items.length && <p>{page.bodyOrigin === 'LEGACY_UNCLASSIFIED' ? '분리 확인된 현재 항목이 없습니다.' : '현재 유효한 정리가 없습니다.'}</p>}
      {page.items.map(item => <CurrentItem key={item.id} api={api} item={item} spaceId={spaceId}/>)}
      <nav className="context-pagination" aria-label="현재 정리 페이지">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>이전 현재 항목</button>
        <span>{offset / 20 + 1}쪽</span>
        <button type="button" disabled={!page.nextCursor} onClick={() => setOffset(Number(page.nextCursor))}>다음 현재 항목</button>
      </nav>
    </>}
  </section>;
}

function CurrentItem({ api, item, spaceId }: { api: NoteApi; item: CurrentKnowledgeItem; spaceId: string }) {
  const date = useNoteDateTime();
  const [expanded, setExpanded] = useState(false);
  return <article className="current-knowledge-item">
    <span className="claim-label" data-claim={item.claimKind}>{claims[item.claimKind]}</span>
    <p className="preserve">{item.body}</p>
    <details><summary>근거·반영 기록 · {item.evidenceCount}</summary>
      <NoteEvidence evidence={item.evidence} evidenceCount={item.evidenceCount}/>
      <p className="context-muted">반영 시각 <time dateTime={item.appliedAt}>{date(item.appliedAt)}</time> · 개정 {item.resultRevision}</p>
      <p className="applied-rules">적용 규칙: {item.rules.length ? item.rules.map(rule => <a key={rule.versionId} href={webUrl(`/spaces/${encodeURIComponent(spaceId)}/rules?stage=history&ruleset=${encodeURIComponent(rule.rulesetId)}&version=${encodeURIComponent(rule.versionId)}`)} target="_blank" rel="noreferrer">{rule.name} v{rule.versionNumber}</a>) : '적용 기록 없음'}</p>
      <div className="context-actions"><button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? '변경 전후·반영 기준 닫기' : '변경 전후·반영 기준 보기'}</button></div>
      {expanded && <NoteAccumulationChange api={api} id={item.id}/>}
    </details>
  </article>;
}
