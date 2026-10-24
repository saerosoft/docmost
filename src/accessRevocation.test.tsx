// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Space } from './model';

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  document.cookie = 'XSRF-TOKEN=test-token';
  window.history.replaceState(null, '', '/?space=space');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); document.cookie = 'XSRF-TOKEN=;max-age=0'; window.history.replaceState(null, '', '/'); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function server() {
  const folder = { id: 'folder', title: 'Cached folder', parentId: null, revision: 1 };
  const child = { id: 'child', title: 'Cached child', parentId: 'folder', revision: 1 };
  const state: {
    spaces: Space[];
    spacesFailure: boolean;
    canEdit: boolean;
    pendingSpaces?: Promise<Space[]>;
    pendingTree?: Promise<(typeof folder | typeof child)[]>;
  } = {
    spaces: [{ id: 'space', name: 'Space', accessEpoch: 1, myRole: 'OWNER' }],
    spacesFailure: false,
    canEdit: true,
  };
  const reads = { spaces: 0, tree: 0, note: 0 };
  vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => {
    const { query, variables } = JSON.parse(String(init.body));
    const reply = (data: object) => new Response(JSON.stringify({ data }));
    if (query.includes('spaces')) {
      reads.spaces++;
      if (state.spacesFailure) throw new TypeError('Access revalidation failed');
      const spaces = await (state.pendingSpaces ?? state.spaces);
      return reply({ spaces: spaces.map(value => query.includes('accessEpoch') ? value : { id: value.id, name: value.name }) });
    }
    if (query.includes('noteTree')) {
      reads.tree++;
      return reply({ noteTree: await (state.pendingTree ?? (variables.parentId ? [child] : [folder])) });
    }
    if (query.includes('knowledgeCurrentItems')) return reply({ knowledgeCurrentItems: { noteId: variables.noteId, revision: 1, items: [], bodyOrigin: 'HUMAN', hasNext: false } });
    if (query.includes('knowledgeNote(')) {
      reads.note++;
      return reply({ knowledgeNote: { ...folder, spaceId: 'space', ownerId: 'owner', bodyOrigin: 'HUMAN', body: '', richBody: null, visibility: 'SPACE', canEdit: state.canEdit } });
    }
    if (query.includes('noteAncestors')) return reply({ noteAncestors: [] });
    if (query.includes('noteComments')) return reply({ noteComments: [] });
    if (query.includes('knowledgeAccumulations')) return reply({ knowledgeAccumulations: [], reviewProposals: [], noteActions: [] });
    throw new Error(`Unexpected GraphQL operation: ${query}`);
  });
  render(<MantineProvider env="test"><App /></MantineProvider>);
  return { state, reads, folder, child };
}

async function settle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
}

async function cacheBothPages() {
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Cached folder 하위 트리 보기' }));
  await settle();
  expect(screen.getByRole('treeitem', { name: 'Cached child' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '루트' }));
  await settle();
  expect(screen.getByRole('treeitem', { name: 'Cached folder' })).toBeTruthy();
}

it('invalidates cached root and child metadata after remote revocation at the next check within thirty seconds', async () => {
  const value = server();
  await cacheBothPages();
  expect(value.reads.tree).toBe(2);
  value.state.spaces = [];

  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

  expect(screen.queryByRole('treeitem', { name: 'Cached folder' })).toBeNull();
  expect(screen.queryByRole('treeitem', { name: 'Cached child' })).toBeNull();
  expect(screen.queryByText('Cached folder')).toBeNull();
});

it.each(['focus', 'visibilitychange'])('rechecks cached tree access on %s before another tree request is needed', async event => {
  const value = server();
  await cacheBothPages();
  value.state.spaces = [];

  fireEvent(event === 'focus' ? window : document, new Event(event));
  await settle();

  expect(screen.queryByRole('navigation', { name: '노트 트리' })).toBeNull();
  expect(screen.queryByText('Cached folder')).toBeNull();
});

it('keeps cached navigation mounted while an unchanged background check is pending', async () => {
  const value = server();
  await cacheBothPages();
  const initialReads = value.reads.spaces;
  const pending = deferred<typeof value.state.spaces>();
  value.state.pendingSpaces = pending.promise;

  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

  expect(value.reads.spaces).toBeGreaterThan(initialReads);
  expect(screen.getByRole('treeitem', { name: 'Cached folder' })).toBeTruthy();
  value.state.pendingSpaces = undefined;
  pending.resolve(value.state.spaces);
  await settle();
  expect(screen.getByRole('treeitem', { name: 'Cached folder' })).toBeTruthy();
  expect(value.reads.tree).toBe(2);
});

it('hides cached navigation after a failed access check', async () => {
  const value = server();
  await cacheBothPages();
  value.state.spacesFailure = true;

  fireEvent(window, new Event('focus'));
  await settle();

  expect(screen.queryByRole('navigation', { name: '노트 트리' })).toBeNull();
  expect(screen.queryByRole('treeitem', { name: 'Cached folder' })).toBeNull();
});

it('refreshes current note permissions after an epoch change while preserving an authorized dirty draft', async () => {
  const value = server();
  await settle();
  fireEvent.click(screen.getByRole('treeitem', { name: 'Cached folder' }));
  await settle();
  fireEvent.input(screen.getByRole('textbox', { name: '노트 제목' }), { target: { innerHTML: '<h1>Unsaved permitted title</h1>' } });
  const initialReads = value.reads.note;
  value.state.spaces = [{ id: 'space', name: 'Space', accessEpoch: 2, myRole: 'OWNER' }];
  value.state.canEdit = false;
  value.folder.title = 'Remotely changed server title';

  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

  expect(value.reads.note).toBeGreaterThan(initialReads);
  expect(screen.getByRole('textbox', { name: '노트 제목' }).textContent).toBe('Unsaved permitted title');
  expect(screen.getByRole('textbox', { name: '노트 제목' }).getAttribute('aria-readonly')).toBe('true');
  expect(screen.getByRole('button', { name: '저장' }).getAttribute('disabled')).toBe('');
});

it('does not restore an older tree response after remote revocation is observed', async () => {
  const value = server();
  await settle();
  const pending = deferred<(typeof value.folder | typeof value.child)[]>();
  value.state.pendingTree = pending.promise;
  fireEvent.click(screen.getByRole('button', { name: 'Cached folder 하위 트리 보기' }));
  await settle();
  value.state.spaces = [];
  fireEvent(window, new Event('focus'));
  await settle();
  pending.resolve([value.child]);
  await settle();

  expect(screen.queryByRole('navigation', { name: '노트 트리' })).toBeNull();
  expect(screen.queryByRole('treeitem', { name: 'Cached child' })).toBeNull();
  expect(screen.queryByText('Cached folder')).toBeNull();
});

it('hides stale tree data within sixty seconds when a thirty-second check stalls and ignores its late success', async () => {
  const value = server();
  await cacheBothPages();
  const pending = deferred<typeof value.state.spaces>();
  value.state.pendingSpaces = pending.promise;

  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

  expect(screen.queryByRole('navigation', { name: '노트 트리' })).toBeNull();
  value.state.pendingSpaces = undefined;
  pending.resolve(value.state.spaces);
  await settle();
  expect(screen.queryByRole('navigation', { name: '노트 트리' })).toBeNull();
  fireEvent(window, new Event('focus'));
  await settle();
  expect(screen.getByRole('treeitem', { name: 'Cached folder' })).toBeTruthy();
});
