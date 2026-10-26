import type { Editor } from "@tiptap/react";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "../../atoms/editor-atoms";
import { useToolbarState } from "./use-toolbar-state";
import { BlockTypeGroup } from "./groups/block-type-group";
import { InlineMarksGroup } from "./groups/inline-marks-group";
import { ListsGroup } from "./groups/lists-group";
import { MediaGroup } from "./groups/media-group";
import { QuickInsertsGroup } from "./groups/quick-inserts-group";
import { HistoryGroup } from "./groups/history-group";
import { DiagramGroup } from "@knowledge/docmost/DiagramGroup";
import classes from "./fixed-toolbar.module.css";
import { LinkSelector } from "../bubble-menu/link-selector";

export function FixedToolbar() {
  const editor = useAtomValue(pageEditorAtom);
  return <div className={classes.fixedToolbar} style={{ position: "sticky", top: 0, insetInlineStart: "auto", insetInlineEnd: "auto" }} data-fixed-toolbar="true" role="toolbar" aria-label="Editor toolbar" onMouseDown={event => event.preventDefault()}>
    {editor && <ToolbarContent editor={editor}/>}
  </div>;
}

function ToolbarContent({ editor }: { editor: Editor }) {
  const state = useToolbarState(editor);
  return (
      <div className={classes.inner}>
        {editor && state && <>
          <BlockTypeGroup editor={editor} />
          <div className={classes.divider} />
          <InlineMarksGroup editor={editor} state={state} />
          <LinkSelector />
          <div className={classes.divider} />
          <ListsGroup editor={editor} state={state} />
          <div className={classes.divider} />
          <MediaGroup />
          <QuickInsertsGroup editor={editor} />
          <DiagramGroup editor={editor} />
          <div className={classes.divider} />
          <HistoryGroup editor={editor} state={state} />
        </>}
      </div>
  );
}
