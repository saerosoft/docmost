// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { Note, Revision } from '../model';
import { NotePanels } from '../NotePanels';
import { DocmostPaneProvider } from './DocmostPaneProvider';

const body = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const note: Note = { id: 'note', spaceId: 'space', title: 'Current', revision: 7, bodyOrigin: 'HUMAN', bodyJson: body('Current'), canEdit: true, visibility: 'PRIVATE', parentId: null };
const revisions: Revision[] = [2, 1].map(revision => ({ id: `revision-${revision}`, revision, title: `Title ${revision}`, createdAt: `2026-10-2${revision}T00:00:00Z`, bodyOrigin: 'HUMAN', bodyJson: body(revision === 2 ? 'New body' : 'Old body') }));
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function show(dirty = false) {
  const history = vi.fn().mockResolvedValue({ items: revisions, nextCursor: null });
  const restore = vi.fn().mockResolvedValue({ ...note, revision: 8 });
  const restored = vi.fn();
  render(<DocmostPaneProvider><NotePanels api={{ ...api, history, restore, comments: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) }} note={note} dirty={dirty} onRestore={restored} onOpen={vi.fn()} onRevision={vi.fn()}/></DocmostPaneProvider>);
  fireEvent.click(screen.getByRole('tab', { name: '이력' }));
  return { history, restore, restored };
}

it('renders the selected immutable revision in the real core history editor and restores through the current revision guard', async () => {
  const value = show(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  const editor = await screen.findByRole('textbox', { name: '개정 원문' });
  expect(editor.textContent).toContain('New body');
  expect(editor.getAttribute('contenteditable')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: '복원' }));
  await waitFor(() => expect(value.restore).toHaveBeenCalledExactlyOnceWith('note', 2, 7));
  expect(value.restored).toHaveBeenCalledWith(expect.objectContaining({ revision: 8 }));
});

it('keeps the revision viewer read-only and blocks restore while the current pane has an unsaved draft', async () => {
  const value = show(true);
  await screen.findByRole('textbox', { name: '개정 원문' });
  expect(screen.getByRole('button', { name: '복원' }).getAttribute('disabled')).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '복원' }));
  expect(value.restore).not.toHaveBeenCalled();
});

it('keeps history selection and comment drafts independent for the same note in two panes', async () => {
  const client = { ...api, history: vi.fn().mockResolvedValue({ items: revisions, nextCursor: null }), comments: vi.fn().mockResolvedValue({ items: [], nextCursor: null }) };
  function pane(id: string) { return <DocmostPaneProvider><section aria-label={id}><NotePanels api={client} note={note} dirty={false} onRestore={vi.fn()} onOpen={vi.fn()} onRevision={vi.fn()}/></section></DocmostPaneProvider>; }
  render(<>{pane('left')}{pane('right')}</>);
  const left = within(screen.getByRole('region', { name: 'left' }));
  const right = within(screen.getByRole('region', { name: 'right' }));
  const leftDraft = await left.findByRole('textbox', { name: '댓글' });
  await waitFor(() => expect(leftDraft.getAttribute('contenteditable')).toBe('true'));
  leftDraft.textContent = 'Only the left pane'; fireEvent.input(leftDraft);
  expect(right.getByRole('textbox', { name: '댓글' }).textContent).toBe('');
  fireEvent.click(left.getByRole('tab', { name: '이력' }));
  fireEvent.click(right.getByRole('tab', { name: '이력' }));
  await left.findByRole('textbox', { name: '개정 원문' }); await right.findByRole('textbox', { name: '개정 원문' });
  fireEvent.click(left.getByRole('button', { name: /개정 1 · Title 1/ }));
  await waitFor(() => expect(left.getByRole('textbox', { name: '개정 원문' }).textContent).toContain('Old body'));
  expect(right.getByRole('textbox', { name: '개정 원문' }).textContent).toContain('New body');
});
