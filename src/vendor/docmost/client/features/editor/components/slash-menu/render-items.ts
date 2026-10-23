import { ReactRenderer } from '@tiptap/react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import CommandList from './command-list';
import type { SlashMenuItemType } from './types';

type Props = SuggestionProps<SlashMenuItemType, SlashMenuItemType>;

export default function renderItems() {
  let component: ReactRenderer | null = null;
  let popup: HTMLElement | null = null;
  let cleanup: (() => void) | null = null;
  let getReferenceClientRect: (() => DOMRect | null) | null = null;
  let listId = '';
  function updatePosition() {
    const rect = getReferenceClientRect?.();
    if (!popup || !rect) return;
    const target = popup;
    void computePosition({ getBoundingClientRect: () => rect }, target, { placement: 'bottom-start', strategy: 'fixed', middleware: [offset(0), flip(), shift()] }).then(({ x, y }) => {
      if (popup === target) { target.style.left = `${x}px`; target.style.top = `${y}px`; }
    });
  }
  function destroy() {
    cleanup?.(); cleanup = null;
    popup?.remove(); popup = null;
    component?.destroy(); component = null;
  }
  return {
    onStart(props: Props) {
      listId = `slash-${crypto.randomUUID()}`;
      component = new ReactRenderer(CommandList, { props: { ...props, items: { basic: props.items }, listId }, editor: props.editor });
      getReferenceClientRect = props.clientRect || null;
      popup = document.createElement('div');
      Object.assign(popup.style, { zIndex: '199', position: 'fixed', top: '0', left: '0' });
      // The access boundary hides this popup with its pane, including during reauthorization.
      const pane = props.editor.view.dom.closest('.pane');
      if (!pane) { destroy(); return; }
      pane.appendChild(popup); popup.appendChild(component.element);
      cleanup = autoUpdate({ getBoundingClientRect: () => getReferenceClientRect?.() || new DOMRect() }, popup, updatePosition);
      props.editor.on('destroy', destroy);
    },
    onUpdate(props: Props) {
      component?.updateProps({ ...props, items: { basic: props.items }, listId });
      getReferenceClientRect = props.clientRect || null; updatePosition();
    },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === 'Escape') { destroy(); return true; }
      // CommandList owns scoped keyboard navigation on this editor's DOM.
      return ['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key);
    },
    onExit: destroy,
  };
}
