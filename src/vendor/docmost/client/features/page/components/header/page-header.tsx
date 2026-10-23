import classes from "./page-header.module.css";
import type { ReactNode } from "react";
import { Group } from "@mantine/core";

export default function PageHeader({ children }: { children: ReactNode }) {
  return <div className={classes.header} data-page-header="true">
    <Group justify="space-between" h="100%" px="md" wrap="wrap" className={classes.group}>{children}</Group>
  </div>;
}
