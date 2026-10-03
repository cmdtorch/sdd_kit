## Purpose

Lets accountants and school administrators download paid sales of a period as an Excel file.

## ADDED Requirements

### Requirement: Staff can export paid sales
The system SHALL let accountants and school administrators download the paid sales of a chosen period as an Excel file.

#### Scenario: Successful export
- **WHEN** an accountant exports a period with two paid sales and one draft
- **THEN** the file contains exactly the two paid sales and their total

#### Scenario: Empty period
- **WHEN** an accountant exports a period without paid sales
- **THEN** the file contains only the header row

#### Scenario: Teacher cannot export
- **WHEN** a teacher requests the export
- **THEN** the system responds 403 and no file is produced
