import { Group, SegmentedControl, Text, UnstyledButton } from '@mantine/core';
import { IconHome, IconSearch, IconSettings } from '@tabler/icons-react';
import type { MouseEventHandler, ReactNode } from 'react';
import { SwitchSpace } from './switch-space';
import classes from './space-sidebar.module.css';
import layout from '@knowledge/docmost/HostLayout.module.css';

interface Props {
  spaces: { id: string; name: string }[];
  spaceId: string | null;
  onSpaceChange: (id: string) => void;
  overviewHref?: string;
  settingsHref?: string;
  sourceHref: string;
  onNavigate: MouseEventHandler<HTMLAnchorElement>;
  onSearch: () => void;
  split: boolean;
  target: string;
  onTargetChange: (target: string) => void;
  children: ReactNode;
}
export function SpaceSidebar({ spaces, spaceId, onSpaceChange, overviewHref, settingsHref,
  sourceHref, onNavigate, onSearch, split, target, onTargetChange, children }: Props) {
  return <div className={classes.navbar}>
    <div className={classes.section} style={{ border: 'none', marginTop: 2, marginBottom: 3 }}>
      <Group gap={4} wrap="nowrap" justify="space-between" style={{ width: '100%' }}>
        <SwitchSpace spaces={spaces} value={spaceId} onChange={onSpaceChange}/>
      </Group>
    </div>
    <div className={classes.section}>
      <div className={classes.menuItems}>
        {overviewHref && <UnstyledButton component="a" href={overviewHref} onClick={onNavigate} className={classes.menu}>
          <div className={classes.menuItemInner}><IconHome size={18} className={classes.menuItemIcon} stroke={2}/><span>개요</span></div>
        </UnstyledButton>}
        <UnstyledButton className={classes.menu} onClick={onSearch} disabled={!spaceId}>
          <div className={classes.menuItemInner}><IconSearch size={18} className={classes.menuItemIcon} stroke={2}/><span>검색</span></div>
        </UnstyledButton>
        {settingsHref && <UnstyledButton component="a" href={settingsHref} onClick={onNavigate} className={classes.menu}>
          <div className={classes.menuItemInner}><IconSettings size={18} className={classes.menuItemIcon} stroke={2}/><span>공간 설정</span></div>
        </UnstyledButton>}
      </div>
    </div>
    {split && <div className={layout.paneTarget}>
      <Text size="xs" c="dimmed" mb={4}>노트를 열 창</Text>
      <SegmentedControl size="xs" fullWidth aria-label="노트를 열 창" value={target}
        onChange={onTargetChange} data={[{ value: 'left', label: '왼쪽 창' }, { value: 'right', label: '오른쪽 창' }]}/>
    </div>}
    <div className={classes.section + ' ' + layout.sectionPages}><div className={layout.pages}>{children}</div></div>
    <Text size="xs" pt="sm"><a href={sourceHref} target="_blank" rel="noreferrer">소스 · AGPL</a></Text>
  </div>;
}
