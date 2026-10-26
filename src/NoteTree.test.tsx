// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteApi, TreeNote } from './model';
import { NoteTree } from './NoteTree';
import { dragData } from './test/dragData';
import { ApiError, clearAccess, refreshAccess } from './transport';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';


vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', async importOriginal => {
  const actual = await importOriginal<typeof import('@atlaskit/pragmatic-drag-and-drop/element/adapter')>();
  return { ...actual, draggable: vi.fn(actual.draggable), dropTargetForElements: vi.fn(actual.dropTargetForElements) };
});

beforeEach(() => {
  vi.mocked(draggable).mockClear();
  vi.mocked(dropTargetForElements).mockClear();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const notes: TreeNote[] = ['Alpha', 'Beta', 'Gamma'].map((title, index) => ({ id: `note-${index}`, title, parentId: null, hasChildren: true, revision: 1 }));

function show(myRole = 'OWNER') {
  const move = vi.fn().mockResolvedValue(undefined);
  const api = {
    spaces: vi.fn().mockResolvedValue([{ id: 'space', name: 'Space', accessEpoch: 1, myRole }]),
    tree: vi.fn().mockResolvedValue({ items: notes, nextCursor: null }),
    findNotes: vi.fn().mockResolvedValue([{ id: 'note-0', title: 'Alpha' }, { id: 'note-1', title: 'Beta' }]),
    move,
  } as unknown as NoteApi;
  render(<MantineProvider><NoteTree api={api} spaceId="space" activeNoteId={null} onOpen={vi.fn()}/></MantineProvider>);
  return { move, tree: api.tree, spaces: api.spaces };
}

function row(title: string) {
  return screen.getByRole('treeitem', { name: title });
}

function drag(source: HTMLElement, target: HTMLElement) {
  const dataTransfer = dragData();
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer, clientX: 160, clientY: 18 });
  fireEvent.drop(target, { dataTransfer, clientX: 160, clientY: 18 });
}

it('moves a dragged note under the note it is dropped on', async () => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  drag(row('Alpha'), row('Beta'));
  await waitFor(() => expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-0'], 'note-1', 'space'));
  const destination = await screen.findByRole('link', { name: '이동한 공간에서 열기' });
  expect(destination.getAttribute('href')).toBe(`${import.meta.env.BASE_URL}?space=space&note=note-0`);
  expect(destination.getAttribute('target')).toBe('_blank');
});

it('moves the whole selection when a selected note is dragged to the root', async () => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Gamma 선택' }));
  drag(row('Gamma'), screen.getByRole('button', { name: '루트' }));
  await waitFor(() => expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-0', 'note-2'], null, 'space'));
});

it('does not move a selection into one of its own notes', async () => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Beta 선택' }));
  drag(row('Alpha'), row('Beta'));
  expect(value.move).not.toHaveBeenCalled();
});

it('moves the selection under a destination picked by title', async () => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.change(screen.getByRole('textbox', { name: '대상 상위 노트 (선택하지 않으면 루트)' }), { target: { value: 'Be' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Beta' }));
  expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));
  await waitFor(() => expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-0'], 'note-1', 'space'));
});

it('uses core tree roving focus and typeahead without fetching another subtree', async () => {
  show();
  const first = await screen.findByRole('treeitem', { name: 'Alpha' });
  expect(screen.getAllByRole('treeitem').filter(value => value.tabIndex === 0)).toHaveLength(1);
  first.focus();
  fireEvent.keyDown(first, { key: 'g' });
  expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'Gamma' }));
});

it('does not bulk-fetch sibling branches and opens only the requested child page', async () => {
  const value = show();
  const first = await screen.findByRole('treeitem', { name: 'Alpha' });
  first.focus(); fireEvent.keyDown(first, { key: '*' });
  expect(value.tree).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Alpha / Beta / Gamma')).toBeNull();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  await waitFor(() => expect(value.tree).toHaveBeenLastCalledWith('space', 'note-0', null));
  expect(value.tree).toHaveBeenCalledTimes(2);
});

it('keeps viewer navigation available without offering note creation or movement', async () => {
  const value = show('VIEWER');
  await screen.findByRole('treeitem', { name: 'Alpha' });
  expect(screen.queryByRole('textbox', { name: '새 노트 제목' })).toBeNull();
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alpha 선택' }).disabled).toBe(true);
  drag(row('Alpha'), row('Beta'));
  expect(value.move).not.toHaveBeenCalled();
  fireEvent.keyDown(row('Alpha'), { key: 'ArrowRight' });
  await waitFor(() => expect(value.tree).toHaveBeenLastCalledWith('space', 'note-0', null));
});

it('explains a rejected move parent while retaining the selection and requiring an explicit retry', async () => {
  const value = show();
  value.move.mockRejectedValueOnce(new ApiError('입력한 값을 확인해 주세요.', 'INVALID_INPUT', 'parentId'));
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.change(screen.getByRole('textbox', { name: '대상 상위 노트 (선택하지 않으면 루트)' }), { target: { value: 'Be' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Beta' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));

  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('이동 대상 상위 노트를 확인해 주세요.');
  expect(alert.textContent).toContain('공개 범위');
  expect(alert.textContent).toContain('다른 상위 노트 또는 루트');
  expect(alert.textContent).toContain('입력한 값을 확인해 주세요.');
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alpha 선택' }).checked).toBe(true);
  expect(screen.getByText('Beta', { selector: 'strong' })).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '선택 노트 이동' }).disabled).toBe(false);
  expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-0'], 'note-1', 'space');
  expect(value.tree).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('link', { name: '이동한 공간에서 열기' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: '다시 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));
  await screen.findByRole('link', { name: '이동한 공간에서 열기' });
  expect(value.move).toHaveBeenCalledTimes(2);
  expect(value.move).toHaveBeenLastCalledWith(['note-0'], null, 'space');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('uses the same target guidance for a rejected drag move without clearing checked notes', async () => {
  const value = show();
  value.move.mockRejectedValueOnce(new ApiError('입력한 값을 확인해 주세요.', 'INVALID_INPUT', 'parentId'));
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  drag(row('Alpha'), row('Beta'));

  expect((await screen.findByRole('alert')).textContent).toContain('이동 대상 상위 노트를 확인해 주세요.');
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alpha 선택' }).checked).toBe(true);
  expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-0'], 'note-1', 'space');
  expect(value.tree).toHaveBeenCalledTimes(1);
});

it.each([
  new ApiError('Selected note revisions changed.', 'CONFLICT', 'parentId'),
  new ApiError('The selected subtree is too large.', 'INVALID_INPUT', 'items'),
  new ApiError('The destination space is not available.', 'INVALID_INPUT', 'spaceId'),
  new ApiError('The request outcome is unknown. Retry explicitly.', 'NETWORK'),
  new Error('An unexpected move error.'),
])('retains an unrelated move failure without claiming a target-parent rejection: $message', async failure => {
  const value = show();
  value.move.mockRejectedValueOnce(failure);
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));

  expect((await screen.findByRole('alert')).textContent).toBe(failure.message);
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alpha 선택' }).checked).toBe(true);
  expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-0'], null, 'space');
  expect(value.tree).toHaveBeenCalledTimes(1);
});

it.each(['resolve', 'reject'] as const)('does not restore a late move %s or destination after access is cleared', async outcome => {
  const value = show();
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  value.move.mockReturnValueOnce(pending);
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.change(screen.getByRole('textbox', { name: '대상 상위 노트 (선택하지 않으면 루트)' }), { target: { value: 'Be' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Beta' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));
  await waitFor(() => expect(value.move).toHaveBeenCalledTimes(1));

  act(() => clearAccess());
  await act(async () => {
    if (outcome === 'resolve') resolve();
    else reject(new ApiError('입력한 값을 확인해 주세요.', 'INVALID_INPUT', 'parentId'));
    await pending.catch(() => undefined);
  });

  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('treeitem')).toBeNull();
  expect(screen.queryByText('Beta', { selector: 'strong' })).toBeNull();
  expect(screen.queryByRole('button', { name: '선택 노트 이동' })).toBeNull();
  expect(screen.queryByRole('link', { name: '이동한 공간에서 열기' })).toBeNull();
  expect(value.move).toHaveBeenCalledTimes(1);
  expect(value.tree).toHaveBeenCalledTimes(1);
});

it('does not restore write controls from a space request that completed after access was cleared', async () => {
  let resolve!: (value: { id: string; name: string; accessEpoch: number; myRole: string }[]) => void;
  const pending = new Promise<{ id: string; name: string; accessEpoch: number; myRole: string }[]>(yes => { resolve = yes; });
  const api = {
    spaces: vi.fn().mockReturnValue(pending),
    tree: vi.fn().mockResolvedValue({ items: notes, nextCursor: null }),
  } as unknown as NoteApi;
  render(<MantineProvider><NoteTree api={api} spaceId="space" activeNoteId={null} onOpen={vi.fn()}/></MantineProvider>);
  await screen.findByRole('treeitem', { name: 'Alpha' });
  act(() => clearAccess());
  await act(async () => {
    resolve([{ id: 'space', name: 'Space', accessEpoch: 1, myRole: 'OWNER' }]);
    await pending;
  });

  expect(screen.queryByRole('button', { name: '선택 노트 이동' })).toBeNull();
  expect(screen.queryByRole('textbox', { name: '새 노트 제목' })).toBeNull();
});

it.each([
  { outcome: 'resolve', timing: 'before-tree' },
  { outcome: 'reject', timing: 'before-tree' },
  { outcome: 'resolve', timing: 'after-tree' },
  { outcome: 'reject', timing: 'after-tree' },
])('recovers controls after access refresh without a stale move $outcome $timing', async ({ outcome, timing }) => {
  const value = show();
  let resolveMove!: () => void;
  let rejectMove!: (error: Error) => void;
  const pendingMove = new Promise<void>((yes, no) => { resolveMove = yes; rejectMove = no; });
  value.move.mockReturnValueOnce(pendingMove);
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));
  await waitFor(() => expect(value.move).toHaveBeenCalledTimes(1));

  let resolveTree!: (page: { items: TreeNote[]; nextCursor: null }) => void;
  const freshTree = new Promise<{ items: TreeNote[]; nextCursor: null }>(yes => { resolveTree = yes; });
  vi.mocked(value.tree).mockReturnValueOnce(freshTree);
  await act(async () => { await refreshAccess(); });
  await waitFor(() => expect(value.tree).toHaveBeenCalledTimes(2));
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '새로고침' }).disabled).toBe(true);

  const finishTreeAndSelect = async () => {
    await act(async () => { resolveTree({ items: notes, nextCursor: null }); await freshTree; });
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: '새로고침' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
    fireEvent.change(screen.getByRole('textbox', { name: '대상 상위 노트 (선택하지 않으면 루트)' }), { target: { value: 'Be' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Beta' }));
  };
  if (timing === 'after-tree') await finishTreeAndSelect();

  await act(async () => {
    if (outcome === 'resolve') resolveMove();
    else rejectMove(new ApiError('입력한 값을 확인해 주세요.', 'INVALID_INPUT', 'parentId'));
    await pendingMove.catch(() => undefined);
  });
  if (timing === 'before-tree') {
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '새로고침' }).disabled).toBe(true);
    await finishTreeAndSelect();
  }

  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('link', { name: '이동한 공간에서 열기' })).toBeNull();
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alpha 선택' }).checked).toBe(true);
  expect(screen.getByText('Beta', { selector: 'strong' })).toBeTruthy();
  expect(screen.getByRole<HTMLButtonElement>('button', { name: '선택 노트 이동' }).disabled).toBe(false);
  expect(value.tree).toHaveBeenCalledTimes(2);
  expect(value.move).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));
  await screen.findByRole('link', { name: '이동한 공간에서 열기' });
  expect(value.move).toHaveBeenCalledTimes(2);
  expect(value.move).toHaveBeenLastCalledWith(['note-0'], 'note-1', 'space');
});

const nativeInput = { altKey: false, button: 0, buttons: 1, ctrlKey: false, metaKey: false, shiftKey: false, clientX: 10, clientY: 10, pageX: 10, pageY: 10 };

function nativeSource(title: string) {
  const element = row(title);
  const registration = vi.mocked(draggable).mock.calls.map(([options]) => options).filter(value => value.element === element).at(-1);
  expect(registration).toBeDefined();
  const data = registration!.getInitialData?.({ input: nativeInput, element, dragHandle: null }) ?? {};
  return {
    registration: registration!,
    source: { element, dragHandle: null, data },
    location: { initial: { input: nativeInput, dropTargets: [] }, current: { input: nativeInput, dropTargets: [] }, previous: { dropTargets: [] } },
  };
}

function nativeLocation(label: string) {
  const element = screen.getByRole('button', { name: label });
  const registration = vi.mocked(dropTargetForElements).mock.calls.map(([options]) => options).filter(value => value.element === element).at(-1);
  expect(registration).toBeDefined();
  return {
    element,
    registration: registration!,
    self: { element, data: {}, dropEffect: 'move' as const, isActiveDueToStickiness: false },
  };
}

function finishNativeLocationDrag(source: ReturnType<typeof nativeSource>, target: ReturnType<typeof nativeLocation>) {
  expect(target.registration.canDrop?.({ input: nativeInput, source: source.source, element: target.element })).toBe(true);
  act(() => source.registration.onDragStart?.(source));
  const event = { source: source.source, location: { ...source.location, current: { input: nativeInput, dropTargets: [target.self] } } };
  // Atlaskit notifies the draggable first. Its core callback clears local source drag state before the external target runs.
  act(() => source.registration.onDrop?.(event));
  act(() => target.registration.onDrop?.({ ...event, self: target.self }));
}

it.each([false, true])('moves to the root from native source data after the source drop callback, with multiselection %s', async multiple => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Gamma' });
  if (multiple) {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gamma 선택' }));
  }
  finishNativeLocationDrag(nativeSource('Gamma'), nativeLocation('루트'));
  await waitFor(() => expect(value.move).toHaveBeenCalledExactlyOnceWith(multiple ? ['note-0', 'note-2'] : ['note-2'], null, 'space'));
});

it('uses the current parent location as the native drop target without changing source selection semantics', async () => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  fireEvent.click(screen.getByRole('button', { name: 'Alpha 하위 트리에 집중' }));
  await waitFor(() => expect(value.tree).toHaveBeenLastCalledWith('space', 'note-0', null));
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: '새로고침' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Beta 하위 트리에 집중' }));
  await waitFor(() => expect(value.tree).toHaveBeenLastCalledWith('space', 'note-1', null));
  await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: '새로고침' }).disabled).toBe(false));

  finishNativeLocationDrag(nativeSource('Gamma'), nativeLocation('상위'));
  await waitFor(() => expect(value.move).toHaveBeenCalledExactlyOnceWith(['note-2'], 'note-0', 'space'));
});

it.each(['context', 'type'])('rejects a native location drop with a foreign %s even if its callback is invoked', async field => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  const original = nativeSource('Alpha');
  const source = { ...original.source, data: { ...original.source.data, ...(field === 'context' ? { uniqueContextId: Symbol('another-tree') } : { type: 'another-drag-type' }) } };
  const target = nativeLocation('루트');

  expect(target.registration.canDrop?.({ input: nativeInput, source, element: target.element })).toBe(false);
  act(() => target.registration.onDrop?.({ source, location: original.location, self: target.self }));
  expect(value.move).not.toHaveBeenCalled();
});

it('rejects a retained native drag after the current space becomes read only', async () => {
  const value = show();
  await screen.findByRole('treeitem', { name: 'Alpha' });
  const source = nativeSource('Alpha');
  vi.mocked(value.spaces).mockResolvedValue([{ id: 'space', name: 'Space', accessEpoch: 2, myRole: 'VIEWER' }]);
  await act(async () => { await refreshAccess(); });
  await waitFor(() => expect(screen.queryByRole('button', { name: '선택 노트 이동' })).toBeNull());
  const target = nativeLocation('루트');

  expect(target.registration.canDrop?.({ input: nativeInput, source: source.source, element: target.element })).toBe(false);
  act(() => target.registration.onDrop?.({ source: source.source, location: source.location, self: target.self }));
  expect(value.move).not.toHaveBeenCalled();
});

it('rejects a native root drop while another move is pending', async () => {
  const value = show();
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  value.move.mockReturnValueOnce(pending);
  await screen.findByRole('treeitem', { name: 'Alpha' });
  const source = nativeSource('Alpha');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '선택 노트 이동' }));
  await waitFor(() => expect(value.move).toHaveBeenCalledTimes(1));
  const target = nativeLocation('루트');

  expect(target.registration.canDrop?.({ input: nativeInput, source: source.source, element: target.element })).toBe(false);
  act(() => target.registration.onDrop?.({ source: source.source, location: source.location, self: target.self }));
  expect(value.move).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await pending; });
});
