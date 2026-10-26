import { IconSearch } from '@tabler/icons-react';
import cx from 'clsx';
import { ActionIcon, type BoxProps, type ElementProps, Group, rem, Text, Tooltip, UnstyledButton } from '@mantine/core';
import classes from './search-control.module.css';

interface SearchControlProps extends BoxProps, ElementProps<'button'> {}
export function SearchControl({ className, ...others }: SearchControlProps) {
  return <UnstyledButton {...others} className={cx(classes.root, className)}>
    <Group gap="xs" wrap="nowrap">
      <IconSearch style={{ width: rem(15), height: rem(15) }} stroke={1.5}/>
      <Text fz="sm" c="dimmed" pr={80}>검색</Text>
      <Text fw={700} className={classes.shortcut}>Ctrl + K</Text>
    </Group>
  </UnstyledButton>;
}
export function SearchMobileControl({ onSearch, disabled }: { onSearch: () => void; disabled?: boolean }) {
  return <Tooltip label="검색" withArrow><ActionIcon variant="subtle" color="gray" aria-label="노트 검색"
    disabled={disabled} onClick={onSearch} size="sm"><IconSearch size={20} stroke={2}/></ActionIcon></Tooltip>;
}
