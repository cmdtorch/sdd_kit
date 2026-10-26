# Spec Delta

## Purpose

Defines the E2E stage of a change: when a change needs it, where it sits in each kit workflow, how it is recorded, when it is complete, and how it gates the archive.

## ADDED Requirements

### Requirement: Each change decides whether it needs E2E
On `clarify`, `clarify-ai-qa` and `clarify-qa` the Main round SHALL ask whether the change needs E2E and against which backend the tests run; on `lean` the AI SHALL ask before the implementation. E2E applies only to a web application in a monorepo. The decision SHALL be recorded in the stage record `e2e.md` as `real backend`, `stubbed backend` or `skipped`; on `clarify` and `lean` a change without `e2e.md` does not use E2E.

#### Scenario: Web change in a monorepo gets the E2E question
- **GIVEN** a `clarify-ai-qa` change of a web application in a monorepo
- **WHEN** the AI writes the Main round questions
- **THEN** the round has a question whether the change needs E2E and against which backend the tests run

#### Scenario: Lean change is asked before the implementation
- **GIVEN** a `lean` change of a web application whose planning artifacts are done
- **WHEN** the AI starts the implementation
- **THEN** it first asks the developer whether the change needs E2E and records the answer in `e2e.md`

#### Scenario: Unknown mode is reported
- **GIVEN** an `e2e.md` whose mode is "staging server"
- **WHEN** the E2E check `check-e2e` runs on the change
- **THEN** it reports an error that names "staging server" and lists the modes `real backend`, `stubbed backend` and `skipped`

### Requirement: The stage record names the E2E tests and the application
Unless E2E is skipped, `e2e.md` SHALL name the folder of the project that holds the change's E2E tests and how the application is started: by the AI with a start command, or by the developer at a recorded address. Only tests in that folder count as E2E tests.

#### Scenario: Missing test folder is reported
- **GIVEN** an `e2e.md` with the mode `real backend` and no test folder
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that says the E2E test folder is missing

#### Scenario: Developer start without an address is reported
- **GIVEN** an `e2e.md` that records that the developer starts the application and no address
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that says the application address is missing

### Requirement: The stage runs after the implementation and gates the archive
When a change needs E2E, the stage SHALL run after every implementation task is done and before the archive. It is complete, without a separate confirmation, when every required E2E test has a valid passed or accepted result and no screenshot has an open difference. The archive gate SHALL run `check-e2e`; while it reports an error the archive SHALL be blocked with a message that names what is missing.

#### Scenario: Archive is blocked before the first E2E run
- **GIVEN** a change that needs E2E, all tasks done and no recorded E2E run
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that says the E2E stage has not run

#### Scenario: Failing case blocks the archive
- **GIVEN** a change whose latest result for the case "Export of a month with two sales" is failed and not accepted
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "Export of a month with two sales"

#### Scenario: Green run with an accepted case allows the archive
- **GIVEN** a change whose latest results pass every case except one that the developer accepted with a reason
- **WHEN** the change is archived
- **THEN** the archive is not blocked by the E2E stage

#### Scenario: Test-case change without an E2E decision blocks the archive
- **GIVEN** a `clarify-qa` change with all tasks done and no `e2e.md`
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that says the E2E decision is missing

#### Scenario: Clarify change without E2E archives as before
- **GIVEN** a `clarify` change with no `e2e.md`
- **WHEN** the change is archived
- **THEN** the archive is not blocked by the E2E stage

#### Scenario: Lean change without E2E archives as before
- **GIVEN** a `lean` change with no `e2e.md`
- **WHEN** the change is archived
- **THEN** the archive is not blocked by the E2E stage

### Requirement: Test results stay valid until the code they tested changes
Each recorded run SHALL keep its result per E2E test and the fingerprints of the project files outside `openspec/` (files git tracks or would track). A later change to an E2E test's own file makes only its results invalid; any other changed file makes every earlier result invalid, unless the developer's decision that no new run is needed is recorded for it. An accepted case stays accepted.

#### Scenario: Rerun of a test fixed in its own file completes the stage
- **GIVEN** a full run where only "Export of a month with two sales" failed, a fix of a selector in that test's file only, and a later run of only that test that passed
- **WHEN** the change is archived
- **THEN** the archive is not blocked by the E2E stage

#### Scenario: Shared E2E helper change needs every test again
- **GIVEN** a full green run, then a change to a shared sign-in helper in the E2E test folder, and a later run of only "Export of a month with two sales"
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that says the other E2E tests have no valid result

#### Scenario: Application fix needs every test again
- **GIVEN** a full run where only "Export of a month with two sales" failed, a fix in the application code, and a later run of only that test that passed
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that says the other E2E tests have no result after the latest application change

### Requirement: Skipped E2E is marked and listed for QA
When a change does not need E2E, the developer skips it on purpose, or Playwright is not allowed, no E2E test SHALL be written, `e2e.md` SHALL hold the mode `skipped` and MAY hold a note, the AI SHALL show the developer that E2E was skipped, and every case labelled `e2e` SHALL be listed as a manual check for QA at the end of the implementation, or at the end of the stage when E2E is skipped during it. The archive SHALL NOT be blocked by the stage.

#### Scenario: Skipped E2E does not block the archive
- **GIVEN** a `clarify-ai-qa` change whose `e2e.md` has the mode `skipped` and no note
- **WHEN** the change is archived
- **THEN** the archive is not blocked by the E2E stage

#### Scenario: Developer skips E2E on purpose
- **GIVEN** a change that needs E2E with the mode `real backend`
- **WHEN** the developer tells the AI to skip E2E for this change
- **THEN** the AI sets the mode to `skipped`, writes no E2E test, and tells the developer that E2E was skipped

#### Scenario: Skipped E2E lists the e2e cases for QA
- **GIVEN** a change with the case "Export of a month with two sales" labelled `automated, e2e` and E2E skipped
- **WHEN** the AI finishes the implementation
- **THEN** it lists "Export of a month with two sales" as a manual check for QA and says that E2E was skipped

### Requirement: Project changes after the stage are caught
When project files change after the stage is complete, the archive SHALL be blocked until a new run is recorded or the developer's decision that no new run is needed is recorded. The AI SHALL run E2E again by itself when the change touches business logic, and otherwise ask the developer.

#### Scenario: Code changed after the stage blocks the archive
- **GIVEN** a change whose E2E stage is complete, and a project file changed after the latest run
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that says project files changed after the latest E2E run

#### Scenario: Developer decides no new run is needed
- **GIVEN** a project file changed after the latest run, and `e2e.md` records the developer's decision that no new run is needed for that change
- **WHEN** the change is archived
- **THEN** the archive is not blocked by the E2E stage

#### Scenario: Business logic change is run again
- **GIVEN** a completed E2E stage and a later fix that changes how an export total is calculated
- **WHEN** the AI finishes the fix
- **THEN** it runs the E2E tests again without asking and records the new run

#### Scenario: Minor change asks the developer
- **GIVEN** a completed E2E stage and a later fix of a typo in a code comment
- **WHEN** the AI finishes the fix
- **THEN** it asks the developer whether to run E2E again and records the answer
