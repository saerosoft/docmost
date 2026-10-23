// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { graphql } from './transport';
vi.mock('./transport', async importOriginal => ({ ...await importOriginal<typeof import('./transport')>(), graphql: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it('submits a cross-space move with loaded revisions and preserves the destination parent', async () => {
  vi.mocked(graphql).mockResolvedValueOnce({ knowledgeNote: { id: 'note', spaceId: 'source', ownerId: 'owner', title: 'Note', revision: 7, richBody: null, body: '', visibility: 'PRIVATE', parentId: null, canEdit: true } });
  vi.mocked(graphql).mockResolvedValueOnce({ moveNotes: true });
  await api.move(['note'], 'parent', 'destination');
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('moveNotes'), { input: { spaceId: 'destination', parentId: 'parent', items: [{ id: 'note', expectedRevision: 7 }] } });
});
it('deletes the exact property under its note revision and requires an acknowledgement', async () => {
  vi.mocked(graphql).mockResolvedValueOnce({ deleteNoteProperty: true });
  await api.deleteProperty('note', 'property', 3);
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('deleteNoteProperty'), { id: 'property', input: { noteId: 'note', expectedRevision: 3 } });
  vi.mocked(graphql).mockResolvedValueOnce({ deleteNoteProperty: false });
  await expect(api.deleteProperty('note', 'property', 4)).rejects.toMatchObject({ code: 'DELETE_NOT_ACKNOWLEDGED' });
});
it('shows the comment author by display name and never by account ID', async () => {
  vi.mocked(graphql).mockResolvedValueOnce({ noteComments: [
    { id: 'c1', body: 'Named', createdAt: '2026-10-23T00:00:00Z', authorName: 'Local owner' },
    { id: 'c2', body: 'Unknown', createdAt: '2026-10-23T00:00:00Z', authorName: null },
  ] });
  const page = await api.comments('note', null);
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('authorName'), { noteId: 'note', offset: 0 });
  expect(page.items.map(item => item.authorName)).toEqual(['Local owner', '알 수 없는 사용자']);
});
it('collects the sources, rules, reviews and actions of a note without duplicates', async () => {
  const accumulation = {
    changeSetId: 'set', spaceId: 'space', title: 'Added',
    evidence: [{ revisionId: 'rev', spaceId: 'space', title: 'Chat' }],
    rules: [{ rulesetId: 'rules', versionId: 'v1', name: 'R-OPS', versionNumber: 2 }],
  };
  vi.mocked(graphql).mockResolvedValueOnce({
    knowledgeAccumulations: [accumulation, accumulation],
    reviewProposals: [{ id: 'proposal', spaceId: 'space', reason: 'Edit', status: 'PENDING' }],
    noteActions: [{ id: 'action', spaceId: 'space', title: 'Follow up' }],
  });
  const value = await api.provenance({ id: 'note', spaceId: 'space', title: 'Note', revision: 1, bodyJson: { type: 'doc' }, visibility: 'SPACE', canEdit: true, parentId: null });
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('noteActions'), { spaceId: 'space', noteId: 'note' });
  expect(value).toEqual({
    sources: [{ revisionId: 'rev', spaceId: 'space', title: 'Chat' }],
    rules: [{ rulesetId: 'rules', versionId: 'v1', spaceId: 'space', label: 'R-OPS v2' }],
    reviews: [
      { id: 'proposal', spaceId: 'space', title: 'Edit', kind: 'proposal', status: 'PENDING' },
      { id: 'set', spaceId: 'space', title: 'Added', kind: 'changeSet', status: null },
    ],
    actions: [{ id: 'action', spaceId: 'space', title: 'Follow up' }],
  });
});
