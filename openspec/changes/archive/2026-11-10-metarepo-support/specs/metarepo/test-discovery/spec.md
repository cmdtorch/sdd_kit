# Spec Delta

## Purpose

Defines how the kit finds the marked tests of a meta-repository change inside the declared clones and the root, shows which repository each test belongs to, and counts a test only for the repositories that the verification plan names for its scenario or test case.

## ADDED Requirements

### Requirement: Marked tests are found inside the clones
In a meta-repository the kit SHALL read scenario markers and case references in every declared clone that exists, by the clone's own git rules: tracked and untracked files count, files it ignores are not read. Its `openspec/` and `.claude/` folders are skipped; `openspec/markers-ignore` patterns are relative to the root and also match clone paths. This holds for the traceability check, the review input and the archive gate.

#### Scenario: Committed test in a clone closes a scenario
- **GIVEN** a meta-repository whose root ignores `repos/*`, and a committed test in `repos/backend` with the marker of "Order is created"
- **WHEN** `check-traceability --markers` runs in the root
- **THEN** "Order is created" has a test

#### Scenario: Uncommitted test in a clone closes a scenario
- **GIVEN** the same test, not committed in `repos/backend`
- **WHEN** `check-traceability --markers` runs in the root
- **THEN** "Order is created" has a test

#### Scenario: File ignored by the clone is not read
- **GIVEN** the marker of "Order is created" only in a file that `repos/backend` ignores
- **WHEN** `check-traceability --markers` runs in the root
- **THEN** "Order is created" has no test

#### Scenario: Clone's own OpenSpec folder is not read
- **GIVEN** the marker of "Order is created" only in `repos/backend/openspec/changes/add-export/tasks.md`
- **WHEN** `check-traceability --markers` runs in the root
- **THEN** "Order is created" has no test

#### Scenario: Root ignore pattern excludes a clone path
- **GIVEN** `openspec/markers-ignore` holds `repos/backend/docs/` and the marker of "Order is created" only in `repos/backend/docs/testing.md`
- **WHEN** `check-traceability --markers` runs in the root
- **THEN** "Order is created" has no test

### Requirement: A test path shows its repository
Every place that shows a found test (the traceability check, the test reviewer's input, the archive gate) SHALL give its path relative to the root, so that a test in a clone starts with that clone's folder.

#### Scenario: Review input shows the clone
- **GIVEN** the marker of "Order is created" in `repos/backend/tests/test_orders.py`
- **WHEN** `review-input.mjs` runs for the change
- **THEN** it lists the test as `repos/backend/tests/test_orders.py`

### Requirement: Every plan row names its repository
In a meta-repository change the *Scenario coverage* table of the verification plan SHALL have a *Repository* column, and every row, `manual` rows included, SHALL name one or more repositories separated by commas: declared clone names or `root`. A missing column, an empty cell or an unknown name SHALL be reported as an error.

#### Scenario: Missing column is reported
- **GIVEN** a meta-repository change whose *Scenario coverage* table has no *Repository* column
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports an error that the table needs a *Repository* column

#### Scenario: Row without a repository is reported
- **GIVEN** a meta-repository change whose plan row for "Order is created" has an empty *Repository* cell
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports an error that names "Order is created"

#### Scenario: Unknown repository is reported
- **GIVEN** a plan row that names the repository `mobile`, which `openspec/clones` does not declare
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports an error that names `mobile` as an unknown repository

#### Scenario: Manual row without a repository is reported
- **GIVEN** a `manual` plan row with a valid manual reason and an empty *Repository* cell
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports an error that names its scenario

### Requirement: A test counts only in a named repository
For a `unit` or `integration` row the traceability check and the archive gate SHALL require a marked test in each repository the row names, of any kind (a Playwright test in a clone counts), and SHALL NOT count a test in another repository. The root's tests outside `openspec/`, the declared clone folders and the E2E test folder count for `root`. The message SHALL name the scenario and each repository without a test.

#### Scenario: Backend test does not close a frontend row
- **GIVEN** a plan row for "Order list is shown" with level `integration` and repository `frontend`, and its marked test only in `repos/backend`
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** it reports that "Order list is shown" has no test in `frontend`

#### Scenario: Playwright test in the frontend clone closes a frontend row
- **GIVEN** a plan row for "Order list is shown" with level `integration` and repository `frontend`, and a Playwright test in `repos/frontend/tests/orders.spec.ts` with its marker
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** "Order list is shown" has a test, shown as `repos/frontend/tests/orders.spec.ts`

#### Scenario: Row for two repositories needs a test in each
- **GIVEN** a plan row for "Order is created" with repositories `backend, root` and its marked test only in `repos/backend`
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "Order is created" and `root`

#### Scenario: Root test closes a root row
- **GIVEN** a plan row with repository `root` and its marked test in `checks/test_rules.py` of the root
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** the scenario has a test

### Requirement: Automated test cases name their repository
On the test-case schemas in a meta-repository, the *Test case coverage* table of the plan (one row per `automated` case) SHALL have a *Repository* column with the same rules as the scenario rows, and a case reference SHALL count only in a repository that its row names.

#### Scenario: Case reference in the wrong repository does not count
- **GIVEN** a `clarify-ai-qa` change whose coverage row for the case "Empty order list" names `backend`, and the only test with its case reference in `repos/frontend`
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** it reports that "Empty order list" has no test in `backend`

### Requirement: A missing clone blocks only the changes that name it
When a declared clone is missing, the traceability check and the archive gate SHALL report it as missing for each plan row, coverage row or task group of the change that names it, and the archive SHALL be blocked. A missing clone that the change does not name SHALL NOT block its archive.

#### Scenario: Archive blocked by a named missing clone
- **GIVEN** a change whose plan row names `frontend` and `repos/frontend` does not exist
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that the clone `frontend` is missing

#### Scenario: Archive blocked by a task group on a missing clone
- **GIVEN** a change whose plan rows name only `backend`, whose task group `## 3. [frontend] Order screen` names `frontend`, and `repos/frontend` does not exist
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that the clone `frontend` is missing

#### Scenario: Archive not blocked by a clone the change does not name
- **GIVEN** a change that names only `backend`, every scenario covered, and `repos/frontend` missing
- **WHEN** the change is archived
- **THEN** the missing clone `frontend` does not block the archive

### Requirement: Search stays within the hook timeouts
Finding the marked tests of a meta-repository SHALL finish within the timeouts of the hooks that use it (archive gate 60 seconds, answers-gate and artifact feedback 30 seconds) on clones of real size: a backend with about 150 API routes and a frontend with 354 request files and its `node_modules`.

#### Scenario: Large frontend clone with dependencies
- **GIVEN** a meta-repository whose frontend clone ignores `node_modules/` holding 50,000 files and has 400 source files, and a backend clone with 300 source files
- **WHEN** the marked tests of a change are collected
- **THEN** the collection finishes in less than 30 seconds, half the archive gate's timeout, on the machine that runs the kit's test suite
