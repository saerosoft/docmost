import { cp, rm } from 'node:fs/promises';
await cp('.tmp/types', 'dist/types', { recursive: true });
await rm('.tmp/types', { recursive: true });
