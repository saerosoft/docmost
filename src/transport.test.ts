// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { clearAccess, graphql, onAccessLost, request } from './transport';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=;max-age=0'; });
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

it('preserves the named GraphQL input field alongside its localized message and failure code', async () => {
  document.cookie = 'XSRF-TOKEN=test-token';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: { addNoteRelation: null },
    errors: [{ message: '입력한 값을 확인해 주세요.', extensions: { code: 'INVALID_INPUT', field: 'toNoteId', messageKey: 'failure.invalid' } }],
  }))));
  await expect(graphql('mutation { addNoteRelation }')).rejects.toMatchObject({
    message: '입력한 값을 확인해 주세요.', code: 'INVALID_INPUT', field: 'toNoteId',
  });
});

it.each([
  { name: 'timeout', failure: new DOMException('signal timed out', 'TimeoutError') },
  { name: 'interruption', failure: new DOMException('body read aborted', 'AbortError') },
  { name: 'broken stream', failure: new TypeError('stream terminated') },
])('maps an OK GraphQL response body $name to NETWORK without retrying the mutation', async ({ failure }) => {
  document.cookie = 'XSRF-TOKEN=test-token';
  const response = new Response('', { status: 200 });
  vi.spyOn(response, 'json').mockRejectedValueOnce(failure);
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  await expect(graphql('mutation SaveNote { saveRichNote }', { id: 'note', input: { idempotencyKey: 'same-request' } })).rejects.toMatchObject({
    code: 'NETWORK',
    message: '서버 응답을 확인하지 못했습니다. 작성 중인 내용은 이 창에 남아 있습니다. 다시 시도해 주세요.',
  });
  expect(fetch).toHaveBeenCalledOnce();
  const init = fetch.mock.calls[0][1];
  expect(init.credentials).toBe('same-origin');
  expect(init.headers.get('X-XSRF-TOKEN')).toBe('test-token');
  expect(JSON.parse(init.body).variables.input.idempotencyKey).toBe('same-request');
});
it('still rejects malformed response JSON without treating it as a valid or retried response', async () => {
  document.cookie = 'XSRF-TOKEN=test-token';
  const fetch = vi.fn().mockResolvedValue(new Response('{malformed', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await expect(graphql('{ok}')).rejects.toMatchObject({ name: 'SyntaxError' });
  expect(fetch).toHaveBeenCalledOnce();
});
it('preserves HTTP conflict classification and its server message', async () => {
  document.cookie = 'XSRF-TOKEN=test-token';
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: '서버의 최신 버전을 확인해 주세요.' }), { status: 409 }));
  vi.stubGlobal('fetch', fetch);
  await expect(graphql('mutation SaveNote { saveRichNote }')).rejects.toMatchObject({
    code: 'CONFLICT', message: '서버의 최신 버전을 확인해 주세요.',
  });
  expect(fetch).toHaveBeenCalledOnce();
});
it('keeps access-loss priority when a pending response body is interrupted after revocation', async () => {
  document.cookie = 'XSRF-TOKEN=test-token';
  const response = new Response('', { status: 200 });
  let rejectBody!: (error: Error) => void;
  let bodyStarted!: () => void;
  const started = new Promise<void>(resolve => { bodyStarted = resolve; });
  vi.spyOn(response, 'json').mockImplementation(() => {
    bodyStarted();
    return new Promise((_resolve, reject) => { rejectBody = reject; });
  });
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  const pending = graphql('{ok}');
  await started;
  clearAccess();
  rejectBody(new DOMException('signal timed out', 'TimeoutError'));
  await expect(pending).rejects.toMatchObject({ code: 'ACCESS_DENIED', message: '접근 권한이 변경되었습니다.' });
  expect(fetch).toHaveBeenCalledOnce();
});
