// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createNoteDateTimeFormatter, NoteDateTimeContext, useNoteDateTime } from './dateTime';
import { NoteCurrentKnowledge } from './NoteCurrentKnowledge';
import { NoteAccumulations } from './NoteAccumulations';
import type { CurrentKnowledgeItem, NoteAccumulation, NoteApi } from './model';

afterEach(cleanup);
const instant = '2026-10-27T00:00:00Z';
function Timestamp({ value = instant }: { value?: string }) {
  return <time dateTime={value}>{useNoteDateTime()(value)}</time>;
}

it('uses and labels the requested time zone across date boundaries and daylight saving time', () => {
  const seoul = createNoteDateTimeFormatter('Asia/Seoul');
  const newYork = createNoteDateTimeFormatter('America/New_York');
  expect(seoul(instant)).toBe('2026. 10. 27. 오전 9:00 (Asia/Seoul)');
  expect(newYork(instant)).toBe('2026. 10. 26. 오후 8:00 (America/New_York)');
  expect(newYork('2026-01-01T00:00:00Z')).toBe('2025. 12. 31. 오후 7:00 (America/New_York)');
});

it('labels the actual default time zone when no host option is supplied', () => {
  render(<Timestamp/>);
  const native = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
  expect(screen.getByText(native.format(new Date(instant)) + ' (' + native.resolvedOptions().timeZone + ')')).toBeTruthy();
});

it('keeps simultaneously mounted host clocks independent', () => {
  render(<>
    <section aria-label="Seoul"><NoteDateTimeContext.Provider value={createNoteDateTimeFormatter('Asia/Seoul')}><Timestamp/></NoteDateTimeContext.Provider></section>
    <section aria-label="New York"><NoteDateTimeContext.Provider value={createNoteDateTimeFormatter('America/New_York')}><Timestamp/></NoteDateTimeContext.Provider></section>
  </>);
  expect(within(screen.getByRole('region', { name: 'Seoul' })).getByText(/오전 9:00 \(Asia\/Seoul\)/)).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'New York' })).getByText(/오후 8:00 \(America\/New_York\)/)).toBeTruthy();
});

it('rejects an invalid host time zone before a root can mount', () => {
  expect(() => createNoteDateTimeFormatter('Invalid/Zone')).toThrow(RangeError);
});

it('keeps malformed timestamps from breaking the surrounding note', () => {
  render(<Timestamp value="not-an-instant"/>);
  expect(screen.getByText('시각 미상')).toBeTruthy();
});

it('uses the same host clock for current items, history and their source evidence', async () => {
  const evidence: NoteAccumulation['evidence'] = [{
    id: 'evidence', revisionId: 'source', spaceId: 'space', title: 'Synthetic source',
    locator: 'paragraph 1', quote: 'A confirmed synthetic statement.', quoteTruncated: false,
    occurredAt: instant, effectiveAt: instant, visibility: 'SPACE',
  }];
  const current: CurrentKnowledgeItem = {
    id: 'current', claimKind: 'CONFIRMED_FACT', body: 'Current statement', appliedAt: instant,
    resultRevision: 2, evidenceCount: 1, evidence, rules: [],
  };
  const history: NoteAccumulation = {
    id: 'history', spaceId: 'space', changeSetId: 'changes', kind: 'REPLACE_NOTE', title: 'History',
    preview: 'Earlier statement', appliedAt: instant, actorName: 'Operator', reviewerName: 'Reviewer',
    automatic: false, resultRevision: 2, evidenceCount: 1, evidence, rules: [],
  };
  const api = {
    currentKnowledge: vi.fn().mockResolvedValue({ noteId: 'note', revision: 2, bodyOrigin: 'HUMAN', items: [current], nextCursor: null }),
    accumulations: vi.fn().mockResolvedValue({ items: [history], nextCursor: null }),
  } as unknown as NoteApi;
  const view = render(<NoteDateTimeContext.Provider value={createNoteDateTimeFormatter('Asia/Seoul')}>
    <NoteCurrentKnowledge api={api} noteId="note" spaceId="space"/>
    <NoteAccumulations api={api} noteId="note"/>
  </NoteDateTimeContext.Provider>);
  await screen.findByText('Current statement');
  await screen.findByText('Earlier statement');
  const expected = '2026. 10. 27. 오전 9:00 (Asia/Seoul)';
  const applied = [...view.container.querySelectorAll('time')];
  expect(applied).toHaveLength(3);
  for (const item of applied) expect(item.textContent).toBe(expected);
  const sources = [...view.container.querySelectorAll('.note-evidence')];
  expect(sources).toHaveLength(2);
  for (const source of sources) expect(source.textContent).toContain('원본 발생 ' + expected + ' · 효력 시점 ' + expected);
});
