<!-- Imported by sdd-kit handoff.mjs from /tmp/claude-1000/-home-coder-project-openspec-c/970cc55f-a427-4b53-8ac8-5ea125737428/scratchpad/be — change "add-sales-export" (active). Backend delta specs (behaviour and errors), for reference only. -->

# Backend specs — add-sales-export

## Capability: inventory/sales-export

### Purpose

Lets accountants and school administrators download paid sales of a period as an Excel file.

### ADDED Requirements

#### Requirement: Staff can export paid sales
The system SHALL let accountants and school administrators download the paid sales of a chosen period as an Excel file.

##### Scenario: Successful export
- **WHEN** an accountant exports a period with two paid sales and one draft
- **THEN** the file contains exactly the two paid sales and their total

##### Scenario: Empty period
- **WHEN** an accountant exports a period without paid sales
- **THEN** the file contains only the header row

##### Scenario: Teacher cannot export
- **WHEN** a teacher requests the export
- **THEN** the system responds 403 and no file is produced

## Capability: inventory/student-sales

### MODIFIED Requirements

#### Requirement: Staff can record a sale
The system SHALL allow users with the accountant or school_admin role to create a sale for a student with a service, quantity and unit price.

##### Scenario: Accountant records a sale
- **WHEN** an accountant submits a sale with a valid student, service, quantity 2 and unit price 50.00
- **THEN** the sale is stored with status draft and total 100.00

##### Scenario: Teacher cannot record a sale
- **WHEN** a teacher submits a sale
- **THEN** the system responds 403 with the message "Only accountants and administrators can record sales" and no sale is stored
