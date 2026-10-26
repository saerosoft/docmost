import { expect, it } from 'vitest';
import { TreeCache } from './treeCache';

it('bounds cached tree pages and evicts the least recently viewed page', () => {
  const cache = new TreeCache(2);
  cache.set('one', { items: [], nextCursor: 'next' });
  cache.set('two', { items: [], nextCursor: null });
  cache.get('one'); cache.set('three', { items: [], nextCursor: null });
  expect(cache.size).toBe(2);
  expect(cache.get('two')).toBeUndefined();
  expect(cache.get('one')?.nextCursor).toBe('next');
  cache.clear(); expect(cache.size).toBe(0);
});

it('keeps the current root page inside the same bounded cache as expanded children', () => {
  const cache = new TreeCache(3);
  const root = { items: [], nextCursor: null };
  cache.set('root', root);
  cache.set('first-child', { items: [], nextCursor: 'next' }, 'root');
  cache.set('second-child', { items: [], nextCursor: null }, 'root');
  cache.set('third-child', { items: [], nextCursor: null }, 'root');
  expect(cache.size).toBe(3);
  expect(cache.peek('root')).toBe(root);
  expect(cache.peek('first-child')).toBeUndefined();
  expect(cache.peek('second-child')).toBeDefined();
});

it('does not change eviction order while composing visible branches', () => {
  const cache = new TreeCache(2);
  cache.set('one', { items: [], nextCursor: null });
  cache.set('two', { items: [], nextCursor: null });
  cache.peek('one');
  cache.set('three', { items: [], nextCursor: null });
  expect(cache.peek('one')).toBeUndefined();
  expect(cache.peek('two')).toBeDefined();
});
