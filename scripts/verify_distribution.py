from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
source = dist / 'source'
metadata = json.loads((source / 'archive.json').read_text(encoding='utf-8'))
archive = source / metadata['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == metadata['sha256'], 'Source archive checksum differs'
manifest = json.loads((root / 'upstream-manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(archive) as bundle:
    names = bundle.namelist()
    assert len(names) == len(set(names)), 'Duplicate source archive entries'
    assert all(not name.startswith('/') and '..' not in Path(name).parts for name in names), 'Unsafe source archive path'
    assert not any('/.tmp/' in name or any(part.startswith('.env') for part in Path(name).parts) for name in names), 'Temporary or environment files included in source archive'
    assert not any('/ee/' in name or '/apps/server/' in name or '/frontend/' in name or '/node_modules/' in name and name.startswith('note-gui/') for name in names), 'Unrelated application or upstream persistence source included'
    required = ['LICENSE', 'NOTICE', 'README.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'upstream-manifest.json']
    required += [item['destination'] for item in manifest['files']]
    required += [path.relative_to(root).as_posix() for directory in ['patches', 'third-party'] for path in (root / directory).rglob('*') if path.is_file()]
    for name in required:
        assert bundle.read('note-gui/' + name) == (root / name).read_bytes(), f'Source archive is missing current source: {name}'
    assert any(name.startswith('dependency-notices/') for name in names), 'Installed dependency notices missing'

font_root = root / 'node_modules' / '@excalidraw' / 'excalidraw' / 'dist' / 'prod' / 'fonts'
fonts = [path for path in font_root.rglob('*') if path.is_file()]
assert fonts, 'Pinned SDK font assets missing'
for font in fonts:
    target = dist / 'excalidraw' / 'fonts' / font.relative_to(font_root)
    assert target.read_bytes() == font.read_bytes(), f'Local SDK font differs: {target.name}'

runtime = list((dist / 'assets').glob('*.js'))
assert runtime, 'Runtime JavaScript missing'
assert not any(b'ASSETS_FALLBACK_URL' in path.read_bytes() or b'https://esm.sh/' in path.read_bytes() for path in runtime), 'SDK font CDN fallback remains in runtime JavaScript'
map_sources = set()
for path in (dist / 'assets').glob('*.js.map'):
    data = json.loads(path.read_text(encoding='utf-8'))
    map_sources.update(item.replace('\\', '/') for item in data.get('sources', []))
for name in ['pages/page/page.tsx', 'features/editor/full-editor.tsx', 'features/editor/page-editor.tsx', 'features/page/tree/components/doc-tree.tsx', 'features/comment/components/comment-list-with-tabs.tsx', 'features/page-history/components/history-editor.tsx', 'features/editor/components/drawio/drawio-view.tsx', 'features/editor/components/excalidraw/excalidraw-view.tsx', 'features/editor/components/code-block/mermaid-view.tsx']:
    assert any(item.endswith('/vendor/docmost/client/' + name) for item in map_sources), f'Core UI is absent from the built runtime: {name}'
assert not any('/src/ee/' in name or '/apps/server/' in name or '/frontend/apps/' in name for name in map_sources), 'Excluded upstream or private source bundled'
print(f'Distribution verified: {len(manifest["files"])} pinned sources, {len(fonts)} local font assets, current source offer and runtime core closure')
