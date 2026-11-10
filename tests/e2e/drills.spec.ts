import { expect, test, type Page } from '@playwright/test';
import { lessons } from '../../src/content/lessons';
import type { Drill } from '../../src/engine/types';

/**
 * Replays every lesson's reference solution against the real app in a real
 * browser. This is what keeps the curriculum honest: if the emulator cannot do
 * what a drill asks, this suite fails and the drill has to change.
 */

const SPECIAL: Record<string, string> = {
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  'Control+v': 'Control+v',
  'Control+a': 'Control+a',
  'Control+d': 'Control+d',
  'Control+u': 'Control+u',
};

async function focusEditor(page: Page) {
  // Click the very start of the first line so the cursor stays where the drill
  // expects it. Clicking the empty area past the end of a line moves the cursor.
  await page.getByTestId('editor').locator('.cm-line').first().click({ position: { x: 2, y: 8 } });
  await expect(page.getByTestId('editor').locator('.cm-editor')).toHaveClass(/cm-focused/);
}

async function play(page: Page, keys: string[]) {
  for (const key of keys) {
    if (SPECIAL[key]) {
      await page.keyboard.press(SPECIAL[key]);
    } else {
      // One physical press per key, like a person typing. Using keyboard.type()
      // for whole strings breaks Vim's insert-change recording (and therefore
      // `.` and macros), because the browser sees one multi-character insert.
      await page.keyboard.press(key);
    }
  }
}

function urlFor(drill: Drill): string {
  const lesson = lessons.find((l) => l.drills.some((d) => d.id === drill.id))!;
  const index = lesson.drills.findIndex((d) => d.id === drill.id);
  return `/#/${lesson.id}/${index}`;
}

const allDrills = lessons.flatMap((lesson) =>
  lesson.drills.map((drill) => ({ lesson, drill })),
);

test.describe('every drill is solvable in a real browser', () => {
  for (const { lesson, drill } of allDrills) {
    test(`${lesson.id} / ${drill.id} — ${drill.title}`, async ({ page }) => {
      await page.goto(urlFor(drill));
      await focusEditor(page);
      await play(page, drill.solution);
      await expect(page.getByTestId('solved')).toBeVisible({ timeout: 4000 });
    });
  }
});

test.describe('solved state', () => {
  test('shows time, keys and a record badge on a first solve', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await focusEditor(page);
    await play(page, ['f', '+', 'r', '-']);
    const solved = page.getByTestId('solved');
    await expect(solved).toBeVisible();
    await expect(solved).toContainText('New best');
    await expect(page.getByTestId('hud-keys')).toHaveText('4');
  });

  test('persists the best across a reload', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await focusEditor(page);
    await play(page, ['f', '+', 'r', '-']);
    await expect(page.getByTestId('solved')).toBeVisible();
    const bestAfterFirst = await page.getByTestId('hud-best').innerText();

    await page.reload();
    await focusEditor(page);
    await expect(page.getByTestId('hud-best')).toHaveText(bestAfterFirst);

    // The overview lists the stored best. The first lesson is expanded already,
    // so only open it if its drill table is not visible.
    await page.goto('/');
    const row = page.locator('.drill-row').filter({ hasText: 'Replace the operator' });
    if ((await row.count()) === 0) {
      await page.getByRole('button', { name: /Hit a character on the line/ }).click();
    }
    await expect(row).toContainText('solved');
  });

  test('reports a better key count even when the time is slower', async ({ page }) => {
    await page.goto('/#/counts/0');
    await focusEditor(page);
    // A deliberately wasteful but correct first attempt would be slow; instead
    // seed a slow, high-key best, then beat the keys.
    await page.evaluate(() => {
      localStorage.setItem(
        'vimtutor-appendix:records:v1',
        JSON.stringify({ 'count-1': { bestTimeMs: 1, bestKeys: 40, runs: 1, updatedAt: 1 } }),
      );
    });
    await page.reload();
    await focusEditor(page);
    await play(page, ['3', 'd', 'w']);
    const solved = page.getByTestId('solved');
    await expect(solved).toBeVisible();
    await expect(solved).toContainText('keys');
  });

  test('retry brings the buffer back and clears the solved panel', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await focusEditor(page);
    await play(page, ['f', '+', 'r', '-']);
    await expect(page.getByTestId('solved')).toBeVisible();

    await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
    await expect(page.getByTestId('solved')).toHaveCount(0);
    await expect(page.getByTestId('editor').locator('.cm-content')).toContainText('const total = price + tax;');

    await focusEditor(page);
    await play(page, ['f', '+', 'r', '-']);
    await expect(page.getByTestId('solved')).toBeVisible();
  });

  test('timer starts on the first key, not on mount', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await focusEditor(page);
    await page.waitForTimeout(400);
    await expect(page.getByTestId('hud-time')).toHaveText('0.00s');
    await page.keyboard.press('f');
    await page.waitForTimeout(250);
    await expect(page.getByTestId('hud-time')).not.toHaveText('0.00s');
  });

  test('Ctrl+Enter retries a solved drill', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await focusEditor(page);
    await play(page, ['f', '+', 'r', '-']);
    await expect(page.getByTestId('solved')).toBeVisible();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('solved')).toHaveCount(0);
  });
});

test.describe('mode indicator', () => {
  test('reflects insert and visual modes', async ({ page }) => {
    await page.goto('/#/inline-jumps/0');
    await focusEditor(page);
    // The pill is styled uppercase, so compare case-insensitively.
    await expect(page.locator('.mode-pill')).toHaveClass(/mode-pill--normal/);
    await page.keyboard.press('i');
    await expect(page.locator('.mode-pill--insert')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.mode-pill--normal')).toHaveCount(1);
    await page.keyboard.press('v');
    await expect(page.locator('.mode-pill--visual')).toHaveCount(1);
  });
});
