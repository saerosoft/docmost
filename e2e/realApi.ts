import { expect, type APIRequestContext, type Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface AcceptanceFixture {
  space: string; destination: string; corpus: string;
  owner: string; peer: string; outsider: string;
  sharedNote: string; privateNote: string; administratorNote: string; peerPrivateNote: string;
}
const path = process.env.NOTE_GUI_E2E_FIXTURE;
export const fixture = path ? JSON.parse(readFileSync(path, 'utf8')) as AcceptanceFixture : undefined;

export async function account(browser: Browser, role: 'owner' | 'peer' | 'outsider') {
  if (!path) throw new Error('NOTE_GUI_E2E_FIXTURE must identify an isolated real-API acceptance fixture.');
  return browser.newContext({
    baseURL: process.env.NOTE_GUI_E2E_BASE_URL || 'http://localhost:9090',
    storageState: resolve(dirname(path), `${role}-auth.json`),
    viewport: { width: 1600, height: 1000 },
  });
}

export async function response<T>(request: APIRequestContext, query: string, variables: object = {}) {
  const csrf = await (await request.get('/api/csrf')).json();
  const result = await request.post('/graphql', { headers: { 'X-XSRF-TOKEN': csrf.token }, data: { query, variables } });
  expect(result.ok()).toBe(true);
  return await result.json() as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
}

export async function graphql<T>(request: APIRequestContext, query: string, variables: object = {}) {
  const result = await response<T>(request, query, variables);
  expect(result.errors, JSON.stringify(result.errors)).toBeUndefined();
  expect(result.data).toBeTruthy();
  return result.data!;
}

export async function role(request: APIRequestContext, accountId: string, value: 'OWNER' | 'EDITOR' | 'VIEWER' | null) {
  const result = await graphql<{ setSpaceMember: boolean }>(request, 'mutation($space:UUID!,$account:UUID!,$role:SpaceRole){setSpaceMember(spaceId:$space,accountId:$account,role:$role)}', { space: fixture!.space, account: accountId, role: value });
  expect(result.setSpaceMember).toBe(true);
}
