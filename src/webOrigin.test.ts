import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webUrl } from './webOrigin';

beforeEach(() => { vi.stubEnv('VITE_WEB_PORT', '9088'); });
afterEach(() => { vi.unstubAllEnvs(); });

it('keeps the host name of the current page so the session cookie is shared', () => {
  expect(webUrl('/login', { protocol: 'http:', hostname: '127.0.0.1' })).toBe('http://127.0.0.1:9088/login');
  expect(webUrl('/login', { protocol: 'http:', hostname: 'localhost' })).toBe('http://localhost:9088/login');
});

it('uses the configured web port for login and note-context links', () => {
  vi.stubEnv('VITE_WEB_PORT', '18128');
  expect(webUrl('/login', { protocol: 'http:', hostname: 'localhost' })).toBe('http://localhost:18128/login');
  expect(webUrl('/spaces/space/actions/new?note=note', { protocol: 'http:', hostname: '127.0.0.1' })).toBe('http://127.0.0.1:18128/spaces/space/actions/new?note=note');
});

it('retains HTTPS and an IPv6 host when using another deployment port', () => {
  vi.stubEnv('VITE_WEB_PORT', '9443');
  expect(webUrl('/spaces/space/reviews?proposal=proposal#details', { protocol: 'https:', hostname: '[::1]' })).toBe('https://[::1]:9443/spaces/space/reviews?proposal=proposal#details');
});

it('uses the configured web origin behind a TLS-terminating proxy', () => {
  vi.stubEnv('VITE_WEB_ORIGIN', 'https://web.example.test');
  expect(webUrl('/login', { protocol: 'https:', hostname: 'notes.example.test' })).toBe('https://web.example.test/login');
});
