// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../api';
import { AttachmentContext } from '../editor/attachmentContext';
import { clearAccess } from '../transport';
import { useAuthorizedFile } from './useAuthorizedFile';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('revokes a displayed core file object URL immediately when access is lost', async () => {
  const create = vi.fn(() => 'blob:protected-file'); const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  const client = { ...api, attachment: vi.fn().mockResolvedValue(new Blob(['private'])) };
  const value = renderHook(() => useAuthorizedFile('file'), { wrapper: ({ children }) => <AttachmentContext.Provider value={{ api: client, noteId: 'note', editable: true }}>{children}</AttachmentContext.Provider> });
  await waitFor(() => expect(value.result.current.url).toBe('blob:protected-file'));
  act(() => clearAccess());
  expect(value.result.current.url).toBeUndefined(); expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:protected-file');
});

it('does not create an object URL for a core file read completed after access loss', async () => {
  const create = vi.fn(() => 'blob:late-private-file');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  let complete!: (blob: Blob) => void;
  const client = { ...api, attachment: vi.fn(() => new Promise<Blob>(resolve => { complete = resolve; })) };
  const value = renderHook(() => useAuthorizedFile('file'), { wrapper: ({ children }) => <AttachmentContext.Provider value={{ api: client, noteId: 'note', editable: true }}>{children}</AttachmentContext.Provider> });
  await waitFor(() => expect(client.attachment).toHaveBeenCalledTimes(1));
  act(() => clearAccess()); await act(async () => { complete(new Blob(['private'])); });
  expect(value.result.current.url).toBeUndefined(); expect(create).not.toHaveBeenCalled();
});
