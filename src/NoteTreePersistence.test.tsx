// @vitest-environment jsdom
import { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NoteTree } from './NoteTree';
import type { NoteApi, Page, TreeNote } from './model';
import { clearAccess } from './transport';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const note = (id: string, parentId: string | null, hasChildren = false): TreeNote => ({ id, title: id, parentId, hasChildren, revision: 1 });
const root = [note('Folder A', null, true), note('Folder B', null, true)];

function show(override?: (parent: string | null, cursor: string | null) => Promise<Page<TreeNote>>) {
  const api = {
    spaces: vi.fn().mockResolvedValue([{ id: 'space', name: 'Space', accessEpoch: 1, myRole: 'OWNER' }]),
    tree: vi.fn((_space: string, parent: string | null, cursor: string | null) => override ? override(parent, cursor) : Promise.resolve({ items: parent ? [note(`${parent} child`, parent)] : root, nextCursor: null })),
    ancestors: vi.fn().mockResolvedValue([]),
    findNotes: vi.fn().mockResolvedValue([]),
  } as unknown as NoteApi;
  function View() {
    const [active, setActive] = useState<string | null>(null);
    return <MantineProvider env="test"><NoteTree api={api} spaceId="space" activeNoteId={active} onOpen={setActive}/></MantineProvider>;
  }
  render(<View/>);
  return api;
}

function toggle(title: string) { fireEvent.click(screen.getByRole('button', { name: `${title} 하위 트리 보기` })); }

it('keeps the native nested tree and other expanded branches when a child opens in the editor', async () => {
  const api = show();
  await screen.findByRole('treeitem', { name: 'Folder A' });
  toggle('Folder A');
  await screen.findByRole('treeitem', { name: 'Folder A child' });
  toggle('Folder B');
  await screen.findByRole('treeitem', { name: 'Folder B child' });
  fireEvent.click(screen.getByRole('treeitem', { name: 'Folder A child' }));
  await waitFor(() => expect(screen.getByRole('treeitem', { name: 'Folder A child' }).getAttribute('aria-selected')).toBe('true'));
  expect(screen.getByRole('treeitem', { name: 'Folder A child' }).getAttribute('aria-level')).toBe('2');
  expect(screen.getByRole('treeitem', { name: 'Folder A' }).getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('treeitem', { name: 'Folder B' }).getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('treeitem', { name: 'Folder B child' })).toBeTruthy();
  expect(api.ancestors).not.toHaveBeenCalled();
  expect(api.tree).toHaveBeenCalledTimes(3);

  toggle('Folder A');
  expect(screen.queryByRole('treeitem', { name: 'Folder A child' })).toBeNull();
  expect(screen.getByRole('treeitem', { name: 'Folder B child' })).toBeTruthy();
  toggle('Folder A');
  await screen.findByRole('treeitem', { name: 'Folder A child' });
  expect(api.tree).toHaveBeenCalledTimes(3);
});

it('replaces a child sibling page without discarding the root or another branch', async () => {
  const api = show(async (parent, cursor) => ({ items: parent === 'Folder A' ? [note(cursor ? 'A second' : 'A first', parent)] : parent === 'Folder B' ? [note('B child', parent)] : root, nextCursor: parent === 'Folder A' && !cursor ? 'page-2' : null }));
  await screen.findByRole('treeitem', { name: 'Folder A' });
  toggle('Folder A');
  await screen.findByRole('treeitem', { name: 'A first' });
  toggle('Folder B');
  await screen.findByRole('treeitem', { name: 'B child' });
  fireEvent.click(screen.getByRole('button', { name: 'Folder A 하위 노트 다음' }));
  await screen.findByRole('treeitem', { name: 'A second' });
  expect(screen.queryByRole('treeitem', { name: 'A first' })).toBeNull();
  expect(screen.getByRole('treeitem', { name: 'B child' })).toBeTruthy();
  expect(screen.getByRole('treeitem', { name: 'Folder A' })).toBeTruthy();
  expect(api.tree).toHaveBeenLastCalledWith('space', 'Folder A', 'page-2');
  fireEvent.click(screen.getByRole('button', { name: 'Folder A 하위 노트 이전' }));
  await screen.findByRole('treeitem', { name: 'A first' });
  expect(api.tree).toHaveBeenCalledTimes(4);
});

it('respects collapse while a child request is pending and reuses its result only when reopened', async () => {
  let finish!: (page: Page<TreeNote>) => void;
  const pending = new Promise<Page<TreeNote>>(resolve => { finish = resolve; });
  const api = show(async parent => parent ? pending : { items: root, nextCursor: null });
  await screen.findByRole('treeitem', { name: 'Folder A' });
  toggle('Folder A');
  expect(screen.getByRole('treeitem', { name: 'Folder A' }).getAttribute('aria-expanded')).toBe('true');
  toggle('Folder A');
  await act(async () => { finish({ items: [note('Late child', 'Folder A')], nextCursor: null }); await pending; });
  expect(screen.getByRole('treeitem', { name: 'Folder A' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('treeitem', { name: 'Late child' })).toBeNull();
  toggle('Folder A');
  await screen.findByRole('treeitem', { name: 'Late child' });
  expect(api.tree).toHaveBeenCalledTimes(2);
});

it('keeps an authorized empty branch loaded without repeatedly requesting it', async () => {
  const api = show(async parent => ({ items: parent ? [] : root, nextCursor: null }));
  await screen.findByRole('treeitem', { name: 'Folder A' });
  toggle('Folder A');
  await waitFor(() => expect(screen.queryByLabelText('Folder A 하위 노트 읽는 중')).toBeNull());
  expect(api.tree).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('treeitem', { name: 'Folder A' }).getAttribute('aria-expanded')).toBe('true');
  toggle('Folder A'); toggle('Folder A');
  expect(api.tree).toHaveBeenCalledTimes(2);
});

it('clears a contextual creation form and ignores a late expanded branch after access loss', async () => {
  let finish!: (page: Page<TreeNote>) => void;
  const pending = new Promise<Page<TreeNote>>(resolve => { finish = resolve; });
  show(async parent => parent ? pending : { items: root, nextCursor: null });
  await screen.findByRole('treeitem', { name: 'Folder A' });
  expect(screen.queryByRole('textbox', { name: '새 노트 제목' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '새 페이지' }));
  fireEvent.change(screen.getByRole('textbox', { name: '새 노트 제목' }), { target: { value: 'Private unsaved page' } });
  toggle('Folder A');
  act(() => clearAccess());
  await act(async () => { finish({ items: [note('Late private child', 'Folder A')], nextCursor: null }); await pending; });
  expect(screen.queryByRole('treeitem')).toBeNull();
  expect(screen.queryByRole('textbox', { name: '새 노트 제목' })).toBeNull();
  expect(screen.queryByDisplayValue('Private unsaved page')).toBeNull();
  expect(screen.queryByText('Late private child')).toBeNull();
});

it('focuses an expanded nested subtree explicitly and retains its real parent drop destination', async () => {
  show(async parent => ({ items: parent === 'Folder A' ? [note('Inner folder', parent, true)] : parent === 'Inner folder' ? [note('Deep page', parent)] : root, nextCursor: null }));
  await screen.findByRole('treeitem', { name: 'Folder A' });
  toggle('Folder A');
  await screen.findByRole('treeitem', { name: 'Inner folder' });
  fireEvent.click(screen.getByRole('button', { name: 'Inner folder 하위 트리에 집중' }));
  await screen.findByRole('treeitem', { name: 'Deep page' });
  expect(screen.getByText('Folder A / Inner folder')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '상위' }));
  await screen.findByRole('treeitem', { name: 'Inner folder' });
  expect(screen.queryByRole('treeitem', { name: 'Folder B' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '루트' }));
  await screen.findByRole('treeitem', { name: 'Folder B' });
});
