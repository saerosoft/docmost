import { useEffect, useRef, useState } from 'react';
import type { NoteApi, NoteFile, Page } from './model';
import { onAccessLost, onAccessRefresh } from './transport';

interface Props { api: NoteApi; noteId: string; revision: number }
const date = (value: string) => new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

export function NoteAttachments({ api, noteId, revision }: Props) {
  return <AttachmentPage key={`${noteId}:${revision}`} api={api} noteId={noteId}/>;
}

function AttachmentPage({ api, noteId }: Omit<Props, 'revision'>) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [previous, setPrevious] = useState<(string | null)[]>([]);
  const [page, setPage] = useState<Page<NoteFile>>();
  const [error, setError] = useState('');
  const [revoked, setRevoked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const lost = onAccessLost(() => {
      request.current++;
      setPage(undefined); setPrevious([]); setRevoked(true);
      setError('접근 권한이 변경되었습니다. 노트를 다시 열어 주세요.');
    });
    const refresh = onAccessRefresh(() => {
      request.current++;
      setPage(undefined); setError(''); setRevoked(false);
      setCursor(null); setPrevious([]); setAttempt(value => value + 1);
    });
    return () => { request.current++; lost(); refresh(); };
  }, []);
  useEffect(() => {
    if (revoked) return;
    const sequence = ++request.current;
    setPage(undefined); setError('');
    api.files(noteId, cursor).then(value => { if (sequence === request.current) setPage(value); })
      .catch(failure => { if (sequence === request.current) setError((failure as Error).message); });
    return () => { request.current++; };
  }, [api, noteId, cursor, attempt, revoked]);

  function reload() {
    setPage(undefined); setError(''); setCursor(null); setPrevious([]);
    setAttempt(value => value + 1);
  }
  function next() {
    if (!page?.nextCursor) return;
    setPrevious(values => [...values, cursor]); setCursor(page.nextCursor); setPage(undefined);
  }
  function back() {
    if (!previous.length) return;
    setCursor(previous[previous.length - 1]); setPrevious(values => values.slice(0, -1)); setPage(undefined);
  }
  return <section className="context-card note-attachments" aria-label="노트 첨부파일">
    <div className="context-actions"><h2>첨부파일</h2>
      <button type="button" disabled={revoked || (!page && !error)} onClick={reload}>첨부 새로고침</button>
    </div>
    <p className="context-muted">본문에 표시되지 않은 파일과 이전 파일 개정도 포함합니다. 파일 이름을 선택하면 해당 개정을 내려받습니다.</p>
    {error && <div role="alert"><p>{error}</p>{!revoked && <button type="button" onClick={() => setAttempt(value => value + 1)}>첨부 다시 읽기</button>}</div>}
    {!page && !error && <p role="status">첨부파일을 읽는 중…</p>}
    {page && <>
      {!page.items.length && <p>현재 볼 수 있는 첨부파일이 없습니다.</p>}
      {page.items.map(file => <article key={file.id}>
        <a href={`/api/files/${encodeURIComponent(file.id)}`} download={file.fileName}>{file.fileName}</a>
        <p className="context-muted">개정 {file.revision} · {file.mediaType} · {file.byteSize.toLocaleString('ko-KR')} 바이트</p>
        <time dateTime={file.createdAt}>{date(file.createdAt)}</time>
        <details><summary>파일 무결성 정보</summary><p className="context-muted">SHA-256: <code>{file.checksum}</code></p></details>
      </article>)}
    </>}
    <nav className="context-pagination" aria-label="첨부파일 페이지">
      <button type="button" disabled={!page || !previous.length} onClick={back}>이전 첨부</button>
      <span>{previous.length + 1}쪽{page ? ` · ${page.items.length}개` : ''}</span>
      <button type="button" disabled={!page?.nextCursor} onClick={next}>다음 첨부</button>
    </nav>
  </section>;
}
