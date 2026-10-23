import { FC } from "react";
import type { Editor } from "@tiptap/react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconTable } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface Props {
  editor: Editor;
}

export const QuickInsertsGroup: FC<Props> = ({ editor }) => {
  const { t } = useTranslation();

  return (
    <ActionIcon.Group>
      <Tooltip label={t("Table")} withArrow>
        <ActionIcon
          variant="subtle"
          color="dark"
          size="md"
          aria-label={t("Table")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <IconTable size={16} />
        </ActionIcon>
      </Tooltip>
    </ActionIcon.Group>
  );
};
