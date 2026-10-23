import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import { pageEditorAtom } from '../vendor/docmost/client/features/editor/atoms/editor-atoms';
import { useAttachments } from '../editor/attachmentContext';
import { onAccessLost } from '../transport';

export function useDocmostUpload() {
  const { api, noteId, editable } = useAttachments();
  const editor = useAtomValue(pageEditorAtom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const stop = onAccessLost(() => { alive.current = false; setBusy(false); setError(''); });
    return () => { alive.current = false; stop(); };
  }, []);

  async function upload(files: File[]) {
    if (!editor || !editable || !editor.isEditable || !alive.current || busy) return;
    setBusy(true); setError('');
    try {
      for (const file of files) {
        if (!alive.current || editor.isDestroyed || !editor.isEditable) return;
        const attachment = await api.upload(noteId, file);
        if (!alive.current || editor.isDestroyed || !editor.isEditable) return;
        const image = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
        editor.chain().focus().insertContent({ type: image ? 'image' : 'attachment', attrs: { fileId: attachment.attachmentId, title: file.name, alt: file.name } }).run();
      }
    } catch (failure) { if (alive.current) setError((failure as Error).message); }
    finally { if (alive.current) setBusy(false); }
  }
  return { upload, busy, error };
}
