# Note GUI acceptance record

## Canonical units and boundaries

This implementation follows `index.html#knowledge-reuse`,
`index.html#knowledge-gui-features` and the linked `KN02-note-detail.html` in
the Knowledge Engine screen specification. The public design is available at
[the screen index](https://static.saerosoft.com/knowledge-engine/#implementation-plan).
The original design files are unchanged.

The note application owns editing, navigation and note context. Knowledge
Engine owns authentication, authorization, revisions, file access, sources,
rules, review and actions. Links to those capabilities open the product web
application. This fork does not include their management screens.

KN-02 uses `knowledgeCurrentItems` for currently valid statements,
`knowledgeAccumulations` for bounded history and `knowledgeAccumulationChange`
for an expanded comparison. The main column separates the authored document
from current knowledge; the adjacent context column contains policy,
provenance and collapsed history. The API selects current membership. Claim
labels distinguish confirmed facts, requests, inference and unspecified
classification. Private and administrator evidence carry explicit labels.
Expanded records show original/effective timestamps, application time, actors,
reviewer and applied rule versions. The generic policy explanation is distinct
from the actual policy snapshot attached to a recorded change.

## Repeatable checks

The real-API browser suite in `e2e/noteGui.spec.ts` covers:

- Structured body editing, bold marks, explicit save and reload, comments,
  property creation and deletion, and the narrow-screen layout.
- Tab switching, reordering and closing with a retained draft; independent
  panes editing the same note; rejection of a stale save; and restoration as
  a new revision without replacing the other pane's draft.
- Mermaid source, Draw.io XML and Excalidraw scene elements stored through
  authorized attachment uploads, note saves and reopening.
- Explicit relationships, incoming backlinks, multi-select tree moves,
  subtree navigation and keyboard focus.

These tests create and archive only their own notes through the API. They do
not mock network responses, reset the database, generate pipeline results or
call external model services. Existing application data remains in place.

Component tests also cover populated current and history items, restricted
evidence labels, source/application timing, lazy comparisons, paging, retry and
late responses after changing the selected note. The adapter tests check the
exact GraphQL projections and authored-body fallback used by these panels.

## Observed local result

On 2026-10-24, the latest standalone client passed 112 tests across 21 Vitest
files and the source-archive regression test. The initial browser run passed
all four real-API editing, navigation and diagram scenarios.
The browser run used installed Chrome on Linux at 1600 by 1000 pixels and a
390 by 844 pixel viewport. It confirmed structured saves and revision conflicts
against the local Knowledge Engine API rather than a replacement server.

The final matching-backend run passed all 25 real-API browser scenarios:
22 general cases and three HTTPS Draw.io embed cases. It included the retained
million-note corpus, populated current knowledge and history, all three account
sessions, live access changes, cross-space moves and large content.

The production build, TypeScript check and distribution verification passed
with 84 pinned upstream source entries and 234 local font assets. The build
still warns about large editor/diagram chunks; loading performance needs
measurement on target devices.

Direct API checks returned 403 for a missing CSRF token and for an unapproved
origin, and 200 for the configured note-client origin with a valid token.

## Acceptance scope and limits

The [populated-data run](populated-data-acceptance.md) verified actual applied
history, before/after snapshots, original source text and private-evidence
separation between accounts, including a populated link to an actual approved
rule version. The [current-knowledge run](current-knowledge-acceptance.md)
also verifies separate current membership, preserved structured human content,
late old evidence, claim labels, legacy restoration and current-item access.

The [self-hosted Draw.io run](drawio-acceptance.md) verified graphical editing,
save, reload and re-edit, immutable attachment bytes, forged-message rejection
and removal of an open diagram when administrator access is revoked.

The later [capacity and account-access run](capacity-and-access-acceptance.md)
verified three account sessions, live role and membership revocation, and
bounded browser navigation and editing with one million notes. The
[move and document run](move-and-large-document-acceptance.md) also verified
private subtree moves, retained pane drafts, a 1,000-paragraph document and a
20 MiB attachment download. Populated evidence revocation passed separately.
These runs cover the note client's named design units under the recorded local
workloads. Source collection, model quality, search-index freshness and the
linked product management screens remain owned by Knowledge Engine. The
measurements do not establish production capacity or target-device performance.
