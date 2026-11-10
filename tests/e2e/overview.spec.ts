import { expect, test } from '@playwright/test';

test.describe('overview and records', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test('shows a stored best in the lesson table', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'vimtutor-appendix:records:v1',
        JSON.stringify({
          'inline-1': { bestTimeMs: 1500, bestKeys: 4, runs: 2, updatedAt: 1 },
        }),
      );
    });
    await page.goto('/');
    const row = page.locator('.drill-row').filter({ hasText: 'Replace the operator' });
    await expect(row).toContainText('1.50s');
    await expect(row).toContainText('4 keys');
    await expect(row).toContainText('solved');
    await expect(page.locator('.dot--done')).toHaveCount(1);
  });

  test('clearing bests empties the progress panel', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'vimtutor-appendix:records:v1',
        JSON.stringify({
          'inline-1': { bestTimeMs: 1500, bestKeys: 4, runs: 2, updatedAt: 1 },
        }),
      );
    });
    await page.goto('/');
    await expect(page.locator('.hero__panel')).toContainText('1 / 37');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Clear bests' }).click();
    await expect(page.locator('.hero__panel')).toContainText('0 / 37');
    await expect(page.locator('.hero__panel')).toContainText('Total runs0');
  });

  test('continue opens the first unsolved drill', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'vimtutor-appendix:records:v1',
        JSON.stringify({
          'inline-1': { bestTimeMs: 1500, bestKeys: 4, runs: 1, updatedAt: 1 },
        }),
      );
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Commas into semicolons');
  });

  test('next drill walks through a lesson and into the next one', async ({ page }) => {
    await page.goto('/#/inline-jumps/3');
    await page.getByRole('button', { name: 'Next drill' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change the inner word');
  });

  test('hint toggles without disturbing the editor', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await expect(page.locator('.hint-box')).toHaveCount(0);
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(page.locator('.hint-box')).toContainText('f jumps onto a character');
    await page.getByRole('button', { name: 'Hide hint' }).click();
    await expect(page.locator('.hint-box')).toHaveCount(0);
  });
});
