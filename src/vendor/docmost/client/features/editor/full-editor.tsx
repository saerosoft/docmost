import classes from "./styles/editor.module.css";
import React from "react";
import { Container } from "@mantine/core";
import type { JSONContent } from "@tiptap/core";
import { TitleEditor } from "./title-editor";
import PageEditor from "./page-editor";
import { FixedToolbar } from "./components/fixed-toolbar/fixed-toolbar";
import { AttachmentContext } from "@knowledge/editor/attachmentContext";
import type { NoteApi } from "@knowledge/model";

const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageEditor = React.memo(PageEditor);
const MemoizedFixedToolbar = React.memo(FixedToolbar);

export interface FullEditorProps {
  api: NoteApi;
  pageId: string;
  title: string;
  content: JSONContent;
  editable: boolean;
  onTitleChange: (title: string) => void;
  onChange: (content: JSONContent) => void;
  onInvalid: () => void;
}

export function FullEditor({ api, pageId, title, content, editable, onTitleChange, onChange, onInvalid }: FullEditorProps) {
  return (
    <AttachmentContext.Provider value={{ api, noteId: pageId, editable }}>
      <Container fluid className={classes.editor} style={{ display: "flex", flexDirection: "column" }}>
        {editable && <MemoizedFixedToolbar />}
        <MemoizedTitleEditor pageId={pageId} title={title} editable={editable} onChange={onTitleChange} />
        <MemoizedPageEditor pageId={pageId} content={content} editable={editable} onChange={onChange} onInvalid={onInvalid} />
      </Container>
    </AttachmentContext.Provider>
  );
}
