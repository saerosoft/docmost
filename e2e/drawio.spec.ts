import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { account, fixture, graphql, role } from './realApi';

const origin = process.env.NOTE_GUI_E2E_DRAWIO_ORIGIN;
test.skip(!fixture || !origin, 'Requires isolated real API accounts and an approved self-hosted Draw.io origin.');

const initial = '<mxfile><diagram name="Acceptance"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Original graphical shape" vertex="1" parent="1"><mxGeometry x="20" y="20" width="180" height="80" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';
const noteQuery = 'query($id:UUID!){knowledgeNote(id:$id){id title revision richBody}}';
type Stored = { knowledgeNote: { id: string; title: string; revision: number; richBody: string } };

async function create(request: APIRequestContext, visibility: 'SPACE' | 'ADMINISTRATORS') {
  const result = await graphql<{ createKnowledgeNote: { id: string } }>(request, 'mutation($input:CreateNoteInput!){createKnowledgeNote(input:$input){id}}', { input: { spaceId: fixture!.space, title: `Draw.io embed ${crypto.randomUUID().slice(0, 8)}`, body: '', visibility, idempotencyKey: crypto.randomUUID() } });
  const id = result.createKnowledgeNote.id;
  const csrf = await (await request.get('/api/csrf')).json();
  const upload = await request.post('/api/files', { headers: { 'X-XSRF-TOKEN': csrf.token }, multipart: { noteId: id, spaceId: fixture!.space, visibility, file: { name: 'acceptance.drawio', mimeType: 'application/octet-stream', buffer: Buffer.from(initial) } } });
  expect(upload.ok()).toBe(true);
  const file = await upload.json() as { id: string };
  const current = (await graphql<Stored>(request, noteQuery, { id })).knowledgeNote;
  await graphql(request, 'mutation($id:UUID!,$input:SaveRichNoteInput!){saveRichNote(id:$id,input:$input){id}}', { id, input: { title: current.title, expectedRevision: current.revision, richBody: JSON.stringify({ type: 'doc', content: [{ type: 'drawio', attrs: { fileId: file.id } }] }), schemaVersion: 1, idempotencyKey: crypto.randomUUID() } });
  return { id, fileId: file.id };
}

async function archive(request: APIRequestContext, id: string) {
  const current = (await graphql<Stored>(request, noteQuery, { id })).knowledgeNote;
  await graphql(request, 'mutation($id:UUID!,$input:ArchiveNoteInput!){archiveNote(id:$id,input:$input)}', { id, input: { expectedRevision: current.revision } });
}

async function open(page: Page, label: string) {
  await page.getByRole('button', { name: '다이어그램 편집', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Draw.io editor"]');
  await expect(frame.getByText(label, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Draw.io XML', { exact: true })).toHaveJSProperty('readOnly', true);
  return frame;
}

test('edits graphical Draw.io text twice and preserves immutable attachment bytes after reload', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const created = await create(owner.request, 'SPACE');
  try {
    const page = await owner.newPage();
    const external = new Set<string>();
    page.on('request', request => { const url = new URL(request.url()); if (url.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(url.hostname)) external.add(url.origin); });
    await page.goto(`/?space=${fixture!.space}&note=${created.id}`);
    for (const [before, after] of [['Original graphical shape', 'First graphical edit'], ['First graphical edit', 'Reopened graphical edit']]) {
      const frame = await open(page, before);
      const source = page.getByLabel('Draw.io XML', { exact: true });
      const original = await source.inputValue();
      await page.evaluate(approved => {
        const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="Draw.io editor"]')!;
        for (const [messageOrigin, messageSource] of [['https://unapproved.invalid', iframe.contentWindow], [approved, window]] as const) {
          window.dispatchEvent(new MessageEvent('message', { origin: messageOrigin, source: messageSource, data: JSON.stringify({ event: 'save', xml: '<mxfile><diagram name="Forged"/></mxfile>' }) }));
        }
      }, origin!);
      await expect(source).toHaveValue(original);
      await frame.getByText(before, { exact: true }).dblclick();
      const editor = frame.locator('.mxCellEditor[contenteditable="true"]');
      await editor.fill(after); await editor.press('Control+Enter');
      await expect(source).toHaveValue(new RegExp(after));
      const embedded = page.frames().find(candidate => candidate.url().startsWith(origin!))!;
      expect(await embedded.evaluate(() => [...Object.values(localStorage)].some(value => value.includes('graphical shape') || value.includes('graphical edit')))).toBe(false);
      expect(await embedded.evaluate(async () => {
        const databases = await indexedDB.databases();
        const values = await Promise.all(databases.map(database => new Promise<unknown[]>((resolve, reject) => {
          const open = indexedDB.open(database.name!);
          open.onerror = () => reject(open.error);
          open.onsuccess = async () => {
            const db = open.result;
            try {
              resolve((await Promise.all([...db.objectStoreNames].map(name => new Promise<unknown[]>((read, fail) => {
                const all = db.transaction(name).objectStore(name).getAll();
                all.onsuccess = () => read(all.result); all.onerror = () => fail(all.error);
              })))).flat());
            } catch (error) { reject(error); } finally { db.close(); }
          };
        })));
        return values.flat().filter(value => {
          const entry = value as { title?: string; data?: unknown };
          return entry.title !== '.scratchpad' || entry.data != null;
        }).length;
      })).toBe(0);
      await frame.getByText('Save', { exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
      await page.reload();
    }
    const current = (await graphql<Stored>(owner.request, noteQuery, { id: created.id })).knowledgeNote;
    const fileId = JSON.parse(current.richBody).content.find((node: { type: string }) => node.type === 'drawio').attrs.fileId;
    expect(fileId).not.toBe(created.fileId);
    const saved = await owner.request.get(`/api/files/${fileId}`);
    expect(await saved.text()).toContain('Reopened graphical edit');
    expect(await (await owner.request.get(`/api/files/${created.fileId}`)).text()).toBe(initial);
    expect([...external]).toEqual([]);
    await open(page, 'Reopened graphical edit');
    await page.screenshot({ path: '.tmp/browser/drawio-graphical-reopened.png', fullPage: true });
    await page.getByRole('button', { name: 'Draw.io 닫기', exact: true }).click();
  } finally { await archive(owner.request, created.id); await owner.close(); }
});

test('removes an open graphical attachment after administrator access is revoked', async ({ browser }) => {
  const owner = await account(browser, 'owner');
  const peer = await account(browser, 'peer');
  const created = await create(owner.request, 'ADMINISTRATORS');
  try {
    await role(owner.request, fixture!.peer, 'OWNER');
    const page = await peer.newPage();
    await page.goto(`/?space=${fixture!.space}&note=${created.id}`);
    const frame = await open(page, 'Original graphical shape');
    await frame.getByText('Original graphical shape', { exact: true }).dblclick();
    await frame.locator('.mxCellEditor[contenteditable="true"]').fill('Unsaved restricted diagram');
    await frame.locator('.mxCellEditor[contenteditable="true"]').press('Control+Enter');
    await role(owner.request, fixture!.peer, 'EDITOR');
    await expect(page.locator('iframe[title="Draw.io editor"]')).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByLabel('Draw.io XML', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '노트 본문', exact: true })).toHaveCount(0);
    expect([403, 404]).toContain((await peer.request.get(`/api/files/${created.fileId}`)).status());
  } finally { await role(owner.request, fixture!.peer, 'EDITOR'); await archive(owner.request, created.id); await Promise.all([owner.close(), peer.close()]); }
});
