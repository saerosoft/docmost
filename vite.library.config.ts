import { mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import config from './vite.config';

export default mergeConfig(config, {
  base: process.env.NOTE_GUI_ASSET_BASE || '/note-gui/',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.VITE_DRAWIO_ORIGIN': JSON.stringify(process.env.NOTE_GUI_DRAWIO_ORIGIN || process.env.VITE_DRAWIO_ORIGIN || ''),
  },
  build: {
    lib: { entry: fileURLToPath(new URL('./src/index.tsx', import.meta.url)), formats: ['es'], fileName: 'note-gui', cssFileName: 'note-gui' },
    rolldownOptions: { output: { chunkFileNames: 'assets/[name]-[hash].js', assetFileNames: '[name][extname]' } },
  },
});
