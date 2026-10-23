import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

export interface ToolbarState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isCode: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isTaskList: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export function useToolbarState(editor: Editor | null): ToolbarState | null {
  return useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor || ctx.editor.isDestroyed) return null;
      return {
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
        isBulletList: ctx.editor.isActive("bulletList"),
        isOrderedList: ctx.editor.isActive("orderedList"),
        isTaskList: ctx.editor.isActive("taskList"),
        canUndo: ctx.editor.can().undo(),
        canRedo: ctx.editor.can().redo(),
      };
    },
  });
}
