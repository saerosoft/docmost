# Capacity and account access acceptance

Date: 2026-10-24. Canonical units: `index.html#knowledge-gui-features`
(bounded trees, independent panes and invalidation) and KN-02 (private evidence).

## Environment and data

The run used a separate PostgreSQL database whose name starts with
`knowledge_engine_note_gui_acceptance_`. The existing application database,
API on 9086 and integrated note client on 9094 were preserved. The acceptance
API listened on loopback 9092 and this client on loopback 9090. No external
model was called and no existing database was reset.

The capacity corpus contained 1,000,000 notes and their initial revisions:
100,000 roots and 900,000 children, with ten children per populated parent.
Notes included space, private and administrator visibility. A guarded SQL
fixture prepared this controlled corpus in the empty acceptance database.
Functional note edits and permission changes used the real API. This measures
note navigation and editing, rather than ingestion throughput or search quality.

The Linux host reported 16 logical CPUs and approximately 57 GiB RAM. The
database occupied about 1.56 GB after fixture creation. Measurements used warm
data and shared host resources; they establish this observed workload, rather
than a production latency guarantee or a cold-start result.

## Million-note observations

Each API run made 100 root-page reads, 100 child-page reads, 100 note reads,
128 reads with concurrency eight and 30 revision-checked saves. Times include
the local HTTP and CSRF preparation used by the harness.

| API p95, milliseconds | Run 1 | Run 2 | Run 3 |
| --- | ---: | ---: | ---: |
| Root page | 20.29 | 12.91 | 15.28 |
| Child page | 10.82 | 10.90 | 8.57 |
| Note read | 12.07 | 10.09 | 10.13 |
| Eight concurrent readers | 19.33 | 18.28 | 20.66 |
| Revision-checked save | 13.35 | 11.30 | 13.21 |

The repeatable browser scenario traversed 50 root pages per run. Every tree
response contained at most 50 notes and 5,223 bytes. At most 21 tree rows were
rendered. Returning to the first page required a new request after cache
eviction, confirming that visited pages were not retained without a bound.

| Browser observation | Run 1 | Run 2 | Run 3 |
| --- | ---: | ---: | ---: |
| Page navigation p95, milliseconds | 158.26 | 147.00 | 153.05 |
| Retained heap after 20 pages, bytes | 25,060,088 | 24,173,612 | 24,700,136 |
| Retained heap after 50 pages, bytes | 24,929,992 | 24,992,140 | 26,098,192 |

Heap values follow explicit browser garbage collection; they are retained
JavaScript heap, not peak browser or operating-system memory. The test also
restored an authorized child location, saved structured content and verified
the stored document after a reload. This run does not cover million-note
subtree moves, million-item relationship traversals or large attachments.

## Live account access observations

Three separate browser sessions represented an owner, an editor and an account
without membership. The editor could read shared content and its own private
note, but could not read the owner's private note or administrator content.
The unrelated account could not read the shared note.

After promoting the editor to administrator, the test opened an administrator
note and changed its draft without saving. A real API role demotion removed
the protected editor and draft during the next polling cycle, observed at
about 31 seconds. Removing space membership likewise cleared both panes and
their cached private draft. Direct API reads were denied after each change.
These cases did not mock network responses or replace the permission service.

A later live demotion from editor to viewer retained the still-readable draft
and disabled body editing and saving. The tree now reads the API's effective
`myRole`, removes creation and movement controls, disables bulk selection and
dragging, and offers only writable destination spaces. A direct save attempt
from the viewer was denied and the stored note remained unchanged. Both the
component and real-API tests reproduced the former tree-control gap before
the fix.

## Repeating the browser checks

The owning backend prepares the isolated data and session files. It supplies
`NOTE_GUI_E2E_FIXTURE`, a JSON object with UUID fields `space`, `destination`,
`corpus`, `owner`, `peer`, `outsider`, `sharedNote`, `privateNote`,
`administratorNote` and `peerPrivateNote`. The same directory contains scoped
Playwright cookie states named `owner-auth.json`, `peer-auth.json` and
`outsider-auth.json`. Keep them under `.tmp/` with restricted file permissions.

`NOTE_GUI_E2E_SCALE_FIXTURE` names the corpus record with `verifiedRows`,
`rootNotes` and `probeIds`, including keys `1`, `2` and `100001`. The probes
must identify existing notes in that corpus. Missing fixture configuration
skips these external-API cases; a skip does not establish acceptance.

Set `NOTE_GUI_API_ORIGIN` when starting the client to proxy the isolated API.
Set `NOTE_GUI_E2E_BASE_URL` if the test client uses another origin. Then run:

```sh
pnpm test:browser e2e/authorization.spec.ts e2e/capacity.spec.ts
```

The capacity browser scenario records its measurements in
`.tmp/acceptance/browser-capacity.json`. Native Windows execution, cold caches,
production concurrency and hardware-specific service limits remain outside
this Linux run.
