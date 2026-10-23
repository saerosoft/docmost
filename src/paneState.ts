import type { JSONContent } from '@tiptap/core';
import type { Note, SaveNote } from './model';

export interface Draft {
  note: Note; title: string; body: JSONContent; dirty: boolean;
  version: number; pending?: { input: SaveNote; version: number };
}
export function openDraft(note: Note): Draft {
  return { note: structuredClone(note), title: note.title, body: structuredClone(note.bodyJson), dirty: false, version: 0 };
}
export function editDraft(draft: Draft, patch: { title?: string; body?: JSONContent }): Draft {
  return { ...draft, ...patch, dirty: true, version: draft.version + 1 };
}
export function prepareSave(draft: Draft): Draft {
  if (draft.pending) return draft;
  return { ...draft, pending: { input: { title: draft.title, bodyJson: structuredClone(draft.body), expectedRevision: draft.note.revision, idempotencyKey: crypto.randomUUID() }, version: draft.version } };
}
export function acceptSave(draft: Draft, note: Note, savedVersion: number): Draft {
  if (draft.version === savedVersion) return openDraft(note);
  return { ...draft, note, pending: undefined, dirty: true };
}
export function acceptMetadata(draft: Draft, note: Note): Draft {
  if (draft.note.title !== note.title || JSON.stringify(draft.note.bodyJson) !== JSON.stringify(note.bodyJson)) {
    // Keep the content revision for conflict checks while accepting current access and location metadata.
    return { ...draft, note: { ...draft.note, spaceId: note.spaceId, parentId: note.parentId, visibility: note.visibility, canEdit: note.canEdit } };
  }
  return { ...draft, note };
}
export function canClose(draft: Draft | undefined, confirm: () => boolean) {
  return !draft?.dirty || confirm();
}
export function reorder<T>(values: readonly T[], from: number, to: number) {
  const result = [...values];
  if (from < 0 || to < 0 || from >= result.length || to >= result.length) return result;
  const [item] = result.splice(from, 1); result.splice(to, 0, item); return result;
}
