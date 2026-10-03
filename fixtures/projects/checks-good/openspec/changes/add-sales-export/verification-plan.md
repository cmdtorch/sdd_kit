## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| inventory/sales-export | Staff can export paid sales | Successful export | unit | yes | 2 paid + 1 draft sale |
| inventory/sales-export | Staff can export paid sales | Successful export | e2e | yes | seeded accountant |
| inventory/sales-export | Staff can export paid sales | Empty period | unit | no | no sales |
| inventory/sales-export | Staff can export paid sales | Teacher cannot export | unit | yes | teacher user |
| inventory/student-sales | Staff can record a sale | Teacher cannot record a sale | unit | no | teacher user |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| inventory/student-sales | Accountant records a sale | behaviour unchanged, covered by test_record_sale |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| inventory/sales-export | Staff can export paid sales | [Q1][Q2][Q4][D1] |
| inventory/student-sales | Staff can record a sale | [desc] |

## Environment

- PostgreSQL test database; Playwright with Chromium.
