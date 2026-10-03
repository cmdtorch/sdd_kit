## Purpose

Shows staff the recorded sales on a page in the frontend, or a clear empty state.

## ADDED Requirements

### Requirement: Sales page shows the sales list
The system SHALL show every recorded sale on the sales page as a row with student, quantity, unit price and total, and SHALL show "No sales yet" instead of the table when there are none.

#### Scenario: Sales page shows recorded sales
- **WHEN** a sale for a student with quantity 2 and unit price 50.00 is recorded and the user opens the sales page
- **THEN** a row shows the student, 2, 50.00 and 100.00

#### Scenario: Sales page shows an empty state
- **WHEN** there are no sales and the user opens the sales page
- **THEN** the page shows "No sales yet"
- **AND** no table is shown
