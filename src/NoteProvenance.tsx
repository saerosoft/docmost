import { useEffect, useState } from 'react';
import type { Note, NoteApi, Provenance } from './model';
import { webUrl } from './webOrigin';

const REVIEW_STATES = { PENDING: '검토 대기', ACCEPTED: '승인', REJECTED: '거절' };

interface Props { api: NoteApi; note: Note }

/** Links from a note to the sources, rules, reviews and actions it came from or leads to, opened in the product web application. */
export function NoteProvenance({ api, note }: Props) {
  const [value, setValue] = useState<Provenance>();
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true; setError(''); setValue(undefined);
    api.provenance(note).then(result => { if (alive) setValue(result); }).catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [api, note]);
  const space = (id: string) => `/spaces/${encodeURIComponent(id)}`;
  return <section className="note-provenance" aria-label="출처·규칙·검토·업무 연결">
    <h3>출처·규칙·검토·업무 연결</h3>
    {error && <p role="alert">{error}</p>}
    {!value && !error && <p role="status">읽는 중…</p>}
    {value && <>
      <h4>원본</h4>
      {value.sources.length ? <ul>{value.sources.map(item => <li key={item.revisionId}><a href={webUrl(`${space(item.spaceId)}/source-revisions/${encodeURIComponent(item.revisionId)}`)} target="_blank" rel="noreferrer">{item.title}</a></li>)}</ul> : <p>반영된 원본이 없습니다.</p>}
      <h4>적용 규칙</h4>
      {value.rules.length ? <ul>{value.rules.map(item => <li key={item.versionId}><a href={webUrl(`${space(item.spaceId)}/rules?stage=history&ruleset=${encodeURIComponent(item.rulesetId)}&version=${encodeURIComponent(item.versionId)}`)} target="_blank" rel="noreferrer">{item.label}</a></li>)}</ul> : <p>적용된 규칙 기록이 없습니다.</p>}
      <h4>검토</h4>
      {value.reviews.length ? <ul>{value.reviews.map(item => <li key={`${item.kind}:${item.id}`}><a href={webUrl(`${space(item.spaceId)}/reviews?${item.kind === 'proposal' ? 'proposal' : 'changeSet'}=${encodeURIComponent(item.id)}`)} target="_blank" rel="noreferrer">{item.title}</a>{item.status && ` · ${REVIEW_STATES[item.status]}`}</li>)}</ul> : <p>검토 기록이 없습니다.</p>}
      <h4>관련 업무</h4>
      {value.actions.length ? <ul>{value.actions.map(item => <li key={item.id}><a href={webUrl(`${space(item.spaceId)}/actions/${encodeURIComponent(item.id)}`)} target="_blank" rel="noreferrer">{item.title}</a></li>)}</ul> : <p>연결된 업무가 없습니다.</p>}
      <a href={webUrl(`${space(note.spaceId)}/actions/new?note=${encodeURIComponent(note.id)}`)} target="_blank" rel="noreferrer">이 노트로 업무 만들기</a>
    </>}
  </section>;
}
