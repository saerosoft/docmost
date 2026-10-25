import "@/features/editor/styles/index.css";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { editorExtensions } from "@knowledge/editor/extensions";
import type { JSONContent } from "@tiptap/core";
import { validateDocument } from "@knowledge/docmost/validateDocument";
import { Title } from "@mantine/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import historyClasses from "./css/history.module.css";
import { recreateTransform } from "../../../../editor-ext/recreate-transform";
import { DOMSerializer, Node } from "@tiptap/pm/model";
import { ChangeSet, simplifyChanges } from "@tiptap/pm/changeset";
import { useAtom } from "jotai";
import {
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";

export interface HistoryEditorProps {
  title: string;
  content: JSONContent;
  previousContent?: JSONContent;
}

export function HistoryEditor({
  title,
  content,
  previousContent,
}: HistoryEditorProps) {
  const [error, setError] = useState("");
  const [highlightChanges] = useAtom(highlightChangesAtom);
  const [, setDiffCounts] = useAtom(diffCountsAtom);

  const editor = useEditor({
    extensions: editorExtensions(),
    editable: false,
    editorProps: { attributes: { role: "textbox", "aria-label": "개정 원문" } },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || !content) return;

    let active = true;
    // React node views flush synchronously; update them after the current React commit.
    queueMicrotask(() => {
      if (!active || editor.isDestroyed) return;
      if (!validateDocument(content, editor.schema) || (previousContent && !validateDocument(previousContent, editor.schema))) {
        setError("이 개정에는 지원하지 않는 내용이 있습니다. 원문은 보존됩니다."); return;
      }
      setError("");
      let decorationSet = DecorationSet.empty;
      let addedCount = 0;
      let deletedCount = 0;

      if (previousContent) {
        try {
          const schema = editor.schema;
          const oldContent = Node.fromJSON(schema, previousContent);
          const newContent = Node.fromJSON(schema, content);

          const tr = recreateTransform(oldContent, newContent, {
            complexSteps: false,
            wordDiffs: true,
            simplifyDiff: true,
          });

          const changeSet = ChangeSet.create(oldContent).addSteps(
            tr.doc,
            tr.mapping.maps,
            [],
          );
          const changes = simplifyChanges(changeSet.changes, newContent);

          editor.commands.setContent(content);

          const specialNodeTypes = new Set([
            "image",
            "attachment",
            "video",
            "excalidraw",
            "drawio",
            "mermaid",
            "mathBlock",
            "mathInline",
            "table",
            "details",
            "callout",
          ]);

          const decorations: Decoration[] = [];
          function wholeNode(doc: Node, from: number, to: number) {
            const found: { node: Node; pos: number }[] = [];
            doc.nodesBetween(from, to, (node, pos) => {
              if (specialNodeTypes.has(node.type.name) && from <= pos && to >= pos + node.nodeSize) {
                found.push({ node, pos }); return false;
              }
            });
            return found[0];
          }
          let changeIndex = 0;

          for (const change of changes) {
            if (change.toB > change.fromB) {
              changeIndex++;
              const currentIndex = changeIndex;
              const foundSpecialNode = wholeNode(newContent, change.fromB, change.toB);

              if (foundSpecialNode) {
                const nodeEnd =
                  foundSpecialNode.pos + foundSpecialNode.node.nodeSize;
                decorations.push(
                  Decoration.node(foundSpecialNode.pos, nodeEnd, {
                    class: "history-diff-node-added",
                    "data-diff-index": String(currentIndex),
                  }),
                );
              } else {
                decorations.push(
                  Decoration.inline(change.fromB, change.toB, {
                    class: "history-diff-added",
                    "data-diff-index": String(currentIndex),
                  }),
                );
              }
              addedCount += 1;
            }
            if (change.toA > change.fromA) {
              changeIndex++;
              const currentIndex = changeIndex;
              const foundDeletedNode = wholeNode(oldContent, change.fromA, change.toA);

              if (foundDeletedNode) {
                decorations.push(
                  Decoration.widget(change.fromB, () => {
                    const wrapper = document.createElement("div");
                    wrapper.className = "history-diff-node-deleted";
                    wrapper.setAttribute("data-diff-index", String(currentIndex));
                    const serializer = DOMSerializer.fromSchema(schema);
                    const dom = serializer.serializeNode(foundDeletedNode!.node);
                    wrapper.appendChild(dom);
                    return wrapper;
                  }),
                );
              } else {
                const deletedText = oldContent.textBetween(
                  change.fromA,
                  change.toA,
                  "",
                );
                if (deletedText) {
                  decorations.push(
                    Decoration.widget(change.fromB, () => {
                      const span = document.createElement("span");
                      span.className = "history-diff-deleted";
                      span.setAttribute("data-diff-index", String(currentIndex));
                      span.textContent = deletedText;
                      return span;
                    }),
                  );
                }
              }
              deletedCount += 1;
            }
          }

          decorationSet = DecorationSet.create(newContent, decorations);
        } catch {
          setError("개정 비교를 표시하지 못했습니다. 선택한 원문은 변경되지 않습니다.");
          editor.commands.setContent(content);
        }
      } else {
        editor.commands.setContent(content);
      }

      const total = addedCount + deletedCount;
      setDiffCounts({ added: addedCount, deleted: deletedCount, total });

      editor.setOptions({
        editorProps: {
          ...editor.options.editorProps,
          decorations: () =>
            highlightChanges ? decorationSet : DecorationSet.empty,
        },
      });
    });
    return () => { active = false; };
  }, [
    title,
    content,
    editor,
    previousContent,
    highlightChanges,
    setDiffCounts,
  ]);

  return (
    <div>
      <Title order={1}>{title}</Title>
      {error && <p role="alert">{error}</p>}
      {editor && !error && (
        <EditorContent
          editor={editor}
          className={historyClasses.historyEditor}
        />
      )}
    </div>
  );
}
