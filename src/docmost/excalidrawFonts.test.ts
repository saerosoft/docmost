// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { loadExcalidraw } from './excalidraw';

afterEach(() => { vi.unstubAllGlobals(); });

it('gives the actual SDK only local font sources even when a local font is unavailable', async () => {
  const sources: string[] = [];
  class FontFixture {
    family: string;
    status = 'loaded';
    unicodeRange = 'U+0-10FFFF';
    constructor(family: string, source: string, descriptors?: FontFaceDescriptors) {
      this.family = family; this.unicodeRange = descriptors?.unicodeRange || this.unicodeRange; sources.push(source);
    }
    load() { return Promise.resolve(this); }
  }
  vi.stubGlobal('FontFace', FontFixture);
  const fonts = new Set();
  Object.defineProperty(document, 'fonts', { configurable: true, value: Object.assign(fonts, { check: () => true, load: () => Promise.resolve([]), ready: Promise.resolve() }) });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({
    font: '', measureText: (text: string) => ({ width: text.length * 10, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }),
  }) });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  const fetch = vi.fn().mockRejectedValue(new TypeError('Local font unavailable'));
  vi.stubGlobal('fetch', fetch);
  const sdk = await loadExcalidraw();
  const elements = sdk.convertToExcalidrawElements([{ type: 'text', text: 'Local font test', x: 0, y: 0, fontFamily: 1 }]);
  await sdk.exportToSvg({ elements, appState: { exportEmbedScene: true }, files: {} });
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.filter(source => /https:\/\/(?:esm\.sh|unpkg\.com|cdn\.)/.test(source))).toEqual([]);
  expect(fetch.mock.calls.map(call => String(call[0])).filter(url => /^https?:/.test(url) && !url.startsWith(window.location.origin))).toEqual([]);
}, 15_000);

it('reopens and serializes complete Excalidraw scenes with embedded image files and persistent canvas state', async () => {
  const sdk = await loadExcalidraw();
  const [rectangle] = sdk.convertToExcalidrawElements([{ type: 'rectangle', x: 1, y: 2, width: 100, height: 40 }]);
  const image = { ...rectangle, id: 'image-node', type: 'image', fileId: 'embedded-image', scale: [1, 1], status: 'saved' };
  const original = {
    type: 'excalidraw', version: 2, elements: [rectangle, image],
    appState: { viewBackgroundColor: '#eefabc', gridSize: 20 },
    files: { 'embedded-image': { id: 'embedded-image', mimeType: 'image/png', dataURL: 'data:image/png;base64,aGVsbG8=', created: 1 } },
  };
  const source = JSON.stringify(original);
  const scene = await sdk.loadFromBlob(Object.assign(new Blob([source], { type: 'application/json' }), { text: async () => source }), null, null);
  const saved = JSON.parse(sdk.serializeAsJSON(scene.elements || [], scene.appState || {}, scene.files || {}, 'local'));
  expect(saved.elements).toHaveLength(2);
  expect(saved.elements[1]).toMatchObject({ type: 'image', fileId: 'embedded-image' });
  expect(saved.files['embedded-image'].dataURL).toBe(original.files['embedded-image'].dataURL);
  expect(saved.appState.viewBackgroundColor).toBe('#eefabc');
});
