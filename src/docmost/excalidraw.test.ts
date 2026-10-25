// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { renderExcalidrawPreview } from './excalidraw';
const sdk = vi.hoisted(() => ({ loadFromBlob: vi.fn(), exportToSvg: vi.fn(), languages: [] as { code: string; label: string }[] }));
vi.mock('@excalidraw/excalidraw', () => sdk);
const source = '{"type":"excalidraw","version":2,"elements":[],"appState":{},"files":{}}';
const svg = (body: string) => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, 'image/svg+xml').documentElement;
const element = { id: 'rectangle', type: 'rectangle', isDeleted: false, version: 1 };
beforeEach(() => {
  sdk.loadFromBlob.mockReset().mockResolvedValue({ elements: [element], appState: { viewBackgroundColor: '#ffffff' }, files: {} });
  sdk.exportToSvg.mockReset().mockResolvedValue(svg('<rect width="100" height="50"/><text x="10" y="20">Stored drawing</text><script>alert(1)</script><foreignObject><div>Unsafe HTML</div></foreignObject>'));
});
async function text(blob: Blob) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(blob); });
}

it('sanitizes the actual SVG export and preserves local font inlining and the original scene bytes', async () => {
  const result = await renderExcalidrawPreview(source, 'dark');
  expect(await text(sdk.loadFromBlob.mock.calls[0][0])).toBe(source);
  expect(result.svg).toContain('<rect'); expect(result.svg).toContain('Stored drawing');
  expect(result.svg).not.toContain('<script'); expect(result.svg).not.toContain('foreignObject');
  expect(sdk.exportToSvg).toHaveBeenCalledWith(expect.objectContaining({
    elements: [element], renderEmbeddables: false,
    appState: expect.objectContaining({ exportWithDarkMode: true, exportEmbedScene: false }),
  }));
  expect(sdk.exportToSvg.mock.calls[0][0].skipInliningFonts).toBeUndefined();
  expect(result.empty).toBe(false);
});

it('retains local SVG and raster image data while excluding remote media from export', async () => {
  const localSvg = { dataURL: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E', mimeType: 'image/svg+xml' };
  const localPng = { dataURL: 'data:image/png;base64,iVBORw0KGgo=', mimeType: 'image/png' };
  const remote = { dataURL: 'https://outside.invalid/private.png', mimeType: 'image/png' };
  const files = { localSvg, localPng, remote };
  sdk.loadFromBlob.mockResolvedValueOnce({ elements: [element], appState: {}, files });
  const result = await renderExcalidrawPreview(source, 'light');
  expect(sdk.exportToSvg.mock.calls[0][0].files).toEqual({ localSvg, localPng });
  expect(files.remote).toBe(remote);
  expect(result.omittedExternalMedia).toBe(true);
});

it('reports an empty scene without trying to export deleted elements', async () => {
  sdk.loadFromBlob.mockResolvedValueOnce({ elements: [{ ...element, isDeleted: true }], appState: {}, files: {} });
  expect(await renderExcalidrawPreview(source, 'light')).toEqual({ svg: '', empty: true, omittedExternalMedia: false });
  expect(sdk.exportToSvg).not.toHaveBeenCalled();
});
