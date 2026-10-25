// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { graphql } from './transport';
vi.mock('./transport', async importOriginal => ({ ...await importOriginal<typeof import('./transport')>(), graphql: vi.fn() }));
afterEach(() => vi.clearAllMocks());
it('uses the server current-knowledge page and never derives its membership from history', async () => {
  const item = { id: 'current-operation', body: 'Still tentative.', claimKind: 'INFERENCE', evidence: [], rules: [] };
  vi.mocked(graphql).mockResolvedValueOnce({ knowledgeCurrentItems: { noteId: 'note', revision: 8, bodyOrigin: 'HUMAN', items: [item], hasNext: true } });
  expect(await api.currentKnowledge('note', '20')).toEqual({ noteId: 'note', revision: 8, bodyOrigin: 'HUMAN', items: [item], nextCursor: '40' });
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('knowledgeCurrentItems(noteId:$noteId,offset:$offset,limit:20)'), { noteId: 'note', offset: 20 });
});
it('uses authored plain text for editing even when the compatibility body contains AI knowledge', async () => {
  vi.mocked(graphql).mockResolvedValueOnce({ knowledgeNote: { id: 'note', spaceId: 'space', ownerId: 'owner', title: 'Human title', revision: 9, richBody: null, authoredBody: '', body: 'AI current text', bodyOrigin: 'HUMAN', visibility: 'SPACE', parentId: null, canEdit: true } });
  const note = await api.note('note');
  expect(JSON.stringify(note.bodyJson)).not.toContain('AI current text');
  expect(note.bodyOrigin).toBe('HUMAN');
});
it('reads revision authored text and preserves its legacy classification for restore', async () => {
  vi.mocked(graphql).mockResolvedValueOnce({ noteRevisions: [{ id: 'revision', revision: 2, title: 'Original', createdAt: '2026-10-23T08:00:00Z', richBody: null, authoredBody: 'Preserved original', body: 'Preserved original\nAI text', bodyOrigin: 'LEGACY_UNCLASSIFIED' }] });
  const history = await api.history('note', null);
  expect(JSON.stringify(history.items[0].bodyJson)).not.toContain('AI text');
  expect(history.items[0].bodyOrigin).toBe('LEGACY_UNCLASSIFIED');
});
it('reads bounded authorized accumulation pages with source scope and dates intact', async () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}`, evidence: [{ visibility: 'ADMINISTRATORS', occurredAt: null, effectiveAt: null }] }));
  vi.mocked(graphql).mockResolvedValueOnce({ knowledgeAccumulations: items });
  expect(await api.accumulations('note', '20')).toEqual({ items, nextCursor: '40' });
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('limit:20'), { noteId: 'note', offset: 20 });
  expect(vi.mocked(graphql).mock.calls[0][0]).toContain('occurredAt effectiveAt visibility');
});
it('reads the selected applied change with its exact comparison and rule conditions', async () => {
  const change = { before: null, after: null, operationBody: 'Recorded change', preserveHumanFields: true, requireEvidence: true, excludePrivateExamples: true, reviewPolicy: 'REVIEW', allowedDocumentTypes: [] };
  vi.mocked(graphql).mockResolvedValueOnce({ knowledgeAccumulationChange: change });
  expect(await api.accumulationChange('item')).toEqual(change);
  expect(graphql).toHaveBeenLastCalledWith(expect.stringContaining('knowledgeAccumulationChange(id:$id)'), { id: 'item' });
});
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
  const value = await api.provenance({ id: 'note', spaceId: 'space', title: 'Note', revision: 1, bodyOrigin: 'HUMAN', bodyJson: { type: 'doc' }, visibility: 'SPACE', canEdit: true, parentId: null });
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

it('pages all authorized immutable file revisions using the last file ID as the cursor', async () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    id: `file-${index}`, fileName: 'Imported drawing.pdf', mediaType: 'application/pdf',
    byteSize: 248710446, checksum: 'a'.repeat(64), revision: index + 1,
    previousId: index ? `file-${index - 1}` : null, createdAt: '2026-10-25T04:00:00Z',
  }));
  vi.mocked(graphql).mockResolvedValueOnce({ noteFiles: items });
  expect(await api.files('note', 'previous-page')).toEqual({ items, nextCursor: 'file-49' });
  expect(graphql).toHaveBeenLastCalledWith(
    expect.stringContaining('noteFiles(noteId:$noteId,after:$after,limit:50){id fileName mediaType byteSize checksum revision previousId createdAt}'),
    { noteId: 'note', after: 'previous-page' },
  );
  vi.mocked(graphql).mockResolvedValueOnce({ noteFiles: [items[0]] });
  expect(await api.files('note', 'file-49')).toEqual({ items: [items[0]], nextCursor: null });
});
