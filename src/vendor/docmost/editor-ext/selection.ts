import type { Editor } from "@tiptap/core";
import { isTextSelection } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";

export const isCellSelection = (selection: unknown): selection is CellSelection => selection instanceof CellSelection;

export function isEditorReady(
  editor: Editor | null | undefined,
): editor is Editor {
  return !!editor && editor.isInitialized;
}

export function isTextSelected(editor: Editor) {
  const {
    state: {
      doc,
      selection,
      selection: { empty, from, to },
    },
  } = editor;

  const isEmptyTextBlock =
    !doc.textBetween(from, to).length && isTextSelection(selection);

  if (empty || isEmptyTextBlock || !editor.isEditable) {
    return false;
  }

  return true;
}
