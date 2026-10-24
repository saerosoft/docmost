import { expect, test } from '@playwright/test';
import { account, fixture, graphql, response } from './realApi';

test.skip(!fixture, 'Requires isolated real API accounts and two spaces in one organization.');

test('moves a private subtree across spaces without discarding either pane draft', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  const created: string[] = [];
  async function create(title: string, parentId: string | null = null) {
    const result = await graphql<{ createKnowledgeNote: { id: string } }>(owner.request, 'mutation($input:CreateNoteInput!){createKnowledgeNote(input:$input){id}}', { input: { spaceId: fixture!.space, title, parentId, body: 'Private subtree content.', visibility: 'PRIVATE', idempotencyKey: crypto.randomUUID() } });
    created.push(result.createKnowledgeNote.id); return result.createKnowledgeNote.id;
  }
  try {
    const title = `Private moved subtree ${crypto.randomUUID().slice(0, 8)}`;
    const parent = await create(title);
    const child = await create('Private moved child', parent);
    const page = await owner.newPage();
    await page.goto(`/?space=${fixture!.space}&note=${parent}&right=${fixture!.sharedNote}`);
    const left = page.getByRole('region', { name: '왼쪽 편집 창', exact: true });
    const right = page.getByRole('region', { name: '오른쪽 편집 창', exact: true });
    await left.getByRole('textbox', { name: '노트 본문', exact: true }).fill('Unsaved moved-note draft.');
    await right.getByRole('textbox', { name: '노트 본문', exact: true }).fill('Independent other-pane draft.');
    await page.getByRole('checkbox', { name: `${title} 선택`, exact: true }).check();
    await page.getByText('선택한 노트 이동 · 1', { exact: true }).click();
    await page.getByRole('combobox', { name: '대상 공간', exact: true }).click();
    await page.getByRole('option', { name: 'Acceptance destination', exact: true }).click();
    await page.getByRole('button', { name: '선택 노트 이동', exact: true }).click();
    const destination = page.getByRole('link', { name: '이동한 공간에서 열기', exact: true });
    await expect(destination).toHaveAttribute('href', `/?space=${fixture!.destination}&note=${parent}`);
    await expect(left.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveText('Unsaved moved-note draft.');
    await expect(right.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveText('Independent other-pane draft.');
    await expect(page.getByRole('treeitem', { name: title, exact: true })).toHaveCount(0);
    const popup = owner.waitForEvent('page'); await destination.click();
    const moved = await popup;
    await expect(moved.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveText('Private subtree content.');
    await expect(moved).toHaveURL(new RegExp(`space=${fixture!.destination}&note=${parent}`));
    await moved.goto(`/?space=${fixture!.destination}&note=${child}`);
    await expect(moved.getByRole('treeitem', { name: 'Private moved child', exact: true })).toBeVisible();
    await expect(moved.locator('.breadcrumb')).toContainText(title);
    const query = 'query($id:UUID!){knowledgeNote(id:$id){id spaceId parentId ownerId visibility revision body}}';
    for (const id of created) {
      const note = (await graphql<{ knowledgeNote: { spaceId: string; ownerId: string; visibility: string; parentId: string | null } }>(owner.request, query, { id })).knowledgeNote;
      expect(note.spaceId).toBe(fixture!.destination); expect(note.ownerId).toBe(fixture!.owner); expect(note.visibility).toBe('PRIVATE');
      expect(note.parentId).toBe(id === child ? parent : null);
      const denied = await response<{ knowledgeNote: unknown }>(peer.request, query, { id });
      expect(denied.data?.knowledgeNote).toBeNull();
    }
    await page.screenshot({ path: '.tmp/browser/cross-space-drafts.png', fullPage: true });
  } finally {
    for (const id of created.reverse()) {
      const result = await graphql<{ knowledgeNote: { revision: number } }>(owner.request, 'query($id:UUID!){knowledgeNote(id:$id){revision}}', { id });
      await graphql(owner.request, 'mutation($id:UUID!,$input:ArchiveNoteInput!){archiveNote(id:$id,input:$input)}', { id, input: { expectedRevision: result.knowledgeNote.revision } });
    }
    await Promise.all([owner.close(), peer.close()]);
  }
});
