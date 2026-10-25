// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note, NoteApi, Page, Relation, RelationEvidence } from './model';
import { NoteRelations } from './NoteRelations';
import { ApiError, clearAccess } from './transport';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function fixture(canEdit = true) {
  const note: Note = { id: 'note', spaceId: 'space', title: 'Title', revision: 4, bodyOrigin: 'HUMAN', bodyJson: { type: 'doc', content: [{ type: 'paragraph' }] }, visibility: 'SPACE', parentId: null, canEdit };
  const proposed: Relation = {
    id: 'relation', targetNoteId: 'target', title: 'Contract', predicate: 'SUPERSEDES', legacyPredicate: null, kind: 'INFERRED',
    reviewState: 'PROPOSED', revision: 1, validFrom: '2026-01-01T00:00:00Z', validTo: null, evidenceCount: 2, provenance: 'source-revision:raw', actorLabel: 'Relation author', direction: 'OUTGOING',
  };
  const legacy: Relation = { ...proposed, id: 'legacy', predicate: 'RELATED_TO', legacyPredicate: 'DEPENDS_ON', kind: 'RECORDED', reviewState: 'ACCEPTED', validFrom: null, evidenceCount: 0 };
  const relations = vi.fn().mockResolvedValue({ items: [proposed, legacy], nextCursor: null });
  const decideRelation = vi.fn().mockResolvedValue(undefined);
  const relate = vi.fn().mockResolvedValue(undefined);
  const findNotes = vi.fn().mockResolvedValue([{ id: 'note', title: 'Title' }, { id: 'target', title: 'Target note' }]);
  const findRelationNotes = vi.fn().mockResolvedValue({ noteId: 'note', total: 1, items: [{ id: 'target', title: 'Target note' }], nextCursor: null });
  const api = { relations, decideRelation, relate, findNotes, findRelationNotes, note: vi.fn().mockResolvedValue({ ...note, revision: 5 }) } as unknown as NoteApi;
  const onRevision = vi.fn();
  return { note, api, relations, decideRelation, relate, findNotes, findRelationNotes, onRevision };
}
function show(value: ReturnType<typeof fixture>) {
  return render(<MantineProvider><NoteRelations api={value.api} note={value.note} onOpen={vi.fn()} onRevision={value.onRevision}/></MantineProvider>);
}
it('shows the recorded provenance and author of the relation', async () => {
  const value = fixture();
  Object.assign(value.api, { relations: vi.fn().mockResolvedValue({ items: [{ ...((await value.relations()).items[0]), actorLabel: 'Relation author', direction: 'OUTGOING' }], nextCursor: null }) });
  show(value);
  expect(await screen.findByText('source-revision:raw')).toBeTruthy();
  expect(screen.getByText('기록자: Relation author')).toBeTruthy();
  expect(screen.getByText('이 노트 → 연결된 노트')).toBeTruthy();
});
it('opens the actual source proof only when requested', async () => {
  const value = fixture();
  const relationEvidence = vi.fn().mockResolvedValue({ items: [{ id: 'span', sourceRevisionId: 'original', sourceRevision: 2, spaceId: 'space', sourceTitle: '계약서 원문', locator: 'paragraph:3', excerpt: '서명된 계약서가 초안을 대체합니다.', excerptTruncated: false }], nextCursor: null });
  Object.assign(value.api, { relationEvidence });
  show(value);
  await screen.findAllByRole('button', { name: 'Contract' });
  expect(relationEvidence).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '관계 근거 보기' }));
  expect(await screen.findByText('서명된 계약서가 초안을 대체합니다.')).toBeTruthy();
  expect(screen.getByText(/paragraph:3/)).toBeTruthy();
  expect(screen.getByRole('link', { name: '계약서 원문' }).getAttribute('href')).toContain('/spaces/space/source-revisions/original');
  expect(relationEvidence).toHaveBeenCalledExactlyOnceWith('relation', null);
});
it('discards a late supporting original after its panel is closed', async () => {
  const value = fixture();
  let finish!: (page: Page<RelationEvidence>) => void;
  Object.assign(value.api, { relationEvidence: vi.fn().mockImplementation(() => new Promise<Page<RelationEvidence>>(resolve => { finish = resolve; })) });
  show(value);
  fireEvent.click(await screen.findByRole('button', { name: '관계 근거 보기' }));
  fireEvent.click(screen.getByRole('button', { name: '관계 근거 접기' }));
  await act(async () => { finish({ items: [{ id: 'late', sourceRevisionId: 'original', sourceRevision: 1, spaceId: 'space', sourceTitle: 'Late original', locator: 'paragraph:0', excerpt: 'Late secret quote', excerptTruncated: false }], nextCursor: null }); });
  expect(screen.queryByText('Late secret quote')).toBeNull();
});
it('removes opened supporting originals on access loss and rejects a late refresh', async () => {
  const value = fixture();
  const first: Page<RelationEvidence> = { items: [{ id: 'span', sourceRevisionId: 'original', sourceRevision: 1, spaceId: 'space', sourceTitle: 'Restricted original', locator: 'paragraph:0', excerpt: 'Previously readable quote', excerptTruncated: false }], nextCursor: null };
  let finish!: (page: Page<RelationEvidence>) => void;
  const relationEvidence = vi.fn().mockResolvedValueOnce(first).mockImplementation(() => new Promise<Page<RelationEvidence>>(resolve => { finish = resolve; }));
  Object.assign(value.api, { relationEvidence });
  show(value);
  fireEvent.click(await screen.findByRole('button', { name: '관계 근거 보기' }));
  await screen.findByText('Previously readable quote');
  fireEvent.click(screen.getByRole('button', { name: '근거 새로고침' }));
  act(() => clearAccess());
  expect(screen.queryByText('Previously readable quote')).toBeNull();
  await act(async () => { finish(first); });
  expect(screen.queryByText('Previously readable quote')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('접근 권한이 변경되었습니다.');
});
it('shows the typed predicate, kind, review state, validity and legacy label', async () => {
  show(fixture());
  expect(await screen.findByText(/대체 · 추론 · 검토 대기/)).toBeTruthy();
  expect(screen.getByText(/근거 2건/)).toBeTruthy();
  expect(screen.getByText(/관련 · 기록 · 확정 · 이전 표기 DEPENDS_ON/)).toBeTruthy();
});
it('decides a proposed relation against its revision with the given reason', async () => {
  const value = fixture(); show(value);
  vi.spyOn(window, 'prompt').mockReturnValue('계약서로 확인');
  fireEvent.click(await screen.findByRole('button', { name: '관계 확정' }));
  await waitFor(() => expect(value.decideRelation).toHaveBeenCalledExactlyOnceWith('relation', 1, 'ACCEPTED', '계약서로 확인'));
  await waitFor(() => expect(value.relations).toHaveBeenCalledTimes(2));
});
it('records a typed relation to a note picked by title with its validity and refreshes the note revision', async () => {
  const value = fixture(); show(value);
  expect(screen.getByRole('button', { name: '관계 추가' })).toHaveProperty('disabled', true);
  fireEvent.change(await screen.findByRole('textbox', { name: '연결할 노트' }), { target: { value: 'Tar' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Target note' }));
  expect(value.findRelationNotes).toHaveBeenLastCalledWith('note', 'Tar', null);
  expect(value.findNotes).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Title' })).toBeNull();
  fireEvent.change(screen.getByLabelText('효력 시작'), { target: { value: '2026-03-01' } });
  fireEvent.click(screen.getByRole('button', { name: '관계 추가' }));
  await waitFor(() => expect(value.relate).toHaveBeenCalledExactlyOnceWith('note', 'target', 'RELATED_TO', { validFrom: '2026-03-01T00:00:00.000Z', validTo: null }));
  await waitFor(() => expect(value.onRevision).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 })));
});
it('offers no decisions to a reader', async () => {
  show(fixture(false));
  await screen.findByText(/대체 · 추론 · 검토 대기/);
  expect(screen.queryByRole('button', { name: '관계 확정' })).toBeNull();
  expect(screen.queryByRole('button', { name: '관계 추가' })).toBeNull();
});

it('binds a stale target rejection to the selected note and preserves the other relationship inputs', async () => {
  const value = fixture();
  value.relate.mockRejectedValueOnce(new ApiError('입력한 값을 확인해 주세요.', 'INVALID_INPUT', 'toNoteId'));
  show(value);
  fireEvent.change(await screen.findByRole('textbox', { name: '연결할 노트' }), { target: { value: 'Tar' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Target note' }));
  fireEvent.change(screen.getByLabelText('효력 시작'), { target: { value: '2026-03-01' } });
  fireEvent.click(screen.getByRole('button', { name: '관계 추가' }));
  expect(await screen.findByText('연결할 노트를 다시 선택해 주세요. 입력한 값을 확인해 주세요.')).toBeTruthy();
  expect(screen.getByLabelText('효력 시작')).toHaveProperty('value', '2026-03-01');
  expect(value.onRevision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '다시 선택' }));
  expect(screen.getByRole('textbox', { name: '연결할 노트' })).toBeTruthy();
  expect(screen.queryByText('연결할 노트를 다시 선택해 주세요. 입력한 값을 확인해 주세요.')).toBeNull();
});
it('addresses a private anchor through the same server selector without supplying a client-chosen owner or visibility', async () => {
  const value = fixture();
  value.note = { ...value.note, visibility: 'PRIVATE' };
  show(value);
  fireEvent.change(await screen.findByRole('textbox', { name: '연결할 노트' }), { target: { value: 'Tar' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Target note' }));
  expect(value.findRelationNotes).toHaveBeenLastCalledWith('note', 'Tar', null);
  expect(value.findNotes).not.toHaveBeenCalled();
});

function expectRevokedRelationPanel() {
  expect(screen.getByRole('alert').textContent).toBe('접근 권한이 변경되었습니다. 노트를 다시 열어 주세요.');
  expect(screen.queryByRole('button', { name: 'Contract' })).toBeNull();
  expect(screen.queryByText('source-revision:raw')).toBeNull();
  expect(screen.queryByText('Target note')).toBeNull();
  expect(screen.queryByRole('textbox', { name: '연결할 노트' })).toBeNull();
  expect(screen.queryByLabelText('효력 시작')).toBeNull();
  expect(screen.queryByLabelText('효력 종료')).toBeNull();
  expect(screen.queryByRole('button', { name: '관계 추가' })).toBeNull();
  expect(screen.queryByRole('button', { name: '관계 확정' })).toBeNull();
}
it('latches access loss for the entire relation panel and blocks stale form and decision handlers', async () => {
  const value = fixture();
  const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Previously prepared reason');
  const view = show(value);
  fireEvent.change(await screen.findByRole('textbox', { name: '연결할 노트' }), { target: { value: 'Tar' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Target note' }));
  fireEvent.change(screen.getByLabelText('효력 시작'), { target: { value: '2026-03-01' } });
  fireEvent.change(screen.getByLabelText('효력 종료'), { target: { value: '2026-04-01' } });
  const form = screen.getByRole('button', { name: '관계 추가' }).closest('form')!;
  const decide = screen.getByRole('button', { name: '관계 확정' });
  const reads = value.relations.mock.calls.length;
  act(() => { clearAccess(); fireEvent.submit(form); fireEvent.click(decide); });
  expectRevokedRelationPanel();
  expect(value.relate).not.toHaveBeenCalled();
  expect(value.decideRelation).not.toHaveBeenCalled();
  expect(prompt).not.toHaveBeenCalled();
  view.rerender(<MantineProvider><NoteRelations api={value.api} note={{ ...value.note, revision: 5 }} onOpen={vi.fn()} onRevision={value.onRevision}/></MantineProvider>);
  expectRevokedRelationPanel();
  expect(value.relations).toHaveBeenCalledTimes(reads);
});
it('does not render a relation list that arrives after access loss', async () => {
  const value = fixture();
  const retained: Page<Relation> = await value.relations();
  let finish!: (page: Page<Relation>) => void;
  value.relations.mockReset().mockImplementation(() => new Promise<Page<Relation>>(resolve => { finish = resolve; }));
  show(value);
  await waitFor(() => expect(value.relations).toHaveBeenCalledOnce());
  act(() => clearAccess());
  await act(async () => { finish(retained); });
  expectRevokedRelationPanel();
  expect(screen.queryByRole('status')).toBeNull();
});
it('stops relation-creation follow-up reads when access is lost before the write acknowledgement', async () => {
  const value = fixture();
  let finish!: () => void;
  value.relate.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  show(value);
  fireEvent.change(await screen.findByRole('textbox', { name: '연결할 노트' }), { target: { value: 'Tar' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Target note' }));
  fireEvent.click(screen.getByRole('button', { name: '관계 추가' }));
  await waitFor(() => expect(value.relate).toHaveBeenCalledOnce());
  act(() => clearAccess());
  await act(async () => { finish(); });
  expectRevokedRelationPanel();
  expect(value.relations).toHaveBeenCalledOnce();
  expect(value.api.note).not.toHaveBeenCalled();
  expect(value.onRevision).not.toHaveBeenCalled();
});
it('does not deliver a late note refresh to the parent after access has been lost', async () => {
  const value = fixture();
  let finish!: (note: Note) => void;
  vi.mocked(value.api.note).mockImplementation(() => new Promise<Note>(resolve => { finish = resolve; }));
  show(value);
  fireEvent.change(await screen.findByRole('textbox', { name: '연결할 노트' }), { target: { value: 'Tar' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Target note' }));
  fireEvent.click(screen.getByRole('button', { name: '관계 추가' }));
  await waitFor(() => expect(value.api.note).toHaveBeenCalledOnce());
  act(() => clearAccess());
  await act(async () => { finish({ ...value.note, revision: 5 }); });
  expectRevokedRelationPanel();
  expect(value.onRevision).not.toHaveBeenCalled();
});
it('stops decision follow-up reads when access is lost while approval is pending', async () => {
  const value = fixture();
  let finish!: () => void;
  value.decideRelation.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  vi.spyOn(window, 'prompt').mockReturnValue('Verified before permission changed');
  show(value);
  fireEvent.click(await screen.findByRole('button', { name: '관계 확정' }));
  await waitFor(() => expect(value.decideRelation).toHaveBeenCalledOnce());
  act(() => clearAccess());
  await act(async () => { finish(); });
  expectRevokedRelationPanel();
  expect(value.relations).toHaveBeenCalledOnce();
  expect(value.onRevision).not.toHaveBeenCalled();
});
