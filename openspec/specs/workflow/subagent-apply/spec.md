# workflow/subagent-apply Specification

## Purpose
Runs the implementation of a change through fresh subagents, one per task group, so that the apply chat does not fill up and lose context, and runs independent groups in parallel in the same working folder when that is safe.

## Requirements

### Requirement: Each task group runs in a fresh subagent
On a change stamped with kit version 0.5.0 or later (`x-sdd-kit` in its `.openspec.yaml`), on every kit schema, the main agent SHALL hand each task group of `tasks.md` except the final group to a new subagent, whatever the size of the change. No setting SHALL switch this off.

#### Scenario: Change with three groups
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` whose `tasks.md` has three task groups before the final group
- **WHEN** the developer runs apply
- **THEN** each of the three groups is done by its own newly started subagent

#### Scenario: Change with one group
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` whose `tasks.md` has one task group before the final group
- **WHEN** the developer runs apply
- **THEN** that group is done by a subagent, not by the main agent

#### Scenario: Apply protocol states the rule
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/apply.md` is read
- **THEN** it says that every task group before the final group is handed to a new subagent on changes stamped 0.5.0 or later, and that this cannot be switched off

### Requirement: Changes started under older rules
A change without the kit version stamp, or stamped with a kit version below 0.5.0, SHALL be implemented and verified as before: by the main agent alone, without implementation, full-suite or verify subagents.

#### Scenario: Change stamped by an older kit
- **GIVEN** a change whose `.openspec.yaml` has `x-sdd-kit: 0.4.0`
- **WHEN** the developer runs apply
- **THEN** the main agent implements its tasks itself without starting implementation subagents

#### Scenario: Change without a stamp
- **GIVEN** a change whose `.openspec.yaml` has no `x-sdd-kit` line
- **WHEN** the developer runs apply
- **THEN** the main agent implements its tasks itself without starting implementation subagents

### Requirement: The final group is run by the main agent
The main agent SHALL run the final group itself: it runs the test reviewer, runs the full suite, and writes `apply-report.md`. Code and test fixes inside the final group go through subagents.

#### Scenario: Final group
- **GIVEN** every group before the final group is accepted
- **WHEN** the final group runs
- **THEN** the main agent starts the test reviewer, runs the full suite itself and writes `apply-report.md`

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

### Requirement: Limits of an implementation subagent
Every subagent started during apply (task group, replacement, collision fix, full suite, review or E2E fix) SHALL NOT start other subagents, SHALL NOT ask the developer, and SHALL NOT edit the change's planning artifacts (`clarifications.md`, `proposal.md`, specs, `design.md`, `verification-plan.md`, test cases) or `tasks.md`.

#### Scenario: Subagent definition states the limits
- **GIVEN** the installed kit
- **WHEN** the implementation subagent's definition in `.claude/agents/` is read
- **THEN** it says that the subagent starts no other subagent, asks the developer nothing and edits no planning artifact and no `tasks.md`

### Requirement: Dependent groups run in order
A group SHALL start only after every group named in its `Depends on:` line is accepted by the main agent.

#### Scenario: Chain of groups
- **GIVEN** groups 1, 2 and 3, where group 2 has `Depends on: 1` and group 3 has `Depends on: 2`
- **WHEN** the main agent runs apply
- **THEN** the subagents for groups 1, 2 and 3 run one after another, each starting after the previous group is accepted

### Requirement: Independent groups may run in parallel
The main agent SHALL run subagents at the same time only for groups that do not depend on each other, whose areas are known and do not overlap, and that do not both name the same one of `dependencies`, `migrations`, `settings` or `assembly`. Among such groups it chooses which run together and when; there is no fixed numeric limit.

#### Scenario: Backend and frontend groups
- **GIVEN** group 2 has `Area: api/`, group 3 has `Area: web/`, both have `Depends on: none` and `Shared: none`
- **WHEN** the main agent runs apply
- **THEN** it may run the subagents for groups 2 and 3 at the same time

#### Scenario: Overlapping areas run in order
- **GIVEN** two groups with `Depends on: none` whose areas both contain `src/config.ts`
- **WHEN** the main agent runs apply
- **THEN** their subagents do not run at the same time

#### Scenario: Both groups change migrations
- **GIVEN** two independent groups with disjoint areas that both have `migrations` in their `Shared:` line
- **WHEN** the main agent runs apply
- **THEN** their subagents do not run at the same time

#### Scenario: Group without an area runs alone
- **GIVEN** a group with `Area: unknown`
- **WHEN** its subagent runs
- **THEN** no other group's subagent runs at the same time

### Requirement: Test runs on shared test resources
Groups whose `Shared:` line names `database`, `ports` or `docker` MAY be written in parallel. Their test runs SHALL NOT overlap, except when they share only `database` and the project's own test setup gives each run its own database, created and deleted by that setup. The kit SHALL NOT change the project's test setup to add such isolation.

#### Scenario: Project gives each run its own database
- **GIVEN** two parallel groups with `Shared: database`, and the project's test setup creates and deletes a separate database for each test run
- **WHEN** both subagents reach their tests
- **THEN** they may run their tests at the same time, each against its own database

#### Scenario: One shared test database
- **GIVEN** two parallel groups with `Shared: database`, and the project's tests all use one fixed test database
- **WHEN** both subagents reach their tests
- **THEN** their test runs do not overlap in time

#### Scenario: Groups sharing ports
- **GIVEN** two parallel groups with `Shared: ports` whose tests start a server on the same fixed port
- **WHEN** both subagents reach their tests
- **THEN** their test runs do not overlap in time

#### Scenario: Kit does not add isolation
- **GIVEN** a project whose tests use one fixed test database
- **WHEN** apply runs groups with `Shared: database`
- **THEN** the project's test setup is not changed to create a database per run unless a task of the change asks for it

### Requirement: Parallel subagents share the working folder
Parallel subagents SHALL work in the project's working folder, without separate copies of the repository. The kit SHALL NOT commit, create branches or worktrees, or merge; the developer commits, as before.

#### Scenario: No commits during apply
- **GIVEN** a change stamped 0.5.0 whose groups 2 and 3 ran in parallel
- **WHEN** apply ends
- **THEN** the git history has no commit, branch or worktree created during apply, and the work is in the working folder as uncommitted changes

### Requirement: Changed files are checked after each subagent
After each subagent the main agent SHALL check which files it changed. A file outside every other group's area, including a file outside every declared area, is accepted. When a changed file lies in another group's area, the main agent runs the tests of both groups; when they fail, it hands the fix to a new subagent, with at most two fix attempts, and then stops and asks the developer. A group with an open collision is not accepted.

#### Scenario: Change inside the group's area
- **GIVEN** the subagent of group 2 changed only files in group 2's area
- **WHEN** the main agent checks its work
- **THEN** it accepts group 2

#### Scenario: File outside every declared area
- **GIVEN** the subagent of group 2 changed `README.md`, which lies in no group's area
- **WHEN** the main agent checks its work
- **THEN** it accepts group 2

#### Scenario: Collision with another group, tests pass
- **GIVEN** the subagent of group 2 changed a file in the area of the accepted group 1
- **WHEN** the main agent runs the tests of groups 1 and 2 and they pass
- **THEN** it accepts group 2 without a fix subagent

#### Scenario: Collision with a group still running
- **GIVEN** the subagent of group 2 changed a file in the area of group 3, whose subagent is still running
- **WHEN** the main agent checks group 2
- **THEN** it waits until group 3's subagent ends, then runs the tests of groups 2 and 3 before it accepts either

#### Scenario: Collision with a group not started yet
- **GIVEN** the subagent of group 2 changed a file in the area of group 4, which has not started
- **WHEN** the main agent checks group 2
- **THEN** it accepts group 2 and the subagent of group 4 is told which of its files group 2 changed

#### Scenario: Collision with another group, tests fail twice
- **GIVEN** the subagent of group 2 changed a file in the area of group 1 and the tests of group 1 now fail
- **WHEN** two fix subagents in a row leave the tests of group 1 failing
- **THEN** the main agent stops, does not accept group 2, and shows the developer the failing tests and both fix attempts

### Requirement: Only the main agent checks off tasks
Only the main agent SHALL mark tasks done in `tasks.md`, and only after it has accepted the work of their group.

#### Scenario: Group accepted
- **GIVEN** the main agent has accepted the work of group 2
- **WHEN** it updates `tasks.md`
- **THEN** every task of group 2 is checked and the tasks of groups not yet accepted stay unchecked

### Requirement: Unfinished subagent is replaced once
When a subagent ends without finishing its group for a reason that is not a stop of the apply protocol (a tool error, its context ran out, an incomplete result), the main agent SHALL start one new subagent for the group's remaining tasks, with a note of what is already done. When that subagent also ends without finishing, the main agent SHALL stop and ask the developer.

#### Scenario: First subagent breaks off
- **GIVEN** the subagent of group 2 ended after two of its four tasks because of a tool error
- **WHEN** the main agent sees the incomplete result
- **THEN** it starts a new subagent for the remaining two tasks with a note of the two done tasks

#### Scenario: Second subagent also breaks off
- **GIVEN** the replacement subagent of group 2 also ended without finishing
- **WHEN** the main agent sees the incomplete result
- **THEN** it stops and tells the developer which tasks of group 2 remain and why both subagents ended

### Requirement: Stops are relayed by the main agent
A subagent that reaches a stop of the apply protocol SHALL end and report it to the main agent, which asks the developer. On a requirement gap, a consent stop or a situation outside the plan, the main agent SHALL start no new subagent, let running ones finish their current group, then ask. On a test failing after two fix attempts or an environment stop, it SHALL first finish the groups that do not depend on it, then ask. A failed start check stops before any subagent starts.

#### Scenario: Requirement gap while another group runs
- **GIVEN** the subagents of groups 2 and 3 run in parallel and the subagent of group 2 reports a requirement gap
- **WHEN** the main agent handles the report
- **THEN** it starts no new subagent, waits for group 3 to finish, appends the question to the Apply round of `clarifications.md` and asks the developer

#### Scenario: Consent needed while another group runs
- **GIVEN** the subagents of groups 2 and 3 run in parallel and the subagent of group 2 reports that it needs to install a tool into the system
- **WHEN** the main agent handles the report
- **THEN** it starts no new subagent, waits for group 3 to finish and asks the developer for consent

#### Scenario: Failing test with independent groups left
- **GIVEN** a test of group 2 still fails after two fix attempts and group 4 does not depend on group 2
- **WHEN** the main agent handles the report
- **THEN** it completes group 4 through a subagent before it shows the failing test to the developer

#### Scenario: Failed start check
- **GIVEN** the verification plan needs a running application and the start check fails
- **WHEN** apply begins
- **THEN** no implementation subagent starts, and the main agent reports what failed and offers the ways of `openspec/protocols/apply.md` section 4

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

### Requirement: Model of the implementation subagents
The model of the subagents that do task groups and collision fixes SHALL be the value of `x-sdd-kit-subagent-model` in the project's `openspec/config.yaml`, outside the kit's block: `opus`, `sonnet`, `haiku`, `fable`, `inherit`, or a full model ID starting with `claude-`. Without that line, or with `inherit`, they SHALL use the main chat's model. Every other subagent SHALL use the main chat's model.

#### Scenario: Model set in the project
- **GIVEN** `openspec/config.yaml` has `x-sdd-kit-subagent-model: sonnet`
- **WHEN** the main agent starts the subagent of a task group
- **THEN** that subagent runs on `sonnet`

#### Scenario: No model set
- **GIVEN** `openspec/config.yaml` has no `x-sdd-kit-subagent-model` line
- **WHEN** the main agent starts the subagent of a task group
- **THEN** that subagent runs on the main chat's model

#### Scenario: Full-suite subagent ignores the setting
- **GIVEN** `openspec/config.yaml` has `x-sdd-kit-subagent-model: sonnet`
- **WHEN** the main agent starts the full-suite subagent at the end of apply
- **THEN** that subagent runs on the main chat's model

#### Scenario: Kit update keeps the setting
- **GIVEN** `openspec/config.yaml` has `x-sdd-kit-subagent-model: haiku`
- **WHEN** the kit is updated
- **THEN** the line is unchanged and `node openspec/tooling/checks/lint-kit.mjs` reports no unknown field for it

### Requirement: Unknown model value
When `x-sdd-kit-subagent-model` has a value other than `opus`, `sonnet`, `haiku`, `fable`, `inherit` or a full model ID starting with `claude-`, the kit's health check SHALL warn about it, and during apply the main agent SHALL say so in the chat and run the implementation subagents on the main chat's model.

#### Scenario: Doctor warns about a typo
- **GIVEN** `openspec/config.yaml` has `x-sdd-kit-subagent-model: sonet`
- **WHEN** `node openspec/tooling/bin/doctor.mjs` runs
- **THEN** it prints a warning that names `sonet` as an unknown model and lists the allowed values

#### Scenario: Full model ID is accepted
- **GIVEN** `openspec/config.yaml` has `x-sdd-kit-subagent-model: claude-sonnet-5-5`
- **WHEN** `node openspec/tooling/bin/doctor.mjs` runs
- **THEN** it prints no warning about the subagent model

#### Scenario: Apply falls back to the main model
- **GIVEN** `openspec/config.yaml` has `x-sdd-kit-subagent-model: sonet`
- **WHEN** the main agent starts the first task group
- **THEN** the chat says that `sonet` is unknown and the subagent runs on the main chat's model

### Requirement: Meta-repository groups of different repositories run in order
In a meta-repository change, groups that name different repositories SHALL NOT run at the same time; only groups of the same repository may run in parallel.

#### Scenario: Backend and frontend clones
- **GIVEN** a meta-repository change with the independent groups `## 2. [backend] Order API` and `## 3. [frontend] Order screen`
- **WHEN** the main agent runs apply
- **THEN** their subagents run one after another

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
