import type { JSONContent } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';

export function validateDocument(body: JSONContent, schema: Schema): boolean {
  function valid(node: JSONContent): boolean {
    const type = node.type && schema.nodes[node.type];
    if (!type || Object.keys(node.attrs || {}).some(key => !(key in (type.spec.attrs || {})))) return false;
    if (node.marks?.some(mark => {
      const markType = schema.marks[mark.type];
      return !markType || Object.keys(mark.attrs || {}).some(key => !(key in (markType.spec.attrs || {})));
    })) return false;
    return (node.content || []).every(valid);
  }
  if (!valid(body)) return false;
  try { schema.nodeFromJSON(body).check(); return true; } catch { return false; }
}
