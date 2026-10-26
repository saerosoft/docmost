import React, { type ReactNode } from "react";
import classes from "@knowledge/docmost/PageLayout.module.css";
import shellClasses from "../../components/layouts/global/app-shell.module.css";
import { FullEditor, type FullEditorProps } from "../../features/editor/full-editor";
import PageHeader from "../../features/page/components/header/page-header";
import { EmptyState } from "../../components/ui/empty-state";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";

const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);
interface Props { editor: FullEditorProps; editorKey: string; header: ReactNode; panels: ReactNode; panelOpen?: boolean }

export default function Page({ editor, editorKey, header, panels, panelOpen = true }: Props) {
  const { t } = useTranslation();
  return <ErrorBoundary resetKeys={[editorKey]} onError={editor.onInvalid} fallbackRender={({ resetErrorBoundary }) => (
    <EmptyState icon={IconAlertTriangle} title={t("Failed to load page. An error occurred.")} action={
      <Button variant="default" size="sm" mt="xs" onClick={resetErrorBoundary}>{t("Try again")}</Button>
    }/>
  )}>
    <div className={classes.page}><MemoizedPageHeader>{header}</MemoizedPageHeader>
      <div className={classes.content}><article className={classes.document} aria-label="노트 내용"><MemoizedFullEditor key={editorKey} {...editor}/></article>
        {panels && <aside className={classes.aside + " " + shellClasses.aside} hidden={!panelOpen} aria-label="페이지 컨텍스트">{panels}</aside>}
      </div>
    </div>
  </ErrorBoundary>;
}
