import { Node, mergeAttributes, type Attributes } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { TaskList, TaskItem, OrderedList } from '@tiptap/extension-list';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { codeLowlight } from '../docmost/codeLanguages';
import CodeBlockView from '../vendor/docmost/client/features/editor/components/code-block/code-block-view';
import { Attachment } from '../vendor/attachment/attachment';
import { Callout } from '../vendor/callout/callout';
import CalloutView from '../vendor/docmost/client/features/editor/components/callout/callout-view';
import { PageBreak } from '../vendor/page-break/page-break';
import AttachmentView from '../vendor/docmost/client/features/editor/components/attachment/attachment-view';
import ImageView from '../vendor/docmost/client/features/editor/components/image/image-view';
import DrawioView from '../vendor/docmost/client/features/editor/components/drawio/drawio-view';
import ExcalidrawView from '../vendor/docmost/client/features/editor/components/excalidraw/excalidraw-view';
import MermaidView from '../vendor/docmost/client/features/editor/components/code-block/mermaid-view';

function diagram(name: string, view: typeof DrawioView) {
  return Node.create({
    name, group: 'block', atom: true, draggable: true,
    addAttributes() { return { fileId: { default: null }, source: { default: null } }; },
    parseHTML() { return [{ tag: `div[data-type="${name}"]` }]; },
    renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-type': name })]; },
    addNodeView() { return ReactNodeViewRenderer(view); },
  });
}
const NoteLink = Node.create({
  name: 'noteLink', group: 'inline', inline: true, atom: true,
  addAttributes() { return { noteId: { default: null } }; },
  parseHTML() { return [{ tag: 'a[data-note-id]' }]; },
  renderHTML({ node }) { return ['a', { href: `?note=${encodeURIComponent(String(node.attrs.noteId))}`, 'data-note-id': node.attrs.noteId }, '연결된 노트']; },
});
export function editorExtensions() {
  return [
    StarterKit.configure({ link: false, orderedList: false, codeBlock: false }),
    CodeBlockLowlight.extend({ addNodeView() { return ReactNodeViewRenderer(CodeBlockView); } }).configure({ lowlight: codeLowlight }),
    OrderedList.extend({ addAttributes() { const attrs: Attributes = this.parent?.() || {}; delete attrs.type; return attrs; } }),
    Link.extend({ addAttributes() { return { href: { default: null }, title: { default: null } }; } }).configure({ openOnClick: false, protocols: ['https', 'http', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer' } }),
    TaskList, TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }), TableRow,
    TableCell.extend({ addAttributes() { const attrs: Attributes = this.parent?.() || {}; delete attrs.align; return attrs; } }),
    TableHeader.extend({ addAttributes() { const attrs: Attributes = this.parent?.() || {}; delete attrs.align; return attrs; } }),
    Attachment.extend({ addAttributes() { return { fileId: { default: null }, title: { default: '' }, alt: { default: '' } }; } }).configure({ view: AttachmentView }),
    Image.extend({
      addAttributes() { return { fileId: { default: null }, title: { default: '' }, alt: { default: '' } }; },
      addNodeView() { return ReactNodeViewRenderer(ImageView); },
    }).configure({ allowBase64: false }),
    Callout.configure({ view: CalloutView }), PageBreak,
    diagram('drawio', DrawioView), diagram('excalidraw', ExcalidrawView), diagram('mermaid', MermaidView), NoteLink,
  ];
}
