from pathlib import Path
import hashlib
import json
import os
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / 'public' / 'source'
output.mkdir(parents=True, exist_ok=True)
archive = output / 'note-gui-source.zip'
excluded = {'node_modules', 'dist', '.git', '.tmp', '.vite', 'coverage', 'source'}
sources = []
for directory, children, names in os.walk(root):
    children[:] = sorted(name for name in children if name not in excluded)
    for name in sorted(names):
        path = Path(directory) / name
        if not name.startswith('.env') and not name.endswith('.log'):
            sources.append(path)
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for path in sources:
        bundle.write(path, 'note-gui/' + path.relative_to(root).as_posix())
    dependencies = root / 'node_modules' / '.pnpm'
    if dependencies.exists():
        for directory, children, names in os.walk(dependencies, followlinks=False):
            children[:] = sorted(name for name in children
                                 if not (Path(directory) / name).is_symlink()
                                 and not (Path(directory) / name).is_junction())
            for name in sorted(names):
                path = Path(directory) / name
                if path.is_file() and name.lower().startswith(('license', 'licence', 'notice', 'copying')):
                    bundle.write(path, 'dependency-notices/' + path.relative_to(dependencies).as_posix())
for name in ['LICENSE', 'NOTICE', 'upstream-manifest.json']:
    shutil.copyfile(root / name, output / name)
(output / 'archive.json').write_text(json.dumps({
    'archive': archive.name,
    'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'sourceFiles': len(sources),
    'lockfileIncluded': (root / 'pnpm-lock.yaml').is_file(),
}, indent=2) + '\n', encoding='utf-8')
