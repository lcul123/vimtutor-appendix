import { expect, test } from '@playwright/test';

test.describe('daily trial', () => {
  test('shows the expert estimate, today, and history', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'vimtutor-appendix:trial:v1',
        JSON.stringify([{ timeMs: 150_000, splitsMs: [150_000], completedAt: Date.now() }]),
      );
    });
    await page.goto('/#/trial');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Daily time trial');
    await expect(page.getByTestId('trial-best')).toContainText('2m');
    await expect(page.getByTestId('trial-today')).not.toHaveText('—');
    await expect(page.getByTestId('trial-history')).toContainText('2m');
  });

  test('the first challenge advances the sequence', async ({ page }) => {
    await page.goto('/#/trial');
    await page.getByRole('button', { name: 'Start trial' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Move to the mark');
    await expect(page.getByTestId('trial-time')).toHaveText('0.0s');
    const editor = page.getByTestId('editor').locator('.cm-editor');
    await expect(editor).toHaveClass(/cm-focused/);
    await page.keyboard.press('j');
    await page.keyboard.press('l');
    await page.keyboard.press('l');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Change a word');
    await expect(page.getByTestId('trial-time')).not.toHaveText('0.0s');
  });
});
