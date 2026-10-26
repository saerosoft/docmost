import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { I18nextProvider } from 'react-i18next';
import { docmostI18n } from './docmost/i18n';
import '@mantine/core/styles.css';
import '@excalidraw/excalidraw/index.css';
import './vendor/docmost/client/styles/a11y-overrides.css';
import { theme, mantineCssResolver } from './vendor/docmost/client/theme';
import './integration.css';
import { App } from './App';
import type { MountedNoteGui, NoteGuiOptions } from './host';
export type { MountedNoteGui, NoteGuiHostModule, NoteGuiOptions } from './host';

export type { NoteApi } from './model';

/** The extracted Docmost workspace, including its original theme and editor styles. */
function NoteGui(options: NoteGuiOptions) {
  return <I18nextProvider i18n={docmostI18n}><MantineProvider theme={theme} cssVariablesResolver={mantineCssResolver} defaultColorScheme="light">
    <App {...options}/>
  </MantineProvider></I18nextProvider>;
}

/** Mounts an isolated React root; the host must import the distributed CSS as well. */
export function mountNoteGui(container: HTMLElement, options: NoteGuiOptions = {}): MountedNoteGui {
  const root = createRoot(container);
  root.render(<NoteGui {...options}/>);
  return { unmount: () => root.unmount() };
}
