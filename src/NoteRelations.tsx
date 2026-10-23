import { useEffect, useState } from 'react';
import { Button, Group, Select, TextInput } from '@mantine/core';
import type { Note, NoteApi, NoteSummary, Page, Relation, RelationEvidence, RelationKind, RelationPredicate, RelationReviewState } from './model';
import { NotePicker } from './NotePicker';
import { onAccessLost } from './transport';
import { webUrl } from './webOrigin';

const PREDICATES: { value: RelationPredicate; label: string }[] = [
  { value: 'RELATED_TO', label: '관련' },
  { value: 'SUPPORTS', label: '뒷받침' },
  { value: 'DERIVED_FROM', label: '출처' },
  { value: 'SUPERSEDES', label: '대체' },
];
const KINDS: Record<RelationKind, string> = { RECORDED: '기록', INFERRED: '추론', UNCERTAIN: '불확실' };
const STATES: Record<RelationReviewState, string> = { PROPOSED: '검토 대기', ACCEPTED: '확정', REJECTED: '거절' };

interface Props { api: NoteApi; note: Note; onOpen: (id: string) => void; onRevision: (note: Note) => void }

/** Typed relation assertions of a note: a person records accepted relations here and decides relations extracted from evidence. */
export function NoteRelations({ api, note, onOpen, onRevision }: Props) {
  const [relations, setRelations] = useState<Page<Relation>>({ items: [], nextCursor: null });
  const [target, setTarget] = useState<NoteSummary | null>(null);
  const [predicate, setPredicate] = useState<RelationPredicate>('RELATED_TO');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true; setError(''); setBusy(true); setRelations({ items: [], nextCursor: null });
    api.relations(note.id, null).then(value => { if (alive) setRelations(value); })
      .catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [api, note.id, note.revision]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function decide(relation: Relation, decision: 'ACCEPTED' | 'REJECTED') {
    const reason = window.prompt(decision === 'ACCEPTED' ? '확정 이유를 입력해 주세요.' : '거절 이유를 입력해 주세요.')?.trim();
    if (!reason) return;
    void perform(async () => { await api.decideRelation(relation.id, relation.revision, decision, reason); setRelations(await api.relations(note.id, null)); });
  }
  return <>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">처리 중…</p>}
    {relations.items.map(value => <article key={`${note.id}:${note.revision}:${value.id}`}>
      <Button variant="subtle" onClick={() => onOpen(value.targetNoteId)}>{value.title}</Button>
      <p>
        {PREDICATES.find(item => item.value === value.predicate)?.label} · {KINDS[value.kind]} · {STATES[value.reviewState]}
        {value.legacyPredicate && ` · 이전 표기 ${value.legacyPredicate}`}
        {value.validFrom && ` · ${new Date(value.validFrom).toLocaleDateString('ko-KR')}부터`}
        {value.validTo && ` · ${new Date(value.validTo).toLocaleDateString('ko-KR')}까지`}
        {value.evidenceCount > 0 && ` · 근거 ${value.evidenceCount}건`}
      </p>
      <p>{value.direction === 'OUTGOING' ? '이 노트 → 연결된 노트' : '연결된 노트 → 이 노트'}</p>
      {value.actorLabel && <p>기록자: {value.actorLabel}</p>}
      <p style={{ whiteSpace: 'pre-wrap' }}>{value.provenance}</p>
      {value.evidenceCount > 0 && <SupportingEvidence api={api} relationId={value.id}/>}
      {note.canEdit && value.reviewState === 'PROPOSED' && <Group>
        <Button size="xs" disabled={busy} onClick={() => decide(value, 'ACCEPTED')}>관계 확정</Button>
        <Button size="xs" variant="outline" disabled={busy} onClick={() => decide(value, 'REJECTED')}>관계 거절</Button>
      </Group>}
    </article>)}
    {!relations.items.length && !busy && <p>아직 관계가 없습니다.</p>}
    {relations.nextCursor && <Button disabled={busy} onClick={() => void perform(async () => { const page = await api.relations(note.id, relations.nextCursor); setRelations({ items: [...relations.items, ...page.items].slice(-100), nextCursor: page.nextCursor }); })}>관계 더 보기</Button>}
    {note.canEdit && <form onSubmit={event => {
      event.preventDefault();
      if (!target) return;
      void perform(async () => {
        await api.relate(note.id, target.id, predicate, { validFrom: validFrom ? new Date(validFrom).toISOString() : null, validTo: validTo ? new Date(validTo).toISOString() : null });
        setTarget(null); setValidFrom(''); setValidTo('');
        setRelations(await api.relations(note.id, null)); onRevision(await api.note(note.id));
      });
    }}>
      <NotePicker api={api} spaceId={note.spaceId} label="연결할 노트" selected={target} onSelect={setTarget} exclude={[note.id]} disabled={busy}/>
      <Select label="관계" data={PREDICATES} value={predicate} onChange={value => value && setPredicate(value as RelationPredicate)} allowDeselect={false}/>
      <TextInput type="date" label="효력 시작" value={validFrom} onChange={event => setValidFrom(event.currentTarget.value)}/>
      <TextInput type="date" label="효력 종료" value={validTo} min={validFrom || undefined} onChange={event => setValidTo(event.currentTarget.value)}/>
      <Button type="submit" disabled={busy || !target}>관계 추가</Button>
    </form>}
  </>;
}

function SupportingEvidence({ api, relationId }: { api: NoteApi; relationId: string }) {
  const [open, setOpen] = useState(false);
  return <section>
    <Button size="xs" variant="subtle" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? '관계 근거 접기' : '관계 근거 보기'}</Button>
    {open && <SupportingEvidencePage api={api} relationId={relationId}/>}
  </section>;
}

function SupportingEvidencePage({ api, relationId }: { api: NoteApi; relationId: string }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const [page, setPage] = useState<Page<RelationEvidence>>();
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const cursor = cursors.at(-1) ?? null;
  useEffect(() => {
    let alive = true; setPage(undefined); setError('');
    const off = onAccessLost(() => { alive = false; setPage(undefined); setError('접근 권한이 변경되었습니다. 노트를 다시 열어 주세요.'); });
    api.relationEvidence(relationId, cursor).then(value => { if (alive) setPage(value); })
      .catch(value => { if (alive) setError((value as Error).message); });
    return () => { alive = false; off(); };
  }, [api, relationId, cursor, refresh]);
  if (error) return <p role="alert">{error}</p>;
  if (!page) return <p role="status">근거를 읽는 중…</p>;
  return <section aria-label="관계 근거">
    {!page.items.length && <p>현재 볼 수 있는 근거가 없습니다.</p>}
    {page.items.map(value => <article key={value.id}>
      <a href={webUrl(`/spaces/${encodeURIComponent(value.spaceId)}/source-revisions/${encodeURIComponent(value.sourceRevisionId)}`)} target="_blank" rel="noreferrer">{value.sourceTitle}</a>
      <p>원본 버전 {value.sourceRevision} · {value.locator}</p>
      <blockquote style={{ whiteSpace: 'pre-wrap' }}>{value.excerpt}</blockquote>
      {value.excerptTruncated && <p>일부 내용입니다. 전체 문맥은 원본에서 확인하세요.</p>}
    </article>)}
    <Group aria-label="근거 페이지">
      <Button size="xs" disabled={!cursors.length} onClick={() => setCursors(value => value.slice(0, -1))}>이전 근거</Button>
      <Button size="xs" disabled={!page.nextCursor} onClick={() => page.nextCursor && setCursors(value => [...value, page.nextCursor!])}>다음 근거</Button>
      <Button size="xs" onClick={() => setRefresh(value => value + 1)}>근거 새로고침</Button>
    </Group>
  </section>;
}
