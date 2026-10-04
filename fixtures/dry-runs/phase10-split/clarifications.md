# Clarifications — add-sales-export-ui

Depth: Comprehensive

## Sources

- [desc] Developer description: "(not provided — this change was created by importing the backend change "add-sales-export"; the developer is asked to supply the description before the round is confirmed)"
- [D1] Backend handoff for "add-sales-export" — `sources/D1-backend-handoff.md`
- [D2] Backend delta specs for "add-sales-export" — `sources/D2-backend-specs.md`

## Main round

### Q1. What should be deliberately left out of this first version of the sales export screen?
For: PO/PM
Why this is asked: the backend also changes how sales are listed, created and edited; this decides how much of the sales page is rebuilt versus only the new export.
- A. Only the export itself; the existing sales table and sale form are not touched beyond what breaks (the removed note, the new total and currency)
- B. The export plus the sales table showing the new total and currency, but no changes to creating or editing sales
- C. The export, the table changes, and the create/edit form changes (required currency)
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q2. Where does a staff member start an export?
For: PO/PM
Why this is asked: decides whether we add a control to the existing sales page or build a separate screen.
- A. A button on the existing sales page that opens a small period-picking dialog
- B. A period picker and export button placed directly on the sales page, above the table
- C. A separate "Export" page reachable from the menu
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q3. How does the user choose the period to export?
For: PO/PM
Why this is asked: the export needs a start date and an end date; this decides the input and any shortcuts.
- A. Two date fields (from, to), both required, no shortcuts
- B. Two date fields plus shortcuts such as "This month" and "Last month"
- C. A month picker only (whole calendar months)
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q4. The backend describes the export as an Excel file, but the endpoint returns a paginated list of student and total, not a file. How should the screen obtain and deliver the file?
For: Dev
Why this is asked: the settled API shows no file download, so the screen cannot be designed until the backend says what the user actually receives and whether all pages are needed.
- A. The backend will add a file-download response; the screen triggers a browser download of that file
- B. The list is the full export; the frontend builds the Excel file itself from all pages
- C. The list is only a preview; a separate download endpoint exists or will be added
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q5. What does the screen do when the chosen period is invalid (start after end, or a date missing)?
For: Dev
Why this is asked: the handoff lists only a 403 error for the export; it names no error for a bad period, so the screen cannot know whether the server rejects it or what text it returns.
- A. The server returns a 400 with field messages (backend to document the exact text); the screen shows them next to the fields
- B. The server does not validate; the screen must prevent invalid periods itself
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q6. What should the user see when the chosen period has no paid sales?
For: PO/PM
Why this is asked: the backend rule says an empty period gives a file with only the header row; the screen must decide whether to still hand that file over.
- A. Download the header-only file anyway, as the backend rule says
- B. Do not download; show a message such as "No paid sales in this period"
- C. Ask the user whether they still want the empty file
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q7. Who sees the export control and the sales page in the interface?
For: PO/PM
Why this is asked: accountants and school administrators may use sales; teachers are refused by the server; this decides whether other roles see the control, a disabled one, or nothing.
- A. Hide the export control (and the sales page entry) for every role except accountants and school administrators
- B. Show the control to everyone; if the server refuses, show the refusal message
- C. Show it disabled with an explanation for other roles
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q8. How should failures during export be shown (refused by the server, network problem, unexpected server error)?
For: PO/PM
Why this is asked: decides the error wording and where it appears, and whether the user can retry.
- A. An inline message in the export dialog or panel, with a retry option
- B. A short temporary notification (toast) for every failure type
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q9. The sales table currently shows student, quantity, price and a note. The note is removed by the backend; how should the table change?
For: PO/PM
Why this is asked: the settled API removes the note and adds a total and a currency per sale; the columns and their formatting need a decision.
- A. Remove the note column; add a total column that shows the amount with its currency in one cell
- B. Remove the note column; add separate total and currency columns
- C. Remove the note column only; do not show total or currency in the table
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q10. Recording a sale now requires a currency. Which currencies can the user choose, and is there a default?
For: Dev
Why this is asked: the handoff says currency is required but gives no list of allowed values, format or default, so the form cannot be built without them.
- A. The backend provides a fixed list of currency codes (backend to name them) and the form shows a dropdown
- B. Free text, validated by the server
- C. A single default currency is pre-selected and the user may change it
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q11. The sale-recording rule mentions a service, but the request in the handoff lists only student, quantity, unit price, status and currency. Is a service chosen when recording a sale?
For: Dev
Why this is asked: the two backend sources disagree; the form either has a service field or it does not.
- A. Yes, the form must include a service field (backend to add it to the request description)
- B. No, the service is not sent from the screen
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q12. The sales list is paginated by the server. How should the user move between pages?
For: PO/PM
Why this is asked: decides the paging control and whether the table keeps its place after a sale is recorded.
- A. Previous / Next buttons with the current page number
- B. Numbered page links
- C. "Load more" at the bottom of the table
- D. Not yet defined
- X. Other (please specify)

[Answer]:
