import { useState, type ReactNode } from 'react';
import { createStore, Provider } from 'jotai';
import { MantineProvider, Menu, Modal, Popover, Tooltip } from '@mantine/core';
import { I18nextProvider } from 'react-i18next';
import { docmostI18n } from './i18n';

export function DocmostPaneProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createStore);
  return <Provider store={store}><I18nextProvider i18n={docmostI18n}>
    <MantineProvider theme={{ components: {
      Menu: Menu.extend({ defaultProps: { withinPortal: false } }),
      Modal: Modal.extend({ defaultProps: { withinPortal: false } }),
      Popover: Popover.extend({ defaultProps: { withinPortal: false } }),
      Tooltip: Tooltip.extend({ defaultProps: { withinPortal: false } }),
    } }}>{children}</MantineProvider>
  </I18nextProvider></Provider>;
}
