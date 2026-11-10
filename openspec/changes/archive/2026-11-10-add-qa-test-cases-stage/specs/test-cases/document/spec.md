# Spec Delta

## Purpose

Defines the test-case document of a change: Gherkin test cases written from the spec scenarios before design and code, each linked to its scenario and labelled with how it will be verified.

## ADDED Requirements

### Requirement: One test-case document per change
A change on the `clarify-ai-qa` or `clarify-qa` schema SHALL have one test-case document, `test-cases.md` in the change directory, with a section per capability and, inside it, a section per spec scenario that holds that scenario's test cases.

#### Scenario: Test cases are grouped by capability and scenario
- **GIVEN** a change on the `clarify-qa` schema whose delta specs have the capabilities `inventory/sale-export` and `inventory/sale-import`
- **WHEN** the test-case check runs on the change after the test cases are written
- **THEN** it finds exactly one `test-cases.md` with a section for each of the two capabilities, each holding a section per scenario of that capability, and reports no structure error

### Requirement: Every scenario has a test case
Every scenario of every delta spec of the change SHALL have at least one test case, and every test case SHALL belong to a scenario that exists in the change's delta specs. The test-case check SHALL report a violation as an error naming the scenario or the test case.

#### Scenario: Scenario without a test case is reported
- **GIVEN** a delta spec scenario "Successful export" with no test case in `test-cases.md`
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the capability and the scenario "Successful export"

#### Scenario: Test case under an unknown scenario is reported
- **GIVEN** a test case placed under a scenario name that no delta spec of the change contains
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the test case and the unknown scenario

#### Scenario: Several cases for one scenario pass
- **GIVEN** the scenario "Totals are rounded" with two test cases, one for the amount 0.005 and one for 0.015
- **WHEN** the test-case check runs on the change
- **THEN** it reports no error for that scenario

### Requirement: The test-case check gates design and archive
While the test-case check reports an error, writing `design.md` and the archive SHALL be blocked. A scenario added after the test-cases stage is complete therefore blocks the archive until it has a test case.

#### Scenario: Design is blocked by a coverage error
- **GIVEN** a change on the `clarify-ai-qa` schema where the scenario "Successful export" has no test case
- **WHEN** the AI tries to write `design.md`
- **THEN** the write is blocked with a message that names the scenario "Successful export"

#### Scenario: Late scenario without a test case blocks the archive
- **GIVEN** a scenario added to a delta spec during implementation, with no test case
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names that scenario

### Requirement: Test cases stay with the change
The test-case document SHALL stay in the change directory and move with it to the archive. Archiving SHALL NOT merge test cases into the project's main specs or any other permanent file.

#### Scenario: Archive does not merge test cases
- **GIVEN** a change on the `clarify-qa` schema with `test-cases.md`, ready to archive
- **WHEN** the change is archived
- **THEN** `test-cases.md` exists only in the archived change directory
- **AND** no file under `openspec/specs/` contains its test cases

### Requirement: Test cases use Gherkin with concrete data in English
Each test case SHALL be written in English with at least one Given, one When and one Then step, with concrete values in its steps (for example an exact amount or name) and an observable outcome in every Then. The test-case check SHALL enforce the steps; concrete data and observable outcomes are judged by the AI QA reviewer.

#### Scenario: Test case without a Then is reported
- **GIVEN** a test case that has Given and When steps but no Then step
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the test case and says the Then step is missing

#### Scenario: Test case without a Given is reported
- **GIVEN** a test case that has When and Then steps but no Given step
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the test case and says the Given step is missing

### Requirement: Test case names are unique and stable
Each test case SHALL have a name that is unique within its capability. Tests reference a test case by this name, so a renamed test case SHALL count as uncovered until its tests reference the new name.

#### Scenario: Duplicate test case name is reported
- **GIVEN** two test cases named "Export of an empty period" in the same capability
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the capability and the duplicated test case name

#### Scenario: Same name in different capabilities is allowed
- **GIVEN** a test case named "Empty list" in two different capabilities
- **WHEN** the test-case check runs on the change
- **THEN** it reports no duplicate-name error

#### Scenario: Renamed case loses its coverage
- **GIVEN** an `automated` test case renamed from "Empty export" to "Export of an empty period" while its test still references "Empty export"
- **WHEN** the traceability check runs with marker checking on the change
- **THEN** it reports "Export of an empty period" as an `automated` test case without a test

### Requirement: Test cases carry verification labels
Each test case SHALL carry one or more verification labels from `automated` (a test below the user interface), `e2e` (the full user path through the interface) and `manual` (checked by hand only). The test case SHALL NOT name a unit or integration level; that choice belongs to the verification plan.

#### Scenario: Several labels on one case
- **GIVEN** a test case labelled `automated` and `e2e`
- **WHEN** the test-case check runs on the change
- **THEN** it reports no label error for that test case

#### Scenario: Missing label is reported
- **GIVEN** a test case with no verification label
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the test case and lists the allowed labels `automated`, `e2e`, `manual`

#### Scenario: Unknown label is reported
- **GIVEN** a test case labelled `unit`
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the test case and the unknown label `unit`
