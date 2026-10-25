// @vitest-environment jsdom
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NodeViewProps } from '@tiptap/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DocmostPaneProvider } from './DocmostPaneProvider';
import { ExcalidrawPreview } from './ExcalidrawPreview';
import ExcalidrawView from '../vendor/docmost/client/features/editor/components/excalidraw/excalidraw-view';
import { loadExcalidraw, renderExcalidrawPreview } from './excalidraw';
import { useDiagramSource } from './useDiagramSource';
import { clearAccess } from '../transport';

vi.mock('./excalidraw', async importOriginal => ({
  ...await importOriginal<typeof import('./excalidraw')>(),
  loadExcalidraw: vi.fn(), renderExcalidrawPreview: vi.fn(),
}));
vi.mock('./useDiagramSource', () => ({ useDiagramSource: vi.fn() }));
vi.mock('@tiptap/react', () => ({ NodeViewWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const scene = '{"type":"excalidraw","elements":[],"appState":{},"files":{}}';
const output = { svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="20"/></svg>', empty: false, omittedExternalMedia: false };
const OriginalURL = URL;
const createUrl = vi.fn();
const revokeUrl = vi.fn();
const saveData = vi.fn();
const parseScene = vi.fn();
const canvasApi = { getSceneElements: () => [{ id: 'rectangle', version: 2 }], getAppState: () => ({}), getFiles: () => ({}) };
interface CanvasProps {
  langCode?: string; viewModeEnabled?: boolean;
  excalidrawAPI: (api: typeof canvasApi) => void;
  onChange: (elements: { version: number }[], state: object, files: object) => void;
}
function Canvas({ langCode, viewModeEnabled, excalidrawAPI, onChange }: CanvasProps) {
  useEffect(() => { excalidrawAPI(canvasApi); onChange([{ version: 1 }], {}, {}); }, [excalidrawAPI]);
  return <section aria-label="Canvas"><span>{langCode}</span>
    <input aria-label="Canvas text" readOnly={viewModeEnabled}/>
    <button type="button" disabled={viewModeEnabled} onClick={() => onChange([{ version: 2 }], {}, {})}>Change drawing</button>
  </section>;
}
beforeEach(() => {
  createUrl.mockReset().mockReturnValue('blob:authorized-preview'); revokeUrl.mockReset();
  saveData.mockReset().mockResolvedValue(true); parseScene.mockReset().mockResolvedValue({ elements: [], appState: {}, files: {} });
  vi.mocked(loadExcalidraw).mockReset().mockResolvedValue({
    Excalidraw: Canvas, loadFromBlob: parseScene, serializeAsJSON: () => 'edited scene bytes',
  } as unknown as Awaited<ReturnType<typeof loadExcalidraw>>);
  vi.mocked(renderExcalidrawPreview).mockReset().mockResolvedValue(output);
  vi.mocked(useDiagramSource).mockReturnValue({
    container: { current: null }, source: scene, loaded: true, error: '', busy: false, saveData, editable: true,
  });
  vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl; });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const props = { editor: { isDestroyed: false }, selected: false } as unknown as NodeViewProps;
function preview(value = scene) { return <DocmostPaneProvider><ExcalidrawPreview source={value} theme="light"/></DocmostPaneProvider>; }
function view() { return <DocmostPaneProvider><ExcalidrawView {...props}/></DocmostPaneProvider>; }

it('renders the stored scene as an isolated SVG image without changing or uploading its source', async () => {
  render(preview());
  const image = await screen.findByRole('img', { name: 'Excalidraw 다이어그램 미리보기' });
  expect(image.getAttribute('src')).toBe('blob:authorized-preview');
  expect(renderExcalidrawPreview).toHaveBeenCalledExactlyOnceWith(scene, 'light');
  expect(createUrl.mock.calls[0][0].type).toBe('image/svg+xml');
  expect(saveData).not.toHaveBeenCalled();
});

it('revokes an already rendered preview and removes it when access is lost', async () => {
  render(preview()); await screen.findByRole('img');
  act(() => clearAccess());
  expect(screen.queryByRole('img')).toBeNull();
  expect(revokeUrl).toHaveBeenCalledWith('blob:authorized-preview');
});

it('does not create an image URL when rendering completes after access is lost', async () => {
  let finish!: (value: typeof output) => void;
  vi.mocked(renderExcalidrawPreview).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(preview()); await screen.findByRole('status');
  act(() => clearAccess());
  await act(async () => finish(output));
  expect(screen.queryByRole('img')).toBeNull(); expect(createUrl).not.toHaveBeenCalled();
});

it('ignores a previous scene render after the attachment source changes', async () => {
  let finish!: (value: typeof output) => void;
  vi.mocked(renderExcalidrawPreview).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const rendered = render(preview());
  rendered.rerender(preview('new scene'));
  await screen.findByRole('img');
  await act(async () => finish(output));
  expect(createUrl).toHaveBeenCalledTimes(1);
  expect(renderExcalidrawPreview).toHaveBeenLastCalledWith('new scene', 'light');
});

it('distinguishes empty scenes from failures and retries the unchanged stored source', async () => {
  vi.mocked(renderExcalidrawPreview).mockRejectedValueOnce(new Error('Export failed'))
    .mockResolvedValueOnce({ svg: '', empty: true, omittedExternalMedia: false });
  render(preview());
  await screen.findByText('다이어그램 미리보기를 불러오지 못했습니다. 원본 파일은 보존됩니다.');
  fireEvent.click(screen.getByRole('button', { name: '미리보기 다시 읽기' }));
  await screen.findByText('빈 다이어그램입니다.');
  expect(renderExcalidrawPreview).toHaveBeenLastCalledWith(scene, 'light');
  expect(saveData).not.toHaveBeenCalled();
});

it('uses the GUI language and reserves Escape for canvas editing while guarding explicit exit', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(view());
  fireEvent.click(await screen.findByRole('button', { name: '드로잉 편집' }));
  await screen.findByText('ko-KR');
  fireEvent.click(screen.getByRole('button', { name: 'Change drawing' }));
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Canvas text' }), { key: 'Escape', code: 'Escape', bubbles: true });
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^나가기$/ }));
  expect(confirm).toHaveBeenCalledExactlyOnceWith('저장되지 않은 변경 사항이 있습니다. 버리시겠습니까?');
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '저장 후 나가기' }));
  await waitFor(() => expect(saveData).toHaveBeenCalledExactlyOnceWith('edited scene bytes'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('keeps an authorized read-only preview visible and disables drawing writes', async () => {
  vi.mocked(useDiagramSource).mockReturnValue({
    container: { current: null }, source: scene, loaded: true, error: '', busy: false, saveData, editable: false,
  });
  render(view()); await screen.findByRole('img');
  fireEvent.click(screen.getByRole('button', { name: '드로잉 보기' }));
  await screen.findByRole('dialog');
  expect(screen.getByRole('button', { name: '저장 후 나가기' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('textbox', { name: 'Canvas text' }).hasAttribute('readonly')).toBe(true);
  expect(saveData).not.toHaveBeenCalled();
});

it('does not reopen an editor from a parse result completed after revocation', async () => {
  let finish!: (value: { elements: never[]; appState: object; files: object }) => void;
  parseScene.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(view()); await screen.findByRole('img');
  fireEvent.click(screen.getByRole('button', { name: '드로잉 편집' }));
  await waitFor(() => expect(parseScene).toHaveBeenCalledTimes(1));
  act(() => clearAccess());
  await act(async () => finish({ elements: [], appState: {}, files: {} }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('img')).toBeNull();
});
