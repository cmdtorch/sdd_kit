## MODIFIED Requirements

### Requirement: The final group is run by the main agent
The main agent SHALL run the final group itself: it runs the test reviewer, runs the full suite, and writes `apply-report.md`. Code and test fixes inside the final group go through subagents.

#### Scenario: Final group
- **GIVEN** every group before the final group is accepted
- **WHEN** the final group runs
- **THEN** the main agent starts the test reviewer, runs the full suite itself and writes `apply-report.md`

### Requirement: Every code edit goes through a subagent
During apply of a change stamped 0.5.0 or later the main agent SHALL NOT edit the project's code or tests itself. Every edit, including a small fix after the test review, after a check or during the E2E stage, SHALL be done by a subagent. The main agent writes only the change's own files (`tasks.md` check marks, `apply-report.md`, `e2e.md`, `clarifications.md`). Every blocker and major finding of one test review SHALL go to one subagent, and the failing tests of one E2E run SHALL go to one subagent, which reruns its tests through `e2e-run.mjs` and makes at most three fix attempts per test.

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

### Requirement: Progress line after each subagent
After each finished subagent, and after its own full-suite run, the main agent SHALL write one line in the chat: the group number and name (for a subagent without a group `fix: <what>`, for the full-suite run `full suite`), the tasks done, the model it ran on, and whether the tests pass or which fail.

#### Scenario: Group finished, tests pass
- **WHEN** the subagent of group 2 "Order API" finishes tasks 2.1 to 2.4 on `sonnet` and its tests pass
- **THEN** the chat shows one line naming group 2 "Order API", tasks 2.1 to 2.4, `sonnet` and that its tests pass

#### Scenario: Full-suite subagent finished
- **WHEN** the main agent's full-suite run finishes and every test passes
- **THEN** the chat shows one line starting with `full suite`, naming the main chat's model and that every test passes

#### Scenario: Group finished, tests fail
- **WHEN** the subagent of group 3 finishes and two of its tests fail
- **THEN** the chat line for group 3 names the two failing tests

## ADDED Requirements

### Requirement: Full suite at the end is run by the main agent
At the end of apply the main agent SHALL run the project's full test suite and quality checks itself. When a command fails, it SHALL hand the fix, with the failing output, to one subagent and run the failed commands again after it ends; at most two fix attempts, then it SHALL stop and show the developer the failures. It SHALL report the commands and their result to the developer.

#### Scenario: End-of-apply suite passes
- **GIVEN** the installed kit
- **WHEN** the section "The final group" of `openspec/protocols/subagents.md` is read
- **THEN** it says that the main agent runs the project's full test suite and quality checks itself and starts no subagent when they pass

#### Scenario: End-of-apply suite fails
- **GIVEN** the installed kit
- **WHEN** the section "The final group" of `openspec/protocols/subagents.md` is read
- **THEN** it says that a failing command's fix goes to one subagent together with the failing output, that the main agent runs the failed commands again afterwards, and that after the second failed fix attempt it stops and shows the developer the failures

#### Scenario: Testing protocol agrees
- **GIVEN** the installed kit
- **WHEN** the section on the end of apply of `openspec/protocols/testing.md` is read
- **THEN** it says that on a change stamped 0.5.0 or later the main agent runs the full suite and the fixes run in subagents

## REMOVED Requirements

### Requirement: Full suite at the end runs in a subagent
**Reason**: starting a subagent to run a command costs a cold start and a re-read of the change without adding quality; the main agent runs the suite and a subagent is started only for a fix.
**Migration**: see "Full suite at the end is run by the main agent".
