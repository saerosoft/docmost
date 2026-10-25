// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { NoteApi, NoteFile, Page } from './model';
import { NoteAttachments } from './NoteAttachments';
import { clearAccess, refreshAccess } from './transport';

afterEach(cleanup);
const file = (id: string, revision = 1): NoteFile => ({
  id, fileName: `${id}.pdf`, mediaType: 'application/pdf', byteSize: 248710446,
  checksum: 'a'.repeat(64), revision, previousId: null, createdAt: '2026-10-25T04:00:00Z',
});
const page = (items: NoteFile[], nextCursor: string | null = null): Page<NoteFile> => ({ items, nextCursor });
function fixture() {
  const files = vi.fn().mockResolvedValue(page([]));
  const attachment = vi.fn();
  return { files, attachment, api: { files, attachment } as unknown as NoteApi };
}

it('lists immutable file revisions with native authorized download links and exact metadata', async () => {
  const value = fixture();
  value.files.mockResolvedValue(page([
    { ...file('old', 1), fileName: '같은 자료.pdf' },
    { ...file('current', 2), fileName: '같은 자료.pdf', previousId: 'old' },
  ]));
  render(<NoteAttachments api={value.api} noteId="note" revision={3}/>);
  const links = await screen.findAllByRole('link', { name: '같은 자료.pdf' });
  expect(links.map(link => link.getAttribute('href'))).toEqual(['/api/files/old', '/api/files/current']);
  expect(links.map(link => link.getAttribute('download'))).toEqual(['같은 자료.pdf', '같은 자료.pdf']);
  expect(screen.getByText('개정 1 · application/pdf · 248,710,446 바이트')).toBeTruthy();
  expect(screen.getByText('개정 2 · application/pdf · 248,710,446 바이트')).toBeTruthy();
  expect(value.attachment).not.toHaveBeenCalled();
});

it('replaces bounded pages and rereads the previous cursor without duplicating rows', async () => {
  const value = fixture();
  const first = Array.from({ length: 50 }, (_, index) => file(`file-${index}`));
  value.files.mockResolvedValueOnce(page(first, 'file-49'))
    .mockResolvedValueOnce(page([file('last')]))
    .mockResolvedValueOnce(page(first, 'file-49'));
  render(<NoteAttachments api={value.api} noteId="note" revision={1}/>);
  await screen.findByRole('link', { name: 'file-0.pdf' });
  expect(screen.getAllByRole('link')).toHaveLength(50);
  fireEvent.click(screen.getByRole('button', { name: '다음 첨부' }));
  await screen.findByRole('link', { name: 'last.pdf' });
  expect(value.files).toHaveBeenLastCalledWith('note', 'file-49');
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.queryByRole('link', { name: 'file-0.pdf' })).toBeNull();
  expect(screen.getByRole('button', { name: '다음 첨부' }).getAttribute('disabled')).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '이전 첨부' }));
  await screen.findByRole('link', { name: 'file-0.pdf' });
  expect(value.files).toHaveBeenLastCalledWith('note', null);
  expect(screen.getAllByRole('link')).toHaveLength(50);
  expect(screen.queryByRole('link', { name: 'last.pdf' })).toBeNull();
});

it('shows read failures, retries and accepts an authoritative empty page', async () => {
  const value = fixture();
  value.files.mockRejectedValueOnce(new Error('Attachment read failed'));
  render(<NoteAttachments api={value.api} noteId="note" revision={1}/>);
  await screen.findByText('Attachment read failed');
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '첨부 다시 읽기' }));
  await screen.findByText('현재 볼 수 있는 첨부파일이 없습니다.');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('does not display a late attachment page after switching to another note', async () => {
  const value = fixture(); let finish!: (value: Page<NoteFile>) => void;
  value.files.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(page([file('other')]));
  const view = render(<NoteAttachments api={value.api} noteId="note" revision={1}/>);
  view.rerender(<NoteAttachments api={value.api} noteId="other" revision={1}/>);
  await screen.findByRole('link', { name: 'other.pdf' });
  await act(async () => finish(page([file('private-old')])));
  expect(screen.queryByRole('link', { name: 'private-old.pdf' })).toBeNull();
  expect(value.files).toHaveBeenLastCalledWith('other', null);
});

it('removes download links on access loss and rejects a late pending page', async () => {
  const value = fixture(); let finish!: (value: Page<NoteFile>) => void;
  value.files.mockResolvedValueOnce(page([file('private')], 'private'))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<NoteAttachments api={value.api} noteId="note" revision={1}/>);
  await screen.findByRole('link', { name: 'private.pdf' });
  fireEvent.click(screen.getByRole('button', { name: '다음 첨부' }));
  await waitFor(() => expect(value.files).toHaveBeenCalledTimes(2));
  act(() => clearAccess());
  await screen.findByText('접근 권한이 변경되었습니다. 노트를 다시 열어 주세요.');
  await act(async () => finish(page([file('late-private')])));
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByRole('button', { name: '첨부 다시 읽기' })).toBeNull();
  expect(screen.getByRole('button', { name: '첨부 새로고침' }).getAttribute('disabled')).toBe('');
});

it('clears the previous access projection and cursor before refreshing authorization', async () => {
  const value = fixture(); let finish!: (value: Page<NoteFile>) => void;
  value.files.mockResolvedValueOnce(page([file('first')], 'first'))
    .mockResolvedValueOnce(page([file('second')]))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<NoteAttachments api={value.api} noteId="note" revision={1}/>);
  await screen.findByRole('link', { name: 'first.pdf' });
  fireEvent.click(screen.getByRole('button', { name: '다음 첨부' }));
  await screen.findByRole('link', { name: 'second.pdf' });
  await act(async () => { await refreshAccess(); });
  expect(screen.queryByRole('link')).toBeNull();
  await waitFor(() => expect(value.files).toHaveBeenLastCalledWith('note', null));
  await act(async () => finish(page([])));
  await screen.findByText('현재 볼 수 있는 첨부파일이 없습니다.');
  expect(screen.getByRole('button', { name: '이전 첨부' }).getAttribute('disabled')).toBe('');
});

it('starts from the first page after a saved note revision changes', async () => {
  const value = fixture();
  value.files.mockResolvedValueOnce(page([file('first')], 'first'))
    .mockResolvedValueOnce(page([file('second')]))
    .mockResolvedValueOnce(page([file('new-upload')]));
  const view = render(<NoteAttachments api={value.api} noteId="note" revision={1}/>);
  await screen.findByRole('link', { name: 'first.pdf' });
  fireEvent.click(screen.getByRole('button', { name: '다음 첨부' }));
  await screen.findByRole('link', { name: 'second.pdf' });
  view.rerender(<NoteAttachments api={value.api} noteId="note" revision={2}/>);
  await screen.findByRole('link', { name: 'new-upload.pdf' });
  expect(screen.queryByRole('link', { name: 'second.pdf' })).toBeNull();
  expect(value.files).toHaveBeenLastCalledWith('note', null);
  expect(screen.getByRole('button', { name: '이전 첨부' }).getAttribute('disabled')).toBe('');
});
