// Fixture Playwright test (not executed).
import { test, expect } from '@playwright/test';

test('accountant exports sales', {
  annotation: { type: 'scenario', description: 'inventory/sales-export :: Successful export' },
}, async ({ page }) => {
  await page.goto('/sales');
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByRole('row')).toHaveCount(3);
});
