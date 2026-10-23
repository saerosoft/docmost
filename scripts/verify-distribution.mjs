import { spawnSync } from 'node:child_process';
const configured = process.env.PYTHON;
const executable = configured || (process.platform === 'win32' ? 'py' : 'python3');
const args = [...(!configured && process.platform === 'win32' ? ['-3'] : []), 'scripts/verify_distribution.py'];
const result = spawnSync(executable, args, { stdio: 'inherit' });
if (result.error) console.error('Python 3 is required to inspect the note-GUI distribution. Set PYTHON to its executable.');
process.exit(result.status ?? 1);
