// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { editorExtensions } from './extensions';
import { approvedDrawioOrigin, diagramPayload } from '../docmost/diagramFiles';

const editors: Editor[] = [];
function create(content: JSONContent) {
  const editor = new Editor({ extensions: editorExtensions(), content, enableContentCheck: true });
  editors.push(editor); return editor;
}
afterEach(() => editors.splice(0).forEach(editor => editor.destroy()));
describe('independent ProseMirror editor contexts', () => {
  it('isolates document, selection and undo across two instances of the same note', () => {
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Shared initial content' }] }] };
    const left = create(content); const right = create(content);
    left.commands.setTextSelection(1);
    left.commands.insertContent('LEFT ');
    expect(left.getText()).toContain('LEFT');
    expect(right.getText()).toBe('Shared initial content');
    right.commands.setTextSelection(5);
    expect(left.state.selection.from).not.toBe(right.state.selection.from);
    left.commands.undo();
    expect(left.getText()).toBe('Shared initial content');
    expect(right.getText()).toBe('Shared initial content');
  });
  it('round trips task lists, tables, code, links, attachments and diagram references', () => {
    const body: JSONContent = { type: 'doc', content: [
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task' }] }] }] },
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph' }] }] }] },
      { type: 'codeBlock', attrs: { language: 'typescript' }, content: [{ type: 'text', text: 'const value = 1;' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Reference', marks: [{ type: 'link', attrs: { href: 'https://example.com', title: null } }] }] },
      { type: 'attachment', attrs: { fileId: 'file-1', title: 'Document', alt: '' } },
      { type: 'image', attrs: { fileId: 'file-2', title: 'Image', alt: 'Description' } },
      ...['mermaid', 'drawio', 'excalidraw'].map(type => ({ type, attrs: { fileId: `${type}-revision-2` } })),
    ] };
    const one = create(body); const two = create(one.getJSON());
    expect(two.getJSON()).toEqual(one.getJSON());
    const diagrams = two.getJSON().content!.filter(node => ['drawio', 'mermaid', 'excalidraw'].includes(node.type!));
    expect(diagrams.map(node => node.attrs?.fileId)).toEqual(['mermaid-revision-2', 'drawio-revision-2', 'excalidraw-revision-2']);
  });
});
describe('editable diagram source preservation', () => {
  it('preserves Draw.io XML, Excalidraw scene and Mermaid text bytes', async () => {
    const xml = '<mxfile><diagram name="One"><mxGraphModel><root/></mxGraphModel></diagram></mxfile>';
    const scene = '{"type":"excalidraw","elements":[{"id":"one","type":"rectangle"}],"appState":{},"files":{}}';
    const mermaid = 'graph TD\n A[한국어] --> B';
    async function read(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(file); }); }
    expect(await read(diagramPayload('drawio', xml))).toBe(xml);
    expect(await read(diagramPayload('excalidraw', scene))).toBe(scene);
    expect(await read(diagramPayload('mermaid', mermaid))).toBe(mermaid);
    expect(() => diagramPayload('drawio', '<!DOCTYPE a><mxfile/>')).toThrow();
  });
  it('requires an explicitly configured HTTPS origin', () => {
    expect(approvedDrawioOrigin(undefined)).toBeNull();
    expect(approvedDrawioOrigin('https://embed.diagrams.net/')).toBe('https://embed.diagrams.net');
    expect(approvedDrawioOrigin('https://user:password@example.com/')).toBeNull();
    expect(approvedDrawioOrigin('https://example.com/foreign/path')).toBeNull();
    expect(approvedDrawioOrigin('http://example.com/')).toBeNull();
  });
});
