# Test review — add-sales-list

Verdict: READY

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | e2e/tests/sales.spec.ts:14 | Sales page shows an empty state | "No table" is asserted via `#sales` toBeHidden. The table is `hidden` in the HTML by default, so this holds even if the page never touches it. The id selector also would not notice a second, differently-named table. | a page that rendered an extra table with another id next to "No sales yet" passes | assert `page.getByRole('table')` has count 0 or is not visible |
| T2 | minor | e2e/tests/sales.spec.ts:14 | Sales page shows an empty state | The API is mocked with `route.fulfill`. This is acceptable because the frontend is the unit under test, but the real empty path is not covered end to end. | none for the UI; the backend empty list is covered by test_empty_list | none needed |
| T3 | minor | backend/tests/test_sales.py::test_sales_listed_newest_first | Sales are listed newest first | The records are created back to back. If ordering used a timestamp with ties, the test could be flaky. It does assert exact order and values, so it is sound. | none significant | optional: set explicit timestamps |

All four scenarios have a marked test, and every THEN/AND is asserted with exact values (order, quantity, unit_price, total as strings). No skipped tests, no assertion-free tests, and no mocks of the unit under test.

## Human decision

<!-- Not needed: verdict is READY. -->
