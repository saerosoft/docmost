export interface MountedNoteGui { unmount: () => void }

/** The framework-neutral contract used by browser hosts of the ESM distribution. */
export interface NoteGuiHostModule {
  mountNoteGui: (container: HTMLElement) => MountedNoteGui;
}
