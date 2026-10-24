# Current knowledge and authored-document acceptance

## Contract and design

This unit follows `KN02-note-detail.html`: the authored document and currently
valid knowledge occupy the main column; accumulation history, source policy
and provenance occupy the adjacent context column. Current items show explicit
claim classifications. Evidence, rule versions and saved comparisons expand
inside the item; history rows remain collapsed until opened. The original
screen specification is unchanged.

`knowledgeCurrentItems` owns current membership and pagination. The client
does not reconstruct current statements from accumulation history or source
arrival order. Each page replaces the previous 20-row page. The returned
`hasNext` controls continuation even when permissions filter some entries.

The editor prefers `richBody`, then the nullable `authoredBody`, then the
compatibility `body`. An empty authored body stays empty. Current-item text is
never inserted into the editor. API changes, human saves and history restores
retain their normal revision checks.

Existing mixed documents and revisions retain `LEGACY_UNCLASSIFIED` rather
than being silently classified as human or current knowledge. The GUI labels
the preserved body and distinguishes an empty classified current projection
from an ordinary empty human note. Restoring a legacy revision retains that
origin. New accepted current items can coexist with a preserved legacy body.

## Real-API workload

The isolated database was migrated by creating a fresh database with strict
Flyway history, then restoring only the retained application data. The source
database stayed unchanged. Before any new cases were applied, all 1,000,055
notes and 1,000,295 revisions matched the original ID, title, body and rich-body
fingerprints. All retained rows had `LEGACY_UNCLASSIFIED` origin, no authored
projection was invented, and the current-item table was empty. The migration
retained its fresh Flyway history and left no disabled triggers.

`e2e/currentKnowledge.spec.ts` uses actual notes, sources, applied changes,
revisions, files and account permissions in the isolated acceptance database.
Controlled pending proposals are persisted there and accepted through the
normal `decideChangeSet` API; they are not browser network replacements or
model-generated results. Sources stay paused and external model execution
stays disabled.

The fixture contains:

- A human document with heading, bold and italic text, table cells and an
  attached Draw.io diagram. Six accepted changes include a superseded proposed
  date, its confirmed replacement, a late historical source, a request, an
  inference and an unclassified statement. Four items remain current.
- A stale proposal rejected after a newer revision-checked human save, without
  changing the authored document or current membership.
- A human revision restored through the GUI as a new revision while retaining
  its rich document, authored text, classification and current items.
- A collected note with an empty human editor and a separate confirmed item.
- Private and administrator notes with current evidence, plus three account
  sessions and live administrator demotion.
- A note with 25 current items to exercise 20/five paging and previous-page
  replacement without merging or dropping items.
- A new current item pinned to an actual approved, active rule version while
  its existing legacy document remains unchanged.

The companion `e2e/populated.spec.ts` retains the pre-migration history cohort.
It verifies that 31 old applied records are still available as history while
their mixed documents have no inferred current membership, and that restoring
a legacy revision preserves its body and origin.

## Observed result

On 2026-10-24, all 25 real-API Chrome scenarios passed against the matching
backend candidate: 22 general cases and three cases using the actual HTTPS
Draw.io embed. The six current-knowledge and four populated-history cases
passed both their focused run and the general regression run. Desktop
1600 by 1000 and narrow 390 by 844 screenshots were compared with KN-02.

All 35 controlled proposals were accepted through the normal API. The human
note retained its exact stored rich JSON, authored text, title and origin
through the applied changes. Its superseded request and late historical
statement stayed out of current membership. A newer human edit rejected the
stale proposal with `CONFLICT`; human and legacy GUI restores retained their
respective origins and independent current membership.

Direct current-item reads denied a private note's non-owner, an editor
without administrator access and an account without space membership. A live
demotion removed already-open administrator evidence on the next access poll.
The approved rule link matched the actual pinned version, and the current
25-item cohort paged as 20/five with no merged or missing entries.

The same general run repeated three 50-page navigation passes over the real
million-note database. Responses contained at most 50 rows, the rendered tree
contained at most 21 rows, and retained browser heap after 50 pages stayed
below 26 MB. Navigation p95 was 154–235 ms across those warm local runs. The
long-document and 20 MiB attachment scenarios also passed. These measurements
share a host and caches; they do not measure cold starts, ingestion, indexing,
model quality or production concurrency.

The client passed 112 tests across 21 Vitest files, the source-archive
regression test and its production build. Distribution verification retained
84 pinned upstream source entries and 234 local font assets. The source offer
includes this unit. Large editor/diagram chunks still require measurement on
target devices.

## Reproduction

Prepare the isolated backend and matching controlled fixtures first. Keep
all fixture records, authentication states, logs and screenshots under `.tmp/`.

```sh
NOTE_GUI_E2E_STORAGE_STATE=.tmp/acceptance/owner-auth.json \
NOTE_GUI_E2E_FIXTURE=.tmp/acceptance/fixtures.json \
NOTE_GUI_E2E_PIPELINE=.tmp/acceptance/pipeline.json \
NOTE_GUI_E2E_RULE=.tmp/acceptance/rule.json \
NOTE_GUI_E2E_CURRENT_FIXTURE=.tmp/acceptance/current-applied.json \
NOTE_GUI_E2E_CHANNEL=chrome \
pnpm test:browser e2e/currentKnowledge.spec.ts e2e/populated.spec.ts
```

Run these cases with the XML fallback configuration. The separately configured
graphical Draw.io suite verifies the approved HTTPS embed. Do not run suites
that change the same peer account's permissions concurrently.
