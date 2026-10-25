// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { excalidrawLanguageCode, loadExcalidraw } from './excalidraw';
import { docmostI18n } from './i18n';

it('makes the real configured GUI locale selectable by the pinned SDK before editor initialization', async () => {
  // No SDK or i18n mock: the installed SDK otherwise filters Korean out of its
  // public languages list and InitializeApp silently chooses English instead.
  const sdk = await loadExcalidraw();
  const language = excalidrawLanguageCode(docmostI18n.resolvedLanguage || docmostI18n.language);
  expect(language).toBe('ko-KR');
  const selected = sdk.languages.find(candidate => candidate.code === language) || sdk.defaultLang;
  expect(selected).toEqual({ code: 'ko-KR', label: '한국어' });
  expect(sdk.languages.some(candidate => candidate.code === sdk.defaultLang.code)).toBe(true);
  await loadExcalidraw();
  expect(sdk.languages.filter(candidate => candidate.code === language)).toHaveLength(1);
});

it.each(['ko', 'ko-KR', 'ko-kr'])('maps Korean GUI language %s to the bundled SDK locale', language => {
  expect(excalidrawLanguageCode(language)).toBe('ko-KR');
  expect(excalidrawLanguageCode('en')).toBe('en');
  expect(excalidrawLanguageCode('ja-JP')).toBe('ja-JP');
});
