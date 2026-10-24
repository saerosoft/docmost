// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { CurrentKnowledgeItem, CurrentKnowledgePage, NoteApi } from './model';
import { NoteCurrentKnowledge } from './NoteCurrentKnowledge';

afterEach(cleanup);
const confirmed: CurrentKnowledgeItem = {
  id: 'confirmed', claimKind: 'CONFIRMED_FACT', body: 'The confirmed date is November 9.', resultRevision: 4, appliedAt: '2026-10-24T08:00:00Z', evidenceCount: 1,
  evidence: [{ id: 'evidence', revisionId: 'original', spaceId: 'space', title: 'Private original', locator: 'paragraph 1', quote: 'The agreed date is November 9.', quoteTruncated: false, occurredAt: '2026-10-22T08:00:00Z', effectiveAt: '2026-10-23T08:00:00Z', visibility: 'PRIVATE' }],
  rules: [{ rulesetId: 'rules', versionId: 'version', name: 'Evidence policy', versionNumber: 2 }],
};
const page = (items: CurrentKnowledgeItem[], nextCursor: string | null = null): CurrentKnowledgePage => ({ noteId: 'note', revision: 4, bodyOrigin: 'HUMAN', items, nextCursor });
function fixture() {
  const currentKnowledge = vi.fn().mockResolvedValue(page([confirmed]));
  const accumulations = vi.fn();
  const accumulationChange = vi.fn().mockResolvedValue({ operationBody: confirmed.body, before: null, after: { revision: 4, title: 'Note', body: confirmed.body }, preserveHumanFields: true, requireEvidence: true, excludePrivateExamples: true, reviewPolicy: 'REVIEW', allowedDocumentTypes: ['NOTE'] });
  return { currentKnowledge, accumulations, accumulationChange, api: { currentKnowledge, accumulations, accumulationChange } as unknown as NoteApi };
}

it('shows only server-selected current items and distinguishes facts, requests and inference', async () => {
  const value = fixture();
  value.currentKnowledge.mockResolvedValue(page([confirmed,
    { ...confirmed, id: 'request', claimKind: 'REQUEST', body: 'A later meeting is proposed.' },
    { ...confirmed, id: 'inference', claimKind: 'INFERENCE', body: 'The time is inferred, not confirmed.' },
    { ...confirmed, id: 'unclassified', claimKind: 'UNSPECIFIED', body: 'The status was not classified.' },
  ]));
  render(<NoteCurrentKnowledge api={value.api} noteId="note" spaceId="space"/>);
  await screen.findByText(confirmed.body);
  for (const label of ['확정 사실', '제안·요청', '추정 · 확인 전', '확정 여부 미분류']) expect(screen.getByText(label)).toBeTruthy();
  expect(value.currentKnowledge).toHaveBeenCalledExactlyOnceWith('note', null);
  expect(value.accumulations).not.toHaveBeenCalled();
});

it('opens exact evidence, its scope and times, applied rules and the saved comparison', async () => {
  const value = fixture(); render(<NoteCurrentKnowledge api={value.api} noteId="note" spaceId="space"/>);
  fireEvent.click(await screen.findByText('근거·반영 기록 · 1'));
  expect(screen.getByText('본인만')).toBeTruthy();
  expect(screen.getByText(confirmed.evidence[0].quote)).toBeTruthy();
  expect(screen.getByText(/원본 발생/)).toBeTruthy(); expect(screen.getByText(/효력 시점/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Evidence policy v2' }).getAttribute('href')).toContain('ruleset=rules&version=version');
  expect(value.accumulationChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '변경 전후·반영 기준 보기' }));
  await screen.findByRole('region', { name: '변경 전후와 반영 기준' });
  expect(value.accumulationChange).toHaveBeenCalledExactlyOnceWith('confirmed');
});

it('replaces current pages, retries a failure and accepts an authoritative empty result', async () => {
  const value = fixture(); value.currentKnowledge.mockRejectedValueOnce(new Error('Current read failed'));
  render(<NoteCurrentKnowledge api={value.api} noteId="note" spaceId="space"/>);
  await screen.findByText('Current read failed');
  value.currentKnowledge.mockResolvedValueOnce(page([confirmed], '20'));
  fireEvent.click(screen.getByRole('button', { name: '현재 정리 다시 읽기' }));
  await screen.findByText(confirmed.body);
  value.currentKnowledge.mockResolvedValueOnce(page([]));
  fireEvent.click(screen.getByRole('button', { name: '다음 현재 항목' }));
  await screen.findByText('현재 유효한 정리가 없습니다.');
  expect(screen.queryByText(confirmed.body)).toBeNull();
  expect(value.currentKnowledge).toHaveBeenLastCalledWith('note', '20');
  expect(value.accumulations).not.toHaveBeenCalled();
});

it('ignores a late current page from a previously opened note', async () => {
  const value = fixture(); let finish!: (result: CurrentKnowledgePage) => void;
  value.currentKnowledge.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  value.currentKnowledge.mockResolvedValueOnce({ ...page([]), noteId: 'other' });
  const view = render(<NoteCurrentKnowledge key="note" api={value.api} noteId="note" spaceId="space"/>);
  view.rerender(<NoteCurrentKnowledge key="other" api={value.api} noteId="other" spaceId="space"/>);
  await screen.findByText('현재 유효한 정리가 없습니다.');
  await act(async () => finish(page([confirmed])));
  await waitFor(() => expect(screen.queryByText(confirmed.body)).toBeNull());
});

it('distinguishes unclassified legacy material from an authoritative empty human note', async () => {
  const value = fixture(); value.currentKnowledge.mockResolvedValue({ ...page([]), bodyOrigin: 'LEGACY_UNCLASSIFIED' });
  render(<NoteCurrentKnowledge api={value.api} noteId="note" spaceId="space"/>);
  await screen.findByText('기존 본문은 작성 구분과 유효성을 확인해야 합니다.');
  expect(screen.getByText('분리 확인된 현재 항목이 없습니다.')).toBeTruthy();
  expect(screen.queryByText('현재 유효한 정리가 없습니다.')).toBeNull();
});
