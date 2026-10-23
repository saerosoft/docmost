import { expect, test, type Page } from '@playwright/test';

const created = new Set<string>();

async function graphQL<T>(page: Page, query: string, variables: object = {}): Promise<T> {
  const csrf = await (await page.request.get('/api/csrf')).json();
  const response = await page.request.post('/graphql', { headers: { 'X-XSRF-TOKEN': csrf.token }, data: { query, variables } });
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.errors, JSON.stringify(body.errors)).toBeUndefined();
  return body.data;
}

async function createNote(page: Page, title: string) {
  await page.getByLabel('새 노트 제목', { exact: false }).fill(title);
  await page.getByRole('button', { name: '현재 경로에 만들기', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '노트 제목', exact: true })).toHaveText(title);
  const id = new URL(page.url()).searchParams.get('note');
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  created.add(id!);
  return id!;
}

test.beforeEach(async ({ page }) => {
  if (!process.env.NOTE_GUI_E2E_STORAGE_STATE) {
    const identifier = process.env.NOTE_GUI_E2E_EMAIL;
    const password = process.env.NOTE_GUI_E2E_PASSWORD;
    if (!identifier || !password) throw new Error('Set NOTE_GUI_E2E_STORAGE_STATE or NOTE_GUI_E2E_EMAIL and NOTE_GUI_E2E_PASSWORD for a local test account.');
    await graphQL(page, 'mutation($input:LoginInput!){login(input:$input){id}}', { input: { identifier, password, rememberMe: false } });
  }
  await page.goto('/');
  await expect(page.getByLabel('새 노트 제목', { exact: false })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  for (const id of [...created].reverse()) {
    const current = await graphQL<{ knowledgeNote: { revision: number } | null }>(page, 'query($id:UUID!){knowledgeNote(id:$id){revision}}', { id });
    if (current.knowledgeNote) {
      const result = await graphQL<{ archiveNote: boolean | null }>(page, 'mutation($id:UUID!,$input:ArchiveNoteInput!){archiveNote(id:$id,input:$input)}', { id, input: { expectedRevision: current.knowledgeNote.revision } });
      expect(result.archiveNote).toBe(true);
    }
  }
  created.clear();
});

test('saves structured notes with the KN-02 context and a compact editor', async ({ page }) => {
  const title = `GUI acceptance ${crypto.randomUUID().slice(0, 8)}`;
  const id = await createNote(page, title);
  const titleBounds = await page.getByRole('textbox', { name: '노트 제목', exact: true }).boundingBox();
  expect(titleBounds!.height).toBeLessThan(140);
  await expect(page.getByRole('heading', { name: '현재 정리', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '새 소스 반영 기준', exact: true })).toBeVisible();
  const summaryBounds = (await page.getByRole('region', { name: '현재 정리', exact: true }).boundingBox())!;
  const policyBounds = (await page.getByRole('region', { name: '새 소스 반영 기준', exact: true }).boundingBox())!;
  expect(summaryBounds.x).toBeLessThan(policyBounds.x);
  expect(summaryBounds.y).toBeLessThan(800);
  await expect(page.getByText('반영된 정리가 없습니다.', { exact: true })).toBeVisible();
  const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
  await body.fill('Human-authored note.');
  await body.press('End');
  await body.press('Control+b');
  await body.pressSequentially(' Bold detail.');
  await body.press('Control+b');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await page.reload();
  await expect(body).toHaveText('Human-authored note. Bold detail.');
  const saved = await graphQL<{ knowledgeNote: { richBody: string } }>(page, 'query($id:UUID!){knowledgeNote(id:$id){richBody}}', { id });
  expect(JSON.parse(saved.knowledgeNote.richBody).content[0].content[1].marks).toContainEqual({ type: 'bold' });
  await page.getByRole('textbox', { name: '댓글', exact: true }).fill('Browser acceptance comment.');
  await page.getByRole('button', { name: '댓글 남기기', exact: true }).click();
  await expect(page.getByText('Browser acceptance comment.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '속성', exact: true }).click();
  await page.getByRole('button', { name: '속성 추가', exact: true }).click();
  await page.getByRole('textbox', { name: '속성 이름', exact: true }).fill('acceptance');
  await page.getByLabel('값', { exact: true }).fill('verified');
  await page.getByRole('button', { name: '이 속성 저장', exact: true }).click();
  await expect(page.getByText('속성 변경을 저장했습니다.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(body).toHaveText('Human-authored note. Bold detail.');
  await page.getByRole('tab', { name: '속성', exact: true }).click();
  await expect(page.getByLabel('값', { exact: true })).toHaveValue('verified');
  await page.getByRole('button', { name: 'acceptance 속성 삭제', exact: true }).click();
  await page.getByRole('button', { name: '삭제 확인', exact: true }).click();
  await expect(page.getByText('아직 속성이 없습니다.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: '현재 정리', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: '.tmp/browser/note-mobile.png', fullPage: true });
  await page.getByRole('heading', { name: '현재 정리', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: '현재 정리', exact: true })).toBeInViewport();
  await page.screenshot({ path: '.tmp/browser/note-mobile-context.png', fullPage: true });
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('preserves tab drafts, isolates split panes, rejects stale saves and restores a revision', async ({ page }) => {
  const title = `GUI split ${crypto.randomUUID().slice(0, 8)}`;
  const id = await createNote(page, title);
  const otherTitle = `GUI tab ${crypto.randomUUID().slice(0, 8)}`;
  await createNote(page, otherTitle);
  const left = page.getByRole('region', { name: '왼쪽 편집 창', exact: true });
  const body = left.getByRole('textbox', { name: '노트 본문', exact: true });
  await left.getByRole('tab', { name: title, exact: true }).click();
  await body.fill('Draft retained across tabs.');
  await left.getByRole('tab', { name: otherTitle, exact: true }).click();
  await left.getByRole('tab', { name: `${title} •`, exact: true }).click();
  await expect(body).toHaveText('Draft retained across tabs.');
  await left.getByRole('button', { name: '탭 오른쪽으로 이동', exact: true }).first().click();
  await expect(left.getByRole('tablist', { name: '왼쪽 노트 탭', exact: true }).getByRole('tab').last()).toHaveText(`${title} •`);
  await left.getByRole('button', { name: `${otherTitle} 탭 닫기`, exact: true }).click();
  await left.getByRole('button', { name: '저장', exact: true }).click();
  await expect(left.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '두 창으로', exact: true }).click();
  await page.getByRole('combobox', { name: '노트를 열 창', exact: true }).click();
  await page.getByRole('option', { name: '오른쪽 창', exact: true }).click();
  await page.getByRole('treeitem', { name: title, exact: true }).click();
  const right = page.getByRole('region', { name: '오른쪽 편집 창', exact: true });
  const rightBody = right.getByRole('textbox', { name: '노트 본문', exact: true });
  await expect(rightBody).toHaveText('Draft retained across tabs.');
  await body.fill('First writer through the left pane.');
  await rightBody.fill('Independent right-pane draft.');
  await left.getByRole('button', { name: '저장', exact: true }).click();
  await expect(left.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(right.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await right.getByRole('button', { name: '저장', exact: true }).click();
  await expect(right.getByRole('alert')).toBeVisible();
  await expect(rightBody).toHaveText('Independent right-pane draft.');
  const current = await graphQL<{ knowledgeNote: { body: string } }>(page, 'query($id:UUID!){knowledgeNote(id:$id){body}}', { id });
  expect(current.knowledgeNote.body).toBe('First writer through the left pane.');
  await right.getByRole('button', { name: '최신 버전 확인', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await right.getByRole('button', { name: '서버 버전 열기', exact: true }).click();
  await expect(rightBody).toHaveText('First writer through the left pane.');
  await right.getByRole('tab', { name: '이력', exact: true }).click();
  await right.getByRole('button', { name: /개정 2 ·/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await right.getByRole('button', { name: '복원', exact: true }).click();
  await expect(rightBody).toHaveText('Draft retained across tabs.');
  await expect(body).toHaveText('First writer through the left pane.');
  const restored = await graphQL<{ knowledgeNote: { revision: number; body: string } }>(page, 'query($id:UUID!){knowledgeNote(id:$id){revision body}}', { id });
  expect(restored.knowledgeNote.revision).toBeGreaterThan(3);
  expect(restored.knowledgeNote.body).toBe('Draft retained across tabs.');
  await page.screenshot({ path: '.tmp/browser/note-split.png', fullPage: true });
});

test('round-trips editable Mermaid, Draw.io and Excalidraw attachment revisions', async ({ page }) => {
  test.setTimeout(120_000);
  const id = await createNote(page, `GUI diagrams ${crypto.randomUUID().slice(0, 8)}`);
  const body = page.getByRole('textbox', { name: '노트 본문', exact: true });
  async function insert(kind: string) {
    await body.click();
    await body.press('Control+End');
    await page.getByRole('button', { name: '다이어그램 삽입', exact: true }).click();
    await page.getByRole('menuitem', { name: kind, exact: true }).click();
  }
  async function saveNote() {
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  }
  await insert('mermaid');
  await page.getByRole('button', { name: '원본 편집', exact: true }).click();
  await page.getByLabel('Mermaid 원본', { exact: true }).fill('graph TD\n  API --> Note');
  await page.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용', exact: true }).click();
  await saveNote();
  await page.reload();
  await expect(body.locator('svg')).toContainText('API');
  await page.getByRole('button', { name: '원본 편집', exact: true }).click();
  await expect(page.getByLabel('Mermaid 원본', { exact: true })).toHaveValue('graph TD\n  API --> Note');
  await page.getByLabel('Mermaid 원본', { exact: true }).fill('graph TD\n  API --> Note --> History');
  await page.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용', exact: true }).click();
  await insert('drawio');
  await page.getByRole('button', { name: '다이어그램 편집', exact: true }).click();
  const xml = '<mxfile><diagram name="Acceptance"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="API note" vertex="1" parent="1"><mxGeometry x="20" y="20" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';
  await page.getByLabel('Draw.io XML', { exact: true }).fill(xml);
  await page.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용', exact: true }).click();
  await saveNote();
  await page.reload();
  await page.getByRole('button', { name: '다이어그램 편집', exact: true }).click();
  await expect(page.getByLabel('Draw.io XML', { exact: true })).toHaveValue(xml);
  await expect(page.getByRole('button', { name: 'Draw.io 닫기', exact: true })).toBeInViewport();
  const updatedXml = xml.replace('API note', 'Reopened API note');
  await page.getByLabel('Draw.io XML', { exact: true }).fill(updatedXml);
  await page.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용', exact: true }).click();
  await insert('excalidraw');
  await page.getByRole('button', { name: '드로잉 편집', exact: true }).click();
  const canvas = page.locator('.excalidraw canvas.interactive');
  await expect(canvas).toBeVisible();
  const rectangle = page.getByRole('radio', { name: 'Rectangle', exact: true });
  await page.locator('label').filter({ has: rectangle }).click();
  await expect(rectangle).toBeChecked();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .45, bounds.y + 220);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .45 + 220, bounds.y + 340, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '저장 후 나가기', exact: true }).click();
  await saveNote();
  await page.reload();
  await page.getByRole('button', { name: '드로잉 편집', exact: true }).click();
  await expect(canvas).toBeVisible();
  const firstSave = await graphQL<{ knowledgeNote: { richBody: string } }>(page, 'query($id:UUID!){knowledgeNote(id:$id){richBody}}', { id });
  const originalSceneId = JSON.parse(firstSave.knowledgeNote.richBody).content.find((node: { type: string }) => node.type === 'excalidraw').attrs.fileId as string;
  const ellipse = page.getByRole('radio', { name: 'Ellipse', exact: true });
  await page.locator('label').filter({ has: ellipse }).click();
  const reopenedBounds = (await canvas.boundingBox())!;
  await page.mouse.move(reopenedBounds.x + reopenedBounds.width * .65, reopenedBounds.y + 380);
  await page.mouse.down();
  await page.mouse.move(reopenedBounds.x + reopenedBounds.width * .65 + 120, reopenedBounds.y + 460, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '저장 후 나가기', exact: true }).click();
  await saveNote();
  await page.reload();
  const note = await graphQL<{ knowledgeNote: { richBody: string } }>(page, 'query($id:UUID!){knowledgeNote(id:$id){richBody}}', { id });
  const nodes = JSON.parse(note.knowledgeNote.richBody).content as { type: string; attrs?: { fileId: string; source?: string } }[];
  for (const kind of ['mermaid', 'drawio', 'excalidraw']) expect(nodes.find(node => node.type === kind)?.attrs?.fileId).toBeTruthy();
  expect(nodes.find(node => node.type === 'mermaid')?.attrs?.source).toBe('graph TD\n  API --> Note --> History');
  const sceneId = nodes.find(node => node.type === 'excalidraw')!.attrs!.fileId;
  const scene = await (await page.request.get(`/api/files/${sceneId}`)).json();
  expect(sceneId).not.toBe(originalSceneId);
  expect(scene.elements).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'rectangle', isDeleted: false }),
    expect.objectContaining({ type: 'ellipse', isDeleted: false }),
  ]));
  const oldScene = await (await page.request.get(`/api/files/${originalSceneId}`)).json();
  expect(oldScene.elements).toHaveLength(1);
  expect(oldScene.elements[0].type).toBe('rectangle');
  const drawioId = nodes.find(node => node.type === 'drawio')!.attrs!.fileId;
  expect(await (await page.request.get(`/api/files/${drawioId}`)).text()).toBe(updatedXml);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('records relationships and backlinks, then moves selected notes into a subtree', async ({ page }) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const parentTitle = `GUI parent ${suffix}`;
  const parentId = await createNote(page, parentTitle);
  const firstTitle = `GUI first ${suffix}`;
  const firstId = await createNote(page, firstTitle);
  const secondTitle = `GUI second ${suffix}`;
  const secondId = await createNote(page, secondTitle);
  await page.getByRole('tab', { name: firstTitle, exact: true }).click();
  await page.getByRole('tab', { name: '관계', exact: true }).click();
  await page.getByRole('textbox', { name: '연결할 노트', exact: true }).fill(secondTitle);
  await page.getByRole('list', { name: '연결할 노트 검색 결과', exact: true }).getByRole('button', { name: secondTitle, exact: true }).click();
  await page.getByRole('button', { name: '관계 추가', exact: true }).click();
  await expect(page.getByText('이 노트 → 연결된 노트', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: secondTitle, exact: true }).click();
  await page.getByRole('tab', { name: '관계', exact: true }).click();
  await expect(page.getByText('연결된 노트 → 이 노트', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: `${firstTitle} 선택`, exact: true }).check();
  await page.getByRole('checkbox', { name: `${secondTitle} 선택`, exact: true }).check();
  await page.getByText('선택한 노트 이동 · 2', { exact: true }).click();
  await page.getByRole('textbox', { name: '대상 상위 노트 (선택하지 않으면 루트)', exact: true }).fill(parentTitle);
  await page.getByRole('list', { name: '대상 상위 노트 (선택하지 않으면 루트) 검색 결과', exact: true }).getByRole('button', { name: parentTitle, exact: true }).click();
  await page.getByRole('button', { name: '선택 노트 이동', exact: true }).click();
  await expect(page.getByText('선택한 노트 이동 · 0', { exact: true })).toBeVisible();
  for (const id of [firstId, secondId]) {
    const note = await graphQL<{ knowledgeNote: { parentId: string } }>(page, 'query($id:UUID!){knowledgeNote(id:$id){parentId}}', { id });
    expect(note.knowledgeNote.parentId).toBe(parentId);
  }
  await page.getByRole('button', { name: '루트', exact: true }).click();
  await page.getByRole('button', { name: `${parentTitle} 하위 트리 보기`, exact: true }).click();
  await expect(page.getByRole('treeitem', { name: firstTitle, exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: secondTitle, exact: true })).toBeVisible();
  const siblings = page.getByRole('tree', { name: '현재 경로의 노트', exact: true }).getByRole('treeitem');
  await expect(siblings).toHaveCount(2);
  await siblings.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(siblings.nth(1)).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
