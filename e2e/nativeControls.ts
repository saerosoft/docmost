import type { Locator, Page } from '@playwright/test';

export function noteWorkspace(page: Page) { return page.locator('[data-note-gui-host], #root'); }

export async function openToolbar(page: Page) {
  if (await page.getByRole('toolbar', { name: 'Editor toolbar', exact: true }).isVisible()) return;
  await page.getByRole('button', { name: '페이지 메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '서식 도구 모음 표시', exact: true }).click();
}

export async function openDetails(scope: Page | Locator) {
  const trigger = scope.getByRole('button', { name: '댓글 및 노트 상세', exact: true });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
}

export async function openKnowledge(page: Page) {
  await page.getByRole('button', { name: '페이지 메뉴', exact: true }).click();
  await page.getByRole('menuitem', { name: '현재 정리·근거·누적 이력', exact: true }).click();
}
