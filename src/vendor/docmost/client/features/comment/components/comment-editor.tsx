import { EditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { StarterKit } from "@tiptap/starter-kit";
import classes from "./comment.module.css";
import { useFocusWithin } from "@mantine/hooks";
import clsx from "clsx";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface CommentEditorProps {
  defaultContent?: string;
  onUpdate?: (content: string) => void;
  onSave?: () => void;
  editable: boolean;
  placeholder?: string;
  surface?: "default" | "muted";
}
export interface CommentEditorHandle { clearContent: () => void }
function plainDocument(value: string) {
  return { type: "doc", content: value.split("\n").map(line => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) };
}

const CommentEditor = forwardRef<CommentEditorHandle, CommentEditorProps>(({ defaultContent = "", onUpdate, onSave, editable, placeholder = "댓글", surface }, ref) => {
  const { ref: focusRef, focused } = useFocusWithin();
  const update = useRef(onUpdate); update.current = onUpdate;
  const save = useRef(onSave); save.current = onSave;
  const commentEditor = useEditor({
    extensions: [
      StarterKit.configure({ gapcursor: false, dropcursor: false, link: false, bold: false, italic: false, underline: false,
        strike: false, code: false, codeBlock: false, heading: false, bulletList: false, orderedList: false,
        listItem: false, listKeymap: false, blockquote: false, horizontalRule: false, trailingNode: false }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { "aria-label": placeholder, role: onUpdate ? "textbox" : "document", "aria-multiline": "true" },
      handleDOMEvents: { keydown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.code === "Enter") { event.preventDefault(); save.current?.(); return true; }
        return false;
      } },
    },
    onUpdate({ editor }) { update.current?.(editor.getText({ blockSeparator: "\n" })); },
    content: plainDocument(defaultContent), editable, immediatelyRender: true, shouldRerenderOnTransaction: false,
  });
  useEffect(() => {
    if (!onUpdate && !editable && commentEditor && !commentEditor.isDestroyed) commentEditor.commands.setContent(plainDocument(defaultContent), { emitUpdate: false });
  }, [defaultContent, editable, commentEditor, onUpdate]);
  useEffect(() => { commentEditor?.setEditable(editable, false); }, [editable, commentEditor]);
  useImperativeHandle(ref, () => ({ clearContent: () => { if (commentEditor && !commentEditor.isDestroyed) commentEditor.commands.clearContent(); } }), [commentEditor]);
  return <div ref={focusRef} className={classes.commentEditor} data-editable={editable || undefined} data-surface={surface}>
    <EditorContent editor={commentEditor} className={clsx(classes.ProseMirror, { [classes.focused]: focused })}/>
  </div>;
});
export default CommentEditor;
