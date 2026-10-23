import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import renderItems from '../components/slash-menu/render-items';
import getSuggestionItems from '../components/slash-menu/menu-items';
import type { SlashMenuItemType } from '../components/slash-menu/types';

export const slashMenuPluginKey = new PluginKey('slash-command');
export default Extension.create({
  name: 'slash-command',
  addProseMirrorPlugins() {
    return [Suggestion<SlashMenuItemType, SlashMenuItemType>({
      pluginKey: slashMenuPluginKey, editor: this.editor, char: '/',
      command: ({ editor, range, props }) => props.command({ editor, range }),
      allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
      items: props => Object.values(getSuggestionItems(props)).flat(),
      render: renderItems,
    })];
  },
});
