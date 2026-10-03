## Purpose

Lets staff read all recorded sales through the API, newest first, with their totals.

## ADDED Requirements

### Requirement: Staff can list sales
The system SHALL list recorded sales newest first with student, quantity, unit price and total, where total is quantity times unit price.

#### Scenario: Sales are listed newest first
- **WHEN** a sale for Aysel (2 × 50.00) and then a sale for Murad (1 × 30.00) are recorded
- **THEN** the list returns Murad (1, 30.00, total 30.00) first and Aysel (2, 50.00, total 100.00) second

#### Scenario: Empty list
- **WHEN** no sales are recorded
- **THEN** the list is empty
