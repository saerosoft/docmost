from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


class SourceOfferTest(unittest.TestCase):
    def test_archive_keeps_client_and_notices_without_temporary_or_environment_files(self):
        root = Path(__file__).resolve().parents[1]
        temporary = root / '.tmp'
        temporary.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temporary) as directory:
            client = Path(directory)
            (client / 'scripts').mkdir()
            shutil.copyfile(root / 'scripts' / 'source_offer.py', client / 'scripts' / 'source_offer.py')
            for name in ['LICENSE', 'NOTICE', 'README.md', 'upstream-manifest.json', 'package.json', 'pnpm-lock.yaml']:
                shutil.copyfile(root / name, client / name)
            (client / 'src').mkdir()
            shutil.copyfile(root / 'src' / 'main.tsx', client / 'src' / 'main.tsx')
            (client / '.tmp').mkdir()
            (client / '.tmp' / 'private-snapshot.txt').write_text('Temporary content')
            (client / '.env.local').write_text('TEST_SECRET=private')
            dependency = client / 'node_modules' / '.pnpm' / 'test-dependency'
            dependency.mkdir(parents=True)
            (dependency / 'LICENSE').write_text('Test dependency notice')
            (dependency / 'index.js').write_text('export {};')
            subprocess.run([sys.executable, 'scripts/source_offer.py'], cwd=client, check=True)
            with zipfile.ZipFile(client / 'public' / 'source' / 'note-gui-source.zip') as archive:
                names = archive.namelist()
                self.assertIn('note-gui/src/main.tsx', names)
                self.assertIn('dependency-notices/test-dependency/LICENSE', names)
                self.assertFalse(any('/.tmp/' in name or '/.env' in name for name in names), names)
                self.assertFalse(any(name.startswith('note-gui/node_modules/') for name in names), names)


if __name__ == '__main__':
    unittest.main()
