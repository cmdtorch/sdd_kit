# Clarifications — add-sales-export

Depth: Comprehensive

## Sources

- [desc] Developer description: "add-sales-export — The client sent this request: 'Бухгалтерии нужна выгрузка продаж в Excel. Чтобы можно было фильтровать по датам и по классам, видеть итоги. И хорошо бы отправлять отчет директору на почту каждый месяц. Сделать удобно.'"
- [D1] Client request (chat message, in Russian) — `sources/D1.md`

## Main round

### Q1. Who may download the sales Excel file?
For: PO/PM
Why this is asked: the file contains prices and student names; this decides the permission rule. Today only accountants and school administrators can record sales.
- A. Only accountants
- B. Accountants and school administrators
- C. Every staff member, including teachers
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q2. Which sales go into the file?
For: PO/PM
Why this is asked: a sale can be a draft, paid or cancelled; the totals differ depending on which are counted.
- A. All sales, with a status column, and totals counting only paid sales
- B. Only paid sales
- C. Paid and draft sales, without cancelled ones
- D. The user picks the statuses in the filter
- E. Not yet defined
- X. Other (please specify)

[Answer]:

### Q3. The request says "filter by dates". Which date should the period apply to?
For: PO/PM
Why this is asked: a sale is recorded on one day and may be paid on another; the period selects different rows depending on this.
- A. The day the sale was recorded
- B. The day the sale was paid
- C. The user chooses which date to filter on
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q4. The request says "filter by classes". What does a class mean here?
For: PO/PM
Why this is asked: a sale is linked to a student, and a student belongs to a class; we need to know which class counts (current or at the time of sale) and whether several can be picked.
- A. The student's current class; one class at a time
- B. The student's current class; several classes at once (or all)
- C. The student's class at the moment of the sale
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q5. Which columns should each row of the file have? (select all that apply)
For: PO/PM
Why this is asked: this fixes the content of the report the accountants will work with.
- A. Date of the sale
- B. Student name
- C. Class
- D. Service name
- E. Quantity, unit price, line total
- F. Status
- G. Who recorded the sale
- X. Other (please specify)

[Answer]:

### Q6. What totals should the accountants see?
For: PO/PM
Why this is asked: "видеть итоги" can mean a single grand total or several breakdowns, which changes the layout of the file.
- A. One grand total at the bottom of the file
- B. Grand total plus a subtotal per class
- C. Grand total plus a subtotal per service
- D. Grand total plus subtotals per class and per service
- E. Not yet defined
- X. Other (please specify)

[Answer]:

### Q7. The monthly email to the director: what exactly is sent, and to whom?
For: PO/PM
Why this is asked: this defines the content, period and recipients of the automatic report.
- A. The same Excel file for the previous calendar month, to one director address
- B. The same Excel file for the previous calendar month, to a list of addresses (director and others)
- C. A short summary in the email body only, without a file
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q8. On which day and at what time of the month should the email be sent?
For: PO/PM
Why this is asked: this sets the schedule; late payments recorded after the send date will not be in that month's report.
- A. The 1st day of each month, in the morning
- B. A fixed later day (for example the 5th), so that late entries are included
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q9. Who sets and changes the director's email address and the monthly sending (on/off)?
For: PO/PM
Why this is asked: the address must be stored somewhere; it decides whether we need a settings screen or a fixed configuration.
- A. Accountants or administrators change it themselves in the system
- B. It is fixed in the system configuration and changed by the developers on request
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q10. "Сделать удобно" ("make it convenient"): what does convenient mean for the accountants?
For: PO/PM
Why this is asked: this is the only usability requirement and it is vague; it decides which extras are in scope.
- A. A single download button on the existing sales screen that respects the filters already chosen
- B. A separate report page with period and class selectors and a download button
- C. Either of the above, we choose
- D. Not yet defined
- X. Other (please specify)

[Answer]:

### Q11. What is deliberately NOT part of this change? (select all that apply)
For: PO/PM
Why this is asked: this is the scope boundary; unselected items are not excluded automatically, they stay open.
- A. Other file formats (CSV, PDF)
- B. Charts or graphs in the file
- C. Reports other than sales (payments, debts, balances)
- D. Sending the report to anyone other than the director
- E. Changes to how sales are recorded
- F. Nothing is excluded yet
- X. Other (please specify)

[Answer]:

### Q12. How will we know the feature works, and are there size or time limits?
For: PO/PM
Why this is asked: this sets the success criteria and whether large exports need special handling.
- A. The accountants get the same totals as their current manual report for one test month
- B. Same as A, and a full school year export must finish within a minute
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q13. Do the Excel file and email text need to be in Russian?
For: PO/PM
Why this is asked: column headings, status names, number/date format and the email text depend on the language.
- A. Russian only
- B. Russian and English
- C. Not yet defined
- X. Other (please specify)

[Answer]:

### Q14. Is there an existing outgoing email service or mailbox configured for the system?
For: Dev
Why this is asked: sending the monthly report needs a mail transport; the code we reviewed has no email or scheduled-job setup, so this may add new infrastructure.
- A. Yes, email sending already works (specify how)
- B. No, we need to set it up as part of this change
- C. Not yet defined
- X. Other (please specify)

[Answer]:
