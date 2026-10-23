import { ActionIcon, Menu } from '@mantine/core';
import { IconChartDots } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';

export function DiagramGroup({ editor }: { editor: Editor }) {
  return <Menu><Menu.Target><ActionIcon variant="subtle" aria-label="다이어그램 삽입"><IconChartDots size={16}/></ActionIcon></Menu.Target><Menu.Dropdown>
    <Menu.Item onClick={() => editor.chain().focus().toggleCallout({ type: 'info' }).run()}>안내 상자</Menu.Item>
    {['mermaid', 'drawio', 'excalidraw'].map(type => <Menu.Item key={type} onClick={() => editor.chain().focus().insertContent({ type }).run()}>{type}</Menu.Item>)}
  </Menu.Dropdown></Menu>;
}
