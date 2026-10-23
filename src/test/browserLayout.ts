import { afterEach, beforeEach } from 'vitest';

// JSDOM has no layout; virtualized core UI needs finite browser viewport measurements.
const restore: (() => void)[] = [];
beforeEach(() => {
  if (typeof HTMLElement === 'undefined') return;
  const fontSet = Object.getOwnPropertyDescriptor(document, 'fonts');
  Object.defineProperty(document, 'fonts', { configurable: true, value: Object.assign(new EventTarget(), { ready: Promise.resolve(), check: () => true }) });
  restore.push(() => { if (fontSet) Object.defineProperty(document, 'fonts', fontSet); else Reflect.deleteProperty(document, 'fonts'); });
  for (const key of ['offsetHeight', 'clientHeight', 'offsetWidth', 'clientWidth']) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get() { return key.endsWith('Width') ? 320 : this.getAttribute('role') === 'treeitem' ? 36 : 384; } });
    restore.push(() => { if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor); else Reflect.deleteProperty(HTMLElement.prototype, key); });
  }
  const bounds = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () { return new DOMRect(0, 0, 320, this.getAttribute('role') === 'treeitem' ? 36 : 384); };
  restore.push(() => { HTMLElement.prototype.getBoundingClientRect = bounds; });
  const scrollBy = window.scrollBy;
  window.scrollBy = () => {};
  restore.push(() => { window.scrollBy = scrollBy; });
  const animation = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: () => ({ finished: Promise.resolve(), cancel() {} }) });
  restore.push(() => { if (animation) Object.defineProperty(HTMLElement.prototype, 'animate', animation); else Reflect.deleteProperty(HTMLElement.prototype, 'animate'); });
});
afterEach(() => { while (restore.length) restore.pop()?.(); });
