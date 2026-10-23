import HistoryItem from "@/features/page-history/components/history-item";
import {
  activeHistoryIdAtom,
  activeHistoryPrevIdAtom,
  compareModeAtom,
  comparePairAtom,
  compareSelectionAtom,
} from "@/features/page-history/atoms/history-atoms";
import { resolveComparePair } from "@/features/page-history/utils/resolve-compare-pair";
import { useAtom, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import {
  Button,
  ScrollArea,
  Group,
  Divider,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { Revision } from "@knowledge/model";

interface Props {
  pageId: string;
  historyItems: Revision[];
  isLoading: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  canRestore: boolean;
  confirmRestore: (id: string) => void;
}

function HistoryList({ pageId, historyItems, isLoading, hasNextPage, fetchNextPage, canRestore, confirmRestore }: Props) {
  const { t } = useTranslation();
  const [activeHistoryId, setActiveHistoryId] = useAtom(activeHistoryIdAtom);
  const setActiveHistoryPrevId = useSetAtom(activeHistoryPrevIdAtom);
  const [compareMode, setCompareMode] = useAtom(compareModeAtom);
  const [compareSelection, setCompareSelection] = useAtom(compareSelectionAtom);
  const setComparePair = useSetAtom(comparePairAtom);

  useEffect(() => {
    setActiveHistoryId(""); setActiveHistoryPrevId(""); setComparePair(null); setCompareMode(false); setCompareSelection([]);
  }, [pageId, setActiveHistoryId, setActiveHistoryPrevId, setComparePair, setCompareMode, setCompareSelection]);

  const handleSelect = useCallback(
    (id: string, index: number) => {
      setComparePair(null);
      setActiveHistoryId(id);
      setActiveHistoryPrevId(historyItems[index + 1]?.id ?? "");
    },
    [historyItems, setActiveHistoryId, setActiveHistoryPrevId, setComparePair],
  );

  const handleToggleCompare = useCallback(
    (id: string) => {
      setCompareSelection((prev) => {
        if (prev.includes(id)) return prev.filter((item) => item !== id);
        if (prev.length >= 2) return prev;
        return [...prev, id];
      });
    },
    [setCompareSelection],
  );

  const handleStartCompare = useCallback(
    (id: string) => {
      setComparePair(null);
      setCompareMode(true);
      setCompareSelection([id]);
    },
    [setComparePair, setCompareMode, setCompareSelection],
  );

  const handleCancelCompare = useCallback(() => {
    setCompareMode(false);
    setCompareSelection([]);
  }, [setCompareMode, setCompareSelection]);

  const handleConfirmCompare = useCallback(() => {
    const pair = resolveComparePair(historyItems, compareSelection);
    if (!pair) return;
    setComparePair(pair);
    setCompareMode(false);
    setCompareSelection([]);
  }, [
    historyItems,
    compareSelection,
    setComparePair,
    setCompareMode,
    setCompareSelection,
  ]);

  const handleRestoreItem = useCallback(
    (id: string, index: number) => {
      handleSelect(id, index);
      confirmRestore(id);
    },
    [handleSelect, confirmRestore],
  );

  useEffect(() => {
    if (historyItems.length > 0 && !activeHistoryId) {
      setActiveHistoryId(historyItems[0].id);
      setActiveHistoryPrevId(historyItems[1]?.id ?? "");
    }
  }, [
    historyItems,
    activeHistoryId,
    setActiveHistoryId,
    setActiveHistoryPrevId,
  ]);

  if (isLoading) {
    return <></>;
  }

  if (historyItems.length === 0) {
    return <>{t("No page history saved yet.")}</>;
  }

  return (
    <div>
      <ScrollArea mah={400} w="100%" type="scroll" scrollbarSize={5}>
        {historyItems.map((historyItem, index) => (
          <HistoryItem
            key={historyItem.id}
            historyItem={historyItem}
            index={index}
            onSelect={handleSelect}
            isActive={historyItem.id === activeHistoryId}
            compareMode={compareMode}
            isChecked={compareSelection.includes(historyItem.id)}
            isCheckboxDisabled={
              !compareSelection.includes(historyItem.id) &&
              compareSelection.length >= 2
            }
            canCompare={historyItems.length >= 2}
            onToggleCompare={handleToggleCompare}
            onStartCompare={handleStartCompare}
            onRestore={canRestore ? handleRestoreItem : undefined}
          />
        ))}
        {hasNextPage && <Button disabled={isLoading} onClick={fetchNextPage}>이력 더 보기</Button>}
      </ScrollArea>

      {compareMode ? (
        <>
          <Divider />
          <Group p="xs" wrap="nowrap">
            <Button
              variant="default"
              size="compact-md"
              onClick={handleCancelCompare}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="compact-md"
              disabled={compareSelection.length !== 2}
              onClick={handleConfirmCompare}
            >
              {t("Compare")}
            </Button>
          </Group>
        </>
      ) : (
        (
          <>
            <Divider />
            <Group p="xs" wrap="nowrap">
              <Button size="compact-md" disabled={!canRestore || !activeHistoryId} onClick={() => confirmRestore(activeHistoryId)}>
                {t("Restore")}
              </Button>
            </Group>
          </>
        )
      )}
    </div>
  );
}

export default HistoryList;
