import { Group, Switch, Text } from '@mantine/core';
import { useAtom, useAtomValue } from 'jotai';
import type { NoteApi, Page, Revision } from '../model';
import { AttachmentContext } from '../editor/attachmentContext';
import HistoryList from '../vendor/docmost/client/features/page-history/components/history-list';
import { HistoryEditor } from '../vendor/docmost/client/features/page-history/components/history-editor';
import { activeHistoryIdAtom, comparePairAtom, diffCountsAtom, highlightChangesAtom } from '../vendor/docmost/client/features/page-history/atoms/history-atoms';

interface Props {
  api: NoteApi;
  noteId: string;
  history: Page<Revision>;
  busy: boolean;
  canRestore: boolean;
  onRestore: (revision: Revision) => void;
  onLoadMore: () => void;
}
export function DocmostHistory({ api, noteId, history, busy, canRestore, onRestore, onLoadMore }: Props) {
  const active = useAtomValue(activeHistoryIdAtom);
  const pair = useAtomValue(comparePairAtom);
  const counts = useAtomValue(diffCountsAtom);
  const [highlight, setHighlight] = useAtom(highlightChangesAtom);
  const index = history.items.findIndex(item => item.id === active);
  const current = pair ? history.items.find(item => item.id === pair.newerId) : history.items[index < 0 ? 0 : index];
  const previous = pair ? history.items.find(item => item.id === pair.olderId) : history.items[(index < 0 ? 0 : index) + 1];
  return <AttachmentContext.Provider value={{ api, noteId, editable: false }}>
    <HistoryList pageId={noteId} historyItems={history.items} isLoading={busy} hasNextPage={!!history.nextCursor} fetchNextPage={onLoadMore} canRestore={canRestore}
      confirmRestore={id => { const revision = history.items.find(item => item.id === id); if (canRestore && revision) onRestore(revision); }}/>
    {current && <>
      {current.bodyOrigin === 'LEGACY_UNCLASSIFIED' && <p className="legacy-body-notice">이 개정은 작성 구분을 확인해야 하는 기존 본문입니다. 복원할 때도 원문과 작성 구분을 유지합니다.</p>}
      <Group justify="space-between" my="sm"><Switch label="변경 표시" checked={highlight} onChange={event => setHighlight(event.currentTarget.checked)}/>
        {counts && <Text size="xs">추가 {counts.added} · 삭제 {counts.deleted}</Text>}
      </Group>
      <HistoryEditor title={current.title} content={current.bodyJson} previousContent={previous?.bodyJson}/>
    </>}
  </AttachmentContext.Provider>;
}
