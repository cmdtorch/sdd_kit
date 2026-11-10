## Purpose

Lets accountants upload sales from an Excel file instead of typing them in one by one.

## ADDED Requirements

### Requirement: Accountant imports sales from a file
The system SHALL let accountants upload an Excel file of sales and store every row as a draft sale.

#### Scenario: Successful import
- **WHEN** an accountant uploads a file with two valid rows
- **THEN** two draft sales are stored with the totals from the file

#### Scenario: File with a wrong column is rejected
- **WHEN** an accountant uploads a file without the total column
- **THEN** the system responds 400 naming the missing column and no sale is stored
