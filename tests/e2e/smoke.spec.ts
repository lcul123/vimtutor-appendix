import { expect, test } from '@playwright/test';

test.describe('app smoke', () => {
  test('overview lists every lesson', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Vim');
    await expect(page.locator('.lesson-card')).toHaveCount(10);
  });

  test('a drill mounts a focused Vim editor', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Replace the operator');
    await expect(page.getByTestId('editor').locator('.cm-editor')).toHaveClass(/cm-focused/);
    await expect(page.getByTestId('target')).toContainText('const total = price - tax;');
  });

  test('unknown hash falls back to the overview', async ({ page }) => {
    await page.goto('/#/nope/3');
    await expect(page.locator('.lesson-card')).toHaveCount(10);
  });
});
