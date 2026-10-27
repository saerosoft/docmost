import { useEffect, useState } from 'react';
import type { NoteAccumulationChange as Change, NoteApi } from './model';

export function NoteAccumulationChange({ api, id }: { api: NoteApi; id: string }) {
  const [value, setValue] = useState<Change>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setValue(undefined); setError('');
    api.accumulationChange(id).then(result => { if (alive) setValue(result); })
      .catch(failure => { if (alive) setError((failure as Error).message); });
    return () => { alive = false; };
  }, [api, id, attempt]);
  if (error) return <div role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>변경 내역 다시 읽기</button></div>;
  if (!value) return <p role="status">변경 내역을 읽는 중…</p>;
  return <section className="accumulation-comparison" aria-label="변경 전후와 반영 기준">
    <h4>변경 전</h4>
    {value.before ? <><p>개정 {value.before.revision} · {value.before.title}</p><pre>{value.before.body}</pre></> : <p>노트 생성 전입니다.</p>}
    <h4>반영한 제안 내용</h4><pre>{value.operationBody}</pre>
    <h4>변경 후</h4>
    {value.after ? <><p>개정 {value.after.revision} · {value.after.title}</p><pre>{value.after.body}</pre></> : <p>현재 열람할 수 있는 개정이 없습니다.</p>}
    <h4>이 변경에 적용한 기준</h4>
    <ul>
      <li>{value.preserveHumanFields ? '사람 편집 보존' : '사람 편집 변경 제안 포함'}</li>
      <li>{value.requireEvidence ? '근거 필수' : '근거 필수 조건 없음'}</li>
      <li>{value.excludePrivateExamples ? '개인 예시 제외' : '현재 권한에서 허용된 예시 사용'}</li>
    </ul>
    <p>반영 정책: {value.reviewPolicy === 'REVIEW' ? '검토 후 반영' : value.reviewPolicy === 'SAFE_AUTO_KNOWLEDGE' ? '안전한 지식 변경만 자동 반영' : value.reviewPolicy}</p>
    <p>허용 문서: {value.allowedDocumentTypes.join(', ') || '별도 형식 제한 없음'}</p>
  </section>;
}
