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
