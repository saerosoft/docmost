# Knowledge Engine note GUI

This public fork of [docmost/docmost](https://github.com/docmost/docmost) adapts
Docmost's AGPL core note client for Knowledge Engine. It contains the note
editor and navigation, with a typed adapter to our existing domain API.

The upstream baseline is **Docmost v0.96.0**, commit
[`9b3e5dd3dc21588fa20c02c5b8646d2f46ee73af`](https://github.com/docmost/docmost/commit/9b3e5dd3dc21588fa20c02c5b8646d2f46ee73af).
The initial extracted client comes from Knowledge Engine commit
`7de5cadb978bd7318bf6b72956a3d460d011ef9e`, directory `note-gui`.
`upstream-manifest.json` records the retained upstream paths, original hashes
and modifications. Upstream history remains available in Git.

## Scope

- Rich note editing: titles, structured ProseMirror documents, slash commands,
  toolbars, tables, code, links, images and attachments.
- Note navigation: reorderable tabs, two independent editing panes, paginated
  trees, keyboard navigation, multi-select moves and subtree focus.
- Note context: comments, revision history and restore, typed properties,
  relationships, backlinks and authorized provenance links. The KN-02 context
  shows recorded knowledge changes, original evidence and its visibility,
  source and application times, applied rule versions and before/after records.
- Editable Draw.io XML, Excalidraw scenes and Mermaid source, with attachment
  revision references and authorized file access.

The working tree excludes Docmost's server, Enterprise modules, account and
organization management, workspace setup, cloud integration, email templates
and product deployment stack. The original Docmost database and collaboration
server are not required. Authentication, permissions, storage, revisions,
search, rules and actions belong to the external Knowledge Engine API. The
client selects spaces already authorized by that API; it does not manage them.
Links to related sources, rules, reviews and actions open the separate product
application. Trilium is a behavioral reference for navigation additions.

The canonical requirements remain the
[implementation plan](https://static.saerosoft.com/knowledge-engine/#implementation-plan)
and its linked KN-02 note screen. Source extraction supports
`#knowledge-reuse` and `#knowledge-gui-features`; it does not establish screen
acceptance.

## Build and run

Use Node.js 26, pnpm 10.29.2 and Python 3.12 or later. The package manifest pins
the Node major and package manager; the release lockfile and dependency patch
must be retained. Set `PYTHON` if Python uses a different command. The wrappers
otherwise select `py -3` on Windows and `python3` elsewhere.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

The root Makefile provides `make bootstrap`, `make test`, `make build` and
`make verify`. These commands operate on this client alone. `make test` also
checks that temporary and environment files stay out of the source archive;
set Make's `PYTHON` variable to the available Python command when needed.

The development server binds to `127.0.0.1:9090` and proxies `/graphql` and
`/api` to `127.0.0.1:9086`. `NOTE_GUI_API_ORIGIN` can select another HTTP(S)
API origin for an isolated acceptance run. Start the existing Knowledge Engine API and sign in
through `http://localhost:9088`, then open `http://localhost:9090`. Use the
same hostname for both applications so the product session cookie is shared.
This repository does not start or provision those external services.

The API must explicitly allow the note client's origin in
`CORS_ALLOWED_ORIGINS`, alongside the product web origins. For local use:

```dotenv
CORS_ALLOWED_ORIGINS=http://localhost:9088,http://127.0.0.1:9088,http://localhost:9090,http://127.0.0.1:9090
```

Restart the API after changing that setting. The development proxy preserves
the browser's Origin and the API's CSRF checks.

`VITE_DRAWIO_ORIGIN` may select an approved HTTPS embed origin. No third-party
Draw.io frame loads unless configured. Without an embed, XML is editable;
with an embed, the XML view follows graphical edits and is read-only to avoid
two editors overwriting each other's drafts. The
API's read-only permission selects the graphical viewer instead of the editor.
The
Excalidraw editor and its pinned fonts run locally. Preserve the SDK patch
that removes automatic font CDN fallback. Mermaid uses strict, sanitized SVG.
A diagram upload creates a file revision; save the note to commit its reference.
The [self-hosted graphical acceptance record](docs/drawio-acceptance.md)
describes the verified embed, message checks and live attachment revocation.

## Browser verification

Start the existing local API and this client's development server first. Use
a local test account with permission to create, edit and archive notes. Set
`NOTE_GUI_E2E_EMAIL` and `NOTE_GUI_E2E_PASSWORD` in the environment, or point
`NOTE_GUI_E2E_STORAGE_STATE` to a Playwright state file containing only the
local application's session cookies. Keep that file under `.tmp/`.

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

Set `NOTE_GUI_E2E_CHANNEL=chrome` to use an installed Chrome instead. The suite
uses the real API. It creates its own notes, verifies their stored contents
and archives those notes after each test. It does not reset the database or
call an LLM. Browser profiles, screenshots, traces and reports stay in `.tmp/`.

## Source distribution

`pnpm build` produces `dist/`, including `/source.html`, the corresponding
modified source archive, AGPL license, provenance, dependency notices and local
fonts. `pnpm source` regenerates the source offer separately. Serve the complete
`dist/` directory with the API paths routed to the domain service. Vite's
development server is not a production host.

The source archive includes this client, build scripts, tests, package pins,
lockfile and dependency notices. Environment files, temporary files and
unrelated applications are excluded. Keep temporary logs and snapshots under
`.tmp/`. Generated release assets in `public/source/` and `dist/` are ignored.

Preserve [LICENSE](LICENSE), [NOTICE](NOTICE), `third-party/` and
`upstream-manifest.json`. Covered client modifications are distributed under
AGPL-3.0-only. Upstream Enterprise code is outside this extraction. Actual
linkage and distribution of connected applications require separate review.

## Behavior and acceptance limits

Each pane has its own editor, title, toolbar, comments, history and in-memory
tab drafts. A pane ID is independent of the note ID. Saves use
`expectedRevision` and idempotency keys; stale edits must report a conflict.
There is no Hocuspocus/Yjs provider or browser body database.

The tree requests 50 siblings at a time and retains at most 24 pages.
Comments, history and relationships use 20-row pages with at most 100 visible
records. Location restoration and file access remain subject to the API's
current authorization. Property deletion is revision checked. Tree moves can
target another authorized space in the same organization; the API checks
subtrees, attachment history and external relationships before accepting them.
The [capacity and account-access run](docs/capacity-and-access-acceptance.md)
measured bounded navigation and revision-checked editing against one million
notes in a separate local database, including live account permission changes.
Its workload and hardware limits remain explicit.

See [the acceptance record](docs/note-gui-acceptance.md) for the canonical
design units, observed browser behavior and remaining checks. Passing component
tests or a production build alone does not establish screen acceptance.
