import "./styles/index.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { getSchema, type JSONContent } from "@tiptap/core";
import { useSetAtom } from "jotai";
import { pageEditorAtom } from "./atoms/editor-atoms";
import { editorExtensions } from "@knowledge/editor/extensions";
import SlashCommand from "./extensions/slash-command";
import { validateDocument } from "@knowledge/docmost/validateDocument";
import { EditorBubbleMenu } from './components/bubble-menu/bubble-menu';
import TableMenu from './components/table/table-menu';
import CalloutMenu from './components/callout/callout-menu';
import { EditorLinkMenu } from './components/link/link-menu';

export interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  onInvalid: () => void;
}

export default function PageEditor({ pageId, editable, content, onChange, onInvalid }: PageEditorProps) {
  const setEditor = useSetAtom(pageEditorAtom);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const change = useRef(onChange); change.current = onChange;
  const invalidate = useRef(onInvalid); invalidate.current = onInvalid;
  const [initialValid] = useState(() => validateDocument(content, getSchema(editorExtensions())));
  const invalid = useRef(!initialValid);
  const [error, setError] = useState(initialValid ? "" : "지원하지 않는 내용이 있습니다. 원문 보호를 위해 저장을 중단합니다.");
  useEffect(() => { if (!initialValid) invalidate.current(); }, [initialValid]);
  function rejectContent() {
    invalid.current = true;
    invalidate.current();
    setError("지원하지 않는 내용이 있습니다. 원문 보호를 위해 저장을 중단합니다.");
  }
  const editor = useEditor({
    extensions: [...editorExtensions(), SlashCommand], content, editable,
    immediatelyRender: true, shouldRerenderOnTransaction: false,
    enableContentCheck: true,
    onContentError: rejectContent,
    onUpdate({ editor }) { if (!invalid.current) change.current(editor.getJSON()); },
    editorProps: {
      scrollThreshold: 80, scrollMargin: 80,
      attributes: { "aria-label": "노트 본문", role: "textbox", "aria-multiline": "true" },
      handleDOMEvents: { keydown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.code === "KeyS") { event.preventDefault(); return true; }
        return false;
      } },
    },
  }, [pageId]);

  useLayoutEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);
  useEffect(() => { editor?.setEditable(editable && !invalid.current, false); }, [editor, editable, error]);
  useEffect(() => {
    if (!editor || editor.isDestroyed || invalid.current || JSON.stringify(content) === JSON.stringify(editor.getJSON())) return;
    if (!validateDocument(content, editor.schema)) { rejectContent(); return; }
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  return <div className="editor-container" style={{ position: "relative" }}>
    {error && <p role="alert">{error}</p>}
    <div ref={menuContainerRef}>
      <EditorContent editor={editor} />
      {editor && editable && menuContainerRef.current && <>
        <EditorLinkMenu editor={editor} appendTo={menuContainerRef.current}/>
        <EditorBubbleMenu editor={editor} appendTo={menuContainerRef.current}/>
        <TableMenu editor={editor} appendTo={menuContainerRef.current}/>
        <CalloutMenu editor={editor} appendTo={menuContainerRef.current}/>
      </>}
    </div>
    <div onClick={() => { if (editor && !editor.isDestroyed) editor.commands.focus("end"); }} style={{ paddingBottom: "20vh" }} />
  </div>;
}
