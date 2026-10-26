# Spec Delta

## Purpose

Defines the E2E tests of a change: which cases or scenarios get one, how Playwright and the application are set up, where the test data comes from, how each test stays tied to its case, and how failing tests are fixed or accepted.

## ADDED Requirements

### Requirement: Every e2e case gets an E2E test
On `clarify-ai-qa` and `clarify-qa`, every test case labelled `e2e` SHALL have an E2E test, a test in the E2E test folder named in `e2e.md`, that references it by `@case <capability-path> :: <case name>`. On `clarify` and `lean`, the AI SHALL mark the spec scenarios that go through the interface, list them in the stage record and show the list to the developer, and each listed scenario SHALL have an E2E test that references it by `@scenario`.

#### Scenario: E2E case without a test blocks the archive
- **GIVEN** a `clarify-ai-qa` change that needs E2E and the case "Export of a month with two sales" labelled `automated, e2e` that no E2E test references
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "Export of a month with two sales"

#### Scenario: Listed scenario without a test blocks the archive
- **GIVEN** a `clarify` change whose stage record lists the scenario "Successful export" for E2E and no E2E test references it
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "Successful export"

#### Scenario: Listed scenario that does not exist is reported
- **GIVEN** a stage record that lists the scenario "Export starts" while no delta spec has a scenario with that name
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that names "Export starts"

#### Scenario: Unit test does not count as E2E coverage
- **GIVEN** the case "Export of a month with two sales" labelled `automated, e2e`, referenced only by a unit test outside the E2E test folder
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that names "Export of a month with two sales" as having no E2E test

#### Scenario: Case that is not e2e needs no E2E test
- **GIVEN** a case labelled only `automated` that no E2E test references
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports no E2E coverage error for that case

### Requirement: Playwright is installed with permission
E2E tests SHALL be written with Playwright and run in Chromium only. When the project has no Playwright, the AI SHALL ask the developer's permission before installing and configuring it. Without permission the AI SHALL record E2E as skipped with that reason.

#### Scenario: Playwright is installed after permission
- **GIVEN** a web project without Playwright and a change that needs E2E
- **WHEN** the E2E stage starts
- **THEN** the AI asks for permission before installing Playwright and installs it only after the developer allows it

#### Scenario: Permission refused skips E2E
- **GIVEN** a web project without Playwright
- **WHEN** the developer refuses to install it
- **THEN** the AI writes no E2E test and records in `e2e.md` that E2E was skipped because Playwright was not allowed

### Requirement: The application is started as the developer chooses
At the start of the E2E stage of each change the AI SHALL ask once whether the developer starts the application, giving its address, or the AI starts it through Playwright with the project's start command, record the answer in `e2e.md`, and not ask again in that stage. When the project has no start command, the AI SHALL offer to write one into the project and SHALL write it only after the developer agrees.

#### Scenario: The start question is asked once
- **GIVEN** a change in the E2E stage whose first run failed
- **WHEN** the AI runs the tests again after a fix
- **THEN** it does not ask again who starts the application

#### Scenario: Missing start command is offered
- **GIVEN** a project with no command that starts the application, and the developer chose that the AI starts it
- **WHEN** the E2E stage starts
- **THEN** the AI offers to write a start command into the project and writes it only after the developer agrees

#### Scenario: Refused start command falls back to the developer
- **GIVEN** a project with no start command
- **WHEN** the developer refuses the offered start command
- **THEN** the AI asks the developer to start the application and give its address, and records the address in `e2e.md`

### Requirement: Tests prepare their own data
With a real backend, the application SHALL run on a separate empty test database, and each test SHALL create the users and data it needs with the project's own means (fixtures, a script or a service API); through the interface a test SHALL perform only the steps of its case. With a stubbed backend, the data SHALL be set in the stubs. Credentials SHALL NOT be committed to git.

#### Scenario: Test creates its user before the case steps
- **GIVEN** a change with a real backend and the case "Accountant exports March" that starts with a signed-in accountant
- **WHEN** the AI writes its E2E test
- **THEN** the test creates the accountant with the project's means before the steps and signs in, and the interface steps are only those of the case

#### Scenario: Credentials stay out of git
- **GIVEN** an E2E test that signs in with a password
- **WHEN** the AI writes the test
- **THEN** the password is created by the test or read from an environment variable, and no committed file holds it

#### Scenario: Project without a way to create data
- **GIVEN** a change with a real backend and a project with no fixtures, script or service API to create users
- **WHEN** the AI writes the first E2E test
- **THEN** it asks the developer how test data may be created before writing it

### Requirement: A test follows its case
An E2E test SHALL perform the Given, When and Then steps of its case. While fixing a test, the AI MAY change only how a step is performed (selectors, waits); when a case itself seems wrong, the AI SHALL ask the developer instead of changing what the test checks.

#### Scenario: Wrong case is asked about
- **GIVEN** a failing E2E test whose case expects a total of 150.00 while the spec says 145.00
- **WHEN** the AI fixes the failure
- **THEN** it asks the developer which value is right and does not change the expected total by itself

### Requirement: Failing tests are fixed in at most three attempts
Tests SHALL run without automatic retries, and each recorded run keeps the retries setting it was made with; a test that fails once is failing. The AI SHALL fix a failing test, in the code or in how the test performs its steps, at most three attempts per test, and then show it to the developer. The developer MAY accept a case with a reason recorded in the stage record; every other case SHALL pass.

#### Scenario: Automatic retries are reported
- **GIVEN** a recorded E2E run made with Playwright set to `retries: 2`
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that says retries must be 0

#### Scenario: Third failed attempt goes to the developer
- **GIVEN** an E2E test that still fails after the AI's third fix attempt
- **WHEN** the attempt ends
- **THEN** the AI stops fixing it and shows the developer the failure with what it tried

#### Scenario: Accepted case without a reason is reported
- **GIVEN** a stage record that accepts the case "Export of a month with two sales" with no reason
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that names the case and says the reason is missing

### Requirement: Accepted cases stay as skipped tests for QA
The test of an accepted case SHALL stay in the project, marked as skipped, with the reason in a comment. At the end of the stage the AI SHALL list every accepted case as a manual check for QA.

#### Scenario: Accepted case is listed for QA
- **GIVEN** the case "Export of a month with two sales" accepted with the reason "export service sandbox is down"
- **WHEN** the AI finishes the E2E stage
- **THEN** it lists the case as a manual check for QA with that reason, and its test is marked as skipped with the reason in a comment
