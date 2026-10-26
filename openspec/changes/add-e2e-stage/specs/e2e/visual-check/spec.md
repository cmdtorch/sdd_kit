# Spec Delta

## Purpose

Defines the comparison of built screens with the UI screenshots of a change in the E2E stage: which screenshots are compared, what counts as a difference, and how differences are fixed or accepted.

## ADDED Requirements

### Requirement: Every screenshot is compared with the built screen
When a change that needs E2E has UI screenshots, the E2E stage SHALL compare every screenshot of the inventory with the built screen, opened at the same window size and in the same state (for example an empty list or an error) as the screenshot. The stage record SHALL hold a result for every screenshot: no differences, differences, or accepted. A change without screenshots has no visual check.

#### Scenario: Screenshot without a comparison blocks the archive
- **GIVEN** a change that needs E2E with the screenshots `01-orders-list.png` and `02-orders-list-mobile.png`, and a stage record with a result only for the first
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names `02-orders-list-mobile.png`

#### Scenario: Change without screenshots needs no visual check
- **GIVEN** a change that needs E2E with no `sources/ui/` screenshot
- **WHEN** the change is archived after a green run
- **THEN** the archive is not blocked by the visual check

#### Scenario: Mobile screenshot is compared at its size
- **GIVEN** the screenshot `02-orders-list-mobile.png` of the mobile variant of the orders list
- **WHEN** the AI compares it with the built screen
- **THEN** it opens the orders list at the mobile window size before taking the snapshot

#### Scenario: Empty-state screenshot is compared in that state
- **GIVEN** the screenshot `03-orders-list-empty.png` of the orders list with no orders
- **WHEN** the AI compares it with the built screen
- **THEN** it brings the built orders list to the state with no orders before taking the snapshot

### Requirement: What counts as a difference
The AI SHALL compare the screenshot and the snapshot of the built screen by looking at both. A missing or extra element, a different constant text (titles, labels, buttons, messages), a different layout or order, different colours, and clearly different sizes, spacing or fonts SHALL count as differences. Data such as names, amounts and dates SHALL be compared only by format, and differences of a few pixels SHALL NOT count.

#### Scenario: Missing button is a difference
- **GIVEN** a screenshot with an "Export" button and a built screen without it
- **WHEN** the AI compares them
- **THEN** it records a difference that names the missing "Export" button

#### Scenario: Different sample data is not a difference
- **GIVEN** a screenshot that shows the customer "Anna Smith" and a built screen that shows the test customer "Test User 1" in the same place and format
- **WHEN** the AI compares them
- **THEN** it records no difference for the customer name

#### Scenario: Different data format is a difference
- **GIVEN** a screenshot that shows the date "12.03.2026" and a built screen that shows "2026-03-12" in the same place
- **WHEN** the AI compares them
- **THEN** it records a difference that names the date format

### Requirement: Differences are fixed or accepted
A difference SHALL be handled like a failing test: the AI fixes it in at most three attempts per screenshot, then shows it to the developer, who MAY accept it with a reason recorded in the stage record. While a screenshot has an open difference, the archive SHALL be blocked.

#### Scenario: Open difference blocks the archive
- **GIVEN** a stage record where `01-orders-list.png` has the open difference "Export button missing"
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names `01-orders-list.png` and "Export button missing"

#### Scenario: Accepted difference allows the archive
- **GIVEN** a stage record where the only difference of `01-orders-list.png` is accepted with the reason "new brand colours approved by the designer"
- **WHEN** the change is archived after a green run
- **THEN** the archive is not blocked by the visual check

#### Scenario: Accepted difference without a reason is reported
- **GIVEN** a stage record that accepts a difference of `01-orders-list.png` with no reason
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that names `01-orders-list.png` and says the reason is missing
