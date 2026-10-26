import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { account, fixture, graphql, response, role } from './realApi';

interface CurrentFixture {
  noteId: string; fileId: string; originalXml: string;
  currentBodies: string[]; excludedBodies: string[];
  privateNoteId: string; administratorNoteId: string;
  staleChangeSetId: string;
  createdNoteId: string;
  pagedNoteId: string; pagedBodies: string[];
  rule: { noteId: string; versionId: string; rulesetId: string; versionNumber: number; name: string };
}
const path = process.env.NOTE_GUI_E2E_CURRENT_FIXTURE;
const current = path ? JSON.parse(readFileSync(path, 'utf8')) as CurrentFixture : undefined;
test.skip(!fixture || !current, 'Requires applied current-knowledge changes on a note with a separate structured human body.');

test('keeps human formatting and diagrams separate from current facts and historical statements', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  try {
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${current!.noteId}`);
    await expect(page.getByRole('heading', { name: '사람이 작성한 본문', exact: true })).toBeVisible();
    const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
    await expect(body.locator('strong')).toHaveText('Human wording must stay. ');
    await expect(body.locator('em')).toHaveText('The review time is tentative.');
    await expect(body.getByRole('cell', { name: 'Human table value', exact: true })).toBeVisible();
    await expect(body.getByRole('cell', { name: 'Keep this cell', exact: true })).toBeVisible();
    const summary = page.getByRole('region', { name: '현재 정리', exact: true });
    for (const text of current!.currentBodies) {
      await expect(summary.locator('.current-knowledge-item > p').filter({ hasText: text })).toHaveCount(1);
      await expect(body).not.toContainText(text);
    }
    for (const text of current!.excludedBodies) {
      await expect(summary).not.toContainText(text);
      await expect(page.getByRole('region', { name: '누적 이력', exact: true })).toContainText(text);
    }
    for (const label of ['확정 사실', '제안·요청', '추정 · 확인 전', '확정 여부 미분류']) await expect(summary.getByText(label, { exact: true })).toBeVisible();
    const stored = await graphql<{ knowledgeCurrentItems: { items: { body: string }[] } }>(owner.request, 'query($id:UUID!){knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{body}}}', { id: current!.noteId });
    expect(stored.knowledgeCurrentItems.items.map(item => item.body).sort()).toEqual([...current!.currentBodies].sort());
    const stale = await response(owner.request, 'mutation($id:UUID!,$input:DecideChangeSetInput!){decideChangeSet(id:$id,input:$input){id status}}', { id: current!.staleChangeSetId, input: { expectedRevision: 1, decision: 'ACCEPTED', reason: 'Verify a stale proposal remains rejected after a newer human edit.' } });
    expect(stale.errors?.[0].extensions?.code).toBe('CONFLICT');
    const unchanged = await graphql<{ knowledgeCurrentItems: { items: { body: string }[] } }>(owner.request, 'query($id:UUID!){knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{body}}}', { id: current!.noteId });
    expect(unchanged.knowledgeCurrentItems.items.map(item => item.body).sort()).toEqual([...current!.currentBodies].sort());
    expect(await (await owner.request.get(`/api/files/${current!.fileId}`)).text()).toBe(current!.originalXml);
    await page.getByRole('button', { name: '다이어그램 편집', exact: true }).click();
    await expect(page.getByLabel('Draw.io XML', { exact: true })).toHaveValue(current!.originalXml);
    await page.getByRole('button', { name: 'Draw.io 닫기', exact: true }).click();
    await expect(page.getByLabel('Draw.io XML', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: '.tmp/browser/current-human-and-history.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await summary.getByRole('heading', { name: '현재 정리', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.tmp/browser/current-knowledge-mobile.png', fullPage: true });
  } finally { await owner.close(); }
});

test('opens a collected note with an empty human editor and a separate confirmed statement', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  try {
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${current!.createdNoteId}`);
    await expect(page.getByRole('heading', { name: '사람이 작성한 본문', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveText('');
    const summary = page.getByRole('region', { name: '현재 정리', exact: true });
    await expect(summary).toContainText('A collected confirmed fact with an empty human editor.');
    await expect(summary.getByText('확정 사실', { exact: true })).toBeVisible();
  } finally { await owner.close(); }
});

test('restores a human revision while retaining its independent current knowledge', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const query = 'query($id:UUID!){knowledgeNote(id:$id){revision richBody authoredBody bodyOrigin} knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{body}}}';
  type State = { knowledgeNote: { revision: number; richBody: string; authoredBody: string; bodyOrigin: string }; knowledgeCurrentItems: { items: { body: string }[] } };
  try {
    const before = await graphql<State>(owner.request, query, { id: current!.noteId });
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${current!.noteId}`);
    await expect(page.getByRole('region', { name: '현재 정리', exact: true }).locator('.current-knowledge-item')).toHaveCount(4);
    await page.getByRole('tab', { name: '이력', exact: true }).click();
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: '복원', exact: true }).click();
    await expect.poll(async () => (await graphql<State>(owner.request, query, { id: current!.noteId })).knowledgeNote.revision).toBe(before.knowledgeNote.revision + 1);
    const after = await graphql<State>(owner.request, query, { id: current!.noteId });
    expect(after.knowledgeNote.richBody).toBe(before.knowledgeNote.richBody);
    expect(after.knowledgeNote.authoredBody).toBe(before.knowledgeNote.authoredBody);
    expect(after.knowledgeNote.bodyOrigin).toBe('HUMAN');
    expect(after.knowledgeCurrentItems.items).toEqual(before.knowledgeCurrentItems.items);
    await expect(page.getByRole('textbox', { name: '노트 본문', exact: true }).locator('strong')).toHaveText('Human wording must stay. ');
    await expect(page.getByRole('region', { name: '현재 정리', exact: true }).locator('.current-knowledge-item')).toHaveCount(4);
  } finally { await owner.close(); }
});

test('replaces bounded current pages without merging or dropping accepted items', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  try {
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${current!.pagedNoteId}`);
    const summary = page.getByRole('region', { name: '현재 정리', exact: true });
    const rows = summary.locator('.current-knowledge-item > p');
    await expect(rows).toHaveCount(20);
    const first = await rows.allTextContents();
    await summary.getByRole('button', { name: '다음 현재 항목', exact: true }).click();
    await expect(rows).toHaveCount(5);
    const last = await rows.allTextContents();
    expect(new Set([...first, ...last]).size).toBe(25);
    expect([...first, ...last].sort()).toEqual([...current!.pagedBodies].sort());
    await expect(summary.getByRole('button', { name: '다음 현재 항목', exact: true })).toBeDisabled();
    await summary.getByRole('button', { name: '이전 현재 항목', exact: true }).click();
    await expect(rows).toHaveText(first);
  } finally { await owner.close(); }
});

test('shows an actual pinned rule on new current knowledge while preserving its legacy document', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  try {
    const page = await owner.newPage();
    const rule = current!.rule;
    await page.goto(`./?space=${fixture!.space}&note=${rule.noteId}`);
    await expect(page.getByRole('heading', { name: '기존 본문', exact: true })).toBeVisible();
    const summary = page.getByRole('region', { name: '현재 정리', exact: true });
    await expect(summary).toContainText('The active rule version supports this newly accepted current fact.');
    await summary.locator('summary').click();
    await expect(summary.getByRole('link', { name: `${rule.name} v${rule.versionNumber}`, exact: true })).toHaveAttribute('href', new RegExp(`ruleset=${rule.rulesetId}&version=${rule.versionId}`));
    const value = await graphql<{ knowledgeCurrentItems: { items: { rules: { versionId: string; versionNumber: number }[] }[] } }>(owner.request, 'query($id:UUID!){knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{rules{versionId versionNumber}}}}', { id: rule.noteId });
    expect(value.knowledgeCurrentItems.items[0].rules).toContainEqual({ versionId: rule.versionId, versionNumber: rule.versionNumber });
  } finally { await owner.close(); }
});

test('enforces current-item privacy and removes open administrator evidence after demotion', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  const outsider = await account(browser, 'outsider');
  const query = 'query($id:UUID!){knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{body evidence{quote}}}}';
  try {
    for (const id of [current!.privateNoteId, current!.administratorNoteId]) {
      const visible = await graphql<{ knowledgeCurrentItems: { items: unknown[] } }>(owner.request, query, { id });
      expect(visible.knowledgeCurrentItems.items).toHaveLength(1);
      const denied = await response(peer.request, query, { id });
      expect(denied.errors?.length).toBeGreaterThan(0); expect(denied.data).toBeNull();
    }
    const denied = await response(outsider.request, query, { id: current!.noteId });
    expect(denied.errors?.length).toBeGreaterThan(0); expect(denied.data).toBeNull();
    await role(owner.request, fixture!.peer, 'OWNER');
    const page = await peer.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${current!.administratorNoteId}`);
    const summary = page.getByRole('region', { name: '현재 정리', exact: true });
    await expect(summary.locator('.current-knowledge-item')).toHaveCount(1);
    await summary.locator('summary').click();
    await expect(summary.locator('.note-evidence .visibility-label')).toHaveText('관리자 전용');
    await role(owner.request, fixture!.peer, 'EDITOR');
    await expect(summary).toHaveCount(0, { timeout: 45_000 });
    await expect(page.locator('.note-evidence')).toHaveCount(0);
    const removed = await response(peer.request, query, { id: current!.administratorNoteId });
    expect(removed.errors?.length).toBeGreaterThan(0); expect(removed.data).toBeNull();
  } finally { await role(owner.request, fixture!.peer, 'EDITOR'); await Promise.all([owner.close(), peer.close(), outsider.close()]); }
});
