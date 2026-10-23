import { ActionIcon, Checkbox } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconFileDescription, IconPointFilled } from "@tabler/icons-react";
import type { TreeNote } from "@knowledge/model";
import type { RenderRowProps } from "./doc-tree";
import classes from "../styles/tree.module.css";

type Props = RenderRowProps<TreeNote> & {
  checked: boolean;
  onCheck: () => void;
  onOpen: (id: string) => void;
};

export function SpaceTreeRow({ node, isOpen, hasChildren, toggleOpen, rowRef, tabIndex, treeItemProps, checked, onCheck, onOpen }: Props) {
  return <div className="tree-row">
    <Checkbox aria-label={`${node.title} 선택`} checked={checked} onChange={onCheck}/>
    <div ref={element => { if (typeof rowRef === "function") rowRef(element); else if (rowRef) rowRef.current = element; }}
      className={classes.node} tabIndex={tabIndex} {...treeItemProps} onClick={() => onOpen(node.id)}
      onKeyDown={event => { if (event.key === "Enter") onOpen(node.id); }}>
      <PageArrow isOpen={isOpen} hasChildren={hasChildren} onToggle={toggleOpen} label={`${node.title} 하위 트리 보기`}/>
      <IconFileDescription size={18}/>
      <span className={classes.text}>{node.title}</span>
    </div>
  </div>;
}

interface PageArrowProps {
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  label: string;
}

function PageArrow({ isOpen, hasChildren, onToggle, label }: PageArrowProps) {
  if (!hasChildren) {
    return (
      <span
        aria-hidden
        className={classes.actionIcon}
        style={{
          width: 20,
          height: 20,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconPointFilled size={8} />
      </span>
    );
  }

  return (
    <ActionIcon
      size={20}
      variant="subtle"
      color="gray"
      className={classes.actionIcon}
      aria-label={label}
      aria-expanded={isOpen}
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {isOpen ? (
        <IconChevronDown stroke={2} size={18} />
      ) : (
        <IconChevronRight stroke={2} size={18} />
      )}
    </ActionIcon>
  );
}

