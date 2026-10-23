import React, { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { UndoRedo } from "@tiptap/extensions";
import { useAtomValue, useSetAtom } from "jotai";
import { pageEditorAtom, titleEditorAtom } from "./atoms/editor-atoms";
import { useTranslation } from "react-i18next";

export interface TitleEditorProps {
  pageId: string;
  title: string;
  editable: boolean;
  onChange: (title: string) => void;
}

function titleDocument(title: string) {
  return { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: title ? [{ type: "text", text: title }] : [] }] };
}

export function TitleEditor({ pageId, title, editable, onChange }: TitleEditorProps) {
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const setTitleEditor = useSetAtom(titleEditorAtom);
  const change = useRef(onChange); change.current = onChange;
  const titleEditor = useEditor({
    extensions: [
      Document.extend({ content: "heading" }), Heading.configure({ levels: [1] }), Text,
      Placeholder.configure({ placeholder: t("Untitled"), showOnlyWhenEditable: false }),
      UndoRedo.configure({ depth: 20 }),
    ],
    content: titleDocument(title), editable, immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => change.current(editor.getText()),
    editorProps: { attributes: { "aria-label": "노트 제목", role: "textbox", "aria-readonly": String(!editable) } },
  }, [pageId]);

  useEffect(() => {
    setTitleEditor(titleEditor);
    return () => setTitleEditor(null);
  }, [titleEditor, setTitleEditor]);
  useEffect(() => {
    if (titleEditor && !titleEditor.isDestroyed && titleEditor.getText() !== title) {
      titleEditor.commands.setContent(titleDocument(title), { emitUpdate: false });
    }
  }, [title, titleEditor]);
  useEffect(() => {
    titleEditor?.setEditable(editable, false);
    titleEditor?.setOptions({ editorProps: { attributes: { "aria-label": "노트 제목", role: "textbox", "aria-readonly": String(!editable) } } });
  }, [editable, titleEditor]);

  function handleTitleKeyDown(event: React.KeyboardEvent) {
    if (!titleEditor || !pageEditor || !editable || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    const { key } = event;
    const { $head } = titleEditor.state.selection;
    if (key === "Enter") {
      event.preventDefault();
      const { $from } = titleEditor.state.selection;
      const textAfterCursor = titleEditor.getText().slice($from.parentOffset);
      if (textAfterCursor) {
        titleEditor.commands.deleteRange({ from: $from.pos, to: titleEditor.state.doc.content.size - 1 });
      }
      pageEditor.chain().command(({ tr }) => { tr.setMeta("addToHistory", false); return true; })
        .insertContentAt(0, { type: "paragraph", content: textAfterCursor ? [{ type: "text", text: textAfterCursor }] : undefined })
        .focus("start").run();
      return;
    }
    if (key === "ArrowDown" || (key === "ArrowRight" && !$head.nodeAfter)) pageEditor.commands.focus("start");
  }

  return <div className="page-title"><EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown} /></div>;
}
