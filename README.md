# Knowledge Engine note GUI

This public fork of [docmost/docmost](https://github.com/docmost/docmost) adapts
Docmost's AGPL core note client for Knowledge Engine. It distributes the
original/adapted application shell, page editor, navigation and styles as an
importable browser library, with a typed adapter to the existing domain API.
The product hosts this library inside Next.js; Vite is an optional development
and demo harness. Preserve the retained original Docmost stylesheets;
host-specific layout additions support tabs, panes and embedding rather than
redesigning the workspace.

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
  relationships, backlinks and authorized provenance links. KN-02 separates
  the authored document, currently valid knowledge and accumulation history.
  Current items distinguish confirmed facts, requests, inference and
  unclassified statements. Expand an item to inspect its original evidence,
  source and application times, applied rule versions and before/after records.
- Editable Draw.io XML, Excalidraw scenes and Mermaid source, with attachment
  revision references and authorized file access.

The working tree excludes Docmost's server, Enterprise modules, account and
organization management, workspace setup, cloud integration, email templates
and product deployment stack. The original Docmost database and collaboration
server are not required. Authentication, permissions, storage, revisions,
search, rules and actions belong to the external Knowledge Engine API. The
client selects spaces already authorized by that API; it does not manage them.
Links to related sources, rules, reviews and actions navigate to the product
web routes. The host consumes the library while the existing Kotlin API remains
authoritative for authentication, permissions and data; there is no second
Docmost backend or browser body database. Trilium is a behavioral reference for
navigation additions.

The canonical requirements remain the
[implementation plan](https://static.saerosoft.com/knowledge-engine/#implementation-plan)
and its linked KN-02 note screen. Source extraction supports
`#knowledge-reuse` and `#knowledge-gui-features`; it does not establish screen
acceptance.

## Build the library

Use Node.js 26, pnpm 10.29.2 and Python 3.11 or later. The package manifest pins
the Node major and package manager; the release lockfile and dependency patch
must be retained. Set `PYTHON` if Python uses a different command. The wrappers
otherwise select `py -3` on Windows and `python3` elsewhere.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The root Makefile provides `make bootstrap`, `make test`, `make build` and
`make verify` for this public library. `make test` also checks that temporary
and environment files stay out of the source archive; set Make's `PYTHON`
variable to the available Python command when needed. The build generates the
source offer, checks TypeScript, emits declarations, runs
`vite.library.config.ts`, copies declaration support files and verifies the
distribution. Tests remain a separate required step in `make verify`.

The package is `private: true`; these instructions do not describe an npm
publication. Consume a verified build from the pinned public repository and
retain its lockfile, notices and matching corresponding-source offer.

## Host the public library

The package exports are:

| Export | Built entry | Purpose |
| --- | --- | --- |
| `.` | `dist/note-gui.js`, with `dist/types/index.d.ts` | ES module and public TypeScript declarations |
| `./style.css` | `dist/note-gui.css` | Required Mantine, native editor and integration styles |

The module exports `mountNoteGui` at runtime and the `NoteGuiOptions`, `NoteApi`,
`MountedNoteGui` and `NoteGuiHostModule` TypeScript contracts.
`mountNoteGui(container, options?)` bundles the pinned React runtime, creates
an isolated React root and returns `{ unmount() }`. `NoteGuiOptions.api` may supply a compatible `NoteApi` adapter;
omitting it uses the existing authenticated domain adapter. `NoteGuiOptions.onNavigate`
may handle native product links through the host router by returning `true`;
return `false` to retain browser navigation. Dirty-pane confirmation runs before
the callback, and modified clicks retain their native behavior. The host must
still preserve backend authorization, revision checks and CSRF. A consumer
whose build resolves the pinned checkout as a package can import
`mountNoteGui` from `@knowledge-engine/note-gui` and the CSS from
`@knowledge-engine/note-gui/style.css`; this does not imply an npm publication.

Copy the complete `dist/` tree to the host's served asset location. The library
asset base defaults to `/note-gui/`; set `NOTE_GUI_ASSET_BASE` before building
only when the served asset path differs. Keep generated chunks, local
Excalidraw fonts and source-offer files at their generated relative paths. The
product route `/notes/` is distinct from this static asset directory.

The current Next.js host uses a client boundary at `/notes/`: it loads
`/note-gui/note-gui.css`, dynamically imports `/note-gui/note-gui.js`, waits for
the stylesheet and then calls `mountNoteGui`. Its effect guards against a late
load after navigation and calls `unmount()` and removes its stylesheet during
cleanup. Server rendering does not call the mount function. A browser host
can use the same lifecycle:

```js
const stylesheet = document.createElement('link');
stylesheet.rel = 'stylesheet';
stylesheet.href = '/note-gui/note-gui.css';
const cssReady = new Promise((resolve, reject) => {
  stylesheet.onload = resolve;
  stylesheet.onerror = reject;
});
document.head.append(stylesheet);

const [gui] = await Promise.all([
  import('/note-gui/note-gui.js'),
  cssReady,
]);
const mounted = gui.mountNoteGui(container);

// Run during host cleanup, after protecting any unsaved drafts.
mounted.unmount();
stylesheet.remove();
```

`container` is a real host element. Framework effects additionally need
cancellation/error handling so a completed import cannot mount after cleanup.
Use `NoteGuiHostModule` for the browser-host type contract when needed. Loading
the module alone does not load the separately emitted stylesheet.

The product host serves this module and CSS and uses the existing same-origin
`/graphql` and `/api` endpoints. The current product host imports this module
with the optional Vite server stopped; preserve this condition during
acceptance and future host changes. Linking to a separate application or reverse-proxying `/notes/` to
that server does not meet the library-host requirement. Keep complete source
distribution available from the hosted GUI; this README does not establish
final product, visual or host acceptance.

## Optional Vite development and demo harness

```sh
pnpm dev
```

`make start-all` in this public repository also starts that harness. It does
not start the product or prove product-host integration.

The optional development server binds to `127.0.0.1:9090` and proxies `/graphql` and
`/api` to `127.0.0.1:9086`. `NOTE_GUI_API_ORIGIN` can select another HTTP(S)
API origin for an isolated acceptance run. Start the existing Knowledge Engine API and sign in
through `http://localhost:9088`, then open `http://localhost:9090`. Use the
same hostname for both applications so the product session cookie is shared.
This repository does not start or provision those external services.

Product navigation can use the configured browser-safe `VITE_WEB_ORIGIN`.
Without that origin, the adapter preserves the current protocol/hostname and
uses `NOTE_GUI_WEB_PORT`, then `FRONTEND_WEB_PORT`, then the demo fallback
`9088`; the selected port is exposed as `VITE_WEB_PORT`. A port must be an
integer from 1 to 65535. The host build must use the actual product origin so
links stay on the intended product/session. Rebuild the library after changing
its inlined public settings; restart the demo when changing its proxy settings.
Keep credentials out of every browser-visible setting.

## Domain API and diagrams

The connected API must expose `knowledgeCurrentItems`, `KnowledgeNote.authoredBody`
and `bodyOrigin` on notes and revisions. The editor loads `richBody` first,
then `authoredBody`, including an intentionally empty authored body. Current
knowledge comes only from the API's current-item projection. Older mixed
documents remain unchanged and carry a `LEGACY_UNCLASSIFIED` notice; their
history is not inferred to be current knowledge. Deploy the matching backend
contract before this client.

Relation target lookup additionally requires `knowledgeRelationTargets(noteId,
query, offset, limit)`. The API authorizes the current anchor and applies its
same-space, same-visibility and private-owner rules before counting or paging.
The relation picker replaces each 20-row page and uses the server's total and
next-page flag; it does not filter the generic first page of readable notes.
A target that changes before submission remains subject to the server's write
checks, and a target-field rejection asks the reader to select it again.

An explicitly used separate-origin demo must be permitted by the API
`CORS_ALLOWED_ORIGINS`, alongside the product web origins. For the optional
local demo:

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
The Excalidraw editor and its pinned fonts run locally. Preserve the SDK patch
that removes automatic font CDN fallback. Saved Excalidraw scenes render as
sanitized SVG image previews with embedded local fonts and image data. Remote
media and embeddables are not fetched for previews. Escape remains with the
canvas and its text tools; explicit Close or Exit confirms any unsaved edits.
The drawing controls follow the note GUI language. The loader explicitly enables
its pinned SDK's bundled Korean locale, which the upstream completion filter
otherwise hides; untranslated SDK strings retain the upstream English fallback.
Mermaid uses strict, sanitized SVG.
A diagram upload creates a file revision; save the note to commit its reference.
The [self-hosted graphical acceptance record](docs/drawio-acceptance.md)
describes the verified embed, message checks and live attachment revocation.

## Browser verification

For product integration, serve the built library through the actual Next.js
`/notes/` host with its existing API, and stop the Vite demo server. Set
`NOTE_GUI_E2E_BASE_URL` to the configured product URL ending in `/notes/`
(including its trailing slash). `NOTE_GUI_E2E_SPACE` selects an isolated writable
space for the note-creation scenarios. Demo-only checks may instead target the
optional development server, but do not establish product-host acceptance. Use
a test account with permission to create, edit and archive isolated notes. Set
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

`pnpm build` produces the importable `dist/note-gui.js`, emitted CSS and
declarations, plus `dist/source.html`, the matching modified library source
archive, AGPL license, provenance, dependency notices and local fonts.
`pnpm source` regenerates the source offer separately. Serve the complete
distribution at the library asset base and retain the GUI's source link; the
product supplies its normal API routing. Vite's development server is not a
production host.

The source archive includes this client, build scripts, tests, package pins,
lockfile and dependency notices. Environment files, temporary files and
unrelated applications are excluded. Keep temporary logs and snapshots under
`.tmp/`. Generated release assets in `public/source/` and `dist/` are ignored.

Preserve [LICENSE](LICENSE), [NOTICE](NOTICE), `third-party/` and
`upstream-manifest.json`. Covered library modifications are distributed under
AGPL-3.0-only. Upstream Enterprise code is outside this extraction. The archive
describes this public library's source; it does not declare the consuming
product's source obligations discharged. A separate package, isolated React
root, browser chunk or process is not a claimed host exemption. Assess the
actual integration and distribution and provide the corresponding source
required for that delivered work.

## Behavior and acceptance limits

Each pane has its own editor, title, toolbar, comments, history and in-memory
tab drafts. A pane ID is independent of the note ID. Saves use
`expectedRevision` and idempotency keys; stale edits must report a conflict.
There is no Hocuspocus/Yjs provider or browser body database.

The tree requests 50 siblings at a time and retains at most 24 pages.
The attachment tab reads 50 authorized file records per page, including earlier
file revisions and imported files that do not appear inside the document. It
replaces each page, clears rows when access changes, and downloads the selected
immutable file through the same-origin authenticated API. Large downloads use
the browser download manager; the client does not buffer them as editor blobs.
Comments, history and relationships use 20-row pages with at most 100 visible
records. Current knowledge and accumulation history replace their 20-row pages;
evidence and comparisons expand inside the selected item. Location restoration
and file access remain subject to the API's
current authorization. Property deletion is revision checked. Tree moves can
target another authorized space in the same organization; the API checks
subtrees, attachment history and external relationships before accepting them.
The [capacity and account-access run](docs/capacity-and-access-acceptance.md)
measured bounded navigation and revision-checked editing against one million
notes in a separate local database, including live account permission changes.
Its workload and hardware limits remain explicit.

See [the acceptance record](docs/note-gui-acceptance.md) and
[current-knowledge checks](docs/current-knowledge-acceptance.md) for the canonical
design units, observed browser behavior and workload limits. Passing component
tests or a production build alone does not establish screen acceptance.
