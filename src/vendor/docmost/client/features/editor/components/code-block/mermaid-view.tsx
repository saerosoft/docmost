import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import classes from "./code-block.module.css";
import { useTranslation } from "react-i18next";
import { Button, Group, Modal, Textarea, useComputedColorScheme } from "@mantine/core";
import DOMPurify from "dompurify";
import { useDiagramSource } from "@knowledge/docmost/useDiagramSource";
import { useDiagramUnload } from "@knowledge/docmost/useDiagramUnload";

export default function MermaidView(props: NodeViewProps) {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme();
  const stored = useDiagramSource(props);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  const [source, setSource] = useState("");
  const [dirty, setDirty] = useState(false);
  useDiagramUnload(opened && dirty);

  useEffect(() => {
    let active = true;
    setPreview(""); setError("");
    if (!stored.loaded || !stored.source) return;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true, securityLevel: "strict",
        htmlLabels: false, theme: computedColorScheme === "light" ? "default" : "dark" });
      const item = await mermaid.render(`mermaid-${uuidv4()}`, stored.source);
      if (active) setPreview(DOMPurify.sanitize(item.svg, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ["foreignObject", "image", "script", "iframe"] }));
    }).catch(() => { if (active) setError(t("Invalid Mermaid diagram")); });
    return () => { active = false; };
  }, [stored.loaded, stored.source, computedColorScheme, t]);

  function close() {
    if (stored.busy) return;
    if (!dirty || window.confirm(t("You have unsaved changes that will be lost."))) { setDirty(false); setOpened(false); }
  }
  return <NodeViewWrapper ref={stored.container} contentEditable={false}>
    <Group justify="space-between"><strong>Mermaid</strong><Button size="xs" disabled={!stored.loaded} onClick={() => { setSource(stored.source); setDirty(false); setOpened(true); }}>{stored.editable ? "원본 편집" : "원본 보기"}</Button></Group>
    <div className={classes.mermaid} contentEditable={false} dangerouslySetInnerHTML={{ __html: preview }}/>
    {(stored.error || error) && <p className={classes.error} role="alert">{stored.error || error} · 원문은 보존됩니다.</p>}
    <Modal opened={opened} onClose={close} title="Mermaid" closeOnEscape={!stored.busy} closeButtonProps={{ 'aria-label': 'Mermaid 닫기' }}>
      <Textarea label="Mermaid 원본" value={source} onChange={event => { setSource(event.currentTarget.value); setDirty(true); }} readOnly={!stored.editable || stored.busy} autosize minRows={8}/>
      {stored.error && <p role="alert">{stored.error}</p>}
      <Button loading={stored.busy} disabled={!stored.editable} onClick={async () => { if (await stored.saveData(source)) { setDirty(false); setOpened(false); } }}>첨부 개정 저장 후 노트에 적용</Button>
    </Modal>
  </NodeViewWrapper>;
}
