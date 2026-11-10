# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| inventory/sale-export | Accountant exports paid sales | Successful export | unit | yes | 2 paid + 1 draft sale |
| inventory/sale-export | Accountant exports paid sales | Successful export | integration | yes | seeded accountant |
| inventory/sale-export | Accountant exports paid sales | Empty period | unit | no | no sales |
| inventory/sale-export | Accountant exports paid sales | Totals are rounded | unit | no | amounts 10.005, 10.015 |
| inventory/sale-export | Accountant exports paid sales | Teacher cannot export | unit | yes | teacher user |
| inventory/sale-import | Accountant imports sales from a file | Successful import | unit | yes | file with two rows |
| inventory/sale-import | Accountant imports sales from a file | File with a wrong column is rejected | unit | no | file without the total column |

## Test case coverage

| Capability | Scenario | Case | Labels | Level |
|---|---|---|---|---|
| inventory/sale-export | Successful export | Export of a month with two paid sales | automated, e2e | integration |
| inventory/sale-export | Successful export | Draft sale is left out | automated | unit |
| inventory/sale-export | Empty period | Export of an empty period | automated | unit |
| inventory/sale-export | Totals are rounded | Amount 0.005 rounds up | automated | unit |
| inventory/sale-export | Totals are rounded | Amount 0.015 rounds up | automated | unit |
| inventory/sale-export | Teacher cannot export | Teacher gets 403 | automated | unit |
| inventory/sale-export | Teacher cannot export | Export button is hidden for a teacher | e2e | — |
| inventory/sale-import | Successful import | Import of a file with two rows | automated | unit |
| inventory/sale-import | Successful import | Long file name is shown in full | manual | — |
| inventory/sale-import | File with a wrong column is rejected | Import of a file without the total column | automated | unit |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| inventory/sale-export | Accountant exports paid sales | [Q1][Q2][Q4][Q5][D1] |
| inventory/sale-import | Accountant imports sales from a file | [Q1][D1] |

## Environment

- PostgreSQL test database.
