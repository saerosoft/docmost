import { atom } from 'jotai';
import type { Editor } from '@tiptap/react';

// Each mounted pane supplies its own Jotai store; editor objects never cross panes.
export const pageEditorAtom = atom<Editor | null>(null);
export const titleEditorAtom = atom<Editor | null>(null);
export const showLinkMenuAtom = atom(false);
