import { useEffect, useRef, useState } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Button, Group, Select, TextInput } from '@mantine/core';
import type { CreateNote, NoteApi, NoteSummary, Page, Space, TreeNote, Visibility } from './model';
import { NotePicker } from './NotePicker';
import { TreeCache } from './treeCache';
import { DocTree } from './vendor/docmost/client/features/page/tree/components/doc-tree';
import { SpaceTreeRow } from './vendor/docmost/client/features/page/tree/components/space-tree-row';
import { ApiError, onAccessLost, onAccessRefresh } from './transport';

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
  const [dragContextId] = useState(() => Symbol('knowledge-note-tree'));
  const cache = useRef(new TreeCache());
  const epoch = useRef(0);
  const pendingCreate = useRef<CreateNote | undefined>(undefined);
  useEffect(() => {
    const changed = () => { cache.current.clear(); setLocated(null); setLocateAttempt(value => value + 1); setReload(value => value + 1); };
    window.addEventListener('note-changed', changed); return () => window.removeEventListener('note-changed', changed);
  }, []);
  useEffect(() => onAccessLost(() => { epoch.current++; cache.current.clear(); setPage({ items: [], nextCursor: null }); setSelected([]); setAncestors([]); setLocated(null); setLocating(false); setMoved(null); setDestination(null); setError(''); setBusy(false); setSpaces([]); }), []);
  useEffect(() => onAccessRefresh(async () => {
    const start = ++epoch.current;
    setMoved(null); setBusy(false); setError(''); setLocationError('');
    cache.current.clear(); setPage({ items: [], nextCursor: null }); setSelected([]); setAncestors([]); setDestination(null);
    setLocated(null); setLocateAttempt(value => value + 1); setReload(value => value + 1);
    const current = await api.spaces();
    if (start === epoch.current) setSpaces(current);
  }), [api]);
  useEffect(() => { setParentId(null); setAncestors([]); setCursor(null); setPrevious([]); setSelected([]); setMoveSpace(spaceId); setDestination(null); setMoved(null); cache.current.clear(); }, [spaceId]);
  useEffect(() => { let alive = true; const start = epoch.current; api.spaces().then(value => { if (alive && start === epoch.current) setSpaces(value); }).catch(e => { if (alive && start === epoch.current) setError(e.message); }); return () => { alive = false; }; }, [api]);
  useEffect(() => {
    let alive = true; const start = epoch.current;
    setLocationError('');
    if (!activeNoteId) { setLocated(null); setLocating(false); return; }
    setLocated(null); setLocating(true); setPage({ items: [], nextCursor: null }); setAncestors([]); setSelected([]);
    api.ancestors(activeNoteId).then(path => {
      if (!alive || start !== epoch.current) return;
      setAncestors(path.map((value, index) => ({ id: index === 0 ? null : path[index - 1].id, title: value.title })));
      setParentId(path.at(-1)?.id ?? null); setCursor(null); setPrevious([]); setLocated(activeNoteId);
    }).catch(e => { if (alive && start === epoch.current) setLocationError(e.message); }).finally(() => { if (alive && start === epoch.current) setLocating(false); });
    return () => { alive = false; };
  }, [api, spaceId, activeNoteId, locateAttempt]);
  useEffect(() => {
    if (activeNoteId && (located !== activeNoteId || locating)) { setBusy(false); return; }
    let alive = true; const start = epoch.current; const key = `${spaceId}/${parentId}/${cursor}`;
    setSelected([]); setError(''); const stored = cache.current.get(key);
    if (stored) { setPage(stored); setBusy(false); return; }
    setBusy(true); setPage({ items: [], nextCursor: null });
    api.tree(spaceId, parentId, cursor).then(value => { if (alive && start === epoch.current) { cache.current.set(key, value); setPage(value); } }).catch(e => { if (alive && start === epoch.current) setError(e.message); }).finally(() => { if (alive && start === epoch.current) setBusy(false); });
    return () => { alive = false; };
  }, [api, spaceId, parentId, cursor, reload, activeNoteId, located, locating]);
  function descend(value: TreeNote) {
    if (ancestors.length >= 32) { setError('한 번에 표시할 수 있는 경로 깊이는 32단계입니다. 노트를 직접 열어 주세요.'); return; }
    setAncestors(values => [...values, { id: parentId, title: value.title }]); setParentId(value.id); setCursor(null); setPrevious([]);
  }
  async function move(ids: string[], parent: string | null, targetSpace: string) {
    if (!canWrite || !writableSpaces.some(value => value.id === targetSpace)) return;
    const start = epoch.current; setMoved(null);
    try { await api.move(ids, parent, targetSpace); } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'INVALID_INPUT' && failure.field === 'parentId') {
        throw new ApiError('이동 대상 상위 노트를 확인해 주세요. 공간·경로·공개 범위·개인 노트 소유자 조건에 맞는 다른 상위 노트 또는 루트를 선택해 주세요. ' + failure.message, failure.code, failure.field);
      }
      throw failure;
    }
    if (start !== epoch.current) return;
    setSelected([]); setDestination(null); setMoved({ id: ids[0], spaceId: targetSpace });
  }
  async function perform(action: () => Promise<void>) {
    const start = epoch.current; setBusy(true); setError('');
    try { await action(); if (start !== epoch.current) return; cache.current.clear(); setReload(value => value + 1); }
    catch (e) { if (start === epoch.current) setError((e as Error).message); }
    finally { if (start === epoch.current) setBusy(false); }
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
    <Group gap="xs"><TreeLocationDropButton label="루트" contextId={dragContextId} parentId={null} selected={selected} canMove={canWrite && !busy && !locating} disabled={locating} onMove={(ids, parent) => { void perform(() => move(ids, parent, spaceId)); }} onClick={() => { setParentId(null); setAncestors([]); setCursor(null); setPrevious([]); }}/>
      {ancestors.length > 0 && <TreeLocationDropButton label="상위" contextId={dragContextId} parentId={ancestors.at(-1)!.id} selected={selected} canMove={canWrite && !busy && !locating} disabled={locating} onMove={(ids, parent) => { void perform(() => move(ids, parent, spaceId)); }} onClick={() => { setParentId(ancestors.at(-1)!.id); setAncestors(values => values.slice(0, -1)); setCursor(null); setPrevious([]); }}/>}
      {activeNoteId && <Button size="xs" variant="subtle" disabled={locating} onClick={() => setLocateAttempt(value => value + 1)}>현재 노트 위치</Button>}
    </Group>
    {ancestors.length > 0 && <p className="breadcrumb">{ancestors.map(value => value.title).join(' / ')}</p>}
    {error && <p role="alert">{error}</p>}{locationError && <p role="alert">{locationError}</p>}{locating && <p role="status">노트 위치 읽는 중…</p>}{busy && <p role="status">읽는 중…</p>}
    <DocTree uniqueContextId={dragContextId} data={page.items} openIds={new Set()} selectedId={activeNoteId || undefined} aria-label="현재 경로의 노트"
      readOnly={busy || !canWrite} rowHeight={36} getDragLabel={node => node.title}
      onSelect={onOpen}
      onMove={async (id, op) => {
        const ids = selected.includes(id) ? selected : [id];
        if (!canWrite || op.kind !== 'make-child' || ids.includes(op.targetId)) return;
        const start = epoch.current; setBusy(true); setError('');
        try { await move(ids, op.targetId, spaceId); if (start !== epoch.current) return; cache.current.clear(); setReload(value => value + 1); }
        catch (failure) { if (start === epoch.current) setError((failure as Error).message); throw failure; }
        finally { if (start === epoch.current) setBusy(false); }
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

interface LocationDropProps {
  label: string;
  contextId: symbol;
  parentId: string | null;
  selected: string[];
  canMove: boolean;
  disabled: boolean;
  onClick: () => void;
  onMove: (ids: string[], parentId: string | null) => void;
}

/** Root and parent buttons share the tree's native drag payload, independent of source drag-end state. */
function TreeLocationDropButton({ label, contextId, parentId, selected, canMove, disabled, onClick, onMove }: LocationDropProps) {
  const element = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(false);
    if (!element.current) return;
    const moveIds = (data: Record<string, unknown>): string[] | null => {
      if (!canMove || data.type !== 'doc-tree-item' || data.uniqueContextId !== contextId || typeof data.id !== 'string' || !data.id) return null;
      const ids = selected.includes(data.id) ? selected : [data.id];
      return parentId !== null && ids.includes(parentId) ? null : ids;
    };
    return dropTargetForElements({
      element: element.current,
      canDrop: ({ source }) => moveIds(source.data) !== null,
      getDropEffect: () => 'move',
      onDragEnter: ({ source }) => setActive(moveIds(source.data) !== null),
      onDragLeave: () => setActive(false),
      onDrop: ({ source }) => {
        setActive(false);
        const ids = moveIds(source.data);
        if (ids) onMove(ids, parentId);
      },
    });
  }, [canMove, contextId, onMove, parentId, selected]);
  return <Button ref={element} size="xs" variant="subtle" disabled={disabled} data-drop-target={active || undefined} onClick={onClick}>{label}</Button>;
}
