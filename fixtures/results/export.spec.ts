import { test, expect } from '@playwright/test';

test('accountant exports sales', {
  annotation: { type: 'scenario', description: 'inventory/sales-export :: Successful export' },
}, async () => {
  expect(1 + 1).toBe(2);
});

test('empty period shows header only', {
  annotation: [
    { type: 'scenario', description: 'inventory/sales-export :: Empty period' },
    { type: 'issue', description: 'JIRA-1' },
  ],
}, async () => {
  expect([]).toEqual(['header']);
});

test.describe('teacher', () => {
  test('cannot export', { annotation: { type: 'scenario', description: 'inventory/sales-export :: Teacher cannot export' } }, async () => {
    test.skip(true, 'not ready');
  });
});

test('no marker', async () => {});
