import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { account, fixture, graphql, response, role } from './realApi';

interface PipelineFixture {
  SPACE: { noteId: string }; PRIVATE: { noteId: string }; ADMINISTRATORS: { noteId: string };
  operations: { operationId: string; sourceRevisionId: string; visibility: string; kind: string; body: string }[];
}
const path = process.env.NOTE_GUI_E2E_PIPELINE;
const records = path ? JSON.parse(readFileSync(path, 'utf8')) as PipelineFixture : undefined;
const rulePath = process.env.NOTE_GUI_E2E_RULE;
const ruleRecord = rulePath ? JSON.parse(readFileSync(rulePath, 'utf8')) as { noteId: string; versionId: string; rulesetId: string; versionNumber: number; ruleName: string; body: string } : undefined;
test.skip(!fixture || !records, 'Requires persisted, reviewed accumulation records and isolated account sessions.');

test('pages real accumulation history and shows original evidence and actual before/after revisions', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  try {
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${records!.SPACE.noteId}`);
    const current = page.getByRole('region', { name: '현재 정리', exact: true });
    await expect(current.getByText('기존 본문은 작성 구분과 유효성을 확인해야 합니다.', { exact: true })).toBeVisible();
    await expect(current.getByText('분리 확인된 현재 항목이 없습니다.', { exact: true })).toBeVisible();
    await expect(current.locator('.current-knowledge-item')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '기존 본문', exact: true })).toBeVisible();
    const history = page.locator('.note-accumulations');
    await expect(history.locator('article.accumulation-item')).toHaveCount(20);
    await history.getByRole('button', { name: '다음 반영 내역', exact: true }).click();
    await expect(history.locator('article.accumulation-item')).toHaveCount(5);
    const replaced = history.locator('article.accumulation-item').filter({ has: page.getByText('개정 2', { exact: true }) });
    await replaced.locator('summary').click();
    await expect(replaced).toContainText('The confirmed delivery date is November 9.');
    await expect(replaced.locator('blockquote')).toHaveText('Acceptance original: The confirmed delivery date is November 9. The former proposed date is superseded.');
    await expect(replaced).toContainText('원본 발생'); await expect(replaced).toContainText('효력 시점'); await expect(replaced).toContainText('반영 시각');
    await replaced.getByRole('button', { name: '변경 전후·반영 기준 보기', exact: true }).click();
    const comparison = replaced.getByRole('region', { name: '변경 전후와 반영 기준', exact: true });
    await expect(comparison.locator('pre').nth(0)).toContainText('November 2; confirmation was pending.');
    await expect(comparison.locator('pre').nth(2)).toContainText('confirmed delivery date is November 9');
    await expect(comparison).toContainText('사람 편집 보존');
    const source = records!.operations.find(value => value.visibility === 'SPACE' && value.kind === 'REPLACE_NOTE')!;
    const original = await graphql<{ sourceRevision: { body: string; occurredAt: string; effectiveAt: string } }>(owner.request, 'query($id:UUID!){sourceRevision(id:$id){body occurredAt effectiveAt}}', { id: source.sourceRevisionId });
    expect(original.sourceRevision.body).toBe('Acceptance original: ' + source.body);
    expect(original.sourceRevision.occurredAt).toBeTruthy(); expect(original.sourceRevision.effectiveAt).toBeTruthy();
    await page.screenshot({ path: '.tmp/browser/populated-history-comparison.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: '.tmp/browser/populated-history-mobile.png', fullPage: true });
  } finally { await owner.close(); }
});

test('keeps private evidence and administrator comparisons out of unauthorized accounts', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  try {
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${records!.PRIVATE.noteId}`);
    await page.locator('.note-accumulations article summary').first().click();
    await expect(page.locator('.note-evidence .visibility-label').first()).toHaveText('본인만');
    await page.goto(`./?space=${fixture!.space}&note=${records!.ADMINISTRATORS.noteId}`);
    await page.locator('.note-accumulations article summary').first().click();
    await expect(page.locator('.note-evidence .visibility-label').first()).toHaveText('관리자 전용');
    for (const visibility of ['PRIVATE', 'ADMINISTRATORS'] as const) {
      const operation = records!.operations.find(value => value.visibility === visibility)!;
      const queries = [
        ['query($id:UUID!){knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{body evidence{quote}}}}', records![visibility].noteId],
        ['query($id:UUID!){knowledgeAccumulations(noteId:$id,offset:0,limit:20){preview evidence{quote}}}', records![visibility].noteId],
        ['query($id:UUID!){knowledgeAccumulationChange(id:$id){operationBody before{body} after{body}}}', operation.operationId],
        ['query($id:UUID!){sourceRevision(id:$id){body}}', operation.sourceRevisionId],
      ];
      for (const [query, id] of queries) {
        const denied = await response(peer.request, query, { id });
        expect(denied.errors?.length).toBeGreaterThan(0);
        expect(JSON.stringify(denied.data)).not.toContain('November');
      }
    }
    await role(owner.request, fixture!.peer, 'OWNER');
    const peerPage = await peer.newPage();
    await peerPage.goto(`./?space=${fixture!.space}&note=${records!.ADMINISTRATORS.noteId}`);
    await peerPage.locator('.note-accumulations article summary').first().click();
    await peerPage.locator('.note-accumulations').getByRole('button', { name: '변경 전후·반영 기준 보기', exact: true }).first().click();
    await expect(peerPage.getByRole('region', { name: '변경 전후와 반영 기준', exact: true })).toBeVisible();
    await role(owner.request, fixture!.peer, 'EDITOR');
    await expect(peerPage.locator('.note-accumulations')).toHaveCount(0, { timeout: 45_000 });
    await expect(peerPage.getByRole('region', { name: '변경 전후와 반영 기준', exact: true })).toHaveCount(0);
    await expect(peerPage.getByText('The review time remains tentative and needs confirmation.', { exact: true })).toHaveCount(0);
  } finally { await role(owner.request, fixture!.peer, 'EDITOR'); await Promise.all([owner.close(), peer.close()]); }
});

test('shows the actual approved rule version pinned to an applied change', async ({ browser }) => {
  test.skip(!ruleRecord, 'Requires a rule version approved through the real acceptance API.');
  const owner = await account(browser, 'owner');
  try {
    const version = await graphql<{ ruleVersion: { id: string; rulesetId: string; versionNumber: number; approvedAt: string | null; status: string } }>(owner.request, 'query($id:UUID!){ruleVersion(id:$id){id rulesetId versionNumber approvedAt status}}', { id: ruleRecord!.versionId });
    expect(version.ruleVersion.approvedAt).toBeTruthy(); expect(version.ruleVersion.status).toBe('ACTIVE');
    expect(version.ruleVersion.rulesetId).toBe(ruleRecord!.rulesetId);
    expect(version.ruleVersion.versionNumber).toBe(ruleRecord!.versionNumber);
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${ruleRecord!.noteId}`);
    const history = page.locator('.note-accumulations');
    await history.locator('article summary').first().click();
    const link = history.getByRole('link', { name: `${ruleRecord!.ruleName} v${ruleRecord!.versionNumber}`, exact: true });
    await expect(link).toHaveAttribute('href', new RegExp(`ruleset=${ruleRecord!.rulesetId}&version=${ruleRecord!.versionId}`));
    await expect(history).toContainText(ruleRecord!.body);
    await history.getByRole('button', { name: '변경 전후·반영 기준 보기', exact: true }).click();
    await expect(history.getByRole('region', { name: '변경 전후와 반영 기준', exact: true })).toContainText('사람 편집 보존');
    await page.screenshot({ path: '.tmp/browser/applied-rule-provenance.png', fullPage: true });
  } finally { await owner.close(); }
});

test('restores a legacy revision without reclassifying its mixed body as human or current knowledge', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const query = 'query($id:UUID!){knowledgeNote(id:$id){revision richBody bodyOrigin}}';
  type NoteState = { knowledgeNote: { revision: number; richBody: string | null; bodyOrigin: string } };
  try {
    const before = (await graphql<NoteState>(owner.request, query, { id: records!.SPACE.noteId })).knowledgeNote;
    expect(before.bodyOrigin).toBe('LEGACY_UNCLASSIFIED');
    const page = await owner.newPage();
    await page.goto(`./?space=${fixture!.space}&note=${records!.SPACE.noteId}`);
    await page.getByRole('tab', { name: '이력', exact: true }).click();
    await expect(page.getByText('이 개정은 작성 구분을 확인해야 하는 기존 본문입니다. 복원할 때도 원문과 작성 구분을 유지합니다.', { exact: true })).toBeVisible();
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: '복원', exact: true }).click();
    await expect.poll(async () => (await graphql<NoteState>(owner.request, query, { id: records!.SPACE.noteId })).knowledgeNote.revision).toBe(before.revision + 1);
    const after = (await graphql<NoteState>(owner.request, query, { id: records!.SPACE.noteId })).knowledgeNote;
    expect(after.richBody).toBe(before.richBody); expect(after.bodyOrigin).toBe('LEGACY_UNCLASSIFIED');
    await expect(page.getByRole('heading', { name: '기존 본문', exact: true })).toBeVisible();
    const current = await graphql<{ knowledgeCurrentItems: { items: unknown[]; bodyOrigin: string } }>(owner.request, 'query($id:UUID!){knowledgeCurrentItems(noteId:$id,offset:0,limit:20){items{id} bodyOrigin}}', { id: records!.SPACE.noteId });
    expect(current.knowledgeCurrentItems.items).toEqual([]); expect(current.knowledgeCurrentItems.bodyOrigin).toBe('LEGACY_UNCLASSIFIED');
  } finally { await owner.close(); }
});
