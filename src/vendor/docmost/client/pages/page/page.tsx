import React, { type ReactNode } from "react";
import { FullEditor, type FullEditorProps } from "../../features/editor/full-editor";
import PageHeader from "../../features/page/components/header/page-header";
import { EmptyState } from "../../components/ui/empty-state";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";

const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);
interface Props { editor: FullEditorProps; editorKey: string; header: ReactNode; panels: ReactNode }

export default function Page({ editor, editorKey, header, panels }: Props) {
  const { t } = useTranslation();
  return <ErrorBoundary resetKeys={[editorKey]} onError={editor.onInvalid} fallbackRender={({ resetErrorBoundary }) => (
    <EmptyState icon={IconAlertTriangle} title={t("Failed to load page. An error occurred.")} action={
      <Button variant="default" size="sm" mt="xs" onClick={resetErrorBoundary}>{t("Try again")}</Button>
    }/>
  )}>
    <div><MemoizedPageHeader>{header}</MemoizedPageHeader>
      <MemoizedFullEditor key={editorKey} {...editor}/>
      {panels}
    </div>
  </ErrorBoundary>;
}
