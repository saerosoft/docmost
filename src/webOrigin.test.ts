import { expect, it } from 'vitest';
import { webUrl } from './webOrigin';

it('keeps the host name of the current page so the session cookie is shared', () => {
  expect(webUrl('/login', { protocol: 'http:', hostname: '127.0.0.1' })).toBe('http://127.0.0.1:9088/login');
  expect(webUrl('/login', { protocol: 'http:', hostname: 'localhost' })).toBe('http://localhost:9088/login');
});
