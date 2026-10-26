from pathlib import Path
import os
import runpy
import shutil
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile


class SourceOfferTest(unittest.TestCase):
    def setUp(self):
        root = Path(__file__).resolve().parents[1]
        temporary = root / '.tmp'
        temporary.mkdir(exist_ok=True)
        workspace = tempfile.TemporaryDirectory(dir=temporary)
        self.addCleanup(workspace.cleanup)
        self.workspace = Path(workspace.name)
        self.client = self.workspace / 'client'
        (self.client / 'scripts').mkdir(parents=True)
        shutil.copyfile(root / 'scripts' / 'source_offer.py', self.client / 'scripts' / 'source_offer.py')
        for name in ['LICENSE', 'NOTICE', 'README.md', 'upstream-manifest.json', 'package.json', 'pnpm-lock.yaml']:
            shutil.copyfile(root / name, self.client / name)
        (self.client / 'src').mkdir()
        shutil.copyfile(root / 'src' / 'main.tsx', self.client / 'src' / 'main.tsx')
        dependency = self.client / 'node_modules' / '.pnpm' / 'test-dependency'
        dependency.mkdir(parents=True)
        (dependency / 'LICENSE').write_text('Test dependency notice')
        (dependency / 'index.js').write_text('export {};')

    def run_source_offer(self, without_junction_api=False):
        if without_junction_api:
            # Exercise the Python 3.11 pathlib interface even on newer runtimes.
            command = [sys.executable, '-c', (
                "import pathlib, runpy\n"
                "if 'is_junction' in vars(pathlib.Path):\n"
                "    delattr(pathlib.Path, 'is_junction')\n"
                "runpy.run_path('scripts/source_offer.py', run_name='__main__')\n"
            )]
        else:
            command = [sys.executable, 'scripts/source_offer.py']
        subprocess.run(command, cwd=self.client, check=True)

    def test_archive_keeps_client_and_notices_without_temporary_or_environment_files(self):
        (self.client / '.tmp').mkdir()
        (self.client / '.tmp' / 'private-snapshot.txt').write_text('Temporary content')
        (self.client / '.env.local').write_text('TEST_SECRET=private')
        (self.client / '.serena').mkdir()
        (self.client / '.serena' / 'project.local.yml').write_text('Local analysis configuration')
        for without_junction_api in (False, True):
            with self.subTest(without_junction_api=without_junction_api):
                self.run_source_offer(without_junction_api)
                with zipfile.ZipFile(self.client / 'public' / 'source' / 'note-gui-source.zip') as archive:
                    names = archive.namelist()
                    self.assertIn('note-gui/src/main.tsx', names)
                    self.assertIn('dependency-notices/test-dependency/LICENSE', names)
                    self.assertFalse(any('/.tmp/' in name or '/.env' in name or '/.serena/' in name for name in names), names)
                    self.assertFalse(any(name.startswith('note-gui/node_modules/') for name in names), names)

    def test_dependency_notice_scan_does_not_follow_linked_directories(self):
        outside = self.workspace / 'outside'
        outside.mkdir()
        (outside / 'LICENSE').write_text('Outside dependency tree')
        link = self.client / 'node_modules' / '.pnpm' / 'outside-link'
        if os.name == 'nt':
            subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(outside)],
                           check=True, capture_output=True)
        else:
            link.symlink_to(outside, target_is_directory=True)
        for without_junction_api in (False, True):
            with self.subTest(without_junction_api=without_junction_api):
                self.run_source_offer(without_junction_api)
                with zipfile.ZipFile(self.client / 'public' / 'source' / 'note-gui-source.zip') as archive:
                    names = archive.namelist()
                    self.assertIn('dependency-notices/test-dependency/LICENSE', names)
                    self.assertFalse(any('/outside-link/' in name for name in names), names)

    def test_windows_fallback_excludes_reparse_points_without_junction_api(self):
        namespace = runpy.run_path(str(self.client / 'scripts' / 'source_offer.py'))
        is_link_directory = namespace['is_link_directory']
        with patch.dict(is_link_directory.__globals__, {'os': SimpleNamespace(name='nt')}):
            for attributes, excluded in ((0, False), (stat.FILE_ATTRIBUTE_REPARSE_POINT, True)):
                with self.subTest(attributes=attributes):
                    path = SimpleNamespace(is_symlink=lambda: False, lstat=lambda: SimpleNamespace(
                        st_file_attributes=attributes))
                    self.assertEqual(is_link_directory(path), excluded)
            # Native Path.is_junction remains authoritative when available.
            self.assertTrue(is_link_directory(SimpleNamespace(
                is_symlink=lambda: False, is_junction=lambda: True)))


if __name__ == '__main__':
    unittest.main()
