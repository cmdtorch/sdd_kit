# Spec Delta

## Purpose

Defines the two schemas that add the test-cases stage to the clarify workflow, `clarify-ai-qa` with the AI QA reviewer only and `clarify-qa` with the AI QA reviewer followed by a human QA, while `clarify` and `lean` stay as they are.

## ADDED Requirements

### Requirement: Two test-case schemas
The kit SHALL ship two test-case schemas: `clarify-ai-qa`, where the AI QA reviewer alone reviews the test cases, and `clarify-qa`, where the AI QA reviewer is followed by a human QA. The schema of a change SHALL decide its review flow; no other setting SHALL change it.

#### Scenario: Both schemas are available after install
- **GIVEN** a project where the kit was just installed
- **WHEN** the developer lists the available schemas
- **THEN** the list contains `clarify-ai-qa` and `clarify-qa` next to `clarify` and `lean`

#### Scenario: AI-only schema has no human hand-over
- **GIVEN** a change on the `clarify-ai-qa` schema
- **WHEN** its AI review loop ends with every blocker and major finding fixed or accepted
- **THEN** no hand-over to a human QA is requested and the developer is asked to confirm the result

#### Scenario: Human-QA schema hands over to QA
- **GIVEN** a change on the `clarify-qa` schema
- **WHEN** its AI review loop ends with every blocker and major finding fixed or accepted
- **THEN** the test cases are handed over to the human QA

### Requirement: Test-cases stage sits between specs and design
Both test-case schemas SHALL have the artifacts of `clarify` with the test-cases artifact between the specs and the design, in this order: clarifications, proposal, specs, test cases, design, verification plan, tasks. The design SHALL require the test cases.

#### Scenario: Test cases come after the specs
- **GIVEN** a new change on the `clarify-qa` schema whose specs are written
- **WHEN** the developer checks the change status
- **THEN** the test-cases artifact is ready and the design is blocked by it

#### Scenario: Same artifacts in both schemas
- **GIVEN** the `clarify-ai-qa` and `clarify-qa` schemas
- **WHEN** their artifact lists are compared
- **THEN** both lists are clarifications, proposal, specs, test cases, design, verification plan, tasks, in this order

### Requirement: Clarify rules hold in the test-case schemas
The test-case schemas SHALL keep every rule of `clarify`: the question rounds and their gates, grounding, the spec reviewer, the verification plan, TDD tasks with scenario markers, the test reviewer and the archive gate.

#### Scenario: Question gate applies
- **GIVEN** a change on the `clarify-ai-qa` schema whose Main round summary is not confirmed
- **WHEN** the AI tries to write `proposal.md`
- **THEN** the write is blocked as on the `clarify` schema

#### Scenario: Archive gate applies to scenarios
- **GIVEN** a change on the `clarify-qa` schema where a scenario planned as `unit` has no test with its scenario marker
- **WHEN** the change is archived
- **THEN** the archive is blocked as on the `clarify` schema, with a message that names the scenario

### Requirement: Clarify and lean are unchanged
The `clarify` and `lean` schemas SHALL keep their artifacts and rules; neither gets the test-cases stage.

#### Scenario: Clarify has no test-cases artifact
- **GIVEN** a new change on the `clarify` schema
- **WHEN** the developer checks the change status
- **THEN** the artifacts are clarifications, proposal, specs, design, verification plan, tasks, with no test-cases artifact

#### Scenario: Lean has no test-cases artifact
- **GIVEN** a new change on the `lean` schema
- **WHEN** the developer checks the change status
- **THEN** the artifacts are proposal, specs, verification plan, tasks, with no test-cases artifact
