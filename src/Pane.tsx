import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Alert, Box, Button, Group, Menu, Tabs, Text, Tooltip } from '@mantine/core';
import { IconDots, IconFileText, IconHistory, IconInfoCircle, IconMessage, IconPaperclip, IconRefresh } from '@tabler/icons-react';
import Aside from './vendor/docmost/client/components/layouts/global/aside';
import type { NoteApi } from './model';
import { acceptMetadata, acceptSave, canClose, editDraft, openDraft, prepareSave, reorder, type Draft } from './paneState';
import Page from './vendor/docmost/client/pages/page/page';
import { DocmostPaneProvider } from './docmost/DocmostPaneProvider';
import { NotePanels, type NotePanel } from './NotePanels';
import { NoteKnowledgeContext } from './NoteKnowledgeContext';
import { NoteCurrentKnowledge } from './NoteCurrentKnowledge';
import { ApiError, onAccessLost, onAccessRefresh } from './transport';

interface Props { api: NoteApi; paneId: string; requestedId: string | null; onLocation: (id: string | null) => void; onDirty: (value: boolean) => void; onActivate: () => void }
export function Pane({ api, paneId, requestedId, onLocation, onDirty, onActivate }: Props) {
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [latest, setLatest] = useState<Draft>();
  const [details, setDetails] = useState<'details' | 'knowledge' | null>(null);
  const [detailPanel, setDetailPanel] = useState<NotePanel>('comments');
  const [openedDetails, setOpenedDetails] = useState(false);
  const [openedKnowledge, setOpenedKnowledge] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const state = useRef(drafts); state.current = drafts;
  const sessionEpoch = useRef(0);
  const openSequence = useRef(0);
  const activeRef = useRef(active); activeRef.current = active;
  const saving = useRef(false);
  useEffect(() => onAccessLost(() => { sessionEpoch.current++; state.current = {}; setDrafts({}); setTabs([]); setActive(null); setLatest(undefined); setDetails(null); setOpenedDetails(false); setOpenedKnowledge(false); setError('접근 권한을 확인해 주세요. 열린 노트가 삭제되었습니다.'); }), []);
  const update = (id: string, transform: (draft: Draft) => Draft) => setDrafts(values => values[id] ? { ...values, [id]: transform(values[id]) } : values);
  async function open(id: string) {
    const sequence = ++openSequence.current;
    if (state.current[id]) { setActive(id); onLocation(id); return; }
    if (Object.keys(state.current).length >= 12) { setError('한 창에서 최대 12개 노트를 열 수 있습니다. 사용하지 않는 탭을 닫아 주세요.'); return; }
    setBusy(true); setError(''); const epoch = sessionEpoch.current;
    try { const note = await api.note(id); if (epoch !== sessionEpoch.current || sequence !== openSequence.current) return; setDrafts(values => ({ ...values, [id]: values[id] || openDraft(note) })); setTabs(values => values.includes(id) ? values : [...values, id]); setActive(id); onLocation(id); }
    catch (e) { if (epoch === sessionEpoch.current) setError((e as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => {
    const refresh = async () => {
      const epoch = ++sessionEpoch.current;
      openSequence.current++;
      await Promise.all(Object.keys(state.current).map(async id => {
        try {
          const note = await api.note(id);
          if (epoch === sessionEpoch.current) update(id, value => acceptMetadata(value, note));
        } catch (failure) {
          if (epoch !== sessionEpoch.current) return;
          if (!(failure instanceof ApiError) || failure.code !== 'NOT_FOUND') throw failure;
          setDrafts(values => { const next = { ...values }; delete next[id]; state.current = next; return next; });
          setTabs(values => values.filter(value => value !== id));
          if (activeRef.current === id) { setActive(null); onLocation(null); }
          setLatest(undefined);
        }
      }));
    };
    const moved = () => { void refresh().catch(failure => setError(failure.message)); };
    const stop = onAccessRefresh(refresh);
    window.addEventListener('note-moved', moved);
    return () => { stop(); window.removeEventListener('note-moved', moved); };
  }, [api, onLocation]);
  useEffect(() => { if (requestedId) void open(requestedId); }, [requestedId]);
  const draft = active ? drafts[active] : undefined;
  useEffect(() => { setLatest(undefined); }, [active]);
  useEffect(() => { onDirty(Object.values(drafts).some(value => value.dirty)); }, [drafts, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  async function save() {
    if (!active || !draft || invalid[active] || saving.current) return;
    const id = active; const prepared = prepareSave(draft); const pending = prepared.pending!; const epoch = sessionEpoch.current;
    setDrafts(values => ({ ...values, [id]: prepared })); setBusy(true); saving.current = true; setError('');
    try { const note = await api.save(id, pending.input); if (epoch === sessionEpoch.current) { update(id, value => acceptSave(value, note, pending.version)); window.dispatchEvent(new Event('note-changed')); } }
    catch (e) { if (epoch === sessionEpoch.current) setError((e as Error).message); }
    finally { setBusy(false); saving.current = false; }
  }
  function close(id: string) {
    if (saving.current || !canClose(drafts[id], () => window.confirm('저장하지 않은 변경을 버리고 탭을 닫을까요?'))) return;
    const remaining = tabs.filter(value => value !== id); setTabs(remaining);
    setDrafts(values => { const next = { ...values }; delete next[id]; return next; });
    if (active === id) { const next = remaining.at(-1) || null; setActive(next); onLocation(next); }
  }
  function openDetails(panel: NotePanel) {
    setOpenedDetails(true); setDetailPanel(panel); setDetails('details');
  }
  function toggleKnowledge() {
    setOpenedKnowledge(true); setDetails(value => value === 'knowledge' ? null : 'knowledge');
  }
  return <DocmostPaneProvider><section className="pane note-gui-pane" aria-label={`${paneId} 편집 창`} onFocusCapture={onActivate} onPointerDownCapture={onActivate}>
    <Box className="note-gui-tabs"><Tabs value={active} onChange={id => { if (id) { setActive(id); onLocation(id); } }}>
      <Tabs.List aria-label={`${paneId} 노트 탭`} style={{ flexWrap: 'nowrap' }}>
        {tabs.map((id, index) => <Group key={id} gap={0} wrap="nowrap">
          <Tabs.Tab value={id} onKeyDown={event => { if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setTabs(values => reorder(values, index, index + (event.key === 'ArrowLeft' ? -1 : 1))); } }}>{drafts[id]?.title || '노트'}{drafts[id]?.dirty ? ' •' : ''}</Tabs.Tab>
          <ActionIcon variant="subtle" color="gray" aria-label={`${drafts[id]?.title} 탭 닫기`} disabled={busy} onClick={() => close(id)}>×</ActionIcon>
          <ActionIcon variant="subtle" color="gray" aria-label="탭 왼쪽으로 이동" disabled={index === 0} onClick={() => setTabs(values => reorder(values, index, index - 1))}>‹</ActionIcon>
          <ActionIcon variant="subtle" color="gray" aria-label="탭 오른쪽으로 이동" disabled={index === tabs.length - 1} onClick={() => setTabs(values => reorder(values, index, index + 1))}>›</ActionIcon>
        </Group>)}
      </Tabs.List>
    </Tabs></Box>
    {error && <Alert color="red" role="alert">{error}</Alert>}{busy && <p role="status">처리 중…</p>}
    {!draft || !active ? <div className="empty"><h2>노트를 선택해 주세요</h2><p>왼쪽 트리에서 노트를 열거나 새 노트를 작성할 수 있습니다.</p></div> : <div className="note-gui-page">
      {latest && <Alert color="orange"><p>서버 개정 {latest.note.revision} · {latest.title}. 현재 편집은 그대로 보존됩니다.</p><details><summary>서버 원문 확인</summary><pre>{JSON.stringify(latest.body, null, 2)}</pre></details><Group>
        <Button onClick={() => { if (window.confirm('내 변경을 버리고 서버 버전을 열까요?')) { update(active, () => latest); setEditorEpoch(value => value + 1); setLatest(undefined); } }}>서버 버전 열기</Button>
        <Button variant="subtle" onClick={() => setLatest(undefined)}>내 편집 계속</Button>
      </Group></Alert>}
      <Page editorKey={`${paneId}:${active}:${editorEpoch}`} header={<>
        <Group gap="xs" wrap="nowrap" className="note-page-breadcrumb"><IconFileText size={17} stroke={1.5}/><Text size="sm" truncate>{draft.title || '제목 없음'}</Text></Group>
        <Group gap="xs" wrap="nowrap" className="note-page-actions">
        <Tooltip label="최신 버전 확인" withinPortal={false}><ActionIcon variant="subtle" color="gray" aria-label="최신 버전 확인" disabled={busy} onClick={async () => { const id = active; const epoch = sessionEpoch.current; setError(''); try { const note = await api.note(id); if (epoch === sessionEpoch.current && activeRef.current === id) setLatest(openDraft(note)); } catch (e) { if (epoch === sessionEpoch.current) setError((e as Error).message); } }}><IconRefresh size={18}/></ActionIcon></Tooltip>
        <Button size="xs" disabled={!draft.note.canEdit || !draft.dirty || busy || invalid[active]} onClick={() => void save()}>저장</Button>
        <Tooltip label="댓글" withinPortal={false}><ActionIcon variant="subtle" color="gray" aria-label="댓글 및 노트 상세" aria-expanded={details === 'details'} onClick={() => { if (details === 'details') setDetails(null); else openDetails('comments'); }}><IconMessage size={20} stroke={1.5}/></ActionIcon></Tooltip>
        <Tooltip label="현재 정리·근거·누적 이력" withinPortal={false}><ActionIcon variant="subtle" color="gray" aria-label="지식 정보" aria-expanded={details === 'knowledge'} onClick={toggleKnowledge}><IconInfoCircle size={20} stroke={1.5}/></ActionIcon></Tooltip>
        <Menu position="bottom-end" withinPortal={false}><Menu.Target><ActionIcon variant="subtle" color="gray" aria-label="페이지 메뉴"><IconDots size={20}/></ActionIcon></Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{draft.note.visibility === 'PRIVATE' ? '나만 보기' : draft.note.visibility === 'ADMINISTRATORS' ? '관리자 전용' : '공간 공유'} · 개정 {draft.note.revision}</Menu.Label>
            <Menu.Item leftSection={<IconHistory size={16}/>} onClick={() => openDetails('history')}>페이지 이력</Menu.Item>
            <Menu.Item onClick={() => openDetails('properties')}>속성</Menu.Item>
            <Menu.Item onClick={() => openDetails('relations')}>관계</Menu.Item>
            <Menu.Item leftSection={<IconPaperclip size={16}/>} onClick={() => openDetails('attachments')}>첨부파일</Menu.Item>
            <Menu.Item onClick={() => { setOpenedKnowledge(true); setDetails('knowledge'); }}>현재 정리·근거·누적 이력</Menu.Item>
            <Menu.Divider/>
            <Menu.Item onClick={() => setShowToolbar(value => !value)}>{showToolbar ? '서식 도구 모음 숨기기' : '서식 도구 모음 표시'}</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group></>} editor={{
        api, pageId: active, title: draft.title, content: draft.body, showToolbar, editable: draft.note.canEdit && !invalid[active],
        byline: <Text size="xs" c="dimmed" className="note-body-status">{draft.note.bodyOrigin === 'HUMAN' ? '사람이 작성한 본문' : '기존 본문'} · {draft.note.visibility === 'PRIVATE' ? '나만 보기' : draft.note.visibility === 'ADMINISTRATORS' ? '관리자 전용' : '공간 공유'} · 개정 {draft.note.revision} · {draft.dirty ? '저장하지 않은 변경' : '저장됨'}</Text>,
        onTitleChange: title => update(active, value => editDraft(value, { title })),
        onInvalid: () => setInvalid(values => ({ ...values, [active]: true })),
        onChange: body => update(active, value => editDraft(value, { body })),
      }} panelOpen={details !== null} panels={(openedDetails || openedKnowledge) && <Aside title={details === 'knowledge' ? '지식 정보' : '노트 상세'} onClose={() => setDetails(null)}>
        {openedKnowledge && <div hidden={details !== 'knowledge'} className="note-knowledge-panels">
          <Text size="xs" c="dimmed">{draft.note.bodyOrigin === 'HUMAN' ? '사람이 작성한 본문' : '기존 본문'}</Text>
          {draft.note.bodyOrigin === 'LEGACY_UNCLASSIFIED' && <Text size="sm">사람이 작성한 내용과 이전 자동 정리가 구분되지 않은 본문입니다. 원문을 보존했습니다.</Text>}
          <NoteCurrentKnowledge key={`${active}:${draft.note.revision}`} api={api} noteId={active} spaceId={draft.note.spaceId}/>
          <NoteKnowledgeContext api={api} note={draft.note}/>
        </div>}
        {openedDetails && <div hidden={details !== 'details'} className="note-detail-panels"><NotePanels key={active} api={api} note={draft.note} dirty={draft.dirty} panel={detailPanel} onPanelChange={setDetailPanel} onOpen={id => void open(id)} onRevision={note => update(active, value => acceptMetadata(value, note))} onRestore={note => { update(active, () => openDraft(note)); setEditorEpoch(value => value + 1); }}/></div>}
      </Aside>}/>
    </div>}
  </section></DocmostPaneProvider>;
}
