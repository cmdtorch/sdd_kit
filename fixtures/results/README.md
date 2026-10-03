# Real tool output (captured 2026-10-03)

- `pytest-*.json`: kit pytest plugin on `fixtures/projects/pytest-sample` (pytest 9.1.1; identical with xdist -n 2)
- `playwright-*.json`: `npx playwright test [--list] --reporter=json` (Playwright 1.63.0) on `export.spec.ts`,
  run in a scratch dir (absolute paths kept as captured; tests pass that dir as the project root)
