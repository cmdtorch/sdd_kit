# metarepo/e2e Specification

## Purpose
Defines the E2E stage and the start check in a meta-repository whose clones together form one web application: when the E2E question is asked, the `e2e` level of the verification plan, where the E2E tests live, which repository they prove, and which edits invalidate a recorded run.

## Requirements

### Requirement: The E2E question for changes that touch the web interface
In a meta-repository the clones together count as one web application for the E2E stage. The meta-repository protocol `openspec/protocols/metarepo.md` SHALL tell the agent to ask the E2E question (Main round on the clarify family, before the first task on `lean`) only when the change touches the web interface, and otherwise to record the stage as skipped with the reason that the change does not touch the web interface.

#### Scenario: Protocol asks only for interface changes
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/metarepo.md` is read
- **THEN** it says that the E2E question is asked only for a change that touches the web interface, in the Main round on the clarify family and before the first task on `lean`

#### Scenario: Skipped stage without interface passes
- **GIVEN** a meta-repository `clarify-ai-qa` change whose stage record says `Mode: skipped` with the note that the change does not touch the web interface, and no case labelled `e2e`
- **WHEN** `check-e2e --mode archive` runs on the change
- **THEN** it reports no error

### Requirement: The e2e level of the verification plan
In a meta-repository change a plan row MAY have the level `e2e`. Such a row SHALL be proven by an E2E test of the stage that references its scenario and has a valid passed run recorded by `e2e-run.mjs`; no marked test in a repository is needed. With the stage skipped, the row counts only as an entry under "Not verified automatically" with the developer's `Consent:`. A project without clones has no `e2e` level.

#### Scenario: Frontend-only scenario proven by E2E
- **GIVEN** a plan row for "Empty phone shows a hint" with level `e2e` and repository `frontend`, and an E2E test that references it with a passed recorded run
- **WHEN** the change is archived
- **THEN** the row does not block the archive

#### Scenario: e2e row without an E2E test blocks the archive
- **GIVEN** the same row and no E2E test that references "Empty phone shows a hint"
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "Empty phone shows a hint"

#### Scenario: e2e row with E2E skipped needs consent
- **GIVEN** the same row, the stage record `Mode: skipped`, and no entry for the scenario under "Not verified automatically"
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "Empty phone shows a hint"

#### Scenario: e2e row with E2E skipped passes with consent
- **GIVEN** the same row, the stage record `Mode: skipped`, and the scenario under "Not verified automatically" with a reason and a `Consent:` line
- **WHEN** the change is archived
- **THEN** the row does not block the archive

#### Scenario: Backend row leaves the frontend to E2E
- **GIVEN** a scenario "Order is created" that touches both clones, with one plan row of level `integration` and repository `backend`, and its marked test in `repos/backend`
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** it reports no error for "Order is created", and asks for no test in `frontend`

#### Scenario: e2e level in a single repository is reported
- **GIVEN** a project without `openspec/clones` and a plan row with level `e2e`
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports an unknown level `e2e`

### Requirement: E2E tests live in the root and prove the whole application
In a meta-repository the E2E test folder named in the stage record SHALL be a folder of the root. An E2E test of the stage SHALL prove the `e2e` rows, the listed scenarios and the `e2e` cases whatever repository the plan names, and SHALL NOT close a `unit` or `integration` row. Playwright tests outside that folder, such as tests in the frontend clone, SHALL NOT count as E2E tests of the stage; they count only as marked tests of their clone.

#### Scenario: Root E2E test proves a frontend scenario
- **GIVEN** the stage record names the test folder `e2e/` of the root, and a test there references "Empty phone shows a hint" with a passed recorded run
- **WHEN** `check-e2e --mode archive` runs on the change
- **THEN** it reports no error for "Empty phone shows a hint"

#### Scenario: Root E2E test does not close a backend integration row
- **GIVEN** a plan row for "Order is created" with level `integration` and repository `backend`, and its marker only in an E2E test of the root's `e2e/` folder
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** it reports that "Order is created" has no test in `backend`

#### Scenario: Clone Playwright test does not count
- **GIVEN** the only Playwright test that references "Empty phone shows a hint" is in `repos/frontend/tests/`
- **WHEN** `check-e2e --mode archive` runs on the change
- **THEN** it reports that "Empty phone shows a hint" has no E2E test

#### Scenario: Test folder inside a clone is reported
- **GIVEN** a meta-repository stage record that names the test folder `repos/frontend/e2e/`
- **WHEN** `check-e2e` runs on the change
- **THEN** it reports an error that the E2E test folder must be a folder of the root

### Requirement: Recorded runs cover every clone
In a meta-repository a recorded E2E run SHALL become invalid after any edit to a file of any declared clone or of the root, except the root's `openspec/` folder and the E2E test folder (whose own rules stay as in kit 0.4). Clone files are read by each clone's own git rules.

#### Scenario: Edit in a clone invalidates the run
- **GIVEN** a passed recorded run and then an edit to `repos/backend/orders/views.py`
- **WHEN** `check-e2e --mode archive` runs on the change
- **THEN** it reports that the E2E tests must run again

#### Scenario: Edit in an untouched clone also invalidates the run
- **GIVEN** a change whose task groups name only `frontend`, a passed recorded run, and then an edit to a file in `repos/backend`
- **WHEN** `check-e2e --mode archive` runs on the change
- **THEN** it reports that the E2E tests must run again

#### Scenario: File ignored by a clone does not invalidate the run
- **GIVEN** a passed recorded run and then a change inside `repos/frontend/node_modules/`, which the clone ignores
- **WHEN** `check-e2e --mode archive` runs on the change
- **THEN** the run stays valid

### Requirement: Start check from the root
In a meta-repository the start check before the first task SHALL start the application with one command run from the root that starts every clone it needs, and SHALL request one address, as in a single repository.

#### Scenario: One root command starts both clones
- **GIVEN** the meta-repository instructions start the application with `mise run up` and serve it at `http://localhost:3000`
- **WHEN** the start check runs before the first task
- **THEN** `start-check.mjs` runs `mise run up` from the root and requests `http://localhost:3000`
