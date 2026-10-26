import type { Page, TreeNote } from './model';

export class TreeCache {
  private pages = new Map<string, Page<TreeNote>>();
  constructor(private readonly maximum = 24) {}
  get(key: string) {
    const value = this.pages.get(key);
    if (value) { this.pages.delete(key); this.pages.set(key, value); }
    return value;
  }
  /** A render read must not make every visible branch the newest cache entry. */
  peek(key: string) { return this.pages.get(key); }
  set(key: string, page: Page<TreeNote>, protectedKey?: string) {
    this.pages.delete(key); this.pages.set(key, page);
    while (this.pages.size > this.maximum) {
      const oldest = [...this.pages.keys()].find(value => value !== protectedKey);
      if (!oldest) break;
      this.pages.delete(oldest);
    }
  }
  clear() { this.pages.clear(); }
  get size() { return this.pages.size; }
}
