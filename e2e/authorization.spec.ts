import { expect, test } from '@playwright/test';
import { account, fixture, graphql, response, role } from './realApi';

test.skip(!fixture, 'Requires NOTE_GUI_E2E_FIXTURE with isolated real API accounts and notes.');

const noteQuery = 'query($id:UUID!){knowledgeNote(id:$id){id title body revision}}';

test('isolates owner-private, administrator and shared notes across three real sessions', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  const outsider = await account(browser, 'outsider');
  try {
    const page = await peer.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${fixture!.sharedNote}`);
    await expect(page.getByRole('textbox', { name: '노트 본문', exact: true })).toContainText('Human-authored agreement.');
    await expect(page.getByRole('treeitem', { name: 'Acceptance owner private note', exact: true })).toHaveCount(0);
    await expect(page.getByRole('treeitem', { name: 'Acceptance administrator note', exact: true })).toHaveCount(0);
    await expect(page.getByRole('treeitem', { name: 'Acceptance peer private note', exact: true })).toBeVisible();
    const lookup = 'query($spaceId:UUID!,$query:String){knowledgeNotes(spaceId:$spaceId,query:$query,offset:0,limit:20){id title}}';
    for (const query of ['Acceptance owner private note', 'Acceptance administrator note']) {
      const hidden = await graphql<{ knowledgeNotes: { id: string; title: string }[] }>(peer.request, lookup, { spaceId: fixture!.space, query });
      expect(hidden.knowledgeNotes).toEqual([]);
    }
    const own = await graphql<{ knowledgeNotes: { id: string }[] }>(peer.request, lookup, { spaceId: fixture!.space, query: 'Acceptance peer private note' });
    expect(own.knowledgeNotes.map(note => note.id)).toEqual([fixture!.peerPrivateNote]);
    const outside = await response(outsider.request, lookup, { spaceId: fixture!.space, query: 'Acceptance shared note' });
    expect(outside.errors?.length).toBeGreaterThan(0);
    expect(outside.data).toBeNull();
    for (const id of [fixture!.privateNote, fixture!.administratorNote]) {
      const denied = await response<{ knowledgeNote: unknown }>(peer.request, noteQuery, { id });
      expect(denied.data?.knowledgeNote).toBeNull();
      expect(JSON.stringify(denied)).not.toContain(id === fixture!.privateNote ? 'Owner-private evidence' : 'Administrator-only evidence');
    }
    const denied = await response<{ knowledgeNote: unknown }>(outsider.request, noteQuery, { id: fixture!.sharedNote });
    expect(denied.data?.knowledgeNote).toBeNull();
    const original = await graphql<{ knowledgeNote: { body: string } }>(owner.request, noteQuery, { id: fixture!.privateNote });
    expect(original.knowledgeNote.body).toBe('Owner-private evidence remains private.');
  } finally { await Promise.all([owner.close(), peer.close(), outsider.close()]); }
});

test('removes an open administrator editor and dirty draft after real role demotion', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  try {
    await role(owner.request, fixture!.peer, 'OWNER');
    const page = await peer.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${fixture!.administratorNote}`);
    const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
    await expect(body).toHaveText('Administrator-only evidence.');
    await body.fill('Unsaved administrator secret.');
    await role(owner.request, fixture!.peer, 'EDITOR');
    await expect(body).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByText('Unsaved administrator secret.', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Acceptance administrator note •', exact: true })).toHaveCount(0);
    const denied = await response<{ knowledgeNote: unknown }>(peer.request, noteQuery, { id: fixture!.administratorNote });
    expect(denied.data?.knowledgeNote).toBeNull();
  } finally {
    await role(owner.request, fixture!.peer, 'EDITOR');
    await Promise.all([owner.close(), peer.close()]);
  }
});

test('clears both panes and cached private content when current space membership is revoked', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  try {
    const page = await peer.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${fixture!.sharedNote}&right=${fixture!.peerPrivateNote}`);
    const left = page.getByRole('region', { name: '왼쪽 편집 창', exact: true });
    const right = page.getByRole('region', { name: '오른쪽 편집 창', exact: true });
    await expect(left.getByRole('textbox', { name: '노트 본문', exact: true })).toContainText('Human-authored agreement.');
    await expect(right.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveText('Peer-private content.');
    await right.getByRole('textbox', { name: '노트 본문', exact: true }).fill('Unsaved peer-private draft.');
    await role(owner.request, fixture!.peer, null);
    await expect(page.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByRole('treeitem')).toHaveCount(0);
    await expect(page.getByText('Unsaved peer-private draft.', { exact: false })).toHaveCount(0);
    const denied = await response<{ knowledgeNote: unknown }>(peer.request, noteQuery, { id: fixture!.peerPrivateNote });
    expect(denied.data?.knowledgeNote).toBeNull();
  } finally {
    await role(owner.request, fixture!.peer, 'EDITOR');
    await Promise.all([owner.close(), peer.close()]);
  }
});

test('keeps readable drafts while disabling writes after demotion to viewer', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  try {
    const page = await peer.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${fixture!.sharedNote}`);
    const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
    await body.fill('Readable but no longer writable draft.');
    await role(owner.request, fixture!.peer, 'VIEWER');
    await expect(body).toHaveAttribute('contenteditable', 'false', { timeout: 45_000 });
    await expect(body).toHaveText('Readable but no longer writable draft.');
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    await expect(page.getByLabel('새 노트 제목', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('checkbox').first()).toBeDisabled();
    const original = await graphql<{ knowledgeNote: { revision: number; body: string } }>(owner.request, noteQuery, { id: fixture!.sharedNote });
    const denied = await response(peer.request, 'mutation($id:UUID!,$input:SaveRichNoteInput!){saveRichNote(id:$id,input:$input){id}}', { id: fixture!.sharedNote, input: { expectedRevision: original.knowledgeNote.revision, title: 'Unauthorized edit', richBody: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }), schemaVersion: 1, idempotencyKey: crypto.randomUUID() } });
    expect(denied.errors?.length).toBeGreaterThan(0);
    const unchanged = await graphql<{ knowledgeNote: { revision: number; body: string } }>(owner.request, noteQuery, { id: fixture!.sharedNote });
    expect(unchanged.knowledgeNote).toEqual(original.knowledgeNote);
    await page.screenshot({ path: '.tmp/browser/viewer-read-only.png', fullPage: true });
  } finally { await role(owner.request, fixture!.peer, 'EDITOR'); await Promise.all([owner.close(), peer.close()]); }
});
