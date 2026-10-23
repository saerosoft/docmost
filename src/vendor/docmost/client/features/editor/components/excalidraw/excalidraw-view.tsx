import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ActionIcon, Button, Card, Group, LoadingOverlay, Modal, Text, useComputedColorScheme } from "@mantine/core";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import clsx from "clsx";
import { IconEdit } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useDiagramSource } from "@knowledge/docmost/useDiagramSource";
import { useDiagramUnload } from "@knowledge/docmost/useDiagramUnload";
import { loadExcalidraw } from "@knowledge/docmost/excalidraw";

const ExcalidrawComponent = lazy(() => loadExcalidraw().then(module => ({ default: module.Excalidraw })));

export default function ExcalidrawView(props: NodeViewProps) {
  const { t } = useTranslation();
  const stored = useDiagramSource(props);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [excalidrawData, setExcalidrawData] = useState<ExcalidrawInitialDataState | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const computedColorScheme = useComputedColorScheme();
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [opening, setOpening] = useState(false);
  const mounted = useRef(true);
  const isInitialLoadRef = useRef(true);
  const lastFingerprintRef = useRef("");
  useDiagramUnload(opened && dirty);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const handleOpen = async () => {
    if (!stored.loaded || opening) return;
    setOpening(true); setLoadError("");
    try {
      const { loadFromBlob } = await loadExcalidraw();
      const scene = await loadFromBlob(new Blob([stored.source], { type: "application/json" }), null, null);
      if (props.editor.isDestroyed || !mounted.current) return;
      setExcalidrawData(scene); setDirty(false); isInitialLoadRef.current = true; open();
    } catch { if (mounted.current) setLoadError("Excalidraw 원문을 열지 못했습니다. 원본 파일은 보존됩니다."); }
    finally { if (mounted.current) setOpening(false); }
  };
  const saveData = useCallback(async () => {
    if (!excalidrawAPI || stored.busy) return;
    setLoadError("");
    try {
      const { serializeAsJSON } = await loadExcalidraw();
      const source = serializeAsJSON(excalidrawAPI.getSceneElements(), excalidrawAPI.getAppState(), excalidrawAPI.getFiles(), "local");
      if (await stored.saveData(source)) { setDirty(false); close(); }
    } catch { if (mounted.current) setLoadError("Excalidraw 원문을 저장하지 못했습니다. 다시 시도해 주세요."); }
  }, [excalidrawAPI, stored.busy, stored.saveData, close]);
  const handleClose = useCallback(() => {
    if (stored.busy) return;
    if (!dirty || window.confirm(t("You have unsaved changes that will be lost."))) { setDirty(false); close(); setExcalidrawAPI(null); }
  }, [stored.busy, dirty, close, t]);

  return <NodeViewWrapper ref={stored.container} data-drag-handle contentEditable={false}>
    <Modal.Root opened={opened} onClose={handleClose} fullScreen withinPortal={false} closeOnEscape={!stored.busy}>
      <Modal.Overlay/><Modal.Content><Modal.Header><Modal.Title>Excalidraw</Modal.Title><Modal.CloseButton disabled={stored.busy}/></Modal.Header><Modal.Body pos="relative">
        <LoadingOverlay visible={stored.busy}/>
        <Group justify="flex-end" wrap="nowrap" bg="var(--mantine-color-body)" p="xs">
          <Button onClick={() => void saveData()} size="compact-sm" loading={stored.busy} disabled={!stored.editable || !excalidrawAPI}>{t("Save & Exit")}</Button>
          <Button onClick={handleClose} color="red" size="compact-sm" disabled={stored.busy}>{t("Exit")}</Button>
        </Group>
        {(stored.error || loadError) && <Text role="alert" c="red">{stored.error || loadError}</Text>}
        <div style={{ height: "80vh" }}><Suspense fallback={<Text role="status">편집기 읽는 중…</Text>}>
          {excalidrawData && <ExcalidrawComponent excalidrawAPI={setExcalidrawAPI} onChange={(elements, _appState, files) => {
            const fingerprint = `${elements.length}:${elements.reduce((sum, element) => sum + (element.version || 0), 0)}:${Object.keys(files).length}`;
            if (isInitialLoadRef.current) { lastFingerprintRef.current = fingerprint; isInitialLoadRef.current = false; return; }
            if (fingerprint !== lastFingerprintRef.current) { lastFingerprintRef.current = fingerprint; setDirty(true); }
          }} initialData={{ ...excalidrawData, scrollToContent: true }} theme={computedColorScheme} viewModeEnabled={!stored.editable}/>} 
        </Suspense></div>
      </Modal.Body></Modal.Content>
    </Modal.Root>
    <Card radius="md" onClick={event => event.detail === 2 && void handleOpen()} p="xs" withBorder className={clsx(props.selected && "ProseMirror-selectednode")}>
      <Group justify="center"><ActionIcon variant="transparent" color="gray" aria-label={t("Edit drawing")} onClick={() => void handleOpen()} disabled={!stored.loaded || opening}><IconEdit size={18}/></ActionIcon>
        <Text component="span" size="lg" c="dimmed">{t("Double-click to edit Excalidraw diagram")}</Text>
      </Group>
      {(stored.error || loadError) && <Text role="alert" c="red">{stored.error || loadError}</Text>}
    </Card>
  </NodeViewWrapper>;
}
