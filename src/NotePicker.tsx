import { useEffect, useState } from 'react';
import { Button, TextInput } from '@mantine/core';
import type { NoteApi, NoteSummary } from './model';
import { RelationNotePicker } from './RelationNotePicker';

interface Props { api: NoteApi; spaceId: string; label: string; selected: NoteSummary | null; onSelect: (note: NoteSummary | null) => void; exclude?: string[]; disabled?: boolean; relationNoteId?: string; error?: string }

/** Relation targets use their authorized selector; navigation keeps its existing readable-note search. */
export function NotePicker(props: Props) {
  return props.relationNoteId
    ? <RelationNotePicker key={props.spaceId + ':' + props.relationNoteId} api={props.api} noteId={props.relationNoteId} label={props.label} selected={props.selected} onSelect={props.onSelect} disabled={props.disabled} error={props.error}/>
    : <ReadableNotePicker {...props}/>;
}

function ReadableNotePicker({ api, spaceId, label, selected, onSelect, exclude = [], disabled = false }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteSummary[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const text = query.trim();
    setResults(null); setError('');
    if (!text) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      api.findNotes(spaceId, text).then(values => { if (alive) setResults(values); }).catch(e => { if (alive) setError((e as Error).message); });
    }, 250);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [api, spaceId, query]);
  if (selected) {
    return <div className="note-picker">
      <span>{label}: <strong>{selected.title}</strong></span>
      <Button size="xs" variant="subtle" disabled={disabled} onClick={() => onSelect(null)}>다시 선택</Button>
    </div>;
  }
  const candidates = results?.filter(value => !exclude.includes(value.id)) ?? [];
  return <div className="note-picker">
    <TextInput label={label} placeholder="노트 제목으로 찾기" value={query} disabled={disabled} maxLength={200} onChange={event => setQuery(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}/>
    {error && <p role="alert">{error}</p>}
    {results && !candidates.length && <p>찾은 노트가 없습니다.</p>}
    {candidates.length > 0 && <ul aria-label={`${label} 검색 결과`}>
      {candidates.map(value => <li key={value.id}><Button size="xs" variant="subtle" disabled={disabled} onClick={() => { onSelect(value); setQuery(''); }}>{value.title}</Button></li>)}
    </ul>}
  </div>;
}
