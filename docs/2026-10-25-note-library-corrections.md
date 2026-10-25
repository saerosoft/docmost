# KN02 note-library corrections — 2026-10-25

This completed correction unit supports the Knowledge Engine KN02 note-detail screen and the canonical knowledge GUI feature block. It does not mark every KN02 or product acceptance criterion complete.

## Implemented corrections

- Preserve the application's configured web port in same-host links from the standalone client.
- List immutable note files, including superseded attachment revisions and files not currently embedded in the body. Use 50-item cursor pages, native authorized downloads, file metadata, refresh and explicit loading/empty/error states.
- Render local Excalidraw files as inline previews. Preserve embedded image bytes, omit remote content from preview rendering without rewriting the source, cancel stale loads, and remove object URLs when access is lost.
- Register the existing bundled Korean Excalidraw locale; the SDK otherwise filters it from the public language list. Untranslated messages retain the SDK's normal fallback.
- Keep the drawing modal open on Escape. Explicit exit asks before discarding unsaved edits.
- Defer history-editor node-view updates until after the React commit, and cancel obsolete work when the editor changes or is destroyed.

## Actual owner verification

The owning Make verification completed at 05:08 UTC with 140 tests in 25 files, TypeScript checking, production build, and corresponding-source archive verification. A subsequent documentation/source-offer verification is recorded by the owning repository commit.

The owner used Playwright MCP and Chrome on the same development host as the API, web app, and standalone client. The application contained the complete imported note/history/attachment corpus; editable checks used separate authorized fixtures.

Actual flows included:

- Save/reload of a 90,063-character fixture; independent panes; stale-revision conflict retaining the unsaved draft; explicit history restore with a new immutable revision.
- A 90,000-character imported body matching its stored authored paragraph; 23 historical revisions across two pages; all 48 children of a virtualized imported tree.
- 254 immutable files across pages of 50/50/50/50/50/4, with every returned file ID matching database order.
- A native browser download of a 248,710,446-byte imported attachment, with downloaded size and SHA-256 matching the stored file.
- Invalid and corrected Mermaid sources, retained immutable file revisions, rendered diagram, and exact-byte native download.
- Excalidraw graphical editing, save/reload, inline preview, and exact-byte native download. A subsequent unsaved text edit survived two Escape presses; canceling the exit confirmation retained the edit, and explicit discard left the saved note and source file unchanged.
- A read-only member could view and download the shared diagram but had no editor actions or access to the two private fixture notes. After membership revocation, the already-open client showed denied access and cleared editors, links, and previews; a previously available file URL returned HTTP 403 with no-store headers.
- At 390 pixels, the attachment list retained its controls and download links without horizontal document overflow. Desktop checks used a 1440-pixel viewport.
- Search returned the saved current fixture revision after save/restore. The restored note no longer exposed a later, uniquely identified historical marker as current evidence.

Full request/response, browser, hash, and database evidence is retained privately with the parent application's acceptance record. No original imported note or attachment content is included in this public report.

## Remaining dependent acceptance

The managed Draw.io graphical flow, positive AI-current-item presentation in the parent web screen, and the rest of the parent screen matrix remain separate checks. These corrections do not establish complete model-runtime readiness, search-answer quality, or repeated-correction quality.
