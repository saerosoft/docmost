import { useEffect, useRef, useState } from 'react';
import { useAttachments } from '../editor/attachmentContext';
import { onAccessLost } from '../transport';

export function useAuthorizedFile(fileId: string | null) {
  const { api } = useAttachments();
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string>();
  const [size, setSize] = useState<number>();
  const [error, setError] = useState('');
  const authorized = useRef(true);
  const currentUrl = useRef<string | undefined>(undefined);
  useEffect(() => {
    authorized.current = true;
    return onAccessLost(() => {
      authorized.current = false;
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = undefined;
      setUrl(undefined); setSize(undefined); setError('');
    });
  }, []);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setUrl(undefined); setSize(undefined); setError('');
    if (!visible || !fileId || !authorized.current) return;
    let active = true; let objectUrl: string | undefined;
    void api.attachment(fileId, 1).then(blob => { if (active && authorized.current) { objectUrl = URL.createObjectURL(blob); currentUrl.current = objectUrl; setUrl(objectUrl); setSize(blob.size); } }).catch(failure => { if (active && authorized.current) setError((failure as Error).message); });
    return () => { active = false; if (objectUrl && currentUrl.current === objectUrl) { URL.revokeObjectURL(objectUrl); currentUrl.current = undefined; } };
  }, [api, fileId, visible]);
  return { container, url, size, error, visible, load: () => setVisible(true) };
}
