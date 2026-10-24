import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Button, Group, Select, TextInput } from '@mantine/core';
import type { CreateNote, NoteApi, NoteSummary, Page, Space, TreeNote, Visibility } from './model';
import { NotePicker } from './NotePicker';
import { TreeCache } from './treeCache';
import { DocTree } from './vendor/docmost/client/features/page/tree/components/doc-tree';
import { SpaceTreeRow } from './vendor/docmost/client/features/page/tree/components/space-tree-row';
import { onAccessLost, onAccessRefresh } from './transport';

interface Props { api: NoteApi; spaceId: string; activeNoteId: string | null; onOpen: (id: string) => void }
export function NoteTree({ api, spaceId, activeNoteId, onOpen }: Props) {
  const [parentId, setParentId] = useState<string | null>(null);
  const [ancestors, setAncestors] = useState<{ id: string | null; title: string }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [previous, setPrevious] = useState<(string | null)[]>([]);
  const [page, setPage] = useState<Page<TreeNote>>({ items: [], nextCursor: null });
  const [selected, setSelected] = useState<string[]>([]);
  const [destination, setDestination] = useState<NoteSummary | null>(null);
  const [moveSpace, setMoveSpace] = useState(spaceId);
  const [moved, setMoved] = useState<{ id: string; spaceId: string } | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const writableSpaces = spaces.filter(value => value.myRole === 'OWNER' || value.myRole === 'EDITOR');
  const canWrite = writableSpaces.some(value => value.id === spaceId);
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('SPACE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [located, setLocated] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locateAttempt, setLocateAttempt] = useState(0);
  const [dragging, setDragging] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const cache = useRef(new TreeCache());
  const epoch = useRef(0);
  const pendingCreate = useRef<CreateNote | undefined>(undefined);
  useEffect(() => {
    const changed = () => { cache.current.clear(); setLocated(null); setLocateAttempt(value => value + 1); setReload(value => value + 1); };
    window.addEventListener('note-changed', changed); return () => window.removeEventListener('note-changed', changed);
  }, []);
  useEffect(() => onAccessLost(() => { epoch.current++; cache.current.clear(); setPage({ items: [], nextCursor: null }); setSelected([]); setAncestors([]); setLocated(null); setLocating(false); setMoved(null); }), []);
  useEffect(() => onAccessRefresh(async () => {
    const start = ++epoch.current;
    setMoved(null);
    cache.current.clear(); setPage({ items: [], nextCursor: null }); setSelected([]); setAncestors([]); setDestination(null); setDragging([]); setDropTarget(null);
    setLocated(null); setLocateAttempt(value => value + 1); setReload(value => value + 1);
    const current = await api.spaces();
    if (start === epoch.current) setSpaces(current);
  }), [api]);
  useEffect(() => { setParentId(null); setAncestors([]); setCursor(null); setPrevious([]); setSelected([]); setMoveSpace(spaceId); setDestination(null); setMoved(null); cache.current.clear(); }, [spaceId]);
  useEffect(() => { let alive = true; api.spaces().then(value => { if (alive) setSpaces(value); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [api]);
  useEffect(() => {
    let alive = true; const start = epoch.current;
    setLocationError('');
    if (!activeNoteId) { setLocated(null); setLocating(false); return; }
    setLocated(null); setLocating(true); setPage({ items: [], nextCursor: null }); setAncestors([]); setSelected([]);
    api.ancestors(activeNoteId).then(path => {
      if (!alive || start !== epoch.current) return;
      setAncestors(path.map((value, index) => ({ id: index === 0 ? null : path[index - 1].id, title: value.title })));
      setParentId(path.at(-1)?.id ?? null); setCursor(null); setPrevious([]); setLocated(activeNoteId);
    }).catch(e => { if (alive) setLocationError(e.message); }).finally(() => { if (alive) setLocating(false); });
    return () => { alive = false; };
  }, [api, spaceId, activeNoteId, locateAttempt]);
  useEffect(() => {
    if (activeNoteId && (located !== activeNoteId || locating)) { setBusy(false); return; }
    let alive = true; const start = epoch.current; const key = `${spaceId}/${parentId}/${cursor}`;
    setSelected([]); setError(''); const stored = cache.current.get(key);
    if (stored) { setPage(stored); setBusy(false); return; }
    setBusy(true); setPage({ items: [], nextCursor: null });
    api.tree(spaceId, parentId, cursor).then(value => { if (alive && start === epoch.current) { cache.current.set(key, value); setPage(value); } }).catch(e => { if (alive && start === epoch.current) setError(e.message); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [api, spaceId, parentId, cursor, reload, activeNoteId, located, locating]);
  function descend(value: TreeNote) {
    if (ancestors.length >= 32) { setError('한 번에 표시할 수 있는 경로 깊이는 32단계입니다. 노트를 직접 열어 주세요.'); return; }
    setAncestors(values => [...values, { id: parentId, title: value.title }]); setParentId(value.id); setCursor(null); setPrevious([]);
  }
  function dropMove(parent: string | null) {
    const ids = dragging; setDragging([]); setDropTarget(null);
    if (!canWrite || !ids.length || (parent !== null && ids.includes(parent))) return;
    void perform(() => move(ids, parent, spaceId));
  }
  async function move(ids: string[], parent: string | null, targetSpace: string) {
    if (!canWrite || !writableSpaces.some(value => value.id === targetSpace)) return;
    const start = epoch.current; setMoved(null);
    await api.move(ids, parent, targetSpace);
    if (start !== epoch.current) return;
    setSelected([]); setDestination(null); setMoved({ id: ids[0], spaceId: targetSpace });
  }
  function dropZone(key: string, parent: string | null) {
    return {
      onDragOver: (event: DragEvent) => { if (dragging.length && !(parent !== null && dragging.includes(parent))) { event.preventDefault(); setDropTarget(key); } },
      onDragLeave: () => setDropTarget(value => value === key ? null : value),
      onDrop: (event: DragEvent) => { event.preventDefault(); dropMove(parent); },
    };
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); cache.current.clear(); setReload(value => value + 1); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function create() {
    if (!canWrite || busy || locating || !title.trim() || parentId !== null) return;
    const previous = pendingCreate.current;
    const input = previous && previous.spaceId === spaceId && previous.title === title.trim() && previous.parentId === parentId && previous.visibility === visibility
      ? previous : { spaceId, title: title.trim(), parentId, visibility, idempotencyKey: crypto.randomUUID() };
    pendingCreate.current = input;
    await perform(async () => {
      const note = await api.create(input);
      pendingCreate.current = undefined; setTitle(''); onOpen(note.id);
    });
  }
  return <nav className="note-tree" aria-label="노트 트리">
    <Group justify="space-between"><h2>지식 노트</h2><Button size="xs" variant="subtle" disabled={busy} onClick={() => { cache.current.clear(); setReload(value => value + 1); }}>새로고침</Button></Group>
    <Group gap="xs"><Button size="xs" variant="subtle" disabled={locating} data-drop-target={dropTarget === 'root' || undefined} {...dropZone('root', null)} onClick={() => { setParentId(null); setAncestors([]); setCursor(null); setPrevious([]); }}>루트</Button>
      {ancestors.length > 0 && <Button size="xs" variant="subtle" disabled={locating} data-drop-target={dropTarget === 'parent' || undefined} {...dropZone('parent', ancestors.at(-1)!.id)} onClick={() => { setParentId(ancestors.at(-1)!.id); setAncestors(values => values.slice(0, -1)); setCursor(null); setPrevious([]); }}>상위</Button>}
      {activeNoteId && <Button size="xs" variant="subtle" disabled={locating} onClick={() => setLocateAttempt(value => value + 1)}>현재 노트 위치</Button>}
    </Group>
    {ancestors.length > 0 && <p className="breadcrumb">{ancestors.map(value => value.title).join(' / ')}</p>}
    {error && <p role="alert">{error}</p>}{locationError && <p role="alert">{locationError}</p>}{locating && <p role="status">노트 위치 읽는 중…</p>}{busy && <p role="status">읽는 중…</p>}
    <DocTree data={page.items} openIds={new Set()} selectedId={activeNoteId || undefined} aria-label="현재 경로의 노트"
      readOnly={busy || !canWrite} rowHeight={36} getDragLabel={node => node.title}
      onSelect={onOpen} onDragStateChange={id => setDragging(id ? selected.includes(id) ? selected : [id] : [])}
      onMove={async (id, op) => {
        const ids = selected.includes(id) ? selected : [id];
        if (!canWrite || op.kind !== 'make-child' || ids.includes(op.targetId)) return;
        setBusy(true); setError('');
        try { await move(ids, op.targetId, spaceId); cache.current.clear(); setReload(value => value + 1); }
        catch (failure) { setError((failure as Error).message); throw failure; }
        finally { setBusy(false); }
      }} onToggle={id => { const node = page.items.find(value => value.id === id); if (node) descend(node); }}
      renderRow={props => <SpaceTreeRow {...props} checked={selected.includes(props.node.id)} onCheck={canWrite ? () => setSelected(values => values.includes(props.node.id) ? values.filter(id => id !== props.node.id) : [...values, props.node.id]) : undefined} onOpen={onOpen}/>}
    />
    {!page.items.length && !busy && !locating && !locationError && <p>이 경로에 노트가 없습니다.</p>}
    <Group justify="space-between"><Button size="xs" disabled={!previous.length || busy || locating} onClick={() => { setCursor(previous.at(-1) || null); setPrevious(values => values.slice(0, -1)); }}>이전</Button><Button size="xs" disabled={!page.nextCursor || busy || locating} onClick={() => { setPrevious(values => [...values.slice(-30), cursor]); setCursor(page.nextCursor); }}>다음</Button></Group>
    {canWrite && <><form onSubmit={event => { event.preventDefault(); void create(); }}><Select label="공유 범위" value={visibility} disabled={busy || locating} data={[{value:"SPACE",label:"공간 공유"},{value:"PRIVATE",label:"나만 보기"}]} onChange={value => setVisibility(value === "PRIVATE" ? "PRIVATE" : "SPACE")}/><TextInput label="새 노트 제목" value={title} disabled={busy || locating} required maxLength={300} onChange={event => setTitle(event.currentTarget.value)}/>{parentId && <p>새 노트는 루트에 만든 뒤 이동할 수 있습니다.</p>}<Button type="submit" size="xs" disabled={busy || locating || !title.trim() || parentId !== null}>현재 경로에 만들기</Button></form>
    <details><summary>선택한 노트 이동 · {selected.length}</summary><form onSubmit={event => { event.preventDefault(); if (destination && selected.includes(destination.id)) { setError('선택한 노트를 자기 하위로 이동할 수 없습니다.'); return; } void perform(() => move(selected, destination?.id ?? null, moveSpace)); }}>
      <Select label="대상 공간" data={writableSpaces.map(value => ({ value: value.id, label: value.name }))} value={moveSpace} disabled={busy} onChange={value => { if (value) { setMoveSpace(value); setDestination(null); } }}/>
      <NotePicker api={api} spaceId={moveSpace} label="대상 상위 노트 (선택하지 않으면 루트)" selected={destination} onSelect={setDestination} exclude={selected} disabled={busy}/>
      <p>노트를 끌어 다른 노트 위에 놓으면 그 아래로, 루트·상위 버튼에 놓으면 그 위치로 이동합니다. 선택한 노트를 끌면 선택한 노트 전체가 이동합니다.</p>
      <p>선택한 노트와 모든 하위 노트를 함께 이동합니다. 같은 조직의 다른 공간을 선택할 수 있으며, 공유 범위와 개인 소유자는 유지됩니다. 첨부 이력이나 트리 밖의 연결이 있으면 전체 이동이 거절됩니다.</p><Button type="submit" disabled={!selected.length || busy}>선택 노트 이동</Button>
    </form></details></>}
    {moved && <p role="status">노트를 이동했습니다. <a href={`/?${new URLSearchParams({ space: moved.spaceId, note: moved.id })}`} target="_blank" rel="noreferrer">이동한 공간에서 열기</a></p>}
  </nav>;
}
