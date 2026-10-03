## Verification matrix

| Capability | Scenario | Level | Expected | Actual | Evidence | Verdict |
|---|---|---|---|---|---|---|
| inventory/sales-export | Successful export | unit | 2 rows, total 150.00 | 2 rows, total 150.00 | tests/test_export.py::test_successful_export passed | Met |
| inventory/sales-export | Successful export | e2e | file downloaded | file downloaded | e2e/export.spec.ts passed | Met |
| inventory/sales-export | Empty period | unit | header only | header only | tests/test_export.py::test_empty_period passed | Met |
| inventory/sales-export | Teacher cannot export | unit | 403 | 403 | tests/test_export.py::test_teacher_forbidden passed | Met |
| inventory/student-sales | Teacher cannot record a sale | unit | 403 + message | 403 + message | tests/test_sales.py::test_teacher_cannot_record passed | Met |

## Commands run

- `make test` — 1523 passed
- `make check` — ok
- `npx playwright test e2e/export.spec.ts` — 1 passed
