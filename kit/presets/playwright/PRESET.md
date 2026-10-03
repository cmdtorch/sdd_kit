# Preset: playwright

Adds the `e2e` level of `openspec/tooling/verify.yaml`. Mark tests with an annotation:

```ts
test('accountant exports sales', {
  annotation: { type: 'scenario', description: 'inventory/sale-export :: Successful export' },
}, async ({ page }) => { /* ... */ });
```
