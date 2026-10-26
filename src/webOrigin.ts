/**
 * The library navigates within its embedding application. Only the standalone
 * development harness may use a configured product origin or another local port.
 */
export function webUrl(path: string, location?: Pick<Location, 'protocol' | 'hostname'>) {
  if (!import.meta.env.DEV) return path;
  if (import.meta.env.VITE_WEB_ORIGIN) return new URL(path, import.meta.env.VITE_WEB_ORIGIN).href;
  const current = location ?? window.location;
  return `${current.protocol}//${current.hostname}:${import.meta.env.VITE_WEB_PORT}${path}`;
}
