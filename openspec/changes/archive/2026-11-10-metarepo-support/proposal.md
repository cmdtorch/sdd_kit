# Proposal

## Why

A meta-repository keeps OpenSpec and the kit in its root and the application clones in their own folders, each
with its own git and ignored by the root; every spec and change lives in the root and the agent always starts
from the root [D1]. In that layout the kit finds no marked test inside a clone, so a change that touches the
clones can never be archived, and an edit to a clone's own OpenSpec change from the root passes every gate
silently [D1]. The Landau ERP meta-repository needs this now, and more projects of this kind will follow [desc].

## What Changes

- The project declares its clones in a project file in the root's OpenSpec folder: a name and a path per clone,
  with no dependency on mise [Q3].
- Doctor reports a declared clone that is missing on disk and offers to add a nested git repository that the list
  does not name; checks report a missing clone as missing, never as a scenario without a test [Q3][D1].
- The kit finds marked tests inside every declared clone by the clone's own rules: uncommitted files count,
  files the clone ignores are not read. This holds for the traceability check, the test reviewer's input and the
  archive gate, and the path of every test shows its clone [D1].
- Every row of the verification plan names the repository where its scenario is proven, in a new
  *Repository* column: one name or several, a test in each named repository, one level for the row. The column
  is required while the project declares clones; only a test in a named repository counts [Q4][Q5].
- The root is a repository like the clones: scenarios and task groups may name it and its tests count [Q12].
- On the test-case schemas every `automated` case names its repository by the same rules [Q16].
- Every task group except the final checks group names one repository; a group without it is a check error
  that blocks `tasks.md`; work in two clones is two groups [Q11][Q20].
- The agent finds each repository's test and quality commands in the meta-repository's documentation and mise
  tasks; the kit stores no commands [Q9].
- The implementation report has a section for every repository the change touches, with the full-suite
  commands and their result; the archive is blocked while a section is missing [Q10].
- The meta-repository with its backend and frontend clones is one web application for the E2E stage; frontend
  scenarios are proven only by the E2E stage with recorded runs [Q6][Q17].
- The E2E tests live in their own folder in the root and prove a scenario whatever its repository; Playwright
  tests a developer keeps in the frontend clone for themselves do not count [Q14][Q18].
- The start check before the first task runs one command from the root that starts both clones, and requests
  one address [Q15].
- An edit to a change inside a clone's own OpenSpec folder, made from a session started in the root, is
  blocked with a message that such changes are worked on from a session in the clone [Q8][Q19].
- Install, update and doctor run in the root without terminal questions and create or change nothing inside the
  clones; doctor also checks the clone list [D1].
- A project without declared clones behaves as with kit 0.4 [Q7][D1].

## Capabilities

### New Capabilities

- `metarepo/clones`: the declared clone list, missing and undeclared clones in doctor and checks, install and
  update in the root without touching the clones, the guard on a clone's own OpenSpec, and unchanged behaviour
  for projects without clones [Q3][Q8][Q19][D1]
- `metarepo/test-discovery`: marked tests and case references found inside the clones, the clone in every
  test path, and the repository of each plan row and `automated` case honoured by the traceability check, the
  review input and the archive gate [Q4][Q5][Q12][Q16][D1]
- `metarepo/apply`: the repository of every task group, test and quality commands per repository, and a section
  per touched repository in the implementation report checked by the archive [Q9][Q10][Q11][Q20]
- `metarepo/e2e`: the E2E stage and the start check in a meta-repository, with the E2E tests in the root and
  frontend scenarios proven only by the E2E stage [Q6][Q14][Q15][Q17][Q18]

### Modified Capabilities

None. Projects without declared clones keep every current requirement; the meta-repository rules are new
requirements that apply only while clones are declared [Q7][D1].

## Impact

- Kit libraries and checks: marker search, the verification plan parser, the traceability check, the review
  input, the task and implementation-report checks, the E2E check and the E2E run record [D1][Q10][Q14].
- Hooks: answers-gate (task groups, the clone OpenSpec guard), archive-gate (repository binding, missing clones,
  report sections) [Q11][Q19][D1].
- Doctor and the installer; protocols `testing.md`, `apply.md`, `e2e.md`; the `clarify` family, `lean` and the
  test-case schemas' plan and tasks templates and instructions [D1][Q7].
- The change builds on the 0.4 line, which stays beta: it touches code that the unarchived changes
  `add-e2e-stage`, `add-qa-test-cases-stage` and `add-ui-sources` introduced [Q7].
- Readiness: the acceptance scenarios of the requirements are automated as kit tests on a fixture
  meta-repository, then a pilot runs on the real Landau ERP meta-repository before release [Q13][D1].

## Assumptions & Open Questions

- [assumption] The root is named by a fixed name, not a path, in the *Repository* column and in a task group;
  the exact name and format are decided in the Design round.
- [assumption] The backend's own kit 0.3.0 gets nothing from this change and keeps working as a single-repository
  project during the transition.
