import classes from "./page-header.module.css";
import type { ReactNode } from "react";
import { Group } from "@mantine/core";

export default function PageHeader({ children }: { children: ReactNode }) {
  return <div className={classes.header} style={{ position: "relative", top: "auto", insetInlineStart: "auto", insetInlineEnd: "auto", flexShrink: 0, zIndex: 110 }} data-page-header="true">
    <Group justify="space-between" h="100%" px="md" wrap="nowrap" className={classes.group}>{children}</Group>
  </div>;
}
