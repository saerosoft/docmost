// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { dragData } from './test/dragData';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  document.cookie = 'XSRF-TOKEN=test-token';
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); document.cookie = 'XSRF-TOKEN=;max-age=0'; window.history.replaceState(null, '', '/'); });

function note(id: string, title: string, parentId: string | null) {
  return { id, title, parentId, spaceId: 'space', ownerId: 'owner', body: '', richBody: null, revision: 1, visibility: 'PRIVATE', canEdit: true };
}
function server() {
  const notes = [
    note('root-a', 'Private root A', null), note('parent-a', 'Private folder A', 'root-a'),
    ...Array.from({ length: 50 }, (_, index) => note(`sibling-${index}`, `Sibling ${index}`, 'parent-a')),
    note('leaf-a', 'Private leaf A', 'parent-a'),
    note('root-b', 'Private root B', null), note('parent-b', 'Private folder B', 'root-b'), note('leaf-b', 'Private leaf B', 'parent-b'),
  ];
  const ancestors: string[] = [];
  const pages: { spaceId: string; parentId: string | null; after: string | null; limit: number }[] = [];
  const moves: { spaceId: string; parentId: string | null; items: { id: string; expectedRevision: number }[] }[] = [];
  const failed = new Set<string>();
  const denied = new Set<string>();
  const held = new Map<string, Promise<void>>();
  const reparent = (id: string, parentId: string | null) => { const value = notes.find(value => value.id === id)!; value.parentId = parentId; value.revision++; };
  const reply = (data: object) => new Response(JSON.stringify({ data }));
  vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => {
    const { query, variables } = JSON.parse(String(init.body));
    if (query.includes('noteAncestors')) {
      ancestors.push(variables.id);
      await held.get(variables.id);
      if (failed.delete(variables.id)) throw new TypeError('Path request failed');
      if (denied.has(variables.id)) return new Response(JSON.stringify({ errors: [{ message: 'Access to the note path was revoked.', extensions: { code: 'FORBIDDEN' } }] }));
      const path: ReturnType<typeof note>[] = [];
      let current = notes.find(value => value.id === variables.id)!;
      while (current.parentId) { current = notes.find(value => value.id === current.parentId)!; path.unshift(current); }
      return reply({ noteAncestors: path });
    }
    if (query.includes('moveNotes')) {
      moves.push(variables.input);
      variables.input.items.forEach((value: { id: string }) => reparent(value.id, variables.input.parentId));
      return reply({ moveNotes: true });
    }
    if (query.includes('knowledgeNote(')) return reply({ knowledgeNote: notes.find(value => value.id === variables.id) });
    if (query.includes('noteComments')) return reply({ noteComments: [] });
    if (query.includes('knowledgeAccumulations')) return reply({ knowledgeAccumulations: [], reviewProposals: [], noteActions: [] });
    if (query.includes('noteTree')) {
      const limit = Number(query.match(/limit:([0-9]+)/)?.[1]);
      pages.push({ ...variables, limit });
      const siblings = notes.filter(value => value.parentId === variables.parentId);
      const offset = variables.after ? siblings.findIndex(value => value.id === variables.after) + 1 : 0;
      return reply({ noteTree: siblings.slice(offset, offset + limit) });
    }
    if (query.includes('spaces')) return reply({ spaces: [{ id: 'space', name: 'Space', accessEpoch: 1, myRole: 'OWNER' }] });
    throw new Error(`Unexpected GraphQL operation: ${query}`);
  });
  return {
    ancestors, pages, moves, reparent,
    failNext(id: string) { failed.add(id); },
    deny(id: string) { denied.add(id); },
    hold(id: string) { let release!: () => void; held.set(id, new Promise<void>(resolve => { release = resolve; })); return release; },
  };
}
function show(split = false) {
  window.history.replaceState(null, '', `/?space=space&note=leaf-a${split ? '&right=leaf-b' : ''}`);
  render(<MantineProvider env="test"><App/></MantineProvider>);
}
function title(pane: '왼쪽' | '오른쪽') {
  return within(screen.getByRole('region', { name: `${pane} 편집 창` })).getByRole('textbox', { name: '노트 제목' });
}

it('reveals a directly opened private note through its authorized parent path and bounded sibling pages', async () => {
  const value = server(); show();
  await screen.findByText('Private root A / Private folder A');
  await screen.findByRole('treeitem', { name: 'Sibling 0' });
  expect(title('왼쪽').textContent).toBe('Private leaf A');
  expect(screen.queryByRole('treeitem', { name: 'Private leaf A' })).toBeNull();
  expect(value.ancestors).toEqual(['leaf-a']);
  expect(value.pages).toEqual([{ spaceId: 'space', parentId: 'parent-a', after: null, limit: 50 }]);
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  const selected = await screen.findByRole('treeitem', { name: 'Private leaf A' });
  expect(selected.getAttribute('aria-current')).toBe('page');
  expect(value.pages).toEqual([
    { spaceId: 'space', parentId: 'parent-a', after: null, limit: 50 },
    { spaceId: 'space', parentId: 'parent-a', after: 'sibling-49', limit: 50 },
  ]);
  fireEvent.click(screen.getByRole('button', { name: '상위' }));
  await screen.findByRole('treeitem', { name: 'Private folder A' });
  expect(value.pages.at(-1)).toEqual({ spaceId: 'space', parentId: 'root-a', after: null, limit: 50 });
  fireEvent.click(screen.getByRole('button', { name: '현재 노트 위치' }));
  await screen.findByText('Private root A / Private folder A');
  await screen.findByRole('treeitem', { name: 'Sibling 0' });
  expect(value.ancestors).toEqual(['leaf-a', 'leaf-a']);
  expect(value.pages).toHaveLength(3);
});

it('follows the focused pane while preserving both drafts and reusing only the bounded page cache', async () => {
  const value = server(); show(true);
  await screen.findByText('Private root A / Private folder A');
  await waitFor(() => expect(title('오른쪽').textContent).toBe('Private leaf B'));
  fireEvent.focus(title('왼쪽'));
  fireEvent.input(title('왼쪽'), { target: { innerHTML: '<h1>Unsaved left title</h1>' } });
  fireEvent.pointerDown(screen.getByRole('region', { name: '오른쪽 편집 창' }));
  await screen.findByText('Private root B / Private folder B');
  fireEvent.input(title('오른쪽'), { target: { innerHTML: '<h1>Unsaved right title</h1>' } });
  fireEvent.focus(title('왼쪽'));
  await screen.findByText('Private root A / Private folder A');
  await waitFor(() => expect(screen.queryByText('노트 위치 읽는 중…')).toBeNull());
  expect(title('왼쪽').textContent).toBe('Unsaved left title');
  expect(title('오른쪽').textContent).toBe('Unsaved right title');
  expect(value.ancestors).toEqual(['leaf-a', 'leaf-b', 'leaf-a']);
  expect(value.pages).toHaveLength(2);
  expect(value.pages.map(value => value.parentId)).toEqual(['parent-a', 'parent-b']);
});

it('ignores an older ancestor response after another pane becomes active', async () => {
  const value = server(); const release = value.hold('leaf-a'); show(true);
  await waitFor(() => expect(value.ancestors).toEqual(['leaf-a']));
  expect(screen.getByText('노트 위치 읽는 중…')).toBeTruthy();
  await waitFor(() => expect(title('오른쪽').textContent).toBe('Private leaf B'));
  fireEvent.focus(title('오른쪽'));
  await screen.findByText('Private root B / Private folder B');
  release();
  await waitFor(() => expect(screen.queryByText('노트 위치 읽는 중…')).toBeNull());
  expect(screen.queryByText('Private root A / Private folder A')).toBeNull();
  expect(value.pages.map(value => value.parentId)).toEqual(['parent-b']);
});

it('keeps failed path loads explicit and retries without crawling root pages', async () => {
  const value = server(); value.failNext('leaf-a'); show();
  await screen.findByRole('alert');
  expect(value.pages).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: '현재 노트 위치' }));
  await screen.findByText('Private root A / Private folder A');
  await screen.findByRole('treeitem', { name: 'Sibling 0' });
  expect(value.ancestors).toEqual(['leaf-a', 'leaf-a']);
  expect(value.pages.map(value => value.parentId)).toEqual(['parent-a']);
});

it('clears private paths and drafts on denial and never restores a late authorized path response', async () => {
  const value = server(); const release = value.hold('leaf-a'); value.deny('leaf-b'); show(true);
  await waitFor(() => expect(value.ancestors).toEqual(['leaf-a']));
  await waitFor(() => expect(title('오른쪽').textContent).toBe('Private leaf B'));
  fireEvent.focus(title('오른쪽'));
  await screen.findByRole('alert');
  release();
  await waitFor(() => expect(screen.queryByRole('navigation', { name: '노트 트리' })).toBeNull());
  expect(screen.queryByRole('textbox', { name: '노트 제목' })).toBeNull();
  expect(screen.queryByText('Private root A / Private folder A')).toBeNull();
  expect(screen.queryByText('Private root B / Private folder B')).toBeNull();
  expect(value.pages).toEqual([]);
});

it('recomputes the active path after moving a directly opened note to its parent ancestor', async () => {
  const value = server(); show();
  await screen.findByRole('treeitem', { name: 'Sibling 0' });
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  const row = await screen.findByRole('treeitem', { name: 'Private leaf A' });
  const parent = screen.getByRole('button', { name: '상위' });
  const dataTransfer = dragData();
  fireEvent.dragStart(row, { dataTransfer }); fireEvent.dragOver(parent, { dataTransfer }); fireEvent.drop(parent, { dataTransfer });
  await waitFor(() => expect(value.moves).toEqual([{ spaceId: 'space', parentId: 'root-a', items: [{ id: 'leaf-a', expectedRevision: 1 }] }]));
  await screen.findByRole('treeitem', { name: 'Private leaf A' });
  await waitFor(() => expect(value.ancestors).toEqual(['leaf-a', 'leaf-a']));
  expect(screen.queryByText('Private root A / Private folder A')).toBeNull();
  expect(value.pages.at(-1)).toEqual({ spaceId: 'space', parentId: 'root-a', after: null, limit: 50 });
});

it('recomputes the active ancestor path after a note change while retaining the editor draft', async () => {
  const value = server(); show();
  await screen.findByRole('treeitem', { name: 'Sibling 0' });
  fireEvent.input(title('왼쪽'), { target: { innerHTML: '<h1>Unsaved title</h1>' } });
  value.reparent('leaf-a', 'parent-b');
  fireEvent(window, new Event('note-changed'));
  await screen.findByText('Private root B / Private folder B');
  await screen.findByRole('treeitem', { name: 'Private leaf A' });
  expect(title('왼쪽').textContent).toBe('Unsaved title');
  expect(value.ancestors).toEqual(['leaf-a', 'leaf-a']);
  expect(value.pages.at(-1)).toEqual({ spaceId: 'space', parentId: 'parent-b', after: null, limit: 50 });
});
