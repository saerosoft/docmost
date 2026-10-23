// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { clearAccess, graphql, onAccessLost, request } from './transport';

afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=;max-age=0'; });
it('uses same session and CSRF double submit without caching body content', async () => {
  document.cookie = 'XSRF-TOKEN=test-token';
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } })));
  vi.stubGlobal('fetch', fetch);
  expect(await graphql('{ok}')).toEqual({ ok: true });
  const init = fetch.mock.calls[0][1];
  expect(init.credentials).toBe('same-origin'); expect(init.cache).toBe('no-store');
  expect(init.headers.get('X-XSRF-TOKEN')).toBe('test-token');
});
it('clears mounted content on forbidden responses and rejects stale reads', async () => {
  const listener = vi.fn(); const stop = onAccessLost(listener);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
  await expect(request('/api/files/file')).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  expect(listener).toHaveBeenCalledOnce();
  let resolve!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
  const pending = request('/api/files/other'); clearAccess(); resolve(new Response('private'));
  await expect(pending).rejects.toMatchObject({ code: 'ACCESS_DENIED' }); stop();
});
