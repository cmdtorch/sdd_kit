# Clarifications — add-sales-list

Depth: Standard

## Sources

- [desc] Developer description: "Sales list: API and a sales page"
- [D1] Client request — `sources/D1.md`

## Main round

### Q1. What does each line of the sales list show?
For: PO/PM
Why this is asked: the request names "who, how many, price and total"; this fixes the columns.
- A. Student, quantity, unit price, total
- B. Only student and total
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Q2. In which order are sales listed?
For: PO/PM
Why this is asked: the request says "new on top"; confirms the sort order.
- A. Newest first
- B. Alphabetically by student
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Q3. Are filters, paging or editing part of this change?
For: PO/PM
Why this is asked: this is the scope boundary.
- A. No, only the list
- B. Yes, filters as well
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Main round

- Each line shows student, quantity, unit price and total [Q1]
- Newest sales first [Q2]
- Only the list: no filters, paging or editing [Q3]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Specs round

### Q4. What should the page show when there are no sales?
For: PO/PM
Why this is asked: an empty table and a message are different behaviours.
- A. The text "No sales yet"
- B. An empty table
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Specs round

- With no sales the page shows "No sales yet" and no table [Q4]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Design round

### Summary confirmation — Design round

- A DRF list/create view; the total is computed, not stored

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Verification round

### Q5. Which journeys need a browser E2E test?
For: Dev
Why this is asked: E2E is expensive; we keep it to key journeys.
- A. The sales page with data and the empty state
- B. None
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Verification round

- E2E: the sales page with data and the empty state [Q5]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct
