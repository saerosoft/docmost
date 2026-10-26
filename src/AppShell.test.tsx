// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { clearAccess } from './transport';

const accessState = vi.hoisted(() => ({ failure: undefined as Error | undefined, refreshing: false }));
vi.mock('./api', () => ({ api: {} }));
vi.mock('./useSpaceAccess', () => ({
  useSpaceAccess: () => ({
    spaces: [
      { id: 'space', name: 'First workspace', accessEpoch: 1, myRole: 'OWNER' },
      { id: 'second', name: 'Second workspace', accessEpoch: 1, myRole: 'OWNER' },
    ], ready: true, refreshing: accessState.refreshing, failure: accessState.failure, recheck: vi.fn(),
  }),
}));
vi.mock('./NoteTree', () => ({
  NoteTree: ({ onOpen }: { onOpen: (id: string) => void }) =>
    <button onClick={() => onOpen('another-note')}>Open another note</button>,
}));
vi.mock('./NotePicker', () => ({
  NotePicker: ({ onSelect }: { onSelect: (note: { id: string; title: string }) => void }) =>
    <button onClick={() => onSelect({ id: 'search-result', title: 'Search result' })}>Search result</button>,
}));
vi.mock('./Pane', () => ({
  Pane: ({ paneId, requestedId, onDirty, onActivate }: {
    paneId: string; requestedId: string | null; onDirty: (dirty: boolean) => void; onActivate: () => void;
  }) => {
    const [draft, setDraft] = useState('');
    return <section aria-label={paneId + ' editing pane'} onFocus={onActivate}>
      <span>{paneId}: {requestedId}</span>
      <input aria-label={paneId + ' draft'} value={draft} onChange={event => {
        setDraft(event.currentTarget.value); onDirty(Boolean(event.currentTarget.value));
      }}/>
    </section>;
  },
}));

beforeEach(() => {
  accessState.failure = undefined; accessState.refreshing = false;
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.history.replaceState(null, '', '/?space=space&note=first-note');
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  window.history.replaceState(null, '', '/');
});
function show() { return render(<MantineProvider env="test"><App/></MantineProvider>); }

it('collapses and restores native navigation without remounting a dirty page', () => {
  show();
  const draft = screen.getByLabelText('왼쪽 draft') as HTMLInputElement;
  fireEvent.change(draft, { target: { value: 'Unsubmitted text' } });
  const toggle = screen.getAllByRole('button', { name: '페이지 탐색' })[1];
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByLabelText('왼쪽 draft')).toBe(draft);
  expect(draft.value).toBe('Unsubmitted text');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(draft.value).toBe('Unsubmitted text');
});

it('keeps the dirty right pane when closing is cancelled and clears only its unload guard after discard', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '두 창으로' }));
  fireEvent.change(screen.getByLabelText('오른쪽 draft'), { target: { value: 'Right unsaved text' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '한 창으로' }));
  expect((screen.getByLabelText('오른쪽 draft') as HTMLInputElement).value).toBe('Right unsaved text');
  expect(confirm).toHaveBeenCalledOnce();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: '한 창으로' }));
  expect(screen.queryByLabelText('오른쪽 draft')).toBeNull();
  expect(screen.getByLabelText('왼쪽 draft')).toBeTruthy();
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(false);
});

it('opens search in the active pane and preserves the other pane draft', async () => {
  show();
  fireEvent.change(screen.getByLabelText('왼쪽 draft'), { target: { value: 'Keep the left draft' } });
  fireEvent.click(screen.getByRole('button', { name: '두 창으로' }));
  fireEvent.focus(screen.getByLabelText('오른쪽 draft'));
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  const search = await screen.findByRole('dialog', { name: '노트 검색' });
  fireEvent.click(within(search).getByRole('button', { name: 'Search result' }));
  expect(screen.getByText('오른쪽: search-result')).toBeTruthy();
  expect((screen.getByLabelText('왼쪽 draft') as HTMLInputElement).value).toBe('Keep the left draft');
  expect(new URL(window.location.href).searchParams.get('right')).toBe('search-result');
});

it('lets the host navigate only after dirty-pane confirmation succeeds', () => {
  const onNavigate = vi.fn(() => true);
  render(<MantineProvider env="test"><App onNavigate={onNavigate}/></MantineProvider>);
  fireEvent.change(screen.getByLabelText('왼쪽 draft'), { target: { value: 'Keep until navigation is approved' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const home = screen.getByRole('link', { name: /^홈$/ });
  expect(fireEvent.click(home)).toBe(false);
  expect(onNavigate).not.toHaveBeenCalled();
  expect((screen.getByLabelText('왼쪽 draft') as HTMLInputElement).value).toBe('Keep until navigation is approved');
  confirm.mockReturnValue(true);
  expect(fireEvent.click(home)).toBe(false);
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith(home.getAttribute('href'));
});

it('requires confirmation before a native space selection discards pane drafts', async () => {
  show();
  fireEvent.change(screen.getByLabelText('왼쪽 draft'), { target: { value: 'Keep the first workspace draft' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: '공간 선택' }));
  fireEvent.click(await screen.findByRole('combobox', { name: '공간' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Second workspace' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect((screen.getByLabelText('왼쪽 draft') as HTMLInputElement).value).toBe('Keep the first workspace draft');
  expect(new URL(window.location.href).searchParams.get('space')).toBe('space');
});

it('removes protected search and pane state on access loss while preserving the requested location', async () => {
  show();
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(await screen.findByRole('dialog', { name: '노트 검색' })).toBeTruthy();
  const location = window.location.href;
  fireEvent(window, new Event('focus'));
  const { act } = await import('@testing-library/react');
  await act(async () => clearAccess());
  expect(screen.queryByRole('dialog', { name: '노트 검색' })).toBeNull();
  expect(screen.queryByText('왼쪽: first-note')).toBeNull();
  expect(window.location.href).toBe(location);
  expect(screen.getByRole('link', { name: '로그인' })).toBeTruthy();
});


it('withholds portaled search content while authority revalidation is unavailable, without discarding drafts', async () => {
  const view = show();
  fireEvent.change(screen.getByLabelText('왼쪽 draft'), { target: { value: 'Retain while checking access' } });
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  expect(await screen.findByRole('dialog', { name: '노트 검색' })).toBeTruthy();
  accessState.failure = new Error('Access check is unavailable');
  view.rerender(<MantineProvider env="test"><App/></MantineProvider>);
  expect(screen.queryByRole('dialog', { name: '노트 검색' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Access check is unavailable');
  accessState.failure = undefined;
  view.rerender(<MantineProvider env="test"><App/></MantineProvider>);
  expect((screen.getByLabelText('왼쪽 draft') as HTMLInputElement).value).toBe('Retain while checking access');
});
