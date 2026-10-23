export function loadExcalidraw() {
  window.EXCALIDRAW_ASSET_PATH = import.meta.env.DEV ? '/node_modules/@excalidraw/excalidraw/dist/prod/' : '/excalidraw/';
  return import('@excalidraw/excalidraw');
}
