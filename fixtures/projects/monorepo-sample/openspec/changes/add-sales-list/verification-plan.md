## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| sales/sales-list | Staff can list sales | Sales are listed newest first | unit | yes | two sales |
| sales/sales-list | Staff can list sales | Empty list | unit | no | no sales |
| sales/sales-page | Sales page shows the sales list | Sales page shows recorded sales | e2e | yes | one sale created through the API |
| sales/sales-page | Sales page shows the sales list | Sales page shows an empty state | e2e | no | API response stubbed to [] |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| sales/sales-list | Staff can list sales | [Q1][Q2][D1] |
| sales/sales-page | Sales page shows the sales list | [Q4][Q5] |

## Environment

- Unit: pytest + pytest-django (SQLite locally, PostgreSQL in CI). E2E: Playwright Chromium against the stack.
