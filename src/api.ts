import { graphql, request, ApiError } from './transport';
import type { JSONContent } from '@tiptap/core';
import type { AttachmentRevision, Comment, CurrentKnowledgePage, KnowledgeBodyOrigin, Note, NoteAccumulation, NoteAccumulationChange, NoteApi, NoteFile, Page, PropertyValue, Provenance, Relation, RelationEvidence, RelationKind, RelationPredicate, RelationReviewState, Revision, Space, TreeNote, Visibility } from './model';

interface WireRelation {
  id: string; fromNoteId: string; toNoteId: string; predicate: RelationPredicate; legacyPredicate: string | null; kind: RelationKind;
  reviewState: RelationReviewState; revision: number; validFrom: string | null; validTo: string | null; evidenceIds: string[]; provenance: string; actorLabel: string | null;
}
interface WireNote { id: string; spaceId: string; ownerId: string; title: string; revision: number; richBody: string | null; authoredBody: string | null; bodyOrigin: KnowledgeBodyOrigin; body: string; visibility: Visibility; parentId: string | null; canEdit: boolean }
interface WireProvenance {
  knowledgeAccumulations: { changeSetId: string; spaceId: string; title: string; evidence: { revisionId: string; spaceId: string; title: string }[]; rules: { rulesetId: string; versionId: string; name: string; versionNumber: number }[] }[];
  reviewProposals: { id: string; spaceId: string; reason: string; status: Provenance['reviews'][number]['status'] }[];
  noteActions: { id: string; spaceId: string; title: string }[];
}
interface WireProperty { id: string; name: string; valueType: PropertyValue['valueType']; textValue: string | null; numberValue: string | null; dateValue: string | null; booleanValue: boolean | null }
const fields = 'id spaceId ownerId title revision richBody body authoredBody bodyOrigin visibility parentId canEdit';
const key = () => crypto.randomUUID();
export function parseBody(value: string | null, plain: string): JSONContent {
  if (!value) return { type: 'doc', content: plain.split('\n').map(text => ({ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) })) };
  const parsed: JSONContent = JSON.parse(value);
  if (parsed.type !== 'doc') throw new ApiError('지원하지 않는 문서 형식입니다. 원문을 변경하지 않았습니다.', 'SCHEMA');
  return parsed;
}
async function mapNote(value: WireNote): Promise<Note> {
  return { id: value.id, spaceId: value.spaceId, title: value.title, revision: value.revision, bodyJson: parseBody(value.richBody, value.authoredBody ?? value.body), bodyOrigin: value.bodyOrigin, visibility: value.visibility, parentId: value.parentId, canEdit: value.canEdit };
}
function page<T>(items: T[], cursor: (value: T) => string, size: number): Page<T> { return { items, nextCursor: items.length === size ? cursor(items[items.length - 1]) : null }; }
export const api: NoteApi = {
  async spaces() { return (await graphql<{ spaces: Space[] }>('query { spaces { id name accessEpoch myRole } }')).spaces; },
  async tree(spaceId, parentId, cursor) {
    const values = (await graphql<{ noteTree: { id: string; title: string; parentId: string | null; revision: number }[] }>('query($spaceId:UUID!,$parentId:UUID,$after:UUID){noteTree(spaceId:$spaceId,parentId:$parentId,after:$after,limit:50){id title parentId revision}}', { spaceId, parentId, after: cursor })).noteTree;
    return page<TreeNote>(values.map(value => ({ ...value, hasChildren: true })), value => value.id, 50);
  },
  async ancestors(id) {
    return (await graphql<{ noteAncestors: { id: string; title: string }[] }>('query($id:UUID!){noteAncestors(id:$id){id title}}', { id })).noteAncestors;
  },
  async note(id) {
    const result = (await graphql<{ knowledgeNote: WireNote | null }>(`query($id:UUID!){knowledgeNote(id:$id){${fields}}}`, { id })).knowledgeNote;
    if (!result) throw new ApiError('노트를 찾을 수 없거나 열람 권한이 없습니다.', 'NOT_FOUND');
    return mapNote(result);
  },
  async findNotes(spaceId, query) {
    return (await graphql<{ knowledgeNotes: { id: string; title: string }[] }>('query($spaceId:UUID!,$query:String){knowledgeNotes(spaceId:$spaceId,query:$query,offset:0,limit:20){id title}}', { spaceId, query })).knowledgeNotes;
  },
  async provenance(note) {
    const value = await graphql<WireProvenance>(
      'query($spaceId:UUID!,$noteId:UUID!){knowledgeAccumulations(noteId:$noteId,offset:0,limit:20){changeSetId spaceId title evidence{revisionId spaceId title} rules{rulesetId versionId name versionNumber}} reviewProposals(spaceId:$spaceId,noteId:$noteId,offset:0,limit:20){id spaceId reason status} noteActions(noteId:$noteId,offset:0,limit:20){id spaceId title}}',
      { spaceId: note.spaceId, noteId: note.id },
    );
    const unique = <T,>(items: T[], key: (item: T) => string) => [...new Map(items.map(item => [key(item), item])).values()];
    const items = value.knowledgeAccumulations;
    return {
      sources: unique(items.flatMap(item => item.evidence), item => item.revisionId),
      rules: unique(items.flatMap(item => item.rules.map(rule => ({ rulesetId: rule.rulesetId, versionId: rule.versionId, spaceId: item.spaceId, label: `${rule.name} v${rule.versionNumber}` }))), item => item.versionId),
      reviews: [
        ...value.reviewProposals.map(item => ({ id: item.id, spaceId: item.spaceId, title: item.reason, kind: 'proposal' as const, status: item.status })),
        ...unique(items, item => item.changeSetId).map(item => ({ id: item.changeSetId, spaceId: item.spaceId, title: item.title, kind: 'changeSet' as const, status: null })),
      ],
      actions: value.noteActions,
    };
  },
  async create({ spaceId, title, parentId, visibility, idempotencyKey }) {
    if (parentId) throw new ApiError('새 노트는 루트에 만든 뒤 선택 이동해 주세요.', 'UNSUPPORTED_PARENT_CREATE');
    return mapNote((await graphql<{ createKnowledgeNote: WireNote }>(`mutation($input:CreateNoteInput!){createKnowledgeNote(input:$input){${fields}}}`, { input: { spaceId, title, body: '', visibility, idempotencyKey } })).createKnowledgeNote);
  },
  async accumulations(noteId, cursor) {
    const offset = Number(cursor || 0);
    const values = (await graphql<{ knowledgeAccumulations: NoteAccumulation[] }>(
      'query($noteId:UUID!,$offset:Int!){knowledgeAccumulations(noteId:$noteId,offset:$offset,limit:20){id spaceId changeSetId kind title preview appliedAt actorName automatic reviewerName resultRevision evidenceCount evidence{id revisionId spaceId title locator quote quoteTruncated occurredAt effectiveAt visibility} rules{rulesetId versionId name versionNumber}}}',
      { noteId, offset },
    )).knowledgeAccumulations;
    return { items: values, nextCursor: values.length === 20 ? String(offset + 20) : null };
  },
  async accumulationChange(id) {
    return (await graphql<{ knowledgeAccumulationChange: NoteAccumulationChange }>(
      'query($id:UUID!){knowledgeAccumulationChange(id:$id){operationBody before{revision title body} after{revision title body} preserveHumanFields requireEvidence excludePrivateExamples reviewPolicy allowedDocumentTypes}}',
      { id },
    )).knowledgeAccumulationChange;
  },
  async currentKnowledge(noteId, cursor) {
    const offset = Number(cursor || 0);
    const value = (await graphql<{ knowledgeCurrentItems: Omit<CurrentKnowledgePage, 'nextCursor'> & { hasNext: boolean } }>(
      'query($noteId:UUID!,$offset:Int!){knowledgeCurrentItems(noteId:$noteId,offset:$offset,limit:20){noteId revision bodyOrigin hasNext items{id claimKind body resultRevision appliedAt evidenceCount evidence{id revisionId spaceId title locator quote quoteTruncated occurredAt effectiveAt visibility} rules{rulesetId versionId name versionNumber}}}}',
      { noteId, offset },
    )).knowledgeCurrentItems;
    return { noteId: value.noteId, revision: value.revision, bodyOrigin: value.bodyOrigin, items: value.items, nextCursor: value.hasNext ? String(offset + 20) : null };
  },
  async save(id, input) {
    return mapNote((await graphql<{ saveRichNote: WireNote }>(`mutation($id:UUID!,$input:SaveRichNoteInput!){saveRichNote(id:$id,input:$input){${fields}}}`, { id, input: { expectedRevision: input.expectedRevision, title: input.title, richBody: JSON.stringify(input.bodyJson), schemaVersion: 1, idempotencyKey: input.idempotencyKey } })).saveRichNote);
  },
  async move(noteIds, parentId, spaceId) {
    const notes = await Promise.all(noteIds.map(id => api.note(id)));
    const result = await graphql<{ moveNotes: boolean | null }>('mutation($input:MoveNotesInput!){moveNotes(input:$input)}', { input: { spaceId, parentId, items: notes.map(note => ({ id: note.id, expectedRevision: note.revision })) } });
    if (result.moveNotes !== true) throw new ApiError('노트 이동을 확인하지 못했습니다.', 'MOVE_NOT_ACKNOWLEDGED');
    window.dispatchEvent(new Event('note-moved'));
    window.dispatchEvent(new Event('note-changed'));
  },
  async history(noteId, cursor) {
    const offset = Number(cursor || 0);
    const values = (await graphql<{ noteRevisions: { id: string; revision: number; title: string; createdAt: string; richBody: string | null; authoredBody: string | null; bodyOrigin: KnowledgeBodyOrigin; body: string }[] }>('query($noteId:UUID!,$offset:Int!){noteRevisions(noteId:$noteId,offset:$offset,limit:20){id revision title createdAt richBody body authoredBody bodyOrigin}}', { noteId, offset })).noteRevisions;
    return { items: values.map(value => ({ ...value, bodyJson: parseBody(value.richBody, value.authoredBody ?? value.body) })), nextCursor: values.length === 20 ? String(offset + 20) : null } as Page<Revision>;
  },
  async restore(id, revision, expectedRevision) { return mapNote((await graphql<{ restoreNote: WireNote }>(`mutation($id:UUID!,$input:RestoreNoteInput!){restoreNote(id:$id,input:$input){${fields}}}`, { id, input: { sourceRevision: revision, expectedRevision, idempotencyKey: key() } })).restoreNote); },
  async comments(noteId, cursor) {
    const offset = Number(cursor || 0);
    const values = (await graphql<{ noteComments: { id: string; body: string; createdAt: string; authorName: string | null }[] }>('query($noteId:UUID!,$offset:Int!){noteComments(noteId:$noteId,offset:$offset,limit:20){id body createdAt authorName}}', { noteId, offset })).noteComments;
    return { items: values.map(value => ({ ...value, authorName: value.authorName ?? '알 수 없는 사용자' })), nextCursor: values.length === 20 ? String(offset + 20) : null } as Page<Comment>;
  },
  async comment(noteId, input) { await graphql('mutation($noteId:UUID!,$input:AddCommentInput!){addNoteComment(noteId:$noteId,input:$input){id}}', { noteId, input }); },
  async properties(noteId) {
    return (await graphql<{ noteProperties: WireProperty[] }>('query($noteId:UUID!){noteProperties(noteId:$noteId){id name valueType textValue numberValue dateValue booleanValue}}', { noteId })).noteProperties.map(value => ({ id: value.id, key: value.name, valueType: value.valueType, value: String(value.textValue ?? value.numberValue ?? value.dateValue ?? value.booleanValue ?? '') }));
  },
  async setProperties(noteId, values, expectedRevision) {
    if (values.length !== 1) throw new ApiError('한 번에 속성 하나를 저장해 주세요.', 'PROPERTY_COUNT');
    const value = values[0];
    if (value.valueType === 'BOOLEAN' && !['true', 'false'].includes(value.value)) throw new ApiError('논리 값은 true 또는 false여야 합니다.', 'PROPERTY_VALUE');
    const field = { TEXT: 'textValue', NUMBER: 'numberValue', DATE: 'dateValue', BOOLEAN: 'booleanValue' }[value.valueType];
    await graphql('mutation($noteId:UUID!,$expectedRevision:Int!,$input:NotePropertyInput!){setNoteProperty(noteId:$noteId,expectedRevision:$expectedRevision,input:$input){id}}', { noteId, expectedRevision, input: { name: value.key, valueType: value.valueType, [field]: value.valueType === 'BOOLEAN' ? value.value === 'true' : value.value } });
  },
  async deleteProperty(noteId, propertyId, expectedRevision) {
    const result = await graphql<{ deleteNoteProperty: boolean | null }>('mutation($id:UUID!,$input:DeleteNotePropertyInput!){deleteNoteProperty(id:$id,input:$input)}', { id: propertyId, input: { noteId, expectedRevision } });
    if (result.deleteNoteProperty !== true) throw new ApiError('속성 삭제를 확인하지 못했습니다.', 'DELETE_NOT_ACKNOWLEDGED');
  },
  async relations(noteId, cursor) {
    const values = (await graphql<{ noteRelations: WireRelation[] }>('query($noteId:UUID!,$after:UUID){noteRelations(noteId:$noteId,after:$after,limit:20){id fromNoteId toNoteId predicate legacyPredicate kind reviewState revision validFrom validTo evidenceIds provenance actorLabel}}', { noteId, after: cursor })).noteRelations;
    const items: Relation[] = [];
    for (const value of values) {
      const targetNoteId = value.toNoteId === noteId ? value.fromNoteId : value.toNoteId;
      const target = await api.note(targetNoteId);
      items.push({
        id: value.id, targetNoteId, title: target.title, predicate: value.predicate, legacyPredicate: value.legacyPredicate, kind: value.kind,
        reviewState: value.reviewState, revision: value.revision, validFrom: value.validFrom, validTo: value.validTo, evidenceCount: value.evidenceIds.length,
        provenance: value.provenance, actorLabel: value.actorLabel, direction: value.fromNoteId === noteId ? 'OUTGOING' : 'INCOMING',
      });
    }
    return { items, nextCursor: values.length === 20 ? values.at(-1)!.id : null };
  },
  async relationEvidence(relationId, cursor) {
    const values = (await graphql<{ noteRelationEvidence: RelationEvidence[] }>('query($relationId:UUID!,$after:UUID){noteRelationEvidence(relationId:$relationId,after:$after,limit:20){id sourceRevisionId sourceRevision spaceId sourceTitle locator excerpt excerptTruncated}}', { relationId, after: cursor })).noteRelationEvidence;
    return page(values, value => value.id, 20);
  },
  async relate(noteId, targetNoteId, predicate, validity) {
    const note = await api.note(noteId);
    await graphql('mutation($noteId:UUID!,$expectedRevision:Int!,$input:NoteRelationInput!){addNoteRelation(noteId:$noteId,expectedRevision:$expectedRevision,input:$input){id}}', { noteId, expectedRevision: note.revision, input: { toNoteId: targetNoteId, predicate, provenance: 'Human-authored note relation', evidenceIds: [], ...validity } });
  },
  async decideRelation(id, expectedRevision, decision, reason) {
    await graphql('mutation($id:UUID!,$input:DecideNoteRelationInput!){decideNoteRelation(id:$id,input:$input){id}}', { id, input: { expectedRevision, decision, reason } });
  },
  async files(noteId, cursor) {
    const items = (await graphql<{ noteFiles: NoteFile[] }>(
      'query($noteId:UUID!,$after:UUID){noteFiles(noteId:$noteId,after:$after,limit:50){id fileName mediaType byteSize checksum revision previousId createdAt}}',
      { noteId, after: cursor },
    )).noteFiles;
    return page(items, file => file.id, 50);
  },
  async upload(noteId, file, previous) {
    const note = await api.note(noteId);
    const data = new FormData(); data.set('file', file); data.set('noteId', noteId); data.set('spaceId', note.spaceId); data.set('visibility', note.visibility);
    if (previous) data.set('previousId', previous.attachmentId);
    const value: { id: string; revision: number; fileName: string } = await (await request('/api/files', { method: 'POST', body: data })).json();
    return { attachmentId: value.id, revision: value.revision, name: value.fileName, mimeType: file.type } as AttachmentRevision;
  },
  async attachment(id) { return (await request(`/api/files/${encodeURIComponent(id)}`)).blob(); },
};
