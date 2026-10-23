import type { JSONContent } from '@tiptap/core';

export type Visibility = 'SPACE' | 'PRIVATE';
export interface Note {
  id: string; spaceId: string; title: string; revision: number; bodyJson: JSONContent;
  visibility: Visibility; canEdit: boolean; parentId: string | null;
}
export interface TreeNote { id: string; title: string; parentId: string | null; hasChildren: boolean; revision: number }
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface Space { id: string; name: string; accessEpoch: number }
export interface NoteSummary { id: string; title: string }
export interface Revision { id: string; revision: number; title: string; createdAt: string; bodyJson: JSONContent }
export interface Comment { id: string; body: string; createdAt: string; authorName: string }
export type PropertyValue = { id?: string; key: string; valueType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE'; value: string };
export type RelationPredicate = 'DERIVED_FROM' | 'SUPPORTS' | 'SUPERSEDES' | 'RELATED_TO';
export type RelationKind = 'RECORDED' | 'INFERRED' | 'UNCERTAIN';
export type RelationReviewState = 'PROPOSED' | 'ACCEPTED' | 'REJECTED';
export interface Relation {
  id: string; targetNoteId: string; title: string; predicate: RelationPredicate; legacyPredicate: string | null; kind: RelationKind;
  reviewState: RelationReviewState; revision: number; validFrom: string | null; validTo: string | null; evidenceCount: number; provenance: string;
  actorLabel: string | null; direction: 'OUTGOING' | 'INCOMING';
}
export interface RelationEvidence {
  id: string; sourceRevisionId: string; sourceRevision: number; spaceId: string; sourceTitle: string;
  locator: string; excerpt: string; excerptTruncated: boolean;
}
export interface RelationValidity { validFrom: string | null; validTo: string | null }
/** Records a note came from or leads to; every entry is one the server returned to this account. */
export interface Provenance {
  sources: { revisionId: string; spaceId: string; title: string }[];
  rules: { rulesetId: string; versionId: string; spaceId: string; label: string }[];
  reviews: { id: string; spaceId: string; title: string; kind: 'proposal' | 'changeSet'; status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null }[];
  actions: { id: string; spaceId: string; title: string }[];
}
export interface AttachmentRevision { attachmentId: string; revision: number; name: string; mimeType: string }
export interface SaveNote { title: string; bodyJson: JSONContent; expectedRevision: number; idempotencyKey: string }
export interface CreateNote { spaceId: string; title: string; parentId: string | null; visibility: Visibility; idempotencyKey: string }
export interface AddComment { body: string; idempotencyKey: string }
export interface NoteApi {
  spaces(): Promise<Space[]>;
  tree(spaceId: string, parentId: string | null, cursor: string | null): Promise<Page<TreeNote>>;
  ancestors(id: string): Promise<NoteSummary[]>;
  note(id: string): Promise<Note>;
  findNotes(spaceId: string, query: string): Promise<NoteSummary[]>;
  provenance(note: Note): Promise<Provenance>;
  create(input: CreateNote): Promise<Note>;
  save(id: string, input: SaveNote): Promise<Note>;
  move(ids: string[], parentId: string | null, spaceId: string): Promise<void>;
  history(id: string, cursor: string | null): Promise<Page<Revision>>;
  restore(id: string, revision: number, expectedRevision: number): Promise<Note>;
  comments(id: string, cursor: string | null): Promise<Page<Comment>>;
  comment(id: string, input: AddComment): Promise<void>;
  properties(id: string): Promise<PropertyValue[]>;
  setProperties(id: string, values: PropertyValue[], expectedRevision: number): Promise<void>;
  deleteProperty(noteId: string, propertyId: string, expectedRevision: number): Promise<void>;
  relations(id: string, cursor: string | null): Promise<Page<Relation>>;
  relationEvidence(id: string, cursor: string | null): Promise<Page<RelationEvidence>>;
  relate(id: string, targetNoteId: string, predicate: RelationPredicate, validity: RelationValidity): Promise<void>;
  decideRelation(id: string, expectedRevision: number, decision: Exclude<RelationReviewState, 'PROPOSED'>, reason: string): Promise<void>;
  upload(id: string, file: File, previous?: AttachmentRevision): Promise<AttachmentRevision>;
  attachment(id: string, revision: number): Promise<Blob>;
}
