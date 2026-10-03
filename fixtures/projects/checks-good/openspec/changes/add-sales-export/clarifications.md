# Clarifications — add-sales-export

Depth: Standard

## Sources

- [desc] Developer description: "Sales export to Excel for accountants"
- [D1] Client request — `sources/D1.md`

## Main round

### Q1. Who may download the sales export?
For: PO/PM
Why this is asked: the file contains prices; this decides the permission rule.
- A. Only accountants
- B. Accountants and school administrators
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

### Q2. Which sales go into the file?
For: PO/PM
Why this is asked: drafts and cancelled sales change the totals.
- A. Only paid sales
- B. All sales with a status column
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Q3. Is the monthly email to the director part of this change?
For: PO/PM
Why this is asked: this is the scope boundary.
- A. Yes
- B. No, later
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

### Summary confirmation — Main round

- Accountants and school administrators may download the export [Q1]
- Only paid sales are included [Q2]
- The monthly email is out of scope [Q3]

Assumptions I will make (not confirmed by an answer):
- The export period is filtered by the sale date

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Specs round

### Q4. What happens when the chosen period has no paid sales?
For: PO/PM
Why this is asked: an empty file and an error message are different behaviours.
- A. A file with only the header row
- B. An error message, no file
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Specs round

- An empty period gives a file with only the header row [Q4]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Design round

### Summary confirmation — Design round

- Build the file with openpyxl in a service; no new dependency

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Verification round

### Q5. Which journey needs a browser E2E test?
For: Dev
Why this is asked: E2E is expensive; we keep it to key journeys.
- A. Downloading the export from the sales page
- B. None
- X. Other (please specify)

[Answer]: A

### Summary confirmation — Verification round

- One E2E test: download from the sales page [Q5]

Assumptions I will make (not confirmed by an answer):
- None.

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct
