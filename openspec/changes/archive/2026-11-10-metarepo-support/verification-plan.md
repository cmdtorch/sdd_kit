# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| metarepo/apply | Every task group names its repository | Group without a repository blocks the tasks | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | Every task group names its repository | Group with an unknown repository blocks the tasks | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | Every task group names its repository | Group with two repositories blocks the tasks | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | Every task group names its repository | Final checks group needs no repository | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | Every task group names its repository | Single group needs a repository | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The agent works in the group's repository | Protocol names the group's repository | unit | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | Missing commands are proposed for AGENTS.md | Protocol suggests AGENTS.md in a meta-repository | unit | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | Missing commands are proposed for AGENTS.md | Kit block points to the protocol | unit | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Report with a section per repository | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Missing section blocks the archive | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Empty section is reported | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Root without tests reports no tests | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Section without a result is reported | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Repeated section is reported | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Failed result does not block by itself | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/apply | The full suite runs per touched repository | Repository named only in the plan needs no section | integration | no | temporary meta-repository change with `tasks.md` and `apply-report.md` variants | — |
| metarepo/clones | Clone list | Clone named after its folder | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Clone with its own name | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Repeated clone name is reported | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Repeated clone path is reported | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Reserved name is reported | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Path outside the root is reported | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Invalid clone list blocks the archive | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Name with a space is reported | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Invalid clone list is reported by the checks | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Empty clone list is a meta-repository | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Clone list | Empty clone list needs root in task groups | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Projects without clones are unchanged | Single repository change archives as before | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Projects without clones are unchanged | Health check says nothing about clones | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Root changes keep their gates | Unanswered Main round blocks the proposal in a meta-repository | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Root changes keep their gates | Open task blocks the archive in a meta-repository | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Missing clone is reported as missing | Health check reports a missing clone | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Missing clone is reported as missing | Checks name the missing clone instead of the test | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Undeclared nested repositories are offered | Doctor adds a clone in a terminal | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Undeclared nested repositories are offered | Developer answers no | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Undeclared nested repositories are offered | Doctor only prints without a terminal | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Undeclared nested repositories are offered | Offered line avoids a known name | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Undeclared nested repositories are offered | Install never asks about nested repositories | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Undeclared nested repositories are offered | Repository inside dependencies is not offered | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Installer in a terminal asks for the repository kind | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Single repository answer creates no list | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Invalid path in a terminal is asked again | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Path not yet on disk is accepted | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Installer in a terminal asks the clone paths | unit | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Update asks no repository question | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Install with clones in the flag | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Flag with a bare path | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Install with the flag alone | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Install without the flag stays a single repository | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Invalid flag entry writes nothing | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Update switches a single repository to a meta-repository | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Update adds clones to an existing list | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Known path under another name writes nothing | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Install and update set up a meta-repository | Update keeps the clone list | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | The kit changes nothing inside a clone | Install leaves the clones untouched | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | The kit changes nothing inside a clone | Uninstall leaves the clones and the list | integration | yes | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Changes started before the switch keep their rules | Change started before the switch archives under the old rules | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Changes started before the switch keep their rules | Change started after the switch is marked | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Changes started before the switch keep their rules | Change created before the switch but written after it | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | Changes started before the switch keep their rules | Clone list removed during a meta-repository change | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | A clone's own OpenSpec is not edited from the root | Editing a clone's proposal is blocked | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | A clone's own OpenSpec is not edited from the root | Shell write to a clone's OpenSpec is blocked | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | A clone's own OpenSpec is not edited from the root | Write through an absolute path is blocked | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | A clone's own OpenSpec is not edited from the root | Removing a clone's OpenSpec file is blocked | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/clones | A clone's own OpenSpec is not edited from the root | Reading a clone's OpenSpec is allowed | integration | no | temporary meta-repository: root git with `repos/*` ignored, clones `repos/backend` and `repos/frontend` with their own git; `openspec/clones` variants | — |
| metarepo/e2e | The E2E question for changes that touch the web interface | Protocol asks only for interface changes | unit | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The E2E question for changes that touch the web interface | Skipped stage without interface passes | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The e2e level of the verification plan | Frontend-only scenario proven by E2E | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The e2e level of the verification plan | e2e row without an E2E test blocks the archive | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The e2e level of the verification plan | e2e row with E2E skipped needs consent | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The e2e level of the verification plan | e2e row with E2E skipped passes with consent | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The e2e level of the verification plan | Backend row leaves the frontend to E2E | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | The e2e level of the verification plan | e2e level in a single repository is reported | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | E2E tests live in the root and prove the whole application | Root E2E test proves a frontend scenario | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | E2E tests live in the root and prove the whole application | Root E2E test does not close a backend integration row | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | E2E tests live in the root and prove the whole application | Clone Playwright test does not count | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | E2E tests live in the root and prove the whole application | Test folder inside a clone is reported | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | Recorded runs cover every clone | Edit in a clone invalidates the run | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | Recorded runs cover every clone | Edit in an untouched clone also invalidates the run | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | Recorded runs cover every clone | File ignored by a clone does not invalidate the run | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/e2e | Start check from the root | One root command starts both clones | integration | no | temporary meta-repository change with `e2e.md`, a root `e2e/` folder and a recorded `e2e-runs.json` | — |
| metarepo/test-discovery | Marked tests are found inside the clones | Committed test in a clone closes a scenario | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Marked tests are found inside the clones | Uncommitted test in a clone closes a scenario | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Marked tests are found inside the clones | File ignored by the clone is not read | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Marked tests are found inside the clones | Clone's own OpenSpec folder is not read | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Marked tests are found inside the clones | Root ignore pattern excludes a clone path | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A test path shows its repository | Review input shows the clone | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Every plan row names its repository | Missing column is reported | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Every plan row names its repository | Row without a repository is reported | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Every plan row names its repository | Unknown repository is reported | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Every plan row names its repository | Manual row without a repository is reported | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A test counts only in a named repository | Backend test does not close a frontend row | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A test counts only in a named repository | Playwright test in the frontend clone closes a frontend row | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A test counts only in a named repository | Row for two repositories needs a test in each | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A test counts only in a named repository | Root test closes a root row | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Automated test cases name their repository | Case reference in the wrong repository does not count | integration | yes | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A missing clone blocks only the changes that name it | Archive blocked by a named missing clone | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A missing clone blocks only the changes that name it | Archive blocked by a task group on a missing clone | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | A missing clone blocks only the changes that name it | Archive not blocked by a clone the change does not name | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |
| metarepo/test-discovery | Search stays within the hook timeouts | Large frontend clone with dependencies | integration | no | temporary meta-repository with marked tests committed, uncommitted and ignored in the clones; plans with *Repository* cells | — |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| metarepo/apply | Every task group names its repository | [Q11][Q20][Q12][D1] |
| metarepo/apply | The agent works in the group's repository | [Q9][Q44][D1] |
| metarepo/apply | Missing commands are proposed for AGENTS.md | [Q39][Q44] |
| metarepo/apply | The full suite runs per touched repository | [Q10][Q23][Q24][D1] |
| metarepo/clones | Clone list | [Q3][Q37][Q40] |
| metarepo/clones | Projects without clones are unchanged | [Q30][Q7][D1] |
| metarepo/clones | Root changes keep their gates | [D1] |
| metarepo/clones | Missing clone is reported as missing | [Q3][D1] |
| metarepo/clones | Undeclared nested repositories are offered | [Q3][Q35] |
| metarepo/clones | Install and update set up a meta-repository | [Q28][Q34][Q37][Q43][Q36][D1] |
| metarepo/clones | The kit changes nothing inside a clone | [D1] |
| metarepo/clones | Changes started before the switch keep their rules | [Q30][Q36] |
| metarepo/clones | A clone's own OpenSpec is not edited from the root | [Q8][Q19][Q27][D1] |
| metarepo/e2e | The E2E question for changes that touch the web interface | [Q6][Q17][Q25][Q33][Q44] |
| metarepo/e2e | The e2e level of the verification plan | [Q21][Q32] |
| metarepo/e2e | E2E tests live in the root and prove the whole application | [Q14][Q18][Q42][Q41] |
| metarepo/e2e | Recorded runs cover every clone | [Q26] |
| metarepo/e2e | Start check from the root | [Q15] |
| metarepo/test-discovery | Marked tests are found inside the clones | [D1][Q41] |
| metarepo/test-discovery | A test path shows its repository | [D1] |
| metarepo/test-discovery | Every plan row names its repository | [Q4][Q5][Q31][Q12][Q40] |
| metarepo/test-discovery | A test counts only in a named repository | [Q4][Q12][Q41][Q42][D1] |
| metarepo/test-discovery | Automated test cases name their repository | [Q16] |
| metarepo/test-discovery | A missing clone blocks only the changes that name it | [Q22][D1] |
| metarepo/test-discovery | Search stays within the hook timeouts | [D1][Q46] |

## Environment

- Node 20+, git, and the pinned OpenSpec CLI 1.15.0 (the archive scenarios run `openspec archive` for real).
- A temporary meta-repository built per test: `git init` of the root with `repos/*` in `.gitignore`, and of the
  clones `repos/backend` and `repos/frontend`, each with its own `.gitignore` (`node_modules/`); the kit installed
  in the root with `--metarepo`.
- The search-time test generates 50,000 files under `repos/frontend/node_modules/` in the temporary folder; it runs
  in the full suite.
- Terminal questions of the installer and the health check are tested with injected answers.
- Running application: no
