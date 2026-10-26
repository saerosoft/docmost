import { ActionIcon, Anchor, Box, Group, Text, Tooltip } from '@mantine/core';
import { IconBook2, IconLayoutColumns, IconLayoutSidebar, IconMessages } from '@tabler/icons-react';
import type { MouseEventHandler } from 'react';
import SidebarToggle from '@/components/ui/sidebar-toggle-button';
import { SearchControl, SearchMobileControl } from '@/features/search/components/search-control';
import classes from './app-header.module.css';

export interface AppHeaderProps {
  mobileOpened: boolean;
  desktopOpened: boolean;
  toggleMobile: () => void;
  toggleDesktop: () => void;
  homeHref: string;
  askHref?: string;
  onNavigate: MouseEventHandler<HTMLAnchorElement>;
  onSearch: () => void;
  searchDisabled: boolean;
  split: boolean;
  onSplit: () => void;
}

export function AppHeader({ mobileOpened, desktopOpened, toggleMobile, toggleDesktop,
  homeHref, askHref, onNavigate, onSearch, searchDisabled, split, onSplit }: AppHeaderProps) {
  return <Group h="100%" px="md" justify="space-between" wrap="nowrap" gap="sm">
    <Group wrap="nowrap" gap="sm">
      <Tooltip label="페이지 탐색">
        <SidebarToggle aria-label="페이지 탐색" aria-controls="page-navigation" opened={mobileOpened}
          onClick={toggleMobile} hiddenFrom="sm" size="sm"/>
      </Tooltip>
      <Tooltip label="페이지 탐색">
        <SidebarToggle aria-label="페이지 탐색" aria-controls="page-navigation" opened={desktopOpened}
          onClick={toggleDesktop} visibleFrom="sm" size="sm"/>
      </Tooltip>
      <Anchor href={homeHref} c="inherit" underline="never" onClick={onNavigate} aria-label="Knowledge Engine 홈">
        <Box hiddenFrom="sm"><IconBook2 size={22} stroke={1.7}/></Box>
        <Text component="span" size="lg" fw={600} visibleFrom="sm">Knowledge Engine</Text>
      </Anchor>
      <a href={homeHref} className={classes.link + ' desktop-home-link'} onClick={onNavigate}>홈</a>
    </Group>
    <Group visibleFrom="md"><SearchControl aria-label="노트 검색" disabled={searchDisabled} onClick={onSearch}/></Group>
    <Group gap="sm" wrap="nowrap">
      <Group hiddenFrom="md"><SearchMobileControl onSearch={onSearch} disabled={searchDisabled}/></Group>
      {askHref && <Tooltip label="AI 대화"><ActionIcon component="a" href={askHref} onClick={onNavigate}
        aria-label="AI 대화" variant="subtle" color="gray" size="sm"><IconMessages size={20}/></ActionIcon></Tooltip>}
      <Tooltip label={split ? '한 창으로' : '두 창으로'}>
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={onSplit}
          aria-label={split ? '한 창으로' : '두 창으로'} aria-pressed={split}>
          {split ? <IconLayoutSidebar size={20}/> : <IconLayoutColumns size={20}/>}
        </ActionIcon>
      </Tooltip>
    </Group>
  </Group>;
}
