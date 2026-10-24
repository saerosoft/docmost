// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteApi, TreeNote } from './model';
import { NoteTree } from './NoteTree';
import { dragData } from './test/dragData';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const notes: TreeNote[] = ['Alpha', 'Beta', 'Gamma'].map((title, index) => ({ id: `note-${index}`, title, parentId: null, hasChildren: true, revision: 1 }));

function show() {
  const move = vi.fn().mockResolvedValue(undefined);
  const api = {
    spaces: vi.fn().mockResolvedValue([{ id: 'space', name: 'Space', accessEpoch: 1 }]),
    tree: vi.fn().mockResolvedValue({ items: notes, nextCursor: null }),
    findNotes: vi.fn().mockResolvedValue([{ id: 'note-0', title: 'Alpha' }, { id: 'note-1', title: 'Beta' }]),
    move,
  } as unknown as NoteApi;
  render(<MantineProvider><NoteTree api={api} spaceId="space" activeNoteId={null} onOpen={vi.fn()}/></MantineProvider>);
  return { move, tree: api.tree };
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
  expect(destination.getAttribute('href')).toBe('/?space=space&note=note-0');
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

it('keeps a paged subtree bounded when a bulk-expand key cannot represent sibling subtrees', async () => {
  const value = show();
  const first = await screen.findByRole('treeitem', { name: 'Alpha' });
  first.focus(); fireEvent.keyDown(first, { key: '*' });
  expect(value.tree).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Alpha / Beta / Gamma')).toBeNull();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  await waitFor(() => expect(value.tree).toHaveBeenLastCalledWith('space', 'note-0', null));
  expect(value.tree).toHaveBeenCalledTimes(2);
});
