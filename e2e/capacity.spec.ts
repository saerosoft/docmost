import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { account, fixture, graphql } from './realApi';

const scalePath = process.env.NOTE_GUI_E2E_SCALE_FIXTURE;
const scale = scalePath ? JSON.parse(readFileSync(scalePath, 'utf8')) as { verifiedRows: number; rootNotes: number; probeIds: Record<string, string> } : undefined;
test.skip(!fixture || !scale, 'Requires an isolated million-note corpus and NOTE_GUI_E2E_SCALE_FIXTURE.');

test('bounds tree transfers, rendered rows and retained heap while navigating a million real notes', async ({ browser }) => {
  test.setTimeout(120_000);
  expect(scale!.verifiedRows).toBeGreaterThanOrEqual(1_000_000);
  const runs: object[] = [];
  for (let run = 0; run < 3; run++) {
    const context = await account(browser, 'owner');
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const rows = page.getByRole('tree', { name: '현재 경로의 노트', exact: true }).getByRole('treeitem');
    const transfers: { rows: number; bytes: number }[] = [];
    const pending: Promise<void>[] = [];
    page.on('response', response => {
      if (response.url().endsWith('/graphql') && response.request().postDataJSON()?.query?.includes('noteTree(')) {
        pending.push(response.body().then(body => { const value = JSON.parse(body.toString()); if (value.data?.noteTree) transfers.push({ rows: value.data.noteTree.length, bytes: body.length }); }));
      }
    });
    try {
      await page.goto(`/?space=${fixture!.corpus}`);
      await expect(rows.first()).toBeVisible();
      const firstId = await rows.first().getAttribute('data-row-id');
      await session.send('HeapProfiler.collectGarbage');
      const baseline = await session.send('Runtime.getHeapUsage');
      const navigation: number[] = [];
      let middleHeap = 0;
      let maxRenderedRows = 0;
      for (let index = 0; index < 50; index++) {
        const before = await rows.first().getAttribute('data-row-id');
        const started = performance.now();
        await page.getByRole('button', { name: '다음', exact: true }).click();
        await expect(rows.first()).not.toHaveAttribute('data-row-id', before!);
        navigation.push(performance.now() - started);
        maxRenderedRows = Math.max(maxRenderedRows, await rows.count());
        if (index === 19) {
          await session.send('HeapProfiler.collectGarbage');
          middleHeap = (await session.send('Runtime.getHeapUsage')).usedSize;
        }
      }
      await session.send('HeapProfiler.collectGarbage');
      const finalHeap = (await session.send('Runtime.getHeapUsage')).usedSize;
      const refetch = page.waitForResponse(response => response.url().endsWith('/graphql') && response.request().postDataJSON()?.query?.includes('noteTree(') && response.request().postDataJSON()?.variables.after === null);
      await page.getByRole('button', { name: '루트', exact: true }).click();
      await refetch;
      await expect(rows.first()).toHaveAttribute('data-row-id', firstId!);
      await Promise.all(pending);
      expect(transfers.length).toBeLessThanOrEqual(55);
      expect(transfers.every(item => item.rows <= 50 && item.bytes < 32_000)).toBe(true);
      expect(maxRenderedRows).toBeLessThanOrEqual(60);
      expect(finalHeap - middleHeap).toBeLessThan(32 * 1024 * 1024);
      const ordered = [...navigation].sort((a, b) => a - b);
      runs.push({ run: run + 1, notes: scale!.verifiedRows, pages: 50, rootNotes: scale!.rootNotes, transfers: transfers.length, maximumRowsPerResponse: Math.max(...transfers.map(item => item.rows)), maximumResponseBytes: Math.max(...transfers.map(item => item.bytes)), maximumRenderedRows: maxRenderedRows, navigationP50Ms: ordered[24], navigationP95Ms: ordered[47], navigationMaxMs: ordered[49], baselineHeapBytes: baseline.usedSize, heapAfter20Pages: middleHeap, heapAfter50Pages: finalHeap, evictedFirstPageRefetched: true });
    } finally { await context.close(); }
  }
  mkdirSync('.tmp/acceptance', { recursive: true });
  writeFileSync('.tmp/acceptance/browser-capacity.json', JSON.stringify({ runs }, null, 2) + '\n');
});

test('restores a child location and saves structured content inside the million-note corpus', async ({ browser }) => {
  const context = await account(browser, 'owner');
  try {
    const page = await context.newPage();
    const id = scale!.probeIds['100001'];
    await page.goto(`/?space=${fixture!.corpus}&note=${id}`);
    const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
    await expect(body).toContainText('Capacity fixture 100001:');
    await expect(page.getByRole('treeitem', { name: 'Scale note 0100001', exact: true })).toBeVisible();
    expect(await page.getByRole('treeitem').count()).toBeLessThanOrEqual(10);
    await body.press('Control+End');
    await body.pressSequentially(' Browser capacity roundtrip.');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    await page.reload();
    await expect(body).toContainText('Browser capacity roundtrip.');
    const stored = await graphql<{ knowledgeNote: { revision: number; richBody: string } }>(context.request, 'query($id:UUID!){knowledgeNote(id:$id){revision richBody}}', { id });
    expect(stored.knowledgeNote.revision).toBeGreaterThan(1);
    expect(JSON.parse(stored.knowledgeNote.richBody).type).toBe('doc');
  } finally { await context.close(); }
});
