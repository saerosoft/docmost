// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note, NoteApi, PropertyValue } from './model';
import { NoteProperties } from './NoteProperties';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function fixture() {
  const note: Note = { id: 'note', spaceId: 'space', title: 'Title', revision: 4, bodyOrigin: 'HUMAN', bodyJson: { type: 'doc', content: [{ type: 'paragraph' }] }, visibility: 'PRIVATE', parentId: null, canEdit: true };
  const property: PropertyValue = { id: 'property', key: 'Owner', valueType: 'TEXT', value: 'Alice' };
  const properties = vi.fn().mockResolvedValue([property]);
  const deleteProperty = vi.fn().mockResolvedValue(undefined);
  const api = { properties, deleteProperty, note: vi.fn().mockResolvedValue({ ...note, revision: 5 }), setProperties: vi.fn() } as unknown as NoteApi;
  const onRevision = vi.fn();
  return { note, properties, deleteProperty, api, onRevision };
}
function show(value: ReturnType<typeof fixture>, dirty = false) {
  return render(<MantineProvider><NoteProperties api={value.api} note={value.note} dirty={dirty} onRevision={value.onRevision}/></MantineProvider>);
}
it('confirms deletion, sends the saved property identity and reloads the note revision', async () => {
  const value = fixture(); show(value);
  fireEvent.click(await screen.findByRole('button', { name: 'Owner 속성 삭제' }));
  expect(value.deleteProperty).not.toHaveBeenCalled();
  value.properties.mockResolvedValue([]);
  fireEvent.click(await screen.findByRole('button', { name: '삭제 확인' }));
  await screen.findByText('아직 속성이 없습니다.');
  expect(value.deleteProperty).toHaveBeenCalledExactlyOnceWith('note', 'property', 4);
  expect(value.onRevision).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 }));
});
it('retains the property when deletion is refused', async () => {
  const value = fixture(); value.deleteProperty.mockRejectedValue(new Error('개정이 변경되었습니다.')); show(value);
  fireEvent.click(await screen.findByRole('button', { name: 'Owner 속성 삭제' }));
  fireEvent.click(await screen.findByRole('button', { name: '삭제 확인' }));
  await screen.findByText('개정이 변경되었습니다.');
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  const propertyName = await screen.findByRole('textbox', { name: '속성 이름' });
  expect((propertyName as HTMLInputElement).value).toBe('Owner');
  expect(value.onRevision).not.toHaveBeenCalled();
});
it('does not repeat an accepted delete when reloading fails', async () => {
  const value = fixture(); show(value);
  fireEvent.click(await screen.findByRole('button', { name: 'Owner 속성 삭제' }));
  value.properties.mockRejectedValueOnce(new Error('다시 읽기 실패')).mockResolvedValue([]);
  fireEvent.click(await screen.findByRole('button', { name: '삭제 확인' }));
  await screen.findByText('다시 읽기 실패');
  fireEvent.click(await screen.findByRole('button', { name: '속성 새로고침' }));
  await screen.findByText('아직 속성이 없습니다.');
  expect(value.deleteProperty).toHaveBeenCalledTimes(1);
});
it('disables property changes while the note body is dirty', async () => {
  const value = fixture(); show(value, true);
  const button = await screen.findByRole('button', { name: 'Owner 속성 삭제' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
  expect(value.deleteProperty).not.toHaveBeenCalled();
});
