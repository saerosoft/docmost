// @vitest-environment jsdom
import { useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteApi, NoteSummary, RelationTargetPage } from './model';
import { NotePicker } from './NotePicker';
import { clearAccess } from './transport';

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const firstPage: RelationTargetPage = {
  noteId: 'anchor', total: 21, nextCursor: '20',
  items: Array.from({ length: 20 }, (_, index) => ({ id: 'target-' + index, title: 'First page target ' + (index + 1) })),
};
function fixture(findRelationNotes = vi.fn().mockResolvedValue(firstPage)) {
  const findNotes = vi.fn().mockResolvedValue([{ id: 'self', title: 'Excluded generic note' }, { id: 'generic', title: 'Generic target' }]);
  const api = { findRelationNotes, findNotes } as unknown as NoteApi;
  const onSelect = vi.fn();
  return { api, findRelationNotes, findNotes, onSelect };
}
function show(value: ReturnType<typeof fixture>, noteId = 'anchor') {
  return render(<MantineProvider env="test"><NotePicker api={value.api} spaceId="space" relationNoteId={noteId} label="연결할 노트" selected={null} onSelect={value.onSelect}/></MantineProvider>);
}
async function settle() { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); }

it('uses server-filtered target pages and totals, reaches the second page, and never calls generic note search', async () => {
  const findRelationNotes = vi.fn().mockImplementation((_id: string, _query: string, cursor: string | null) => Promise.resolve(cursor
    ? { noteId: 'anchor', total: 21, items: [{ id: 'last', title: 'Second page target' }], nextCursor: null }
    : firstPage));
  const value = fixture(findRelationNotes);
  show(value); await settle();
  expect(screen.getByText('연결 가능한 노트 21개')).toBeTruthy();
  expect(value.findNotes).not.toHaveBeenCalled();
  expect(value.findRelationNotes).toHaveBeenLastCalledWith('anchor', '', null);
  fireEvent.click(screen.getByRole('button', { name: '다음 대상' }));
  expect(screen.queryByRole('button', { name: 'First page target 1' })).toBeNull();
  await settle();
  expect(value.findRelationNotes).toHaveBeenLastCalledWith('anchor', '', '20');
  expect(screen.getByRole('button', { name: '다음 대상' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Second page target' }));
  expect(value.onSelect).toHaveBeenCalledExactlyOnceWith({ id: 'last', title: 'Second page target' });
});

it('resets paging for a new server search and rejects a late result from the previous page', async () => {
  let finish!: (page: RelationTargetPage) => void;
  const value = fixture(vi.fn().mockImplementation((_id: string, query: string, cursor: string | null) => {
    if (query === 'new') return Promise.resolve({ noteId: 'anchor', total: 1, items: [{ id: 'new', title: 'New search target' }], nextCursor: null });
    if (cursor) return new Promise<RelationTargetPage>(resolve => { finish = resolve; });
    return Promise.resolve(firstPage);
  }));
  show(value); await settle();
  fireEvent.click(screen.getByRole('button', { name: '다음 대상' })); await settle();
  fireEvent.change(screen.getByRole('textbox', { name: '연결할 노트' }), { target: { value: '  new  ' } }); await settle();
  expect(value.findRelationNotes).toHaveBeenLastCalledWith('anchor', 'new', null);
  expect(screen.getByRole('button', { name: '이전 대상' })).toHaveProperty('disabled', true);
  await act(async () => { finish({ noteId: 'anchor', total: 21, items: [{ id: 'old', title: 'Late previous target' }], nextCursor: null }); });
  expect(screen.getByRole('button', { name: 'New search target' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Late previous target' })).toBeNull();
});

it('clears a selected private title on access loss and ignores a pending page after revocation', async () => {
  let finish!: (page: RelationTargetPage) => void;
  const value = fixture(vi.fn().mockResolvedValueOnce({
    noteId: 'anchor', total: 1, items: [{ id: 'private', title: 'Private selected title' }], nextCursor: null,
  }).mockImplementation(() => new Promise<RelationTargetPage>(resolve => { finish = resolve; })));
  function Controlled() {
    const [selected, setSelected] = useState<NoteSummary | null>(null);
    return <NotePicker api={value.api} spaceId="space" relationNoteId="anchor" label="연결할 노트" selected={selected} onSelect={setSelected}/>;
  }
  render(<MantineProvider env="test"><Controlled/></MantineProvider>); await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Private selected title' }));
  expect(screen.getByText('Private selected title')).toBeTruthy();
  act(() => clearAccess());
  expect(screen.queryByText('Private selected title')).toBeNull();
  expect(screen.queryByRole('textbox', { name: '연결할 노트' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('접근 권한이 변경되었습니다.');
  cleanup();

  show(value); await settle();
  act(() => clearAccess());
  await act(async () => { finish({ noteId: 'anchor', total: 1, items: [{ id: 'late', title: 'Late private target' }], nextCursor: null }); });
  expect(screen.queryByText('Late private target')).toBeNull();
});

it('clears old target rows when the addressed anchor changes', async () => {
  const value = fixture(vi.fn().mockImplementation((id: string) => Promise.resolve({
    noteId: id, total: 1, items: [{ id: id + '-target', title: id + ' target' }], nextCursor: null,
  })));
  const view = show(value);
  await settle(); expect(screen.getByRole('button', { name: 'anchor target' })).toBeTruthy();
  view.rerender(<MantineProvider env="test"><NotePicker api={value.api} spaceId="space" relationNoteId="other" label="연결할 노트" selected={null} onSelect={value.onSelect}/></MantineProvider>);
  expect(screen.queryByRole('button', { name: 'anchor target' })).toBeNull();
  await settle();
  expect(screen.getByRole('button', { name: 'other target' })).toBeTruthy();
  expect(value.findRelationNotes).toHaveBeenLastCalledWith('other', '', null);
});

it('shows a lookup failure with an explicit retry instead of an empty result', async () => {
  const value = fixture(vi.fn().mockRejectedValueOnce(new Error('목록을 읽지 못했습니다.')).mockResolvedValueOnce({
    noteId: 'anchor', total: 0, items: [], nextCursor: null,
  }));
  show(value); await settle();
  expect(screen.getByRole('alert').textContent).toBe('목록을 읽지 못했습니다.');
  expect(screen.queryByText('연결 가능한 노트를 찾지 못했습니다.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '검색 다시 시도' })); await settle();
  expect(screen.getByText('연결 가능한 노트를 찾지 못했습니다.')).toBeTruthy();
  expect(value.findRelationNotes).toHaveBeenCalledTimes(2);
});

it('keeps the ordinary tree destination picker on its existing generic search contract', async () => {
  const value = fixture();
  render(<MantineProvider env="test"><NotePicker api={value.api} spaceId="destination" label="상위 노트" selected={null} onSelect={value.onSelect} exclude={['self']}/></MantineProvider>);
  await settle();
  expect(value.findNotes).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: '상위 노트' }), { target: { value: 'parent' } }); await settle();
  expect(value.findNotes).toHaveBeenCalledExactlyOnceWith('destination', 'parent');
  expect(value.findRelationNotes).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Excluded generic note' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Generic target' }));
  expect(value.onSelect).toHaveBeenCalledExactlyOnceWith({ id: 'generic', title: 'Generic target' });
});
