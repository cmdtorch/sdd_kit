# Clarifications — add-sale-export

Depth: Standard

## Sources

- [desc] Developer description: "Sales export to Excel and sales import from a file for accountants"
- [D1] Client request — `sources/D1.md`

## Main round

### Q1. Who may export and import sales?
Why this is asked: the files contain prices; this decides the permission rule.
- A. Only accountants
- B. Accountants and school administrators
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Q2. Which sales go into the export file?
Why this is asked: drafts change the totals.
- A. Only paid sales
- B. All sales with a status column
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Q3. Is the monthly email to the director part of this change?
Why this is asked: this is the scope boundary.
- A. Yes
- B. No, later
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

### Summary confirmation — Main round

- Only accountants may export and import sales [Q1]
- Only paid sales are exported [Q2]
- The monthly email is out of scope [Q3]

Assumptions I will make (not confirmed by an answer):
- The export period is filtered by the sale date

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Specs round

### Q4. What happens when the chosen period has no paid sales?
Why this is asked: an empty file and an error message are different behaviours.
- A. A file with only the header row
- B. An error message, no file
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Q5. How are totals rounded?
Why this is asked: half-cent amounts appear in discounts.
- A. Half up to two decimals
- B. Banker's rounding
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Specs round

- An empty period gives a file with only the header row [Q4]
- Totals are rounded half up to two decimals [Q5]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Design round

### Summary confirmation — Design round

- Build and read the files with openpyxl in services; no new dependency

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Verification round

### Q6. Which scenario needs an integration test through the real API?
Why this is asked: integration tests are slower; we keep them to the scenarios where the parts working together are the risk.
- A. The successful export (permissions, query and response together)
- B. None
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Verification round

- One integration test: the successful export through the API [Q6]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct
