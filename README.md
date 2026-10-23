# Knowledge Engine note GUI

This public fork of [docmost/docmost](https://github.com/docmost/docmost) is for
adapting Docmost's AGPL core note client into the Knowledge Engine note GUI.
The selected design reuses the core editor, page layout, tree, comments,
history views and diagram tools, with our own backend owning the data.

The extraction baseline is **Docmost v0.96.0**, commit
[`9b3e5dd3dc21588fa20c02c5b8646d2f46ee73af`](https://github.com/docmost/docmost/commit/9b3e5dd3dc21588fa20c02c5b8646d2f46ee73af).
Work starts on `feature/knowledge-engine-note-gui` from that commit. The
upstream `main` history is retained separately.

## Planned changes

- Extract the React, Mantine and Tiptap/ProseMirror core client into an
  independently built browser application. Remove Enterprise UI, routes and
  transitive imports from the extracted application.
- Replace Docmost service hooks, authentication and file contracts with a
  typed adapter to the Knowledge Engine API. Our backend owns sessions,
  authorization, note IDs, bodies, revisions, comments and attachments.
- Replace the Hocuspocus/Yjs body-save path with explicit API saves using
  `expectedRevision` and idempotency keys. Preserve structured ProseMirror JSON
  and report conflicting edits. Live simultaneous co-editing requires a
  separate persistence design.
- Add reorderable note tabs and two independent editing panes. Scope the
  editor, title, toolbar, selection, comments, history and unsaved state to
  each pane, including when both panes show the same note.
- Add keyboard tree navigation, multi-select moves and subtree focus. Load
  roots, children and ancestor paths on demand, with bounded client caching.
- Add typed properties, relationships and backlinks with provenance, plus
  authorized links to sources, rules, reviews and actions.
- Preserve editable Draw.io XML and Excalidraw scene data with attachment
  revisions, and Mermaid source in documents. Saving only a preview is
  insufficient. Draw.io must use an approved embed origin.

The original Docmost server and database are outside this integration.
Knowledge Engine services remain responsible for permissions, persistence,
search, AI rules and actions. Trilium is a behavioral reference for the added
navigation features; its code and full feature set are outside this scope.

## Status and acceptance

This branch currently contains the upstream baseline and this scope statement.
The standalone extraction and API integration have not been published from
this branch. Build independence, editable-content round trips, pane isolation,
revision conflicts, access revocation and bounded tree loading must be verified
before the corresponding GUI work is accepted. Million-note capacity has not
been demonstrated.

The authoritative scope and checks are in the
[canonical implementation plan](https://static.saerosoft.com/knowledge-engine/#implementation-plan).
Work proceeds one named plan block or linked screen at a time.

## License and source distribution

The extracted client and its modifications will be published under AGPL-3.0,
with corresponding source, build instructions, provenance and dependency
notices. Preserve the upstream [LICENSE](LICENSE) and copyright notices.
Enterprise directories retained in upstream history keep their separate
license; `apps/client/src/ee`, `apps/server/src/ee` and `packages/ee` are excluded
from the extraction. Connected applications require review of their actual
code linkage and distribution.

## Upstream Docmost documentation

The documentation below describes the original Docmost application. Its
features and startup instructions do not establish the fork's implementation
or acceptance status.

<div align="center">
    <h1><b>Docmost</b></h1>
    <p>
        Open-source collaborative wiki and documentation software.
        <br />
        <a href="https://docmost.com"><strong>Website</strong></a> | 
        <a href="https://docmost.com/docs"><strong>Documentation</strong></a> |
        <a href="https://twitter.com/DocmostHQ"><strong>Twitter / X</strong></a>
    </p>
</div>
<br />

## Getting started

To get started with Docmost, please refer to our [documentation](https://docmost.com/docs) or try our [cloud version](https://docmost.com/pricing) .

## Features

- Real-time collaboration
- Diagrams (Draw.io, Excalidraw and Mermaid)
- Spaces
- Permissions management
- Groups
- Comments
- Page history
- Search
- File attachments
- Embeds (Airtable, Loom, Miro and more)
- Translations (10+ languages)

### Screenshots

<p align="center">
<img alt="home" src="https://docmost.com/screenshots/home.png" width="70%">
<img alt="editor" src="https://docmost.com/screenshots/editor.png" width="70%">
</p>

### License
Docmost core is licensed under the open-source AGPL 3.0 license.  
Enterprise features are available under an enterprise license (Enterprise Edition).  

All files in the following directories are licensed under the Docmost Enterprise license defined in `packages/ee/License`.
  - apps/server/src/ee
  - apps/client/src/ee
  - packages/ee

### Contributing

See the [development documentation](https://docmost.com/docs/self-hosting/development)

## Thanks
Special thanks to;

<img width="100" alt="Crowdin" src="https://github.com/user-attachments/assets/a6c3d352-e41b-448d-b6cd-3fbca3109f07" />

[Crowdin](https://crowdin.com/) for providing access to their localization platform.


<img width="48" alt="Algolia-mark-square-white" src="https://github.com/user-attachments/assets/6ccad04a-9589-4965-b6a1-d5cb1f4f9e94" />

[Algolia](https://www.algolia.com/) for providing full-text search to the docs.

