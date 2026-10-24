import { describe, expect, it } from 'vitest';
import { acceptMetadata, acceptSave, canClose, editDraft, openDraft, prepareSave, reorder } from './paneState';
import type { Note } from './model';

const note: Note = { id: 'note', spaceId: 'space', title: 'Title', revision: 1, bodyOrigin: 'HUMAN', bodyJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original' }] }] }, visibility: 'PRIVATE', canEdit: true, parentId: null };
describe('pane draft ownership', () => {
  it('keeps independent drafts for the same note in two panes', () => {
    const left = editDraft(openDraft(note), { title: 'Left title' });
    const right = openDraft(note);
    left.body.content![0].content![0].text = 'Left only';
    expect(right.title).toBe('Title');
    expect(right.body.content![0].content![0].text).toBe('Original');
    expect(note.bodyJson.content![0].content![0].text).toBe('Original');
  });
  it('retains a stable idempotency key and submitted snapshot on retry', () => {
    const first = prepareSave(editDraft(openDraft(note), { title: 'First' }));
    const newer = editDraft(first, { title: 'Newer while request is pending' });
    const retry = prepareSave(newer);
    expect(retry.pending?.input.idempotencyKey).toBe(first.pending?.input.idempotencyKey);
    expect(retry.pending?.input.title).toBe('First');
    const accepted = acceptSave(retry, { ...note, title: 'First', revision: 2 }, first.pending!.version);
    expect(accepted.title).toBe('Newer while request is pending');
    expect(accepted.dirty).toBe(true);
    expect(prepareSave(accepted).pending?.input.expectedRevision).toBe(2);
  });
  it('retains dirty state when close is cancelled and reorders without losing a draft', () => {
    const draft = editDraft(openDraft(note), { title: 'Unsaved' });
    expect(canClose(draft, () => false)).toBe(false);
    expect(draft.title).toBe('Unsaved');
    expect(reorder(['one', 'two', 'three'], 0, 2)).toEqual(['two', 'three', 'one']);
  });
  it('advances comment revisions only when the server body has not changed', () => {
    const dirty = editDraft(openDraft(note), { title: 'My pending title' });
    expect(acceptMetadata(dirty, { ...note, revision: 2 }).note.revision).toBe(2);
    expect(acceptMetadata(dirty, { ...note, title: 'Another author', revision: 3 }).note.revision).toBe(1);
    expect(acceptMetadata(dirty, { ...note, revision: 2 }).title).toBe('My pending title');
  });
});
