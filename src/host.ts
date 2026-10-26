import type { NoteApi } from './model';

export interface NoteGuiOptions {
  api?: NoteApi;
  /** Return true when the host handles a confirmed, unmodified product-link navigation. */
  onNavigate?: (href: string) => boolean;
}

export interface MountedNoteGui { unmount: () => void }

/** The framework-neutral contract used by browser hosts of the ESM distribution. */
export interface NoteGuiHostModule {
  mountNoteGui: (container: HTMLElement, options?: NoteGuiOptions) => MountedNoteGui;
}
