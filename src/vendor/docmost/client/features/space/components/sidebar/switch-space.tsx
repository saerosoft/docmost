import { Avatar, Button, Group, Popover, Select, Text } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react';
import classes from './switch-space.module.css';

interface Props {
  spaces: { id: string; name: string }[];
  value: string | null;
  onChange: (value: string) => void;
}
export function SwitchSpace({ spaces, value, onChange }: Props) {
  const [opened, setOpened] = useState(false);
  const name = spaces.find(space => space.id === value)?.name ?? '공간 선택';
  return <Popover width={280} position="bottom" withArrow shadow="md" opened={opened}
    onChange={setOpened} trapFocus returnFocus withinPortal={false}>
    <Popover.Target>
      <Button variant="subtle" fullWidth justify="space-between" color="gray"
        aria-label="공간 선택" aria-expanded={opened}
        rightSection={opened ? <IconChevronUp size={18}/> : <IconChevronDown size={18}/>}
        onClick={() => setOpened(value => !value)}>
        <Group gap="xs" wrap="nowrap">
          <Avatar name={name} color="initials" variant="filled" size={20}/>
          <Text className={classes.spaceName} size="sm" fw={500} lineClamp={1}>{name}</Text>
        </Group>
      </Button>
    </Popover.Target>
    <Popover.Dropdown>
      <Select label="공간" searchable nothingFoundMessage="접근 가능한 공간이 없습니다."
        data={spaces.map(space => ({ value: space.id, label: space.name }))} value={value}
        comboboxProps={{ withinPortal: false }} onChange={id => { if (id) { onChange(id); setOpened(false); } }}/>
    </Popover.Dropdown>
  </Popover>;
}
