import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

const apiOrigin = process.env.NOTE_GUI_API_ORIGIN || 'http://127.0.0.1:9086';
const apiUrl = new URL(apiOrigin);
if (!['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.origin !== apiOrigin) throw new Error('NOTE_GUI_API_ORIGIN must be an HTTP(S) origin without credentials, a path or query.');

function excalidrawFonts(): Plugin {
  const fonts = fileURLToPath(new URL('./node_modules/@excalidraw/excalidraw/dist/prod/fonts', import.meta.url));
  return { name: 'pinned-excalidraw-fonts', apply: 'build', async generateBundle() {
    const emit = async (directory: string) => {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, item.name);
        if (item.isDirectory()) await emit(path);
        else if (item.isFile()) this.emitFile({ type: 'asset', fileName: `excalidraw/fonts/${relative(fonts, path).split('\\').join('/')}`, source: await readFile(path) });
      }
    };
    await emit(fonts);
  } };
}

export default defineConfig({
  plugins: [react(), excalidrawFonts()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src/vendor/docmost/client', import.meta.url)), '@knowledge': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1', port: 9090, strictPort: true,
    watch: { ignored: ['**/.tmp/**', '**/public/source/**'] },
    proxy: { '/graphql': apiOrigin, '/api': apiOrigin },
  },
  build: { sourcemap: true },
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: ['./src/test/browserLayout.ts'],
    server: { deps: { inline: [/@excalidraw\//, /roughjs/] } },
  },
});
