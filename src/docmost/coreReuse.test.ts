import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const upstream = 'apps/client/src/';
const required = [
  ['page renderer', 'pages/page/page.tsx'],
  ['page layout', 'features/editor/full-editor.tsx'],
  ['title', 'features/editor/title-editor.tsx'],
  ['editor', 'features/editor/page-editor.tsx'],
  ['toolbar', 'features/editor/components/fixed-toolbar/fixed-toolbar.tsx'],
  ['slash menu', 'features/editor/components/slash-menu/command-list.tsx'],
  ['table menu', 'features/editor/components/table/table-menu.tsx'],
  ['code block', 'features/editor/components/code-block/code-block-view.tsx'],
  ['link menu', 'features/editor/components/link/link-menu.tsx'],
  ['file', 'features/editor/components/attachment/attachment-view.tsx'],
  ['image', 'features/editor/components/image/image-view.tsx'],
  ['tree', 'features/page/tree/components/doc-tree.tsx'],
  ['tree drag and drop', 'features/page/tree/components/doc-tree-row.tsx'],
  ['comments', 'features/comment/components/comment-list-with-tabs.tsx'],
  ['comment editor', 'features/comment/components/comment-editor.tsx'],
  ['history', 'features/page-history/components/history-editor.tsx'],
  ['history list', 'features/page-history/components/history-list.tsx'],
  ['Draw.io', 'features/editor/components/drawio/drawio-view.tsx'],
  ['Excalidraw', 'features/editor/components/excalidraw/excalidraw-view.tsx'],
  ['Mermaid', 'features/editor/components/code-block/mermaid-view.tsx'],
] as const;
interface SourceEntry { source: string; destination: string; upstreamSha256: string; changes: string[] }
interface Manifest { commit: string; files: SourceEntry[] }
const manifest: Manifest = JSON.parse(readFileSync(resolve(root, 'upstream-manifest.json'), 'utf8'));

function runtimeGraph() {
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
  const files = new Set<string>();
  const imports = new Set<string>();
  function visit(path: string) {
    if (files.has(path)) return;
    files.add(path);
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    function dependency(specifier: string) {
      imports.add(specifier);
      const found = ts.resolveModuleName(specifier, path, options, ts.sys).resolvedModule;
      if (found && !found.isExternalLibraryImport && !found.resolvedFileName.endsWith('.d.ts')) visit(found.resolvedFileName);
      else if (specifier.startsWith('.') && existsSync(resolve(dirname(path), specifier))) files.add(resolve(dirname(path), specifier));
    }
    function scan(node: ts.Node) {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const names = clause?.namedBindings;
        const onlyTypes = clause?.isTypeOnly || (!clause?.name && names && ts.isNamedImports(names) && names.elements.every(item => item.isTypeOnly));
        if (!onlyTypes) dependency(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        dependency(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        dependency(node.arguments[0].text);
      }
      ts.forEachChild(node, scan);
    }
    scan(source);
  }
  visit(resolve(root, 'src/main.tsx'));
  return { files, imports };
}

describe('the selected Docmost client is actual runtime source', () => {
  const graph = runtimeGraph();

  it.each(required)('uses the pinned upstream %s UI in the application import graph', (_area, source) => {
    expect(manifest.commit).toBe('9b3e5dd3dc21588fa20c02c5b8646d2f46ee73af');
    const retained = manifest.files.find(file => file.source === upstream + source);
    expect(retained, `The actual upstream UI must be retained: ${source}`).toBeDefined();
    if (!retained) return;
    expect(retained.upstreamSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(graph.files.has(resolve(root, retained.destination)), `Copied but unused UI does not satisfy reuse: ${retained.destination}`).toBe(true);
  });

  it('excludes Enterprise, upstream server and browser body persistence from production imports', () => {
    const forbidden = /(?:^|\/)(?:ee|server)(?:\/|$)|^@hocuspocus\/|^y(?:js|\-indexeddb|\-prosemirror)$|^@tiptap\/extension-collaboration(?:-caret)?$|^socket\.io-client$/;
    expect([...graph.imports].filter(path => forbidden.test(path))).toEqual([]);
    expect([...graph.files].map(path => relative(root, path)).filter(path => /(?:^|\/)ee\/|apps\/server\/|\.\.\/frontend\//.test(path))).toEqual([]);
    const dependencies: { dependencies: Record<string, string> } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(Object.keys(dependencies.dependencies).filter(name => forbidden.test(name))).toEqual([]);
  });
});
