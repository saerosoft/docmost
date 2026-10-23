import { createContext, useContext } from 'react';
import type { NoteApi } from '../model';

export const AttachmentContext = createContext<{ api: NoteApi; noteId: string; editable: boolean } | null>(null);
export function useAttachments() {
  const value = useContext(AttachmentContext);
  if (!value) throw new Error('Missing pane attachment context');
  return value;
}
