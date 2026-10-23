import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Group, Select } from '@mantine/core';
import { api } from './api';
import { NoteTree } from './NoteTree';
import { Pane } from './Pane';
import { onAccessLost } from './transport';
import { webUrl } from './webOrigin';
import { useSpaceAccess } from './useSpaceAccess';

export function App() {
  const params = new URLSearchParams(window.location.search);
  const access = useSpaceAccess(api);
  const { spaces } = access;
  const [spaceId, setSpaceId] = useState<string | null>(params.get('space'));
  const [left, setLeft] = useState<string | null>(params.get('note'));
  const [right, setRight] = useState<string | null>(params.get('right'));
  const [split, setSplit] = useState(params.has('right'));
  const [target, setTarget] = useState('left');
  const [error, setError] = useState('');
  const dirty = useRef({ left: false, right: false });
  const accessLost = useRef(false);
  const leftDirty = useCallback((value: boolean) => { dirty.current.left = value; }, []);
  const rightDirty = useCallback((value: boolean) => { dirty.current.right = value; }, []);
  useEffect(() => {
    if (access.ready && !accessLost.current) setSpaceId(current => spaces.some(value => value.id === current) ? current : spaces[0]?.id || null);
  }, [spaces, access.ready]);
  useEffect(() => onAccessLost(() => { accessLost.current = true; setSpaceId(null); setLeft(null); setRight(null); dirty.current = { left: false, right: false }; setError(`로그인 또는 공간 접근 권한을 확인해 주세요. 로그인 세션은 같은 호스트 이름(${window.location.hostname})의 메인 화면에서 로그인해야 이 화면에 전달됩니다. 로그인한 뒤 이 페이지를 새로고침하면 요청한 공간과 노트를 다시 엽니다.`); }), []);
  useEffect(() => {
    // After access is lost the requested space and note stay in the address so a reload after signing in reopens them.
    if (accessLost.current) return;
    const query = new URLSearchParams();
    if (spaceId) query.set('space', spaceId); if (left) query.set('note', left); if (right && split) query.set('right', right);
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
  }, [spaceId, left, right, split]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (dirty.current.left || dirty.current.right) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave);
  }, []);
  return <>
    {access.failure && <div className="error" role="alert">{access.failure.message} <Button onClick={() => void access.recheck()}>접근 권한 다시 확인</Button></div>}
    {(!access.ready || access.refreshing) && <p role="status">접근 권한 확인 중…</p>}
    <div hidden={!access.ready || access.refreshing || !!access.failure}><div className="app">
    <header className="app-header"><a className="brand" href={webUrl('/')} onClick={event => { if ((dirty.current.left || dirty.current.right) && !window.confirm('저장하지 않은 변경이 있습니다. 메인 화면으로 이동할까요?')) event.preventDefault(); }}>Knowledge Engine <span>Notes</span></a><Group>
      <Select aria-label="공간" placeholder="접근 가능한 공간 없음" data={spaces.map(value => ({ value: value.id, label: value.name }))} value={spaceId} onChange={value => { if (value && value !== spaceId && (!(dirty.current.left || dirty.current.right) || window.confirm('공간을 바꾸고 저장하지 않은 변경을 버릴까요?'))) { setSpaceId(value); setLeft(null); setRight(null); } }}/>
      <Button variant="light" onClick={() => { if (split && dirty.current.right && !window.confirm('오른쪽 창의 저장하지 않은 변경을 버릴까요?')) return; setSplit(value => !value); setTarget('left'); }}>{split ? '한 창으로' : '두 창으로'}</Button>
      <a href="/source.html" target="_blank" rel="noreferrer">소스 · AGPL</a>
    </Group></header>
    {error && <div className="error" role="alert">{error} <a href={webUrl('/login')}>로그인</a></div>}
    <div className="workspace">
      <aside className="sidebar">{split && <Select label="노트를 열 창" data={[{ value: 'left', label: '왼쪽 창' }, { value: 'right', label: '오른쪽 창' }]} value={target} onChange={value => value && setTarget(value)}/>}{spaceId && <NoteTree key={spaceId} api={api} spaceId={spaceId} activeNoteId={target === 'right' && split ? right : left} onOpen={id => target === 'right' && split ? setRight(id) : setLeft(id)}/>}</aside>
      <main className={`panes ${split ? 'split' : ''}`}><Pane key={`${spaceId}:left`} api={api} paneId="왼쪽" requestedId={left} onLocation={setLeft} onDirty={leftDirty} onActivate={() => setTarget('left')}/>{split && <Pane key={`${spaceId}:right`} api={api} paneId="오른쪽" requestedId={right} onLocation={setRight} onDirty={rightDirty} onActivate={() => setTarget('right')}/>}</main>
    </div>
    </div></div>
  </>;
}
