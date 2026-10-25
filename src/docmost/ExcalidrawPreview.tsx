import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { onAccessLost } from '../transport';
import { renderExcalidrawPreview } from './excalidraw';

interface Preview { source: string; url?: string; empty: boolean; omittedExternalMedia: boolean }
export function ExcalidrawPreview({ source, theme }: { source?: string; theme: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<Preview>();
  const [failure, setFailure] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [revoked, setRevoked] = useState(false);
  const authorized = useRef(true);
  const generation = useRef(0);
  const currentUrl = useRef<string | undefined>(undefined);
  useEffect(() => {
    authorized.current = true;
    const stop = onAccessLost(() => {
      authorized.current = false; generation.current++;
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = undefined; setPreview(undefined); setFailure(undefined); setRevoked(true);
    });
    return () => { authorized.current = false; generation.current++; stop(); };
  }, []);
  useEffect(() => {
    const sequence = ++generation.current;
    let url: string | undefined;
    setPreview(undefined); setFailure(undefined);
    if (!source || !authorized.current) return;
    void renderExcalidrawPreview(source, theme).then(value => {
      if (!authorized.current || sequence !== generation.current) return;
      if (value.svg) { url = URL.createObjectURL(new Blob([value.svg], { type: 'image/svg+xml' })); currentUrl.current = url; }
      setPreview({ source, url, empty: value.empty, omittedExternalMedia: value.omittedExternalMedia });
    }).catch(() => { if (authorized.current && sequence === generation.current) setFailure(source); });
    return () => {
      generation.current++;
      if (url) URL.revokeObjectURL(url);
      if (currentUrl.current === url) currentUrl.current = undefined;
    };
  }, [source, theme, attempt]);
  if (!source || revoked) return null;
  if (failure === source) return <div role="alert">
    <p>{t('Drawing preview unavailable. The original file is preserved.')}</p>
    <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('Retry drawing preview')}</button>
  </div>;
  if (preview?.source !== source) return <p role="status">{t('Loading drawing preview…')}</p>;
  return <div className="excalidraw-preview">
    {preview.empty ? <p>{t('Empty drawing.')}</p> : <img src={preview.url} alt={t('Excalidraw drawing preview')} onError={() => setFailure(source)}/>}
    {preview.omittedExternalMedia && <p>{t('External media is not loaded in drawing previews.')}</p>}
  </div>;
}
