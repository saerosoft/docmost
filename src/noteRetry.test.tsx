// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import type { Note, Visibility } from './model';
import { NotePanels } from './NotePanels';
import { NoteTree } from './NoteTree';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  document.cookie = 'XSRF-TOKEN=test-token';
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); document.cookie = 'XSRF-TOKEN=;max-age=0'; });

const note: Note = { id: 'note', spaceId: 'space', title: 'Note', revision: 1, bodyOrigin: 'HUMAN', bodyJson: { type: 'doc', content: [] }, visibility: 'PRIVATE', parentId: null, canEdit: true };
interface CreateInput { spaceId: string; title: string; body: string; visibility: Visibility; idempotencyKey: string }
interface CommentInput { body: string; idempotencyKey: string }

function server(loseNextResponse = true) {
  const creates: CreateInput[] = [];
  const comments: { noteId: string; input: CommentInput }[] = [];
  const savedNotes: { id: string; input: CreateInput }[] = [];
  const savedComments: { id: string; noteId: string; body: string; createdAt: string; authorName: string }[] = [];
  const reply = (data: object) => new Response(JSON.stringify({ data }));
  vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => {
    const { query, variables } = JSON.parse(String(init.body));
    if (query.includes('createKnowledgeNote')) {
      const input: CreateInput = variables.input;
      creates.push(input);
      let saved = savedNotes.find(value => value.input.idempotencyKey === input.idempotencyKey);
      if (!saved) { saved = { id: `created-${savedNotes.length + 1}`, input }; savedNotes.push(saved); }
      if (loseNextResponse) { loseNextResponse = false; throw new TypeError('Response lost after commit'); }
      return reply({ createKnowledgeNote: { ...note, ...saved.input, id: saved.id, ownerId: 'owner', richBody: null } });
    }
    if (query.includes('addNoteComment')) {
      const input: CommentInput = variables.input;
      comments.push({ noteId: variables.noteId, input });
      let saved = savedComments.find(value => value.id === input.idempotencyKey);
      if (!saved) { saved = { id: input.idempotencyKey, noteId: variables.noteId, body: input.body, createdAt: '2026-10-23T00:00:00Z', authorName: 'Member' }; savedComments.push(saved); }
      if (loseNextResponse) { loseNextResponse = false; throw new TypeError('Response lost after commit'); }
      return reply({ addNoteComment: { id: saved.id } });
    }
    if (query.includes('noteComments')) return reply({ noteComments: savedComments.filter(value => value.noteId === variables.noteId) });
    if (query.includes('knowledgeCurrentItems')) return reply({ knowledgeCurrentItems: { noteId: variables.noteId, revision: 1, items: [], bodyOrigin: 'HUMAN', hasNext: false } });
    if (query.includes('knowledgeNote(')) return reply({ knowledgeNote: { ...note, id: variables.id, ownerId: 'owner', richBody: null, body: '', revision: 1 + savedComments.length } });
    if (query.includes('noteTree')) return reply({ noteTree: [] });
    if (query.includes('spaces')) return reply({ spaces: [{ id: 'space', name: 'Space', accessEpoch: 1, myRole: 'OWNER' }, { id: 'other', name: 'Other', accessEpoch: 1, myRole: 'OWNER' }] });
    throw new Error(`Unexpected GraphQL operation: ${query}`);
  });
  return { creates, comments, savedNotes, savedComments };
}

async function showTree(spaceId = 'space') {
  const view = render(<MantineProvider env="test"><NoteTree api={api} spaceId={spaceId} activeNoteId={null} onOpen={vi.fn()}/></MantineProvider>);
  await screen.findByText('이 경로에 노트가 없습니다.');
  return view;
}
async function createNote(title: string) {
  const field = await waitFor(() => {
    const textbox = screen.getByRole('textbox', { name: '새 노트 제목' });
    expect(textbox.getAttribute('disabled')).toBeNull();
    return textbox;
  });
  fireEvent.change(field, { target: { value: title } });
  const submit = await waitFor(() => {
    const button = screen.getByRole('button', { name: '현재 경로에 만들기' });
    expect(button.getAttribute('disabled')).toBeNull();
    return button;
  });
  fireEvent.click(submit);
}
async function showComments() {
  render(<MantineProvider env="test"><NotePanels api={api} note={note} dirty={false} onRestore={vi.fn()} onOpen={vi.fn()} onRevision={vi.fn()}/></MantineProvider>);
  await screen.findByText('아직 댓글이 없습니다.');
}

it('publishes a saved comment only after loading its matching note revision', async () => {
  server(false);
  let finish!: (value: Note) => void;
  const read = vi.spyOn(api, 'note').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  try {
    await showComments();
    await postComment('Saved before revision');
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(within(screen.getByRole('tabpanel', { name: '댓글 목록' })).queryByText('Saved before revision')).toBeNull();
    finish({ ...note, revision: 2 });
    await waitFor(() => expect(within(screen.getByRole('tabpanel', { name: '댓글 목록' })).getByText('Saved before revision')).toBeTruthy());
  } finally { read.mockRestore(); }
});
async function postComment(body: string) {
  const field = await waitFor(() => {
    const textbox = screen.getByRole('textbox', { name: '댓글' });
    expect(textbox.getAttribute('contenteditable')).toBe('true');
    return textbox;
  });
  field.querySelector('p')!.textContent = body; fireEvent.input(field);
  await waitFor(() => expect(screen.getByRole('button', { name: '댓글 남기기' }).getAttribute('disabled')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '댓글 남기기' }));
}

it('retries a committed private note with the same request and starts a new request after acknowledgement', async () => {
  const value = server(); await showTree();
  fireEvent.click(screen.getByRole('combobox', { name: '공유 범위' }));
  fireEvent.click(await screen.findByRole('option', { name: '나만 보기' }));
  await createNote('Private title');
  await screen.findByRole('alert');
  expect((screen.getByRole('textbox', { name: '새 노트 제목' }) as HTMLInputElement).value).toBe('Private title');
  fireEvent.click(screen.getByRole('button', { name: '현재 경로에 만들기' }));
  await waitFor(() => expect((screen.getByRole('textbox', { name: '새 노트 제목' }) as HTMLInputElement).value).toBe(''));
  expect(value.savedNotes).toHaveLength(1);
  expect(value.creates).toHaveLength(2);
  expect(value.creates[1]).toEqual(value.creates[0]);
  expect(value.creates[0].visibility).toBe('PRIVATE');
  await createNote('Private title');
  await waitFor(() => expect(value.creates).toHaveLength(3));
  expect(value.savedNotes).toHaveLength(2);
  expect(value.creates[2].idempotencyKey).not.toBe(value.creates[0].idempotencyKey);
});

it('uses a new creation identity when the member deliberately replaces the title and visibility', async () => {
  const value = server(); await showTree();
  await createNote('First title'); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('combobox', { name: '공유 범위' }));
  fireEvent.click(await screen.findByRole('option', { name: '나만 보기' }));
  await createNote('Replacement title');
  await waitFor(() => expect(value.creates).toHaveLength(2));
  expect(value.savedNotes.map(value => [value.input.title, value.input.visibility])).toEqual([['First title', 'SPACE'], ['Replacement title', 'PRIVATE']]);
  expect(value.creates[1].idempotencyKey).not.toBe(value.creates[0].idempotencyKey);
});

it('does not replay a failed creation into a different space', async () => {
  const value = server(); const view = await showTree();
  await createNote('Title'); await screen.findByRole('alert');
  view.rerender(<MantineProvider env="test"><NoteTree api={api} spaceId="other" activeNoteId={null} onOpen={vi.fn()}/></MantineProvider>);
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '현재 경로에 만들기' }));
  await waitFor(() => expect(value.creates).toHaveLength(2));
  expect(value.creates[1].spaceId).toBe('other');
  expect(value.creates[1].idempotencyKey).not.toBe(value.creates[0].idempotencyKey);
});

it('retries a committed comment once and allows the same text as a new acknowledged operation', async () => {
  const value = server(); await showComments();
  await postComment('Comment body'); await screen.findByRole('alert');
  expect(screen.getByRole('textbox', { name: '댓글' }).textContent).toBe('Comment body');
  fireEvent.click(screen.getByRole('button', { name: '댓글 남기기' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '댓글' }).textContent).toBe(''));
  expect(value.savedComments).toHaveLength(1);
  expect(value.comments).toHaveLength(2);
  expect(value.comments[1]).toEqual(value.comments[0]);
  await postComment('Comment body');
  await waitFor(() => expect(value.comments).toHaveLength(3));
  expect(value.savedComments).toHaveLength(2);
  expect(value.comments[2].input.idempotencyKey).not.toBe(value.comments[0].input.idempotencyKey);
});

it('uses a new comment identity when the member deliberately replaces its body', async () => {
  const value = server(); await showComments();
  await postComment('First comment'); await screen.findByRole('alert');
  await postComment('Replacement comment');
  await waitFor(() => expect(value.comments).toHaveLength(2));
  expect(value.savedComments.map(value => value.body)).toEqual(['First comment', 'Replacement comment']);
  expect(value.comments[1].input.idempotencyKey).not.toBe(value.comments[0].input.idempotencyKey);
});
