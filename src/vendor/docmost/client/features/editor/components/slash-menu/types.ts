import type { Editor, Range } from '@tiptap/core';
import type { ComponentType } from 'react';

export type CommandProps = { editor: Editor; range: Range };
export type CommandListProps = CommandProps & {
  items: SlashMenuGroupedItemsType;
  command: (item: SlashMenuItemType) => void;
  listId: string;
};
export type SlashMenuItemType = {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  searchTerms: string[];
  command: (props: CommandProps) => void;
};
export type SlashMenuGroupedItemsType = Record<string, SlashMenuItemType[]>;
