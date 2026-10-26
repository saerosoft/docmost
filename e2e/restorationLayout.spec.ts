import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { account, fixture, graphql } from './realApi';

test('keeps the Docmost document canvas inside measured desktop and narrow viewports', async ({ browser }, testInfo) => {
  test.skip(!fixture, 'Requires isolated real API accounts and notes.');
  const context = await account(browser, 'owner');
  const page = await context.newPage();
  try {
    await page.goto('./?' + new URLSearchParams({ space: fixture!.space, note: fixture!.sharedNote }));
    await expect(page.getByRole('textbox', { name: '노트 본문', exact: true })).toBeVisible();
    if (process.env.NOTE_GUI_E2E_HOSTED === '1') {
      await expect(page.locator('[data-note-gui-host]')).toBeVisible();
      await expect(page.locator('link[rel="stylesheet"][href="/note-gui/note-gui.css"]')).toHaveCount(1);
      const module = await page.request.get('/note-gui/note-gui.js');
      expect(module.status()).toBe(200);
      expect(new URL(module.url()).origin).toBe(new URL(page.url()).origin);
    }
    for (const width of [1600, 900, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
      await expect(page.getByRole('textbox', { name: '노트 제목', exact: true })).toBeVisible();
      const bounds = await page.getByRole('textbox', { name: '노트 본문', exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width === 375) {
        const toggle = page.getByRole('button', { name: '페이지 탐색', exact: true }).filter({ visible: true });
        await toggle.click();
        await expect(page.getByRole('navigation', { name: '공간 탐색', exact: true })).toBeVisible();
        await page.getByRole('button', { name: '페이지 탐색 닫기', exact: true }).click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      await page.screenshot({ path: testInfo.outputPath('docmost-' + width + '.png') });
    }
  } finally { await context.close(); }
});

test('renders a retained large imported authored document without changing its stored revision', async ({ browser }) => {
  const noteId = process.env.NOTE_GUI_E2E_IMPORTED_NOTE_ID;
  const spaceId = process.env.NOTE_GUI_E2E_IMPORTED_SPACE_ID;
  const storageState = process.env.NOTE_GUI_E2E_CORPUS_STORAGE_STATE;
  test.skip(!noteId || !spaceId || !storageState, 'Requires an explicit existing-owner read-only corpus check.');
  const context = await browser.newContext({
    baseURL: process.env.NOTE_GUI_E2E_BASE_URL || 'http://localhost:9090/',
    storageState, viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const query = 'query($id:UUID!){knowledgeNote(id:$id){id revision body authoredBody richBody}}';
  type Document = { id: string; revision: number; body: string; authoredBody: string | null; richBody: string | null };
  try {
    const before = (await graphql<{ knowledgeNote: Document }>(context.request, query, { id: noteId })).knowledgeNote;
    const expected = before.authoredBody ?? before.body;
    expect(expected.length).toBeGreaterThanOrEqual(90000);
    await page.goto('./?' + new URLSearchParams({ space: spaceId!, note: noteId! }));
    const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
    await expect(body).toBeVisible();
    const paragraph = body.locator(':scope > p').first();
    await expect.poll(async () => (await paragraph.textContent())?.length).toBe(expected.length);
    const visibleText = await paragraph.textContent() ?? '';
    expect(hash(visibleText)).toBe(hash(expected));
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    const after = (await graphql<{ knowledgeNote: Document }>(context.request, query, { id: noteId })).knowledgeNote;
    expect(hash(JSON.stringify(after))).toBe(hash(JSON.stringify(before)));
  } finally { await context.close(); }
});
