import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { account, fixture, graphql, response, role } from './realApi';

interface PipelineFixture {
  SPACE: { noteId: string }; PRIVATE: { noteId: string }; ADMINISTRATORS: { noteId: string };
  operations: { operationId: string; sourceRevisionId: string; visibility: string; kind: string; body: string }[];
}
const path = process.env.NOTE_GUI_E2E_PIPELINE;
const records = path ? JSON.parse(readFileSync(path, 'utf8')) as PipelineFixture : undefined;
test.skip(!fixture || !records, 'Requires persisted, reviewed accumulation records and isolated account sessions.');

test('pages real accumulation history and shows original evidence and actual before/after revisions', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  try {
    const page = await owner.newPage();
    await page.goto(`/?space=${fixture!.space}&note=${records!.SPACE.noteId}`);
    const history = page.locator('.note-accumulations');
    await expect(history.locator('article.accumulation-item')).toHaveCount(20);
    await history.getByRole('button', { name: '다음 반영 내역', exact: true }).click();
    await expect(history.locator('article.accumulation-item')).toHaveCount(5);
    const replaced = history.locator('article.accumulation-item').filter({ has: page.getByText('개정 2', { exact: true }) });
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
    await page.goto(`/?space=${fixture!.space}&note=${records!.PRIVATE.noteId}`);
    await expect(page.locator('.note-evidence .visibility-label').first()).toHaveText('본인만');
    await page.goto(`/?space=${fixture!.space}&note=${records!.ADMINISTRATORS.noteId}`);
    await expect(page.locator('.note-evidence .visibility-label').first()).toHaveText('관리자 전용');
    for (const visibility of ['PRIVATE', 'ADMINISTRATORS'] as const) {
      const operation = records!.operations.find(value => value.visibility === visibility)!;
      const queries = [
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
    await peerPage.goto(`/?space=${fixture!.space}&note=${records!.ADMINISTRATORS.noteId}`);
    await peerPage.locator('.note-accumulations').getByRole('button', { name: '변경 전후·반영 기준 보기', exact: true }).first().click();
    await expect(peerPage.getByRole('region', { name: '변경 전후와 반영 기준', exact: true })).toBeVisible();
    await role(owner.request, fixture!.peer, 'EDITOR');
    await expect(peerPage.locator('.note-accumulations')).toHaveCount(0, { timeout: 45_000 });
    await expect(peerPage.getByRole('region', { name: '변경 전후와 반영 기준', exact: true })).toHaveCount(0);
    await expect(peerPage.getByText('The review time remains tentative and needs confirmation.', { exact: true })).toHaveCount(0);
  } finally { await role(owner.request, fixture!.peer, 'EDITOR'); await Promise.all([owner.close(), peer.close()]); }
});
