# Self-hosted Draw.io acceptance

On 2026-10-24, the real-API Chrome suite initially passed both write/revocation scenarios in
`e2e/drawio.spec.ts` against an isolated API, account sessions and storage.
The graphical editor was the official Draw.io v32.6.1 static web application,
commit `84487b4891cbc0f32d7e30f34cf878c87cb1f414`, served over HTTPS on
`localhost:9093`. The browser trusted only that local certificate's SPKI pin.
This does not configure a production embed origin or establish its capacity.

The first scenario opened an authorized XML attachment in the actual iframe,
edited a shape's text using the graphical editor, saved an attachment revision
and then saved the note. It reloaded and repeated the graphical edit, then
verified the final stored attachment through the API. The original attachment
bytes were unchanged. Requests during the scenario stayed on loopback hosts.

Messages with an unapproved origin or the wrong window did not change the
source or save a file. The receiver requires both the configured HTTPS origin
and the current iframe window. Only the real graphical editor's messages
provided the successful save path. The iframe requests `stealth=1`, `pwa=0`
and `plugins=0` to disable external service features, service-worker setup and
plugins in the embedded editor. `drafts=0` disables persistent diagram drafts;
the browser test checked local storage for diagram text and found no stored
diagram records in IndexedDB; the only initialized records were an empty
scratchpad and its metadata. These are the upstream
[supported URL parameters](https://www.drawio.com/docs/reference/supported-url-parameters/).

A simultaneous XML draft could previously be overwritten by the iframe's
next autosave. A regression test reproduced that competing-editor problem.
With an embed configured, the XML view now follows the graphical editor and
is read-only. Without an embed, direct XML editing remains available.

The second scenario promoted a separate account to space owner, opened an
administrator-only diagram and edited it without saving. After demotion to
editor, the next actual access poll removed the iframe, XML, note and draft.
A direct download of the former attachment was denied. This verifies the
application's periodic revocation handling; it is not an instantaneous push
notification or a guarantee that previously downloaded bytes can be recalled.

The later viewer scenario opened a shared diagram with `chrome=0`, the
upstream's graphical read-only viewer. Double-clicking its text did not open
an editor, and no embedded Save action was present. The XML and application
save control were read-only. The API allowed the original download and denied
a new attachment upload from that account.

Run against a prepared, isolated real-API fixture and approved embed:

```sh
VITE_DRAWIO_ORIGIN=https://localhost:9093 pnpm dev
NOTE_GUI_E2E_FIXTURE=.tmp/acceptance/fixtures.json \
NOTE_GUI_E2E_DRAWIO_ORIGIN=https://localhost:9093 \
NOTE_GUI_E2E_CHANNEL=chrome pnpm test:browser e2e/drawio.spec.ts
```

For a local test certificate, `NOTE_GUI_E2E_DRAWIO_SPKI` accepts that specific
certificate's SPKI hash. No global certificate-error bypass is used. Keep
certificates, private keys, fixture sessions and screenshots under `.tmp/`.
