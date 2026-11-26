## MODIFIED Requirements

### Requirement: Every code edit goes through a subagent
In apply of a change stamped 0.5.0 or later the main agent SHALL NOT edit project code or tests: a subagent makes every edit, small fixes after a test review, a check or in the E2E stage included; the main agent writes only the change's own files (`tasks.md` check marks, `apply-report.md`, `e2e.md`, `clarifications.md`). One test review's blocker and major findings SHALL go to one subagent, and so SHALL one E2E run's failing tests, rerun via `e2e-run.mjs`, at most three fix attempts each.

#### Scenario: Fix after the test review
- **GIVEN** the test reviewer reports a blocker finding in one test
- **WHEN** the main agent acts on the finding
- **THEN** the fix is made by a newly started subagent, and the main agent edits no test or code file itself

#### Scenario: Failing E2E test
- **GIVEN** an E2E test fails in the E2E stage
- **WHEN** the main agent has read the run result
- **THEN** the fix of the application code or of the E2E test is made by a newly started subagent, and the main agent runs the E2E tests again

#### Scenario: Several review findings go to one subagent
- **GIVEN** the installed kit
- **WHEN** the section "The final group" of `openspec/protocols/subagents.md` is read
- **THEN** it says that every blocker and major finding of one test review is handed to one subagent together

#### Scenario: Failing tests of one E2E run go to one subagent
- **GIVEN** the installed kit
- **WHEN** the section "The final group" of `openspec/protocols/subagents.md` is read
- **THEN** it says that the failing tests of one E2E run are handed to one subagent together, that this subagent reruns its tests through `e2e-run.mjs` with at most three fix attempts per test, and that the main agent makes the full run afterwards

#### Scenario: Subagent definition allows running its E2E tests
- **GIVEN** the installed kit
- **WHEN** the implementation subagent's definition in `.claude/agents/` is read
- **THEN** it says that an E2E fix reruns only its failing tests through `e2e-run.mjs` and stops after the third failed attempt on a test
