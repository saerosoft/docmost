# Retained third-party notices

Docmost core and this modified client are covered by the root `LICENSE` and
`NOTICE`. The release source archive also includes notices found in installed
packages. This directory supplies the notices omitted by published bundles and
notices for source copied through Docmost.

- `Excalidraw-LICENSE.txt`: MIT, from Excalidraw commit
  `3a5ef4020d7515f34c96d179b631911bb8ef8a9f`, the SDK's pinned source version.
  `patches/` removes the SDK's automatic CDN font fallback in both development
  and production builds. Font files and glyphs are unchanged.
- `Excalifont-font-metadata.txt`, `ComicShanns-font-metadata.txt` and
  `Xiaolai-font-metadata.txt`: original copyright and license metadata from
  that same Excalidraw commit's `packages/excalidraw/fonts/*/index.ts`.
- `Excalifont-OFL.txt`, `Xiaolai-OFL.txt`: SIL Open Font License 1.1 text from
  [Xiaolai commit b54a518](https://github.com/lxgw/kose-font/blob/b54a518fcd4be4db6b25fd19871e8b1a26250e9e/License.txt).
  Font-specific copyrights remain in the matching metadata notices.
  Comic Shanns' metadata contains its full MIT notice.
- `Virgil-LICENSE.txt`: from
  [Virgil commit 3d4c829](https://github.com/excalidraw/virgil/blob/3d4c829dc85b455d4646631ac52bc1517df04217/LICENSE.md).
- `Assistant-OFL.txt`, `Nunito-OFL.txt`, `LilitaOne-OFL.txt`: the respective
  [Google Fonts](https://github.com/google/fonts/tree/main/ofl) license files.
- `Cascadia-LICENSE.txt`: [Microsoft Cascadia Code](https://github.com/microsoft/cascadia-code/blob/main/LICENSE).
- `Liberation-LICENSE.txt`: [Liberation Fonts](https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE).
- `RecreateTransform-LICENSE.txt` and `RecreateTransform-NOTICE.txt`: full
  Apache-2.0 license and Atypon notice from
  [prosemirror-recreate-transform](https://github.com/sueddeutsche/prosemirror-recreate-transform).
  Docmost's retained index links to this source with an MIT label; the actual
  upstream license and notice are preserved here rather than relying on that
  label. Our source changes are listed in `upstream-manifest.json`.

The font notices were retrieved on 2026-10-23. The packaged font bytes come
from the lockfile's pinned Excalidraw SDK, not from the live font repositories.
