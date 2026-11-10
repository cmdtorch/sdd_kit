# Spec Delta

## Purpose

Defines how the specs of a change in UI mode cover the inventory: every element the change builds has a scenario, and in the test-case workflows its test cases are labelled for end-to-end checks.

## ADDED Requirements

### Requirement: Every built element has a scenario
Every inventory element with the decision `in scope` or `mock` SHALL name one or more scenarios of the change's delta specs that cover it, each as `<capability-path> :: <Scenario name>`. While an element lacks one, or names a scenario that does not exist, the specs are not complete: writing `design.md` (on `lean`, `verification-plan.md`) and the archive SHALL be blocked with a message that names the element.

#### Scenario: In-scope element without a scenario blocks the design
- **GIVEN** a `clarify` change with an inventory element "export-button" with the decision `in scope` and no scenario named
- **WHEN** the AI writes `design.md`
- **THEN** the write is blocked with a message that names "export-button"

#### Scenario: Lean element without a scenario blocks the verification plan
- **GIVEN** a `lean` change with an inventory element "export-button" with the decision `in scope` and no scenario named
- **WHEN** the AI writes `verification-plan.md`
- **THEN** the write is blocked with a message that names "export-button"

#### Scenario: Element names a scenario that does not exist
- **GIVEN** an inventory element that names `inventory/sale-export :: Export starts` while that delta spec has no scenario with that name
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names the element and the scenario "Export starts"

#### Scenario: Mock element without a scenario blocks the design
- **GIVEN** an inventory element "share-button" with the decision `mock` and no scenario named
- **WHEN** the AI writes `design.md`
- **THEN** the write is blocked with a message that names "share-button"

#### Scenario: Elements that are not built need no scenario
- **GIVEN** inventory elements with the decisions `out of scope`, `decoration` and `existing`, none naming a scenario
- **WHEN** the UI check runs on the change
- **THEN** it reports no coverage error for them

### Requirement: Mock elements describe the mock behaviour
The scenario of a `mock` element SHALL state what the user sees and what does not happen, for example a click that shows the message "Coming soon" and changes nothing. The spec reviewer judges this.

#### Scenario: Mock scenario without a visible outcome is a review finding
- **GIVEN** a `mock` element "share-button" covered by the scenario "Share is not available yet" whose THEN says only "nothing happens"
- **WHEN** the spec reviewer reviews the change
- **THEN** the review has a finding that names the scenario and says what the user sees is missing

### Requirement: UI test cases carry the e2e label
On the `clarify-ai-qa` and `clarify-qa` schemas, every test case under a scenario that covers an `in scope` or `mock` element SHALL carry the `e2e` label, alone or with other labels.

#### Scenario: UI case without e2e is reported
- **GIVEN** a scenario that covers the element "export-button" and a test case under it labelled only `automated`
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the test case and says the `e2e` label is required

#### Scenario: UI case with automated and e2e passes
- **GIVEN** a scenario that covers the element "export-button" and a test case under it labelled `automated, e2e`
- **WHEN** the test-case check runs on the change
- **THEN** it reports no label error for that test case
