import type { Page, TreeNote } from './model';

export class TreeCache {
  private pages = new Map<string, Page<TreeNote>>();
  constructor(private readonly maximum = 24) {}
  get(key: string) {
    const value = this.pages.get(key);
    if (value) { this.pages.delete(key); this.pages.set(key, value); }
    return value;
  }
  set(key: string, page: Page<TreeNote>) {
    this.pages.delete(key); this.pages.set(key, page);
    while (this.pages.size > this.maximum) this.pages.delete(this.pages.keys().next().value!);
  }
  clear() { this.pages.clear(); }
  get size() { return this.pages.size; }
}
