import { FC, useCallback, useEffect, useRef } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useAtom } from "jotai";
import { showLinkMenuAtom } from "@/features/editor/atoms/editor-atoms";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel";
import { TextSelection } from "@tiptap/pm/state";
import { Paper } from "@mantine/core";

type EditorLinkMenuProps = {
  editor: Editor;
  appendTo: HTMLElement;
};

export const EditorLinkMenu: FC<EditorLinkMenuProps> = ({ editor, appendTo }) => {
  const [showLinkMenu, setShowLinkMenu] = useAtom(showLinkMenuAtom);
  const showLinkMenuRef = useRef(showLinkMenu);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    showLinkMenuRef.current = showLinkMenu;
    if (showLinkMenu) {
      editor.commands.focus();
    }
  }, [showLinkMenu, editor]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
  }, []);

  const onSetLink = useCallback(
    (url: string) => {
      if (editor.state.selection.empty) editor.commands.insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] });
      editor
        .chain()
        .focus()
        .setLink({
          href: url,
        })
        .command(({ tr }) => {
          tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
          return true;
        })
        .run();
      setShowLinkMenu(false);
    },
    [editor, setShowLinkMenu],
  );

  useEffect(() => {
    if (!showLinkMenu) return;

    const dismiss = () => {
      setShowLinkMenu(false);
      editor.commands.focus();
      editor.commands.setTextSelection(editor.state.selection.to);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        dismiss();
      }
    };

    const pane = editor.view.dom.closest<HTMLElement>(".pane");
    pane?.addEventListener("keydown", handleKeyDown);
    appendTo.addEventListener("mousedown", handleMouseDown);
    return () => {
      pane?.removeEventListener("keydown", handleKeyDown);
      appendTo.removeEventListener("mousedown", handleMouseDown);
    };
  }, [showLinkMenu, setShowLinkMenu, editor, appendTo]);

  if (!showLinkMenu) return null;

  return (
    <BubbleMenu
      editor={editor}
      appendTo={appendTo}
      shouldShow={({ editor }) => {
        return showLinkMenuRef.current && editor.isEditable;
      }}
      options={{
        placement: "bottom",
        offset: 8,
        onShow: focusInput,
        onHide: () => {
          setShowLinkMenu(false);
        },
      }}
      style={{ zIndex: 198, position: "relative" }}
    >
      <Paper ref={containerRef} w={320} p="sm" shadow="md" radius={6} withBorder>
        <LinkEditorPanel onSetLink={onSetLink} />
      </Paper>
    </BubbleMenu>
  );
};
