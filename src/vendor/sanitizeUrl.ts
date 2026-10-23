import { sanitizeUrl as sanitize } from '@braintree/sanitize-url';

export function sanitizeUrl(value: string | null | undefined): string {
  return sanitize(value ?? undefined);
}
