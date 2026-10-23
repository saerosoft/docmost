import { useRef, useState } from "react";
import { ActionIcon, Avatar, Badge, Button, Center, Group, Paper, ScrollArea, Stack, Tabs, Text } from "@mantine/core";
import { IconArrowUp, IconMessageOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import CommentListItem from "./comment-list-item";
import CommentEditor, { type CommentEditorHandle } from "./comment-editor";
import type { Comment, Page } from "@knowledge/model";

interface Props {
  comments: Page<Comment>;
  canComment: boolean;
  isLoading: boolean;
  onSave: (body: string) => Promise<boolean>;
  onLoadMore: () => void;
}

export default function CommentListWithTabs({ comments, canComment, isLoading, onSave, onLoadMore }: Props) {
  const { t } = useTranslation();
  return <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
    <Tabs defaultValue="open" variant="default" style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
      <Tabs.List justify="center"><Tabs.Tab value="open" leftSection={<Badge size="sm" variant="light" color="blue">{comments.items.length}</Badge>}>{t("Open")}</Tabs.Tab></Tabs.List>
      <ScrollArea mah={400} scrollbarSize={5} type="scroll"><Tabs.Panel value="open" pt="xs">
        {!comments.items.length && !isLoading ? <Center py="xl"><Stack align="center" gap="xs"><IconMessageOff size={32} stroke={1.5} color="var(--mantine-color-dimmed)"/><Text size="sm" c="dimmed">아직 댓글이 없습니다.</Text></Stack></Center>
          : comments.items.map(comment => <Paper shadow="sm" radius="md" p="sm" mb="sm" withBorder key={comment.id} data-comment-id={comment.id}><CommentListItem comment={comment}/></Paper>)}
        {comments.nextCursor && <Button disabled={isLoading} onClick={onLoadMore}>댓글 더 보기</Button>}
      </Tabs.Panel></ScrollArea>
    </Tabs>
    {canComment && <PageCommentInput onSave={onSave} isLoading={isLoading}/>}
  </div>;
}

function PageCommentInput({ onSave, isLoading }: { onSave: Props["onSave"]; isLoading: boolean }) {
  const [content, setContent] = useState("");
  const commentEditorRef = useRef<CommentEditorHandle>(null);
  async function handleSave() {
    if (isLoading || !content.trim() || content.length > 10000) return;
    if (await onSave(content)) { setContent(""); commentEditorRef.current?.clearContent(); }
  }
  return <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--mantine-color-default-border)", paddingTop: "var(--mantine-spacing-sm)", paddingBottom: 25, position: "relative" }}>
    <Group wrap="nowrap" align="flex-start" gap="xs"><Avatar size="sm" style={{ flexShrink: 0, marginTop: 10 }}/><div style={{ flex: 1, minWidth: 0 }}>
      <CommentEditor ref={commentEditorRef} onUpdate={setContent} onSave={() => void handleSave()} editable={!isLoading} placeholder="댓글" surface="muted"/>
    </div></Group>
    {content.length > 10000 && <Text role="alert" c="red">댓글은 10,000자 이내로 입력해 주세요.</Text>}
    <ActionIcon variant="filled" radius="xl" size="sm" aria-label="댓글 남기기" onClick={() => void handleSave()} onMouseDown={event => event.preventDefault()}
      loading={isLoading} disabled={!content.trim() || content.length > 10000} style={{ position: "absolute", right: 8, bottom: 30 }}><IconArrowUp size={16}/></ActionIcon>
  </div>;
}
