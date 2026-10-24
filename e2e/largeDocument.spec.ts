import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { account, fixture, graphql } from './realApi';

test.skip(!fixture, 'Requires isolated real API accounts and storage.');

test('saves a long structured document and a 20 MiB attachment without truncation', async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await account(browser, 'owner');
  const result = await graphql<{ createKnowledgeNote: { id: string; title: string } }>(owner.request, 'mutation($input:CreateNoteInput!){createKnowledgeNote(input:$input){id title}}', { input: { spaceId: fixture!.space, title: `Large note ${crypto.randomUUID().slice(0, 8)}`, body: '', visibility: 'PRIVATE', idempotencyKey: crypto.randomUUID() } });
  const note = result.createKnowledgeNote;
  const query = 'query($id:UUID!){knowledgeNote(id:$id){revision body richBody}}';
  type Stored = { knowledgeNote: { revision: number; body: string; richBody: string } };
  try {
    const paragraphs = Array.from({ length: 1000 }, (_, index) => `Paragraph ${String(index).padStart(4, '0')}: ` + 'Korean 한국어 evidence remains complete. '.repeat(2));
    const richBody = JSON.stringify({ type: 'doc', content: paragraphs.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) });
    await graphql(owner.request, 'mutation($id:UUID!,$input:SaveRichNoteInput!){saveRichNote(id:$id,input:$input){id}}', { id: note.id, input: { title: note.title, expectedRevision: 1, richBody, schemaVersion: 1, idempotencyKey: crypto.randomUUID() } });
    const page = await owner.newPage();
    const start = performance.now();
    await page.goto(`/?space=${fixture!.space}&note=${note.id}`);
    const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
    await expect(body.locator('p')).toHaveCount(1000);
    await expect(body.locator('p').last()).toHaveText(paragraphs.at(-1)!);
    const openMs = performance.now() - start;
    await body.press('Control+End'); await body.press('Enter'); await body.pressSequentially('Browser large-document edit.');
    const payload = randomBytes(20 * 1024 * 1024);
    const checksum = createHash('sha256').update(payload).digest('hex');
    const uploadStart = performance.now();
    const uploaded = page.waitForResponse(response => response.url().endsWith('/api/files') && response.request().method() === 'POST');
    await page.locator('input[type="file"]').setInputFiles({ name: 'large-acceptance.bin', mimeType: 'application/octet-stream', buffer: payload });
    const upload = await uploaded; expect(upload.ok()).toBe(true);
    await expect(body.getByText('large-acceptance.bin', { exact: true })).toBeVisible();
    const uploadMs = performance.now() - uploadStart;
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    await page.reload();
    await expect(body.locator('p').first()).toHaveText(paragraphs[0]);
    await expect(body).toContainText('Browser large-document edit.');
    await body.getByText('large-acceptance.bin', { exact: true }).scrollIntoViewIfNeeded();
    const downloaded = page.waitForEvent('download');
    await body.getByRole('link', { name: 'Download', exact: true }).click();
    const download = await downloaded;
    mkdirSync('.tmp/acceptance', { recursive: true });
    const path = '.tmp/acceptance/large-attachment-download.bin';
    await download.saveAs(path);
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(checksum);
    unlinkSync(path);
    const saved = (await graphql<Stored>(owner.request, query, { id: note.id })).knowledgeNote;
    expect(saved.body).toContain(paragraphs[0]); expect(saved.body).toContain(paragraphs.at(-1)!);
    const attachment = JSON.parse(saved.richBody).content.find((node: { type: string }) => node.type === 'attachment');
    expect(attachment.attrs.fileId).toMatch(/^[a-f0-9-]{36}$/);
    const beforeInvalid = saved.richBody;
    await body.fill('x'.repeat(110_000));
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(body).toHaveText('x'.repeat(110_000));
    expect((await graphql<Stored>(owner.request, query, { id: note.id })).knowledgeNote.richBody).toBe(beforeInvalid);
    writeFileSync('.tmp/acceptance/large-document.json', JSON.stringify({ paragraphs: paragraphs.length, textCharacters: paragraphs.join('\n').length, structuredBytes: Buffer.byteLength(richBody), attachmentBytes: payload.length, attachmentSha256: checksum, openMs, uploadMs, oversizedDraftCharacters: 110_000, storedBodyPreservedAfterRejection: true }, null, 2));
  } finally {
    const current = (await graphql<Stored>(owner.request, query, { id: note.id })).knowledgeNote;
    await graphql(owner.request, 'mutation($id:UUID!,$input:ArchiveNoteInput!){archiveNote(id:$id,input:$input)}', { id: note.id, input: { expectedRevision: current.revision } });
    await owner.close();
  }
});
