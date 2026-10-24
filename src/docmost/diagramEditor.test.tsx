// @vitest-environment jsdom
import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { NoteApi } from '../model';
import { clearAccess } from '../transport';
import { DocmostPaneProvider } from './DocmostPaneProvider';
import { FullEditor } from '../vendor/docmost/client/features/editor/full-editor';
import { pageEditorAtom } from '../vendor/docmost/client/features/editor/atoms/editor-atoms';

let editor: Editor | null = null;
const xml = '<mxfile><diagram name="Original"><mxGraphModel><root/></mxGraphModel></diagram></mxfile>';
const changedXml = '<mxfile><diagram name="Changed"><mxGraphModel><root><mxCell id="kept"/></root></mxGraphModel></diagram></mxfile>';
function Capture() {
  const body = useAtomValue(pageEditorAtom);
  useEffect(() => { editor = body; return () => { editor = null; }; }, [body]);
  return null;
}
function show(kind: string, client: NoteApi, editable = true) {
  return <DocmostPaneProvider><section className="pane"><FullEditor api={client} pageId="diagram-note" title="Diagram" content={{ type: 'doc', content: [{ type: kind, attrs: { fileId: 'original-file' } }] }} editable={editable} onTitleChange={vi.fn()} onChange={vi.fn()} onInvalid={vi.fn()}/><Capture/></section></DocmostPaneProvider>;
}
async function text(file: Blob) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(file); }); }
function client(source = xml) {
  return { ...api, attachment: vi.fn().mockResolvedValue(Object.assign(new Blob([source]), { text: async () => source })), upload: vi.fn().mockResolvedValue({ attachmentId: 'new-immutable-file', revision: 1, name: 'diagram', mimeType: 'application/octet-stream' }) };
}
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function openDrawio() {
  const button = await screen.findByRole('button', { name: '다이어그램 편집' });
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false)); fireEvent.click(button);
  return screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Draw.io XML' });
}

it('reopens authorized Draw.io XML and saves its bytes as a new immutable attachment reference', async () => {
  const value = client(); render(show('drawio', value));
  const source = await openDrawio(); expect(source.value).toBe(xml);
  fireEvent.change(source, { target: { value: changedXml } });
  fireEvent.click(screen.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용' }));
  await waitFor(() => expect(value.upload).toHaveBeenCalledTimes(1));
  const [noteId, file, previous] = value.upload.mock.calls[0];
  expect(noteId).toBe('diagram-note'); expect(await text(file)).toBe(changedXml);
  expect(previous).toMatchObject({ attachmentId: 'original-file', revision: 1 });
  await waitFor(() => expect(editor?.getJSON().content?.[0].attrs?.fileId).toBe('new-immutable-file'));
});

it('rejects Draw.io messages from another origin or window and accepts the approved frame', async () => {
  vi.stubEnv('VITE_DRAWIO_ORIGIN', 'https://drawio.example.test');
  const value = client(); render(show('drawio', value)); await openDrawio();
  const frame = await screen.findByTitle<HTMLIFrameElement>('Draw.io editor');
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Draw.io XML' }).readOnly).toBe(true);
  const url = new URL(frame.src);
  expect(url.searchParams.get('stealth')).toBe('1');
  expect(url.searchParams.get('pwa')).toBe('0');
  expect(url.searchParams.get('plugins')).toBe('0');
  expect(url.searchParams.get('drafts')).toBe('0');
  act(() => { window.dispatchEvent(new MessageEvent('message', { origin: 'https://wrong.example.test', source: frame.contentWindow, data: JSON.stringify({ event: 'save', xml: changedXml }) })); });
  act(() => { window.dispatchEvent(new MessageEvent('message', { origin: 'https://drawio.example.test', source: window, data: JSON.stringify({ event: 'save', xml: changedXml }) })); });
  expect(value.upload).not.toHaveBeenCalled();
  expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Draw.io XML' }).value).toBe(xml);
  act(() => { window.dispatchEvent(new MessageEvent('message', { origin: 'https://drawio.example.test', source: frame.contentWindow, data: JSON.stringify({ event: 'save', xml: changedXml }) })); });
  await waitFor(() => expect(value.upload).toHaveBeenCalledTimes(1));
});

it('retains XML and attachment identity when validation or upload fails', async () => {
  const value = client(); value.upload.mockRejectedValue(new Error('Upload failed'));
  render(show('drawio', value)); const source = await openDrawio();
  fireEvent.change(source, { target: { value: '<broken>' } });
  fireEvent.click(screen.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용' }));
  await screen.findAllByRole('alert'); expect(value.upload).not.toHaveBeenCalled();
  expect(editor?.getJSON().content?.[0].attrs?.fileId).toBe('original-file');
  fireEvent.change(source, { target: { value: changedXml } });
  fireEvent.click(screen.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용' }));
  await screen.findAllByText('Upload failed'); expect(source.value).toBe(changedXml);
  expect(editor?.getJSON().content?.[0].attrs?.fileId).toBe('original-file');
});

it.each(['read-only', 'revoked'] as const)('ignores a completed diagram upload after %s access replaces write authority', async mode => {
  const value = client(); let complete!: (attachment: { attachmentId: string }) => void;
  value.upload.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const view = render(show('drawio', value)); const source = await openDrawio();
  fireEvent.change(source, { target: { value: changedXml } });
  fireEvent.click(screen.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용' }));
  await waitFor(() => expect(value.upload).toHaveBeenCalledTimes(1));
  if (mode === 'read-only') view.rerender(show('drawio', value, false));
  else act(() => clearAccess());
  await act(async () => { complete({ attachmentId: 'late-file' }); });
  expect(editor?.getJSON().content?.[0].attrs?.fileId).toBe('original-file');
});

it('edits the real Mermaid source UI and preserves exact source in the new attachment', async () => {
  const mermaid = 'graph TD\n A[Original] --> B';
  const value = client(mermaid); render(show('mermaid', value));
  const open = await screen.findByRole('button', { name: '원본 편집' });
  await waitFor(() => expect(open.hasAttribute('disabled')).toBe(false)); fireEvent.click(open);
  const source = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Mermaid 원본' }); expect(source.value).toBe(mermaid);
  const changed = 'graph TD\n A[수정] --> B'; fireEvent.change(source, { target: { value: changed } });
  fireEvent.click(screen.getByRole('button', { name: '첨부 개정 저장 후 노트에 적용' }));
  await waitFor(() => expect(value.upload).toHaveBeenCalledTimes(1));
  expect(await text(value.upload.mock.calls[0][1])).toBe(changed);
  await waitFor(() => expect(editor?.getJSON().content?.[0].attrs).toMatchObject({ fileId: 'new-immutable-file', source: changed }));
});
