import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Text, Paper, ActionIcon, Loader } from "@mantine/core";
import { IconDownload, IconPaperclip } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAuthorizedFile } from "@knowledge/docmost/useAuthorizedFile";
import { Button } from "@mantine/core";

export default function AttachmentView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node } = props;
  const name = String(node.attrs.title || "attachment");
  const file = useAuthorizedFile(node.attrs.fileId ? String(node.attrs.fileId) : null);
  const url = file.url;

  return (
    <NodeViewWrapper ref={file.container} contentEditable={false}>
      <Paper withBorder p="4px"  data-drag-handle>
        <Group
          justify="space-between"
          gap="xl"
          style={{ cursor: "pointer" }}
          wrap="nowrap"
          h={25}
        >
          <Group wrap="nowrap" gap="sm" style={{ minWidth: 0, flex: 1 }}>
            {!url && file.visible && !file.error ? (
              <Loader size={20} style={{ flexShrink: 0 }} />
            ) : (
              <IconPaperclip size={20} style={{ flexShrink: 0 }} />
            )}

            <Text component="span" size="md" truncate="end" style={{ minWidth: 0 }}>
              {!url && file.visible && !file.error ? "첨부파일 읽는 중…" : name}
            </Text>

            <Text component="span" size="sm" c="dimmed" style={{ flexShrink: 0 }}>
              {file.size !== undefined ? `${file.size.toLocaleString()} B` : ""}
            </Text>
          </Group>

          {url && (
            <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
              <ActionIcon component="a" href={url} download={name} variant="default" aria-label={t("Download")}>
                  <IconDownload size={18} />
                </ActionIcon>
            </Group>
          )}
        </Group>
      </Paper>
      {!file.visible && <Button size="xs" variant="subtle" onClick={file.load}>첨부파일 열기</Button>}
      {file.error && <Text role="alert" c="red">{file.error}</Text>}
    </NodeViewWrapper>
  );
}
