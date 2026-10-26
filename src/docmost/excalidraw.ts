import DOMPurify from 'dompurify';
import type { NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export function excalidrawLanguageCode(language: string) {
  return /^ko(?:-|$)/i.test(language) ? 'ko-KR' : language;
}

export async function loadExcalidraw() {
  window.EXCALIDRAW_ASSET_PATH = `${import.meta.env.BASE_URL}${import.meta.env.DEV ? 'node_modules/@excalidraw/excalidraw/dist/prod/' : 'excalidraw/'}`;
  const sdk = await import('@excalidraw/excalidraw');
  // This pinned SDK bundles Korean but omits it from its selectable list because
  // the translation is below its completion threshold. Enable only our bundled
  // GUI locale; the SDK retains English fallback for untranslated strings.
  if (!sdk.languages.some(language => language.code === 'ko-KR')) {
    sdk.languages.push({ code: 'ko-KR', label: '한국어' });
  }
  return sdk;
}

export async function renderExcalidrawPreview(source: string, theme: 'light' | 'dark') {
  const { loadFromBlob, exportToSvg } = await loadExcalidraw();
  const scene = await loadFromBlob(new Blob([source], { type: 'application/json' }), null, null);
  const elements = scene.elements.filter((element): element is typeof element & NonDeletedExcalidrawElement => !element.isDeleted);
  const files = Object.fromEntries(Object.entries(scene.files).filter(([, file]) => /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(file.dataURL)));
  const omittedExternalMedia = Object.keys(files).length !== Object.keys(scene.files).length || elements.some(element => element.type === 'embeddable');
  if (!elements.length) return { svg: '', empty: true, omittedExternalMedia };
  const svg = await exportToSvg({
    elements, files, appState: { ...scene.appState, exportBackground: true, exportWithDarkMode: theme === 'dark', exportEmbedScene: false },
    renderEmbeddables: false,
  });
  return {
    svg: DOMPurify.sanitize(svg.outerHTML, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['foreignObject', 'script', 'iframe'],
    }),
    empty: false, omittedExternalMedia,
  };
}
