import { useEffect, useRef, useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { useAttachments } from '../editor/attachmentContext';
import { onAccessLost } from '../transport';
import { defaultDiagramSource, diagramPayload } from './diagramFiles';

export function useDiagramSource({ node, editor, updateAttributes }: NodeViewProps) {
  const { api, noteId, editable } = useAttachments();
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const saving = useRef(false);
  const current = useRef({ node, editable }); current.current = { node, editable };
  useEffect(() => {
    alive.current = true;
    const stop = onAccessLost(() => { alive.current = false; setSource(''); setLoaded(false); setError(''); });
    return () => { alive.current = false; stop(); };
  }, []);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoaded(false); setError(''); setSource('');
    if (!node.attrs.fileId) { setSource(node.attrs.source || defaultDiagramSource(node.type.name)); setLoaded(true); return; }
    void api.attachment(String(node.attrs.fileId), 1).then(blob => blob.text()).then(value => {
      if (active && alive.current) { diagramPayload(node.type.name, value); setSource(value); setLoaded(true); }
    }).catch(failure => { if (active && alive.current) setError((failure as Error).message); });
    return () => { active = false; };
  }, [api, node.attrs.fileId, node.attrs.source, node.type.name, visible]);

  async function saveData(value: string) {
    if (saving.current || !alive.current || !current.current.editable || !editor.isEditable) return false;
    saving.current = true; setBusy(true); setError('');
    const fileId = current.current.node.attrs.fileId;
    try {
      const previous = fileId ? { attachmentId: String(fileId), revision: 1, name: '', mimeType: '' } : undefined;
      const attachment = await api.upload(noteId, diagramPayload(node.type.name, value), previous);
      if (!alive.current || editor.isDestroyed || !editor.isEditable || !current.current.editable || current.current.node.attrs.fileId !== fileId) return false;
      updateAttributes({ fileId: attachment.attachmentId, source: node.type.name === 'mermaid' ? value : null });
      return true;
    } catch (failure) { if (alive.current) setError((failure as Error).message); return false; }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  return { container, source, loaded, error, busy, saveData, editable: editable && editor.isEditable };
}
