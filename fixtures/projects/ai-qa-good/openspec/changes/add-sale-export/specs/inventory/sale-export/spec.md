## Purpose

Lets accountants download the paid sales of a chosen period as an Excel file with rounded totals.

## ADDED Requirements

### Requirement: Accountant exports paid sales
The system SHALL let accountants download the paid sales of a chosen period as an Excel file.

#### Scenario: Successful export
- **WHEN** an accountant exports a period with two paid sales and one draft
- **THEN** the file contains exactly the two paid sales

#### Scenario: Empty period
- **WHEN** an accountant exports a period without paid sales
- **THEN** the file contains only the header row

#### Scenario: Totals are rounded
- **WHEN** an accountant exports a sale whose total has a half cent
- **THEN** the total in the file is rounded half up to two decimals

#### Scenario: Teacher cannot export
- **WHEN** a teacher requests the export
- **THEN** the system responds 403 and no file is produced
