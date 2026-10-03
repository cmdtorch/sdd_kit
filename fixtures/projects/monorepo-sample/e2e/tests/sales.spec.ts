import { test, expect } from '@playwright/test';

test('sales page shows a recorded sale', {
  annotation: { type: 'scenario', description: 'sales/sales-page :: Sales page shows recorded sales' },
}, async ({ page, request }) => {
  const student = `Aysel ${Date.now()}`;
  const created = await request.post('/api/sales/', { data: { student, quantity: 2, unit_price: '50.00' } });
  expect(created.status()).toBe(201);
  await page.goto('/');
  const row = page.getByRole('row', { name: new RegExp(student) });
  await expect(row.getByRole('cell')).toHaveText([student, '2', '50.00', '100.00']);
});

test('sales page shows the empty state', {
  annotation: { type: 'scenario', description: 'sales/sales-page :: Sales page shows an empty state' },
}, async ({ page }) => {
  await page.route('**/api/sales/', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByText('No sales yet')).toBeVisible();
  await expect(page.locator('#sales')).toBeHidden();
});
