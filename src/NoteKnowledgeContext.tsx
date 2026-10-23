import type { Note, NoteApi } from './model';
import { NoteProvenance } from './NoteProvenance';
import { webUrl } from './webOrigin';

export function NoteKnowledgeContext({ api, note }: { api: NoteApi; note: Note }) {
  const path = `/spaces/${encodeURIComponent(note.spaceId)}`;
  return <aside className="knowledge-context" aria-label="노트의 현재 정리와 근거">
    <nav className="context-actions" aria-label="이 노트에서 이어서 하기">
      <a href={webUrl(`${path}/knowledge/conflicts?note=${encodeURIComponent(note.id)}`)} target="_blank" rel="noreferrer">갱신 검토·미결</a>
      <a href={webUrl(`${path}/actions/new?note=${encodeURIComponent(note.id)}`)} target="_blank" rel="noreferrer">업무 만들기</a>
    </nav>
    <section className="context-card" aria-label="새 소스 반영 기준">
      <h2>새 소스 반영 기준</h2>
      <ul>
        <li>새 사실은 기존 지식에 누적합니다.</li>
        <li>명확한 변경은 소스의 반영 정책을 따릅니다.</li>
        <li>불확실·상충·사람 편집 변경은 검토합니다.</li>
        <li>뒤늦게 수집한 옛 자료도 이력·근거로 보존합니다.</li>
      </ul>
      <p className="context-muted">수집 순서와 원본 발생·효력 시점을 구분합니다. 실제 적용 규칙은 각 반영 내역에서 확인할 수 있습니다.</p>
    </section>
    <NoteProvenance api={api} note={note}/>
  </aside>;
}
