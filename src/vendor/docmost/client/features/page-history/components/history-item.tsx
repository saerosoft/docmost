import {
  Text,
  UnstyledButton,
  ActionIcon,
  Checkbox,
  Menu,
} from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import classes from "./css/history.module.css";
import clsx from "clsx";
import type { Revision } from "@knowledge/model";
import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface HistoryItemProps {
  historyItem: Revision;
  index: number;
  onSelect: (id: string, index: number) => void;
  onHover?: (id: string, index: number) => void;
  onHoverEnd?: () => void;
  isActive: boolean;
  compareMode: boolean;
  isChecked: boolean;
  isCheckboxDisabled: boolean;
  canCompare: boolean;
  onToggleCompare: (id: string) => void;
  onStartCompare: (id: string) => void;
  onRestore?: (id: string, index: number) => void;
}

const HistoryItem = memo(function HistoryItem({
  historyItem,
  index,
  onSelect,
  onHover,
  onHoverEnd,
  isActive,
  compareMode,
  isChecked,
  isCheckboxDisabled,
  canCompare,
  onToggleCompare,
  onStartCompare,
  onRestore,
}: HistoryItemProps) {
  const { t } = useTranslation();
  const date = new Date(historyItem.createdAt).toLocaleString("ko-KR");

  const handleClick = useCallback(() => {
    if (compareMode) {
      onToggleCompare(historyItem.id);
    } else {
      onSelect(historyItem.id, index);
    }
  }, [compareMode, onToggleCompare, onSelect, historyItem.id, index]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(historyItem.id, index);
  }, [onHover, historyItem.id, index]);

  return (
    <div
      className={clsx(classes.history, { [classes.active]: isActive })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
    >
      {compareMode && (
        <Checkbox
          size="xs"
          className={classes.compareCheckbox}
          checked={isChecked}
          disabled={isCheckboxDisabled}
          onChange={() => onToggleCompare(historyItem.id)}
          aria-label={t("Select version from {{date}}", { date })}
        />
      )}

      <UnstyledButton
        p="xs"
        onClick={handleClick}
        className={classes.historyButton}
      >
        <Text size="sm">{date}</Text>

        <Text size="sm" c="dimmed">개정 {historyItem.revision} · {historyItem.title}</Text>
      </UnstyledButton>

      {!compareMode && (
        <Menu shadow="md" width={180} position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              className={classes.itemMenu}
              aria-label={t("Version actions for {{date}}", { date })}
              onClick={(e) => e.stopPropagation()}
            >
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              disabled={!canCompare}
              onClick={() => onStartCompare(historyItem.id)}
            >
              {t("Compare")}
            </Menu.Item>
            {onRestore && (
              <Menu.Item onClick={() => onRestore(historyItem.id, index)}>
                {t("Restore")}
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
});

export default HistoryItem;
