# Populated note-context acceptance

On 2026-10-24, both scenarios in `e2e/populated.spec.ts` passed against the
isolated Knowledge Engine API and three account sessions. The database held
31 applied changes: 25 on a shared note and three each on private and
administrator notes. The original text and pending proposals were controlled
test inputs persisted in the isolated database. The actual `decideChangeSet`
API accepted them and produced notes, revisions, evidence and outbox records.
No browser network response was mocked and no model execution was claimed.

The shared history paged as 20 and five records. Opening the replacement
record showed the former proposed November 2 date in the actual prior
revision and the confirmed November 9 date in the actual resulting revision.
The displayed quote matched the original source revision returned by the API.
Original occurrence, effective time and application time were shown separately.
The same populated layout fit a 390 by 844 pixel viewport without horizontal
page overflow.

Owner-private and administrator evidence carried their respective visibility
labels. Another account could not read their accumulation list, comparison or
source revision through direct API requests. After that account was promoted,
it opened an administrator comparison; demotion removed both the note context
and expanded comparison on the next access poll.

An additional real-API scenario verified a populated applied-rule link. A
test-only ruleset was created with four required cases, validated without an
available model, manually reviewed through the supported API, approved and
activated in the isolated database. A controlled proposal pinned that exact
version and was applied through `decideChangeSet`. The GUI's rule name, version
number and destination IDs matched the actual approved version returned by
the API. This checks provenance and approval plumbing, not model quality or
production rule readiness; no provider execution profile was invented.

These are change-history and authorization results. They do not establish
that the old history list is a view of currently valid knowledge. KN-02's
separate current-knowledge contract is being implemented in the owning
Knowledge Engine backend.

```sh
NOTE_GUI_E2E_FIXTURE=.tmp/acceptance/fixtures.json \
NOTE_GUI_E2E_PIPELINE=.tmp/acceptance/pipeline.json \
NOTE_GUI_E2E_RULE=.tmp/acceptance/rule.json \
NOTE_GUI_E2E_CHANNEL=chrome pnpm test:browser e2e/populated.spec.ts
```

Keep fixture IDs and account sessions under `.tmp/`. The suite reads existing
applied records and changes only the peer's temporary role, restoring it in
cleanup. It does not reset the database or invoke an LLM.
