import { Avatar, Box, Group, Text } from "@mantine/core";
import type { Comment } from "@knowledge/model";
import CommentEditor from "./comment-editor";

export default function CommentListItem({ comment }: { comment: Comment }) {
  return <Box pb="xs">
    <Group><Avatar name={comment.authorName} size="sm"/><div style={{ flex: 1 }}>
      <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={500} lineClamp={1}>{comment.authorName}</Text></Group>
      <Group gap="xs"><Text component="time" size="xs" fw={500} c="dimmed" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("ko-KR")}</Text></Group>
    </div></Group>
    <CommentEditor defaultContent={comment.body} editable={false}/>
  </Box>;
}
