import { useId, useState } from "react";
import { Group, ScrollArea, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconLink, IconWorld } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./link.module.css";
import { safeLinkUrl } from "@knowledge/docmost/safeLinkUrl";

export function LinkEditorPanel({ onSetLink }: { onSetLink: (url: string) => void }) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const listId = useId();
  const safe = safeLinkUrl(url);
  return <div><form onSubmit={event => { event.preventDefault(); if (safe) onSetLink(safe); }}>
    <TextInput leftSection={<IconLink size={16} stroke={1.5} color="var(--mantine-color-dimmed)"/>} classNames={{ input: classes.linkInput }}
      placeholder="https://" aria-label={t("Add link")} role="combobox" aria-expanded={!!safe} aria-controls={listId} aria-autocomplete="list"
      value={url} onChange={event => setUrl(event.currentTarget.value)} data-autofocus autoFocus/>
  </form>
  {safe && <ScrollArea.Autosize mah={300} scrollbars="y" scrollbarSize={6} mt={8} id={listId} role="listbox" aria-label={t("Link suggestions")}>
    <UnstyledButton role="option" aria-selected onClick={() => onSetLink(safe)} className={classes.searchItem}>
      <Group gap={10} wrap="nowrap" align="flex-start"><span className={classes.pageIcon}><IconWorld size={18} stroke={1.5}/></span><div style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={500} truncate lh={1.3}>{safe}</Text><Text size="xs" c="dimmed" lh={1.4}>{t("Link to web page")}</Text>
      </div></Group>
    </UnstyledButton>
  </ScrollArea.Autosize>}
  {!!url && !safe && <Text role="alert" c="red">HTTP, HTTPS 또는 이메일 링크를 입력해 주세요.</Text>}
  </div>;
}
