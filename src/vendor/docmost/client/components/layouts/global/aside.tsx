import { ActionIcon, Box, Group, ScrollArea, Title, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { type ReactNode } from "react";

interface Props { title: string; onClose: () => void; children: ReactNode }

export default function Aside({ title, onClose, children }: Props) {
  return <Box p="md" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <Group justify="space-between" wrap="nowrap" mb="md">
      <Title order={2} size="h6" fw={500}>{title}</Title>
      <Tooltip label="닫기" withArrow><ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="노트 상세 닫기"><IconX size={18}/></ActionIcon></Tooltip>
    </Group>
    <ScrollArea style={{ flex: 1, minHeight: 0 }} scrollbarSize={5} type="scroll">{children}</ScrollArea>
  </Box>;
}
