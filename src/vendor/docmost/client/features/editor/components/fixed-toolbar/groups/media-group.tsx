import { FC } from "react";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconFileTypePdf, IconPaperclip, IconPhoto } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useDocmostUpload } from "@knowledge/docmost/useDocmostUpload";

export const MediaGroup: FC = () => {
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useDocmostUpload();
  function pickFile(accept: string) { if (input.current) { input.current.accept = accept; input.current.click(); } }
  const { t } = useTranslation();

  return (
    <>
    <input ref={input} type="file" hidden multiple disabled={busy} onChange={event => { void upload(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ""; }} />
    {error && <span role="alert">{error}</span>}
    <Menu shadow="md" position="bottom-start" withArrow={false}>
      <Menu.Target>
        <Tooltip label={t("Insert media")} withArrow>
          <ActionIcon
            variant="subtle"
            color="dark"
            size="md"
            aria-label={t("Insert media")}
          >
            <IconPhoto size={16} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconPhoto size={16} />}
            onClick={() => pickFile("image/png,image/jpeg,image/webp")}
          >
            {t("Image")}
          </Menu.Item>
        <Menu.Item
          leftSection={<IconFileTypePdf size={16} />}
          onClick={() =>
            pickFile("application/pdf")
          }
        >
          PDF
        </Menu.Item>
          <Menu.Item
            leftSection={<IconPaperclip size={16} />}
            onClick={() =>
              pickFile("")
            }
          >
            {t("File attachment")}
          </Menu.Item>
      </Menu.Dropdown>
    </Menu>
    </>
  );
};
