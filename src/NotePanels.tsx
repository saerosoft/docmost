import { useEffect, useRef, useState } from 'react';
import { Tabs } from '@mantine/core';
import './docmost/i18n';
import CommentListWithTabs from './vendor/docmost/client/features/comment/components/comment-list-with-tabs';
import { DocmostHistory } from './docmost/DocmostHistory';
import { NoteProperties } from './NoteProperties';
import { NoteProvenance } from './NoteProvenance';
import { NoteRelations } from './NoteRelations';
import type { AddComment, Comment, Note, NoteApi, Page, Revision } from './model';

interface Props { api: NoteApi; note: Note; dirty: boolean; onRestore: (note: Note) => void; onOpen: (id: string) => void; onRevision: (note: Note) => void }
export function NotePanels({ api, note, dirty, onRestore, onOpen, onRevision }: Props) {
  const [panel, setPanel] = useState<string | null>('comments');
  const [comments, setComments] = useState<Page<Comment>>({ items: [], nextCursor: null });
  const [history, setHistory] = useState<Page<Revision>>({ items: [], nextCursor: null });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingComment = useRef<{ noteId: string; input: AddComment } | undefined>(undefined);
  useEffect(() => {
    let alive = true; setError(''); setBusy(true);
    const load = panel === 'comments' ? api.comments(note.id, null).then(value => { if (alive) setComments(value); })
      : panel === 'history' ? api.history(note.id, null).then(value => { if (alive) setHistory(value); })
      : Promise.resolve();
    load.catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [api, note.id, note.revision, panel]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function comment(message: string) {
    if (busy || !message.trim()) return false;
    const previous = pendingComment.current;
    const request = previous && previous.noteId === note.id && previous.input.body === message
      ? previous : { noteId: note.id, input: { body: message, idempotencyKey: crypto.randomUUID() } };
    pendingComment.current = request;
    setBusy(true); setError('');
    let committed = false;
    try {
      await api.comment(request.noteId, request.input);
      committed = true; pendingComment.current = undefined;
      setComments(await api.comments(request.noteId, null)); onRevision(await api.note(request.noteId));
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
    return committed;
  }
  return <aside className="note-panels" aria-label="노트 상세">
    <Tabs value={panel} onChange={setPanel}><Tabs.List>
      <Tabs.Tab value="comments">댓글</Tabs.Tab><Tabs.Tab value="history">이력</Tabs.Tab><Tabs.Tab value="properties">속성</Tabs.Tab><Tabs.Tab value="relations">관계</Tabs.Tab>
    </Tabs.List></Tabs>
    {error && <p role="alert">{error}</p>}{busy && <p role="status">처리 중…</p>}
    {panel === 'comments' && <CommentListWithTabs comments={comments} canComment={note.canEdit} isLoading={busy} onSave={comment}
      onLoadMore={() => void perform(async () => { const page = await api.comments(note.id, comments.nextCursor); setComments({ items: [...comments.items, ...page.items].slice(-100), nextCursor: page.nextCursor }); })}/>}
    {panel === 'history' && <>
      {dirty && <p>현재 변경을 먼저 저장한 뒤 복원해 주세요.</p>}
      <DocmostHistory api={api} noteId={note.id} history={history} busy={busy} canRestore={note.canEdit && !dirty && !busy}
        onRestore={revision => { if (window.confirm(`개정 ${revision.revision}을 새 개정으로 복원할까요?`)) void perform(async () => onRestore(await api.restore(note.id, revision.revision, note.revision))); }}
        onLoadMore={() => void perform(async () => { const page = await api.history(note.id, history.nextCursor); setHistory({ items: [...history.items, ...page.items].slice(-100), nextCursor: page.nextCursor }); })}/>
    </>}
    {panel === 'properties' && <NoteProperties api={api} note={note} dirty={dirty} onRevision={onRevision}/>}
    {panel === 'relations' && <><NoteRelations api={api} note={note} onOpen={onOpen} onRevision={onRevision}/><NoteProvenance api={api} note={note}/></>}
  </aside>;
}
