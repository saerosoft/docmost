import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ActionIcon, Button, Card, Group, LoadingOverlay, Modal, Text, Textarea, useComputedColorScheme } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import clsx from "clsx";
import { IconEdit } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useDiagramSource } from "@knowledge/docmost/useDiagramSource";
import { approvedDrawioOrigin, diagramPayload } from "@knowledge/docmost/diagramFiles";
import { useDiagramUnload } from "@knowledge/docmost/useDiagramUnload";

export default function DrawioView(props: NodeViewProps) {
  const { t } = useTranslation();
  const stored = useDiagramSource(props);
  const frame = useRef<HTMLIFrameElement>(null);
  const [initialXML, setInitialXML] = useState("");
  const xml = useRef("");
  const [opened, { open, close }] = useDisclosure(false);
  const computedColorScheme = useComputedColorScheme();
  const [dirty, setDirty] = useState(false);
  const [messageError, setMessageError] = useState("");
  const origin = approvedDrawioOrigin(import.meta.env.VITE_DRAWIO_ORIGIN);
  useDiagramUnload(opened && dirty);

  const handleOpen = () => {
    if (!stored.loaded) return;
    xml.current = stored.source; setInitialXML(stored.source); setDirty(false); setMessageError(""); open();
  };
  const handleClose = useCallback(() => {
    if (stored.busy) return;
    if (!dirty || window.confirm(t("You have unsaved changes that will be lost."))) { setDirty(false); close(); }
  }, [stored.busy, dirty, close, t]);
  const apply = useCallback(async (source: string) => {
    if (await stored.saveData(source)) { setDirty(false); close(); }
  }, [stored.saveData, close]);

  useEffect(() => {
    if (!opened || !origin) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || typeof event.data !== "string" || event.data.length > 10_000_000) return;
      let data: { event?: string; xml?: string };
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.event === "init") frame.current?.contentWindow?.postMessage(JSON.stringify({ action: "load", xml: xml.current, autosave: 1 }), origin);
      if ((data.event === "save" || data.event === "autosave") && typeof data.xml === "string" && stored.editable) {
        try {
          diagramPayload("drawio", data.xml);
          xml.current = data.xml; setInitialXML(data.xml); setDirty(true); setMessageError("");
          if (data.event === "save") void apply(data.xml);
        } catch (failure) { setMessageError((failure as Error).message); }
      }
      if (data.event === "exit") handleClose();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [opened, origin, stored.editable, apply, handleClose]);

  return <NodeViewWrapper ref={stored.container} data-drag-handle contentEditable={false}>
    <Modal.Root opened={opened} onClose={handleClose} fullScreen closeOnEscape={!stored.busy}>
      <Modal.Overlay/><Modal.Content><Modal.Header><Modal.Title>Draw.io</Modal.Title><Modal.CloseButton aria-label="Draw.io 닫기" disabled={stored.busy}/></Modal.Header>
        <Modal.Body pos="relative"><LoadingOverlay visible={stored.busy}/>
          {origin ? <><Text size="xs">이 편집기를 열면 다이어그램 원문이 승인된 {origin} 주소로 전달됩니다.</Text>
            <iframe ref={frame} title="Draw.io editor" src={`${origin}/?embed=1&proto=json&spin=1&libraries=1&stealth=1&pwa=0&plugins=0&drafts=0&ui=${computedColorScheme === "light" ? "kennedy" : "dark"}`}
              sandbox="allow-scripts allow-same-origin allow-downloads" style={{ width: "100%", height: "70vh", border: 0 }}/></>
            : <Text>Draw.io 편집기 주소가 설정되지 않았습니다. XML 원문을 편집할 수 있습니다.</Text>}
          <Textarea label="Draw.io XML" value={initialXML} readOnly={!!origin || !stored.editable || stored.busy} autosize minRows={8}
            onChange={event => { xml.current = event.currentTarget.value; setInitialXML(xml.current); setDirty(true); }}/>
          {(stored.error || messageError) && <Text role="alert" c="red">{stored.error || messageError}</Text>}
          <Group justify="flex-end" mt="sm"><Button onClick={() => void apply(xml.current)} loading={stored.busy} disabled={!stored.editable}>첨부 개정 저장 후 노트에 적용</Button></Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
    <Card radius="md" onClick={event => event.detail === 2 && handleOpen()} p="xs" withBorder className={clsx(props.selected && "ProseMirror-selectednode")}>
      <Group justify="center"><ActionIcon variant="transparent" color="gray" aria-label={t("Edit diagram")} onClick={handleOpen} disabled={!stored.loaded}><IconEdit size={18}/></ActionIcon>
        <Text component="span" size="lg" c="dimmed">{t("Double-click to edit Draw.io diagram")}</Text>
      </Group>
      {stored.error && <Text role="alert" c="red">{stored.error}</Text>}
    </Card>
  </NodeViewWrapper>;
}
