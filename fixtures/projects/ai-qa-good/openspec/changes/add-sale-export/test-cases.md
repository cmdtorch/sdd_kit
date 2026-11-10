# Test Cases

## inventory/sale-export

### Scenario: Successful export

#### Case: Export of a month with two paid sales
Labels: automated, e2e
- **Given** two paid sales of 100.00 and 50.00 and one draft sale of 999.00 in March 2026
- **When** the accountant exports March 2026
- **Then** the file has exactly two rows with totals 100.00 and 50.00

#### Case: Draft sale is left out
Labels: automated
- **Given** one draft sale of 999.00 and no paid sale in March 2026
- **When** the accountant exports March 2026
- **Then** the file has no row with the total 999.00

### Scenario: Empty period

#### Case: Export of an empty period
Labels: automated
- **Given** no sales in January 2020
- **When** the accountant exports January 2020
- **Then** the file has only the header row

### Scenario: Totals are rounded

#### Case: Amount 0.005 rounds up
Labels: automated
- **Given** a paid sale with the total 10.005 in March 2026
- **When** the accountant exports March 2026
- **Then** the row shows the total 10.01

#### Case: Amount 0.015 rounds up
Labels: automated
- **Given** a paid sale with the total 10.015 in March 2026
- **When** the accountant exports March 2026
- **Then** the row shows the total 10.02

### Scenario: Teacher cannot export

#### Case: Teacher gets 403
Labels: automated
- **Given** a teacher signed in
- **When** the teacher requests the export of March 2026
- **Then** the response is 403 and no file is returned

#### Case: Export button is hidden for a teacher
Labels: e2e
- **Given** a teacher signed in on the sales page
- **When** the page loads
- **Then** the page shows no Export button

## inventory/sale-import

### Scenario: Successful import

#### Case: Import of a file with two rows
Labels: automated
- **Given** a file with two rows: totals 20.00 and 30.00
- **When** the accountant uploads the file
- **Then** two draft sales with totals 20.00 and 30.00 are stored

#### Case: Long file name is shown in full
Labels: manual
- **Given** a file named "sales-of-the-whole-spring-term-2026-for-all-classes.xlsx"
- **When** the accountant uploads the file
- **Then** the upload screen shows the whole file name on two lines

### Scenario: File with a wrong column is rejected

#### Case: Import of a file without the total column
Labels: automated
- **Given** a file with the columns student and quantity only
- **When** the accountant uploads the file
- **Then** the response is 400 with the message "Missing column: total" and no sale is stored

## General remarks

## Spec changes during test-case review

None.

## Stage result

Accepted findings:
- (none)

[Answer]: Looks correct
