import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Image, Loader, Text } from "@mantine/core";
import clsx from "clsx";
import classes from "./image-view.module.css";
import { useAuthorizedFile } from "@knowledge/docmost/useAuthorizedFile";
import { Button } from "@mantine/core";

export default function ImageView(props: NodeViewProps) {
  const { node, selected } = props;
  const file = useAuthorizedFile(node.attrs.fileId ? String(node.attrs.fileId) : null);
  const src = file.url;
  const alt = String(node.attrs.alt || node.attrs.title || "");

  return (
    <NodeViewWrapper ref={file.container} data-drag-handle contentEditable={false}>
      <div
        className={clsx(
          selected && "ProseMirror-selectednode",
          classes.imageWrapper,
          !src && file.visible && !file.error && classes.skeleton,
        )}
      >
        {src && (
          <Image radius="md" fit="contain" src={src} alt={alt} />
        )}
        {!src && file.visible && !file.error && <Loader size={20}/>}
        {!file.visible && <Button size="xs" variant="subtle" onClick={file.load}>이미지 열기</Button>}
        {file.error && <Text role="alert" c="red">{file.error}</Text>}
      </div>
    </NodeViewWrapper>
  );
}
