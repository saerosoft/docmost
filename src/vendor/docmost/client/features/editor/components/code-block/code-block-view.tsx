import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Group, Select, Tooltip } from "@mantine/core";
import { CopyButton } from "@mantine/core";
import { codeLanguages } from "@knowledge/docmost/codeLanguages";
import { useEffect, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import classes from "./code-block.module.css";
import { useTranslation } from "react-i18next";

export default function CodeBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, editor } = props;
  const { language } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );
  useEffect(() => { setLanguageValue(language || null); }, [language]);

  function changeLanguage(language: string | null) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  return (
    <NodeViewWrapper className="codeBlock">
      <Group
        justify="flex-end"
        contentEditable={false}
        className={classes.menuGroup}
      >
        <Select
          placeholder="auto"
          aria-label={t("Code language")}
          checkIconPosition="right"
          data={[...new Set([...codeLanguages, ...(language ? [String(language)] : [])])].sort()}
          value={languageValue}
          onChange={changeLanguage}
          searchable
          style={{ maxWidth: "130px" }}
          classNames={{ input: classes.selectInput }}
          disabled={!editor.isEditable}
        />

        <CopyButton value={node?.textContent} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? t("Copied") : t("Copy")}
              withArrow
              position="right"
            >
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={copy}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>

      <pre
        spellCheck="false"
      >
        <NodeViewContent<"code"> as="code" className={`language-${language || ""}`} />
      </pre>

    </NodeViewWrapper>
  );
}
