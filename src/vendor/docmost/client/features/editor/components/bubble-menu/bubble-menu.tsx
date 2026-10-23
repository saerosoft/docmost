import { BubbleMenu, BubbleMenuProps } from "@tiptap/react/menus";
import { isNodeSelection, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { FC, useEffect, useRef } from "react";
import {
  IconBold,
  IconCode,
  IconItalic,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import clsx from "clsx";
import classes from "./bubble-menu.module.css";
import { ActionIcon, rem, Tooltip } from "@mantine/core";
import { isCellSelection, isTextSelected } from "../../../../../editor-ext/selection";
import { LinkSelector } from "./link-selector";
import { useAtomValue } from "jotai";
import { showLinkMenuAtom } from "../../atoms/editor-atoms";
import { useTranslation } from "react-i18next";
export interface BubbleMenuItem {
  name: string;
  isActive: () => boolean;
  command: () => void;
  icon: typeof IconBold;
}

type EditorBubbleMenuProps = Omit<BubbleMenuProps, "children" | "editor"> & {
  editor: Editor;
  appendTo: HTMLElement;
};

export const EditorBubbleMenu: FC<EditorBubbleMenuProps> = (props) => {
  const { t } = useTranslation();
  const showLinkMenu = useAtomValue(showLinkMenuAtom);
  const showLinkMenuRef = useRef(showLinkMenu);
  useEffect(() => { showLinkMenuRef.current = showLinkMenu; }, [showLinkMenu]);

  const editorState = useEditorState({
    editor: props.editor,
    selector: (ctx) => {
      if (!props.editor) {
        return null;
      }

      return {
        isBold: ctx.editor.isActive("bold"),
        isItalic: ctx.editor.isActive("italic"),
        isUnderline: ctx.editor.isActive("underline"),
        isStrike: ctx.editor.isActive("strike"),
        isCode: ctx.editor.isActive("code"),
      };
    },
  });

  const items: BubbleMenuItem[] = [
    {
      name: "Bold",
      isActive: () => !!editorState?.isBold,
      command: () => props.editor.chain().focus().toggleBold().run(),
      icon: IconBold,
    },
    {
      name: "Italic",
      isActive: () => !!editorState?.isItalic,
      command: () => props.editor.chain().focus().toggleItalic().run(),
      icon: IconItalic,
    },
    {
      name: "Underline",
      isActive: () => !!editorState?.isUnderline,
      command: () => props.editor.chain().focus().toggleUnderline().run(),
      icon: IconUnderline,
    },
    {
      name: "Strike",
      isActive: () => !!editorState?.isStrike,
      command: () => props.editor.chain().focus().toggleStrike().run(),
      icon: IconStrikethrough,
    },
    {
      name: "Code",
      isActive: () => !!editorState?.isCode,
      command: () => props.editor.chain().focus().toggleCode().run(),
      icon: IconCode,
    },
  ];

  const bubbleMenuProps: EditorBubbleMenuProps = {
    ...props,
    shouldShow: ({ state, editor }) => {
      const { selection } = state;
      const { empty } = selection;

      if (
        !editor.isEditable ||
        editor.isActive("image") ||
        empty ||
        isNodeSelection(selection) ||
        isCellSelection(selection) ||
        showLinkMenuRef.current
      ) {
        return false;
      }
      return isTextSelected(editor);
    },
    options: {
      placement: "bottom",
      offset: 8,
    },
  };

  if (showLinkMenu) return null;

  return (
    <BubbleMenu
      {...bubbleMenuProps}
      appendTo={props.appendTo}
      style={{ zIndex: 199, position: "relative" }}
    >
      <div className={classes.bubbleMenu}>
            <ActionIcon.Group>
              {items.map((item, index) => (
                <Tooltip
                  key={index}
                  label={t(item.name)}
                  withArrow
                  withinPortal={false}
                >
                  <ActionIcon
                    key={index}
                    variant="default"
                    size="lg"
                    radius="0"
                    aria-label={t(item.name)}
                    className={clsx({ [classes.active]: item.isActive() })}
                    style={{ border: "none" }}
                    onClick={() =>
                      item.command()
                    }
                  >
                    <item.icon style={{ width: rem(16) }} stroke={2} />
                  </ActionIcon>
                </Tooltip>
              ))}
            </ActionIcon.Group>

        <LinkSelector />
      </div>
    </BubbleMenu>
  );
};
