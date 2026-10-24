# Cross-space moves and large documents

On 2026-10-24, the real-API Chrome scenarios in `e2e/crossSpace.spec.ts` and
`e2e/largeDocument.spec.ts` passed against isolated accounts, database and
storage. They create and archive only their own notes. They do not call an
LLM or reset the database.

## Private subtree move

A private parent and its private child moved to another space in the same
organization through the tree's destination picker. The API confirmed both
new space IDs, the original owner, private visibility and the parent-child
relationship. The other account could read neither note after the move.

The original tree removed the moved parent. Both panes retained their unsaved
drafts. The completion message opened the moved note in its destination space
in a new tab; directly opening the child restored its authorized ancestor
path there. The original editing windows retain their navigation context so
moving a note does not discard another pane's draft. The destination link is
cleared when access is refreshed or lost.

This exercises a two-note subtree. It does not establish performance for a
million-node subtree move, cross-organization moves or retention-linked files.

## Long document and large attachment

The test seeded a valid structured document through the real save API, then
opened and edited it in the browser. It contained 1,000 paragraphs, 92,999
plain-text characters including paragraph separators and 163,026 JSON bytes.
All original paragraphs and the browser edit survived save and reload.

The browser file input uploaded a 20 MiB attachment. After saving and reopening
the note, the actual download's SHA-256 matched the uploaded bytes. A later
110,000-character draft exceeded the backend's text limit: the UI retained the
draft and displayed the rejection, while the stored body and attachment
reference remained unchanged.

In this single warm local run, opening through the last paragraph took 1.24 s
and the upload through its visible attachment took 3.29 s. These timings share
the host and caches described in the [million-note run](capacity-and-access-acceptance.md);
they are observations, not a device-independent latency promise. This test
does not measure enormous diagrams, simultaneous large uploads or peak memory.

```sh
NOTE_GUI_E2E_FIXTURE=.tmp/acceptance/fixtures.json \
NOTE_GUI_E2E_CHANNEL=chrome pnpm test:browser \
  e2e/crossSpace.spec.ts e2e/largeDocument.spec.ts
```
