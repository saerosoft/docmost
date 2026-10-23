// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Note, NoteApi, NoteAccumulation } from './model';
import { NoteKnowledgeContext } from './NoteKnowledgeContext';
import { NoteAccumulations } from './NoteAccumulations';

afterEach(cleanup);

const note: Note = { id: 'note-a', spaceId: 'space', title: 'Human notes', revision: 4, bodyJson: { type: 'doc' }, visibility: 'SPACE', parentId: null, canEdit: true };
const item: NoteAccumulation = {
  id: 'item', spaceId: 'space', changeSetId: 'change', kind: 'APPEND_NOTE', title: 'Meeting follow-up',
  preview: 'The date is tentative and needs confirmation.', appliedAt: '2026-10-23T08:00:00Z', actorName: 'Editor',
  automatic: false, reviewerName: 'Reviewer', resultRevision: 4, evidenceCount: 2,
  evidence: [
    { id: 'proof', revisionId: 'source', spaceId: 'space', title: 'Personal memo', locator: 'paragraph 2', quote: 'Tentative date', quoteTruncated: true, occurredAt: '2026-10-22T08:00:00Z', effectiveAt: null, visibility: 'PRIVATE' },
    { id: 'restricted', revisionId: 'admin-source', spaceId: 'space', title: 'Restricted memo', locator: 'paragraph 3', quote: 'Needs confirmation', quoteTruncated: false, occurredAt: null, effectiveAt: null, visibility: 'ADMINISTRATORS' },
  ],
  rules: [{ rulesetId: 'rules', versionId: 'v2', name: 'Update policy', versionNumber: 2 }],
};

function fixture() {
  const accumulations = vi.fn().mockResolvedValue({ items: [item], nextCursor: null });
  const accumulationChange = vi.fn().mockResolvedValue({
    operationBody: 'Append the tentative date.', before: { revision: 3, title: 'Before', body: 'Original human text' },
    after: { revision: 4, title: 'After', body: 'Original human text\nTentative date' },
    preserveHumanFields: true, requireEvidence: true, excludePrivateExamples: true, reviewPolicy: 'REVIEW', allowedDocumentTypes: ['text/plain'],
  });
  const provenance = vi.fn().mockResolvedValue({ sources: [], rules: [], reviews: [], actions: [] });
  return { accumulations, accumulationChange, api: { accumulations, accumulationChange, provenance } as unknown as NoteApi };
}

function NoteContext({ api, note }: { api: NoteApi; note: Note }) {
  return <><NoteAccumulations key={`${note.id}:${note.revision}`} api={api} noteId={note.id}/><NoteKnowledgeContext api={api} note={note}/></>;
}

function show(api: NoteApi, value = note) {
  return render(<NoteContext api={api} note={value}/>);
}

it('shows recorded knowledge, source visibility and distinct source and application times beside the human editor', async () => {
  const value = fixture(); show(value.api);
  expect(await screen.findByText(item.preview)).toBeTruthy();
  expect(screen.getByRole('heading', { name: '새 소스 반영 기준' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: '현재 정리' })).toBeTruthy();
  expect(screen.getByText('본인만')).toBeTruthy();
  expect(screen.getByText('관리자 전용')).toBeTruthy();
  expect(screen.getAllByText(/효력 시점 미상/)).toHaveLength(2);
  expect(within(screen.getByRole('region', { name: '현재 정리' })).getAllByText(/원본 발생/)).toHaveLength(2);
  expect(screen.getByText(/반영 시각/)).toBeTruthy();
  expect(screen.getByText(/원문 일부/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Personal memo' }).getAttribute('href')).toContain('/spaces/space/source-revisions/source');
  expect(screen.getByRole('link', { name: '갱신 검토·미결' }).getAttribute('href')).toContain('/knowledge/conflicts?note=note-a');
  expect(value.accumulationChange).not.toHaveBeenCalled();
});

it('loads the saved comparison and actual rule conditions only when opened', async () => {
  const value = fixture(); show(value.api);
  fireEvent.click(await screen.findByRole('button', { name: '변경 전후·반영 기준 보기' }));
  expect(await screen.findByText('Original human text')).toBeTruthy();
  expect(screen.getByText('Original human text\nTentative date', { exact: true, normalizer: value => value })).toBeTruthy();
  expect(screen.getByText('사람 편집 보존')).toBeTruthy();
  expect(screen.getByText('근거 필수')).toBeTruthy();
  expect(screen.getByText('반영 정책: 검토 후 반영')).toBeTruthy();
  expect(value.accumulationChange).toHaveBeenCalledExactlyOnceWith('item');
});

it('replaces a bounded page and permits a failed read to be retried', async () => {
  const value = fixture(); value.accumulations.mockRejectedValueOnce(new Error('Read unavailable'));
  show(value.api);
  expect(await screen.findByText('Read unavailable')).toBeTruthy();
  value.accumulations.mockResolvedValueOnce({ items: [item], nextCursor: '20' });
  fireEvent.click(screen.getByRole('button', { name: '현재 정리 다시 읽기' }));
  await screen.findByText(item.preview);
  value.accumulations.mockResolvedValueOnce({ items: [{ ...item, id: 'second', title: 'Older update' }], nextCursor: null });
  fireEvent.click(screen.getByRole('button', { name: '다음 반영 내역' }));
  await screen.findByText('Older update');
  expect(screen.queryByText('Meeting follow-up')).toBeNull();
  expect(value.accumulations).toHaveBeenLastCalledWith('note-a', '20');
});

it('ignores a late response from the previously selected note', async () => {
  const value = fixture();
  let finish!: (page: { items: NoteAccumulation[]; nextCursor: null }) => void;
  value.accumulations.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  value.accumulations.mockResolvedValueOnce({ items: [], nextCursor: null });
  const view = show(value.api);
  view.rerender(<NoteContext api={value.api} note={{ ...note, id: 'note-b' }}/>);
  await screen.findByText('반영된 정리가 없습니다.');
  finish({ items: [item], nextCursor: null });
  await waitFor(() => expect(within(screen.getByRole('region', { name: '현재 정리' })).queryByText(item.preview)).toBeNull());
});
