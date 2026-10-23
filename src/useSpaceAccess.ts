import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteApi, Space } from './model';
import { clearAccess, onAccessLost, refreshAccess } from './transport';

// A 30-second interval and deadline bound stale display to 60 seconds, excluding browser scheduling; focus/visibility also checks.
const ACCESS_CHECK_INTERVAL = 30_000;
const ACCESS_CHECK_DEADLINE = 30_000;

function withinAccessDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer = 0;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(new Error('접근 권한 확인 시간이 초과되었습니다. 다시 시도해 주세요.')), ACCESS_CHECK_DEADLINE);
  });
  return Promise.race([operation, deadline]).finally(() => window.clearTimeout(timer));
}

export function useSpaceAccess(api: NoteApi) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<Error>();
  const snapshot = useRef<Space[] | undefined>(undefined);
  const active = useRef(false);
  const pending = useRef(false);
  const stopped = useRef(false);
  const request = useRef(0);
  const version = useRef(0);
  const blocked = useRef(false);
  const recheck = useCallback(async () => {
    if (stopped.current || pending.current) return;
    pending.current = true;
    const sequence = ++request.current;
    try {
      const current = await withinAccessDeadline(api.spaces());
      if (!active.current || stopped.current || sequence !== request.current) return;
      const previous = snapshot.current;
      snapshot.current = current;
      const byId = new Map(current.map(space => [space.id, space.accessEpoch]));
      if (previous?.some(space => !byId.has(space.id))) { clearAccess(); return; }
      if (previous?.some(space => byId.get(space.id) !== space.accessEpoch) || blocked.current) {
        const refreshVersion = ++version.current;
        blocked.current = false;
        setFailure(undefined);
        setRefreshing(true);
        await withinAccessDeadline(refreshAccess());
        if (!active.current || stopped.current || version.current !== refreshVersion) return;
        setRefreshing(false);
      }
      setSpaces(current);
      setReady(true);
    } catch (error) {
      if (!active.current || stopped.current || sequence !== request.current) return;
      version.current++;
      blocked.current = true;
      setFailure(error instanceof Error ? error : new Error('접근 권한을 확인하지 못했습니다. 다시 시도해 주세요.'));
      setRefreshing(false);
    } finally {
      if (sequence === request.current) pending.current = false;
    }
  }, [api]);

  useEffect(() => {
    active.current = true;
    const stop = onAccessLost(() => {
      stopped.current = true;
      request.current++;
      version.current++;
      setSpaces([]);
      setReady(true);
      setRefreshing(false);
      setFailure(undefined);
    });
    void recheck();
    const check = () => { void recheck(); };
    const visible = () => { if (document.visibilityState !== 'hidden') check(); };
    const timer = window.setInterval(check, ACCESS_CHECK_INTERVAL);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active.current = false;
      pending.current = false;
      request.current++;
      version.current++;
      stop();
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [recheck]);
  return { spaces, ready, refreshing, failure, recheck };
}
