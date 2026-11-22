# Apply Report

## Manual checks

### workflow/manual-checks :: Report records the subagent runs
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a change whose groups 1 and 2 were done by subagents, group 2 after one replacement subagent, the last task is done
Expected: the section "Subagent runs" of `apply-report.md` has three lines, each with its task group, the tasks done, the model and the test result

### workflow/subagent-apply :: Change with three groups
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a change stamped `x-sdd-kit: 0.5.0` whose `tasks.md` has three task groups before the final group, the developer runs apply
Expected: each of the three groups is done by its own newly started subagent

### workflow/subagent-apply :: Change with one group
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a change stamped `x-sdd-kit: 0.5.0` whose `tasks.md` has one task group before the final group, the developer runs apply
Expected: that group is done by a subagent, not by the main agent

### workflow/subagent-apply :: Final group
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given every group before the final group is accepted, the final group runs
Expected: the main agent starts the test reviewer and writes `apply-report.md`, and the full suite is run by a subagent

### workflow/subagent-apply :: Fix after the test review
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the test reviewer reports a blocker finding in one test, the main agent acts on the finding
Expected: the fix is made by a newly started subagent, and the main agent edits no test or code file itself

### workflow/subagent-apply :: Failing E2E test
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given an E2E test fails in the E2E stage, the main agent has read the run result
Expected: the fix of the application code or of the E2E test is made by a newly started subagent, and the main agent runs the E2E tests again

### workflow/subagent-apply :: Chain of groups
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given groups 1, 2 and 3, where group 2 has `Depends on: 1` and group 3 has `Depends on: 2`, the main agent runs apply
Expected: the subagents for groups 1, 2 and 3 run one after another, each starting after the previous group is accepted

### workflow/subagent-apply :: Backend and frontend groups
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given group 2 has `Area: api/`, group 3 has `Area: web/`, both have `Depends on: none` and `Shared: none`, the main agent runs apply
Expected: it may run the subagents for groups 2 and 3 at the same time

### workflow/subagent-apply :: Overlapping areas run in order
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given two groups with `Depends on: none` whose areas both contain `src/config.ts`, the main agent runs apply
Expected: their subagents do not run at the same time

### workflow/subagent-apply :: Both groups change migrations
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given two independent groups with disjoint areas that both have `migrations` in their `Shared:` line, the main agent runs apply
Expected: their subagents do not run at the same time

### workflow/subagent-apply :: Group without an area runs alone
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a group with `Area: unknown`, its subagent runs
Expected: no other group's subagent runs at the same time

### workflow/subagent-apply :: Project gives each run its own database
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given two parallel groups with `Shared: database`, and the project's test setup creates and deletes a separate database for each test run, both subagents reach their tests
Expected: they may run their tests at the same time, each against its own database

### workflow/subagent-apply :: One shared test database
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given two parallel groups with `Shared: database`, and the project's tests all use one fixed test database, both subagents reach their tests
Expected: their test runs do not overlap in time

### workflow/subagent-apply :: Groups sharing ports
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given two parallel groups with `Shared: ports` whose tests start a server on the same fixed port, both subagents reach their tests
Expected: their test runs do not overlap in time

### workflow/subagent-apply :: Kit does not add isolation
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a project whose tests use one fixed test database, apply runs groups with `Shared: database`
Expected: the project's test setup is not changed to create a database per run unless a task of the change asks for it

### workflow/subagent-apply :: No commits during apply
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a change stamped 0.5.0 whose groups 2 and 3 ran in parallel, apply ends
Expected: the git history has no commit, branch or worktree created during apply, and the work is in the working folder as uncommitted changes

### workflow/subagent-apply :: Change inside the group's area
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 changed only files in group 2's area, the main agent checks its work
Expected: it accepts group 2

### workflow/subagent-apply :: File outside every declared area
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 changed `README.md`, which lies in no group's area, the main agent checks its work
Expected: it accepts group 2

### workflow/subagent-apply :: Collision with another group, tests pass
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 changed a file in the area of the accepted group 1, the main agent runs the tests of groups 1 and 2 and they pass
Expected: it accepts group 2 without a fix subagent

### workflow/subagent-apply :: Collision with a group still running
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 changed a file in the area of group 3, whose subagent is still running, the main agent checks group 2
Expected: it waits until group 3's subagent ends, then runs the tests of groups 2 and 3 before it accepts either

### workflow/subagent-apply :: Collision with a group not started yet
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 changed a file in the area of group 4, which has not started, the main agent checks group 2
Expected: it accepts group 2 and the subagent of group 4 is told which of its files group 2 changed

### workflow/subagent-apply :: Collision with another group, tests fail twice
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 changed a file in the area of group 1 and the tests of group 1 now fail, two fix subagents in a row leave the tests of group 1 failing
Expected: the main agent stops, does not accept group 2, and shows the developer the failing tests and both fix attempts

### workflow/subagent-apply :: Group accepted
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the main agent has accepted the work of group 2, it updates `tasks.md`
Expected: every task of group 2 is checked and the tasks of groups not yet accepted stay unchecked

### workflow/subagent-apply :: First subagent breaks off
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagent of group 2 ended after two of its four tasks because of a tool error, the main agent sees the incomplete result
Expected: it starts a new subagent for the remaining two tasks with a note of the two done tasks

### workflow/subagent-apply :: Second subagent also breaks off
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the replacement subagent of group 2 also ended without finishing, the main agent sees the incomplete result
Expected: it stops and tells the developer which tasks of group 2 remain and why both subagents ended

### workflow/subagent-apply :: Requirement gap while another group runs
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagents of groups 2 and 3 run in parallel and the subagent of group 2 reports a requirement gap, the main agent handles the report
Expected: it starts no new subagent, waits for group 3 to finish, appends the question to the Apply round of `clarifications.md` and asks the developer

### workflow/subagent-apply :: Consent needed while another group runs
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the subagents of groups 2 and 3 run in parallel and the subagent of group 2 reports that it needs to install a tool into the system, the main agent handles the report
Expected: it starts no new subagent, waits for group 3 to finish and asks the developer for consent

### workflow/subagent-apply :: Failing test with independent groups left
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a test of group 2 still fails after two fix attempts and group 4 does not depend on group 2, the main agent handles the report
Expected: it completes group 4 through a subagent before it shows the failing test to the developer

### workflow/subagent-apply :: Failed start check
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given the verification plan needs a running application and the start check fails, apply begins
Expected: no implementation subagent starts, and the main agent reports what failed and offers the ways of `openspec/protocols/apply.md` section 4

### workflow/subagent-apply :: End-of-apply suite
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given every task group before the final group is accepted, the final group runs the full suite
Expected: a subagent runs the project's full test suite and quality checks, fixes what fails and reports the commands and their result

### workflow/subagent-apply :: Group finished, tests pass
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): the subagent of group 2 "Order API" finishes tasks 2.1 to 2.4 on `sonnet` and its tests pass
Expected: the chat shows one line naming group 2 "Order API", tasks 2.1 to 2.4, `sonnet` and that its tests pass

### workflow/subagent-apply :: Full-suite subagent finished
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): the full-suite subagent finishes and every test passes
Expected: the chat shows one line starting with `full suite`, naming the model and that every test passes

### workflow/subagent-apply :: Group finished, tests fail
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): the subagent of group 3 finishes and two of its tests fail
Expected: the chat line for group 3 names the two failing tests

### workflow/subagent-apply :: Full-suite subagent ignores the setting
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given `openspec/config.yaml` has `x-sdd-kit-subagent-model: sonnet`, the main agent starts the full-suite subagent at the end of apply
Expected: that subagent runs on the main chat's model

### workflow/subagent-apply :: Backend and frontend clones
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a meta-repository change with the independent groups `## 2. [backend] Order API` and `## 3. [frontend] Order screen`, the main agent runs apply
Expected: their subagents run one after another

### workflow/subagent-delegation :: Developer runs verify
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a change stamped 0.5.0 whose tasks are all done, the developer runs verify
Expected: the check of the implementation against the artifacts is done by a subagent and its findings are shown to the developer by the main agent

### workflow/subagent-delegation :: Verify finding is fixed
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given verify reports that a scenario has no implementation, the developer asks for the fix
Expected: the code is changed by a newly started subagent, not by the main agent

### workflow/subagent-delegation :: Verify subagent changes nothing
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a change stamped 0.5.0 whose implementation misses one scenario, the verify subagent ends
Expected: its report names the missing scenario and no file of the project or the change was changed by it

### workflow/subagent-delegation :: Code study before the questions
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a new change in the Main round whose request touches code in several folders of the project, the main agent hands the study of the code areas the request touches to a subagent
Expected: the chat first says why it does so, and the subagent returns a summary of what it found

### workflow/subagent-delegation :: Reading subagent proposes a decision
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a code-reading subagent finds two possible places for a new module, it returns its summary
Expected: the summary describes both places and no planning artifact is changed by the subagent

### workflow/task-groups :: Group with its plan lines
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a group `## 2. Order API` that depends on group 1, changes `src/api/orders/` and adds a library, the agent writes `tasks.md`
Expected: the group heading is followed by `Depends on: 1`, `Area: src/api/orders/` and `Shared: dependencies`

### workflow/task-groups :: Independent group
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a group whose work needs nothing from the other groups, the agent writes `tasks.md`
Expected: its line reads `Depends on: none`

### workflow/task-groups :: Dependent group waits
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a `tasks.md` whose group 3 has `Depends on: 2`, the main agent runs apply
Expected: no subagent starts group 3 before group 2 is accepted

### workflow/task-groups :: Area of a frontend group
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a group that changes only files under `web/src/orders/`, the agent writes `tasks.md`
Expected: its line reads `Area: web/src/orders/`

### workflow/task-groups :: Rename across the project
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a group that renames a term in every module of the project, the agent writes `tasks.md`
Expected: its line reads `Area: unknown`

### workflow/task-groups :: Group installs a library
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a task group whose tasks add a new library to the project, the agent writes `tasks.md`
Expected: its `Shared:` line contains `dependencies`

### workflow/task-groups :: Group whose tests use the database
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a task group whose tests read and write the project's test database and that changes no shared file, the agent writes `tasks.md`
Expected: its `Shared:` line contains `database` and none of `dependencies`, `migrations`, `settings`, `assembly`

### workflow/task-groups :: Large group is split
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a piece of work that needs 9 tasks, the agent writes `tasks.md`
Expected: the work is spread over at least two task groups of at most 5 tasks each

### workflow/task-groups :: Group without plan lines
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a `tasks.md` whose group 2 has no plan lines, the agent writes `tasks.md` and later runs apply
Expected: the write is not blocked, and group 2 runs alone after group 1 is accepted

### workflow/task-groups :: Malformed plan line
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a `tasks.md` whose group 3 has `Depends on: the API group`, the main agent runs apply
Expected: group 3 runs alone after every earlier group is accepted

### workflow/task-groups :: Final group depends on all
Reason: cannot be automated: agent behaviour in a real session, checked in the pilot
Steps: pilot (the next kit change after the beta release, in the kit repository): given a `tasks.md` with groups 1 to 4, where group 4 is the final group, the agent writes `tasks.md`
Expected: group 4 has `Depends on: 1, 2, 3`

## Not verified automatically

None.

## Weakened tests

None.

## Subagent runs

- 2. Subagent runs in the implementation report — 2.1–2.3 — inherit — 32 tests pass (apply-protocol), release 9 pass
- 3. Subagents protocol: scheduling and the changed-files check — 3.1–3.5 — inherit — 28 tests pass, release 9 pass
- 1. Version gate and model setting — 1.1–1.5 — inherit — 12 tests pass, checks+lib 85 pass, release 9 pass
- 4. Subagents protocol: stops, final group, progress, delegation, pointers — 4.1–4.4 — inherit — 49 tests pass, related suites 303 pass
- 5. Agent definitions — 5.1–5.3 — inherit — 51 tests pass, installer 22, review 10, release 9 pass
- 6. Schema instructions — 6.1–6.5 — inherit — schemas 39 pass, related suites 269 pass
- fix: test review round 1 (T1–T5) and full suite — 7.1, 7.2 — inherit — every test passes (702 of 702), doctor Ready
- verify (read-only) — — inherit — 136 tests pass, 0 critical, 2 warnings, 5 suggestions
- fix: verify findings W1, W2, S1–S4 — — inherit — 197 tests pass
