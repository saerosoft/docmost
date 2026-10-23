import { sanitizeUrl } from '@braintree/sanitize-url';

export function safeLinkUrl(value: string): string | null {
  const input = value.trim();
  if (!input || /^\w[\w+.-]*:/.test(input) && !/^(?:https?:|mailto:)/i.test(input)) return null;
  try {
    const url = new URL(/^(?:https?:|mailto:)/i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol) || url.username || url.password) return null;
    const safe = sanitizeUrl(url.href);
    return safe === 'about:blank' ? null : safe;
  } catch { return null; }
}
