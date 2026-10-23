// @vitest-environment jsdom
import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api';
import type { NoteApi } from '../model';
import { clearAccess } from '../transport';
import { DocmostPaneProvider } from './DocmostPaneProvider';
import { FullEditor } from '../vendor/docmost/client/features/editor/full-editor';
import { pageEditorAtom, titleEditorAtom } from '../vendor/docmost/client/features/editor/atoms/editor-atoms';

const editors = new Map<string, { body: Editor; title: Editor }>();
function Capture({ id }: { id: string }) {
  const body = useAtomValue(pageEditorAtom);
  const title = useAtomValue(titleEditorAtom);
  useEffect(() => { if (body && title) editors.set(id, { body, title }); }, [body, title, id]);
  return null;
}
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); editors.clear(); vi.unstubAllGlobals(); });

function page(id: string, onChange = vi.fn(), onInvalid = vi.fn(), content: JSONContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original body' }] }] }, editable = true, client: NoteApi = api) {
  return <DocmostPaneProvider><section className="pane" aria-label={id}>
    <FullEditor api={client} pageId="same-note" title="Original title" content={content} editable={editable} onTitleChange={vi.fn()} onChange={onChange} onInvalid={onInvalid}/>
    <Capture id={id}/>
  </section></DocmostPaneProvider>;
}

it('uses the actual toolbar and independent editor/title stores for the same note in two panes', async () => {
  const left = vi.fn(); const right = vi.fn();
  render(<>{page('left', left)}{page('right', right)}</>);
  await waitFor(() => expect(editors.size).toBe(2));
  const one = editors.get('left')!; const two = editors.get('right')!;
  expect(one.body).not.toBe(two.body); expect(one.title).not.toBe(two.title);
  act(() => { one.body.commands.setTextSelection({ from: 1, to: 9 }); });
  fireEvent.click(within(screen.getByRole('region', { name: 'left' })).getByRole('button', { name: '굵게' }));
  expect(left).toHaveBeenCalled(); expect(right).not.toHaveBeenCalled();
  expect(one.body.getJSON().content?.[0].content?.[0].marks?.[0].type).toBe('bold');
  expect(two.body.getJSON().content?.[0].content?.[0].marks).toBeUndefined();
});

it('emits an empty body to the revision draft and retains editable content when permissions change', async () => {
  const changed = vi.fn();
  const view = render(page('left', changed));
  await waitFor(() => expect(editors.has('left')).toBe(true));
  const editor = editors.get('left')!.body;
  act(() => { editor.commands.clearContent(true); });
  expect(changed).toHaveBeenLastCalledWith(editor.getJSON());
  expect(editor.isEmpty).toBe(true);
  view.rerender(page('left', changed, vi.fn(), { type: 'doc', content: [{ type: 'paragraph' }] }, false));
  expect(editors.get('left')!.body).toBe(editor);
  expect(editor.isEditable).toBe(false);
});

it('fails closed for unknown node attributes instead of silently saving stripped content', async () => {
  const invalid = vi.fn(); const changed = vi.fn();
  const body = { type: 'doc', content: [{ type: 'paragraph', attrs: { unsupportedMeaning: 'retain me' }, content: [{ type: 'text', text: 'Protected body' }] }] };
  render(page('left', changed, invalid, body));
  await screen.findByRole('alert');
  expect(invalid).toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  expect(body.content[0].attrs.unsupportedMeaning).toBe('retain me');
});

it('keeps the actual toolbar menu within the pane access boundary', async () => {
  render(page('left'));
  await waitFor(() => expect(editors.has('left')).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: '일반 텍스트' }));
  const menu = await screen.findByRole('menu');
  expect(menu.closest('.pane')).toBe(screen.getByRole('region', { name: 'left' }));
});

it('discards a late file upload after the pane access generation is revoked', async () => {
  let complete!: (value: { attachmentId: string; revision: number; name: string; mimeType: string }) => void;
  const upload = vi.fn(() => new Promise<{ attachmentId: string; revision: number; name: string; mimeType: string }>(resolve => { complete = resolve; }));
  const view = render(page('left', vi.fn(), vi.fn(), { type: 'doc', content: [{ type: 'paragraph' }] }, true, { ...api, upload }));
  await waitFor(() => expect(editors.has('left')).toBe(true));
  const input = view.container.querySelector('input[type="file"]'); expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { files: [new File(['private'], 'private.txt', { type: 'text/plain' })] } });
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  act(() => clearAccess());
  await act(async () => { complete({ attachmentId: 'late-private-file', revision: 1, name: 'private.txt', mimeType: 'text/plain' }); });
  expect(JSON.stringify(editors.get('left')!.body.getJSON())).not.toContain('late-private-file');
});

it('uses the actual slash menu keyboard command only in its own pane and cleans up the popup', async () => {
  const view = render(<>{page('left')}{page('right')}</>);
  await waitFor(() => expect(editors.size).toBe(2));
  const left = editors.get('left')!.body;
  act(() => { left.commands.clearContent(); left.commands.focus(); left.commands.insertContent('/table'); });
  const menu = await screen.findByRole('listbox', { name: '슬래시 명령어' });
  expect(menu.closest('.pane')).toBe(screen.getByRole('region', { name: 'left' }));
  act(() => left.view.focus());
  await waitFor(() => expect(left.view.hasFocus()).toBe(true));
  fireEvent.keyDown(left.view.dom, { key: 'Enter' });
  await waitFor(() => expect(left.getJSON().content?.some(node => node.type === 'table')).toBe(true));
  expect(editors.get('right')!.body.getJSON().content?.some(node => node.type === 'table')).toBe(false);
  view.unmount(); expect(document.querySelector('[role="listbox"]')).toBeNull();
});
