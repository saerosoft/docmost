import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Alert, Button, Modal, Text } from '@mantine/core';
import { api as defaultApi } from './api';
import type { NoteGuiOptions } from './host';
import { NoteTree } from './NoteTree';
import { NotePicker } from './NotePicker';
import { Pane } from './Pane';
import { onAccessLost } from './transport';
import { webUrl } from './webOrigin';
import { useSpaceAccess } from './useSpaceAccess';
import GlobalAppShell from './vendor/docmost/client/components/layouts/global/global-app-shell';
import { SpaceSidebar } from './vendor/docmost/client/features/space/components/sidebar/space-sidebar';

export function App({ api = defaultApi, onNavigate }: NoteGuiOptions) {
  const params = new URLSearchParams(window.location.search);
  const access = useSpaceAccess(api);
  const { spaces } = access;
  const [spaceId, setSpaceId] = useState<string | null>(params.get('space'));
  const [left, setLeft] = useState<string | null>(params.get('note'));
  const [right, setRight] = useState<string | null>(params.get('right'));
  const [split, setSplit] = useState(params.has('right'));
  const [target, setTarget] = useState('left');
  const [searchOpened, setSearchOpened] = useState(false);
  const [error, setError] = useState('');
  const dirty = useRef({ left: false, right: false });
  const accessLost = useRef(false);
  const leftDirty = useCallback((value: boolean) => { dirty.current.left = value; }, []);
  const rightDirty = useCallback((value: boolean) => { dirty.current.right = value; }, []);
  useEffect(() => {
    if (access.ready && !accessLost.current) setSpaceId(current => spaces.some(value => value.id === current) ? current : spaces[0]?.id || null);
  }, [spaces, access.ready]);
  useEffect(() => onAccessLost(() => {
    accessLost.current = true; setSpaceId(null); setLeft(null); setRight(null); setSearchOpened(false);
    dirty.current = { left: false, right: false };
    setError('로그인 또는 공간 접근 권한을 확인해 주세요. 메인 화면에서 같은 계정으로 로그인한 뒤 새로고침하면 요청한 공간과 노트를 다시 엽니다.');
  }), []);
  useEffect(() => {
    // Preserve the requested URL after access loss so a later sign-in can restore authorized locations.
    if (accessLost.current) return;
    const query = new URLSearchParams();
    if (spaceId) query.set('space', spaceId);
    if (left) query.set('note', left);
    if (right && split) query.set('right', right);
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
  }, [spaceId, left, right, split]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty.current.left || dirty.current.right) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, []);
  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && access.ready && !access.refreshing && !access.failure && spaceId) {
        event.preventDefault(); setSearchOpened(true);
      }
    };
    window.addEventListener('keydown', search);
    return () => window.removeEventListener('keydown', search);
  }, [access.ready, access.refreshing, access.failure, spaceId]);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || event.currentTarget.target === '_blank') return;
    if ((dirty.current.left || dirty.current.right) && !window.confirm('저장하지 않은 변경이 있습니다. 메인 화면으로 이동할까요?')) {
      event.preventDefault(); return;
    }
    if (onNavigate?.(event.currentTarget.href)) event.preventDefault();
  }
  function changeSpace(value: string) {
    if (value === spaceId) return;
    if ((dirty.current.left || dirty.current.right) && !window.confirm('공간을 바꾸고 저장하지 않은 변경을 버릴까요?')) return;
    setSpaceId(value); setLeft(null); setRight(null); setSearchOpened(false); setTarget('left');
    dirty.current = { left: false, right: false };
  }
  function toggleSplit() {
    if (split && dirty.current.right && !window.confirm('오른쪽 창의 저장하지 않은 변경을 버릴까요?')) return;
    if (split) dirty.current.right = false;
    setSplit(value => !value); setTarget('left');
  }
  function open(id: string) {
    if (target === 'right' && split) setRight(id); else setLeft(id);
  }
  const currentSpace = spaces.find(value => value.id === spaceId);
  return <>
    {access.failure && <Alert color="red" role="alert">{access.failure.message} <Button onClick={() => void access.recheck()}>접근 권한 다시 확인</Button></Alert>}
    {(!access.ready || access.refreshing) && <Text p="md" role="status">접근 권한 확인 중…</Text>}
    <div hidden={!access.ready || access.refreshing || !!access.failure}>
      <GlobalAppShell header={{
        homeHref: webUrl('/'), askHref: spaceId ? webUrl(`/spaces/${spaceId}/ask`) : undefined,
        onNavigate: navigate, onSearch: () => setSearchOpened(true), searchDisabled: !spaceId,
        split, onSplit: toggleSplit,
      }} sidebar={closeMobile => <SpaceSidebar spaces={spaces} spaceId={spaceId} onSpaceChange={changeSpace}
        overviewHref={spaceId ? webUrl(`/spaces/${spaceId}/knowledge`) : undefined}
        settingsHref={spaceId && currentSpace?.myRole === 'OWNER' ? webUrl(`/spaces/${spaceId}/settings`) : undefined}
        sourceHref={`${import.meta.env.BASE_URL}source.html`} onNavigate={navigate}
        onSearch={() => { closeMobile(); setSearchOpened(true); }} split={split} target={target} onTargetChange={setTarget}>
        {spaceId && <NoteTree key={spaceId} api={api} spaceId={spaceId} activeNoteId={target === 'right' && split ? right : left}
          onOpen={id => { open(id); closeMobile(); }}/>}
      </SpaceSidebar>}>
        {error && <Alert color="red" role="alert">{error} <a href={webUrl('/login')}>로그인</a></Alert>}
        <div className="note-gui-panes" data-split={split}>
          <Pane key={`${spaceId}:left`} api={api} paneId="왼쪽" requestedId={left} onLocation={setLeft}
            onDirty={leftDirty} onActivate={() => setTarget('left')}/>
          {split && <Pane key={`${spaceId}:right`} api={api} paneId="오른쪽" requestedId={right} onLocation={setRight}
            onDirty={rightDirty} onActivate={() => setTarget('right')}/>}
        </div>
      </GlobalAppShell>
      {searchOpened && spaceId && access.ready && !access.refreshing && !access.failure && <Modal opened onClose={() => setSearchOpened(false)} title="노트 검색" centered>
        <NotePicker key={spaceId} api={api} spaceId={spaceId} label="노트 제목" selected={null}
          onSelect={note => { if (note) { open(note.id); setSearchOpened(false); } }}/>
      </Modal>}
    </div>
  </>;
}
