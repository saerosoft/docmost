export class ApiError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

const REQUEST_DEADLINE = 30_000;

let generation = 0;
const revoked = new Set<() => void>();
const refreshed = new Set<() => void | Promise<void>>();
export function onAccessLost(listener: () => void) {
  revoked.add(listener);
  return () => { revoked.delete(listener); };
}
export function clearAccess() {
  generation++;
  revoked.forEach(listener => listener());
}
export function onAccessRefresh(listener: () => void | Promise<void>) {
  refreshed.add(listener);
  return () => { refreshed.delete(listener); };
}
export async function refreshAccess() {
  const epoch = ++generation;
  await Promise.all([...refreshed].map(listener => listener()));
  if (epoch !== generation) throw new ApiError('접근 권한이 변경되었습니다.', 'ACCESS_DENIED');
}

let issuing: Promise<string> | undefined;
function token() {
  const cookie = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='));
  if (cookie) return Promise.resolve(decodeURIComponent(cookie.slice(11)));
  issuing ??= fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(REQUEST_DEADLINE) })
    .then(async response => {
      if (response.status === 401 || response.status === 403) clearAccess();
      if (!response.ok) throw new ApiError('보안 요청을 준비하지 못했습니다. 다시 시도해 주세요.', 'CSRF');
      const data: { token: string } = await response.json();
      return data.token;
    }).catch(error => { if (error instanceof ApiError) throw error; throw new ApiError('서버에 연결하지 못했습니다. 다시 시도해 주세요.', 'NETWORK'); }).finally(() => { issuing = undefined; });
  return issuing;
}

export async function request(path: string, init: RequestInit = {}) {
  if (!(path.startsWith('/api/') || path === '/graphql')) throw new ApiError('허용되지 않은 요청입니다.', 'INVALID_PATH');
  const epoch = generation;
  const deadline = AbortSignal.timeout(REQUEST_DEADLINE);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  const headers = new Headers(init.headers);
  headers.set('Accept-Language', 'ko-KR');
  if (init.method && init.method !== 'GET') headers.set('X-XSRF-TOKEN', await token());
  if (epoch !== generation) throw new ApiError('접근 권한이 변경되었습니다.', 'ACCESS_DENIED');
  let response: Response;
  try { response = await fetch(path, { ...init, headers, signal, credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new ApiError('서버에 연결하지 못했습니다. 작성 중인 내용은 이 창에 남아 있습니다.', 'NETWORK'); }
  if (response.status === 401 || response.status === 403) {
    clearAccess();
    throw new ApiError('로그인 또는 접근 권한을 확인해 주세요. 열린 자료를 지웠습니다.', 'ACCESS_DENIED');
  }
  if (epoch !== generation) throw new ApiError('접근 권한이 변경되었습니다.', 'ACCESS_DENIED');
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { detail?: string } | null;
    throw new ApiError(problem?.detail || (response.status === 409 ? '다른 변경이 먼저 저장되었습니다. 내 내용을 보존하고 최신 버전을 확인해 주세요.' : '요청을 처리하지 못했습니다.'), response.status === 409 ? 'CONFLICT' : 'REQUEST_FAILED');
  }
  return response;
}

export async function graphql<T>(query: string, variables: object = {}): Promise<T> {
  const epoch = generation;
  const response = await request('/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const body: { data?: T; errors?: { message: string; extensions?: { code?: string; classification?: string } }[] } = await response.json();
  if (epoch !== generation) throw new ApiError('접근 권한이 변경되었습니다.', 'ACCESS_DENIED');
  if (body.errors?.length) {
    const failure = body.errors[0];
    const code = failure.extensions?.code || failure.extensions?.classification || 'GRAPHQL';
    if (['UNAUTHORIZED', 'UNAUTHENTICATED', 'FORBIDDEN', 'ACCESS_DENIED'].includes(code)) clearAccess();
    throw new ApiError(failure.message, code);
  }
  if (!body.data) throw new ApiError('서버 응답이 비어 있습니다.', 'EMPTY_RESPONSE');
  return body.data;
}
