// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note, NoteApi } from './model';
import { NoteProvenance } from './NoteProvenance';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});
afterEach(() => { cleanup(); });

it('links each provenance record to the web application on the same host name', async () => {
  const note: Note = { id: 'note', spaceId: 'space', title: 'Title', revision: 1, bodyJson: { type: 'doc' }, visibility: 'SPACE', parentId: null, canEdit: true };
  const api = {
    provenance: vi.fn().mockResolvedValue({
      sources: [{ revisionId: 'rev', spaceId: 'space', title: 'Chat' }],
      rules: [{ rulesetId: 'rules', versionId: 'v1', spaceId: 'space', label: 'R-OPS v2' }],
      reviews: [{ id: 'proposal', spaceId: 'space', title: 'Edit', kind: 'proposal', status: 'PENDING' }],
      actions: [{ id: 'action', spaceId: 'space', title: 'Follow up' }],
    }),
  } as unknown as NoteApi;
  render(<MantineProvider><NoteProvenance api={api} note={note}/></MantineProvider>);
  const origin = `${window.location.protocol}//${window.location.hostname}:9088`;
  expect((await screen.findByRole('link', { name: 'Chat' })).getAttribute('href')).toBe(`${origin}/spaces/space/source-revisions/rev`);
  expect(screen.getByRole('link', { name: 'R-OPS v2' }).getAttribute('href')).toBe(`${origin}/spaces/space/rules?stage=history&ruleset=rules&version=v1`);
  expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(`${origin}/spaces/space/reviews?proposal=proposal`);
  expect(screen.getByText(/검토 대기/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Follow up' }).getAttribute('href')).toBe(`${origin}/spaces/space/actions/action`);
  expect(screen.getByRole('link', { name: '이 노트로 업무 만들기' }).getAttribute('href')).toBe(`${origin}/spaces/space/actions/new?note=note`);
});
