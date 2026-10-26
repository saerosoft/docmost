/**
 * The product web application issues the session cookie for the host name it was opened on, and a browser sends that
 * cookie only to the same host name. Links back to it therefore keep this page's host name and change only the port.
 */
export function webUrl(path: string, location: Pick<Location, 'protocol' | 'hostname'> = window.location) {
  if (import.meta.env.VITE_WEB_ORIGIN) return new URL(path, import.meta.env.VITE_WEB_ORIGIN).href;
  return `${location.protocol}//${location.hostname}:${import.meta.env.VITE_WEB_PORT}${path}`;
}
