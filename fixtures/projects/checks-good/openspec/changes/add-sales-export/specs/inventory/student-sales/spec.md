## MODIFIED Requirements

### Requirement: Staff can record a sale
The system SHALL allow users with the accountant or school_admin role to create a sale for a student with a service, quantity and unit price.

#### Scenario: Accountant records a sale
- **WHEN** an accountant submits a sale with a valid student, service, quantity 2 and unit price 50.00
- **THEN** the sale is stored with status draft and total 100.00

#### Scenario: Teacher cannot record a sale
- **WHEN** a teacher submits a sale
- **THEN** the system responds 403 with the message "Only accountants and administrators can record sales" and no sale is stored
