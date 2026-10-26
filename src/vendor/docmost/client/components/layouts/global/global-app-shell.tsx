import { AppShell } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppHeader, type AppHeaderProps } from './app-header';
import classes from './app-shell.module.css';
import { SkipToMain } from '@/components/ui/skip-to-main';
import layout from '@knowledge/docmost/HostLayout.module.css';

interface Props {
  children: ReactNode;
  header: Omit<AppHeaderProps, 'mobileOpened' | 'desktopOpened' | 'toggleMobile' | 'toggleDesktop'>;
  sidebar: (closeMobile: () => void) => ReactNode;
}

/** Docmost's core AppShell, with explicit slots instead of upstream routes and global account state. */
export default function GlobalAppShell({ children, header, sidebar }: Props) {
  const [mobileOpened, setMobileOpened] = useState(false);
  const [desktopOpened, setDesktopOpened] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((event: MouseEvent) => {
    if (!isResizing || !sidebarRef.current) return;
    setSidebarWidth(Math.min(600, Math.max(220, event.clientX - sidebarRef.current.getBoundingClientRect().left)));
  }, [isResizing]);
  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return <>
    <SkipToMain/>
    <AppShell header={{ height: 45 }} navbar={{
      width: sidebarWidth, breakpoint: 'sm',
      collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
    }} padding={0}>
      <AppShell.Header px="md" className={classes.header + " " + layout.header}>
        <AppHeader {...header} mobileOpened={mobileOpened} desktopOpened={desktopOpened}
          toggleMobile={() => setMobileOpened(value => !value)}
          toggleDesktop={() => setDesktopOpened(value => !value)}/>
      </AppShell.Header>
      {mobileOpened && <button type="button" className={layout.mobileBackdrop}
        aria-label="페이지 탐색 닫기" onClick={() => setMobileOpened(false)}/>}
      <AppShell.Navbar id="page-navigation" className={classes.navbar + " " + layout.navbar} withBorder={false}
        ref={sidebarRef} aria-label="공간 탐색" onKeyDown={event => {
          if (event.key === 'Escape') setMobileOpened(false);
        }}>
        <div className={classes.resizeHandle + " " + layout.resizeHandle} role="separator" aria-label="탐색 영역 너비"
          aria-orientation="vertical" aria-valuemin={220} aria-valuemax={600}
          aria-valuenow={sidebarWidth} tabIndex={0}
          onMouseDown={event => { event.preventDefault(); setIsResizing(true); }}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            setSidebarWidth(value => Math.min(600, Math.max(220, value + (event.key === 'ArrowRight' ? 20 : -20))));
          }}/>
        {sidebar(() => setMobileOpened(false))}
      </AppShell.Navbar>
      <AppShell.Main id="main-content" tabIndex={-1} className={layout.main}>{children}</AppShell.Main>
    </AppShell>
  </>;
}
