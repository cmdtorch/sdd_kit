# Spec Delta

## Purpose

Defines how tests are run during apply so that time is saved without cutting any test: a task group runs only its own test files, every wider run happens once at the end, and a long run never ends at the tool time limit without a result.

## ADDED Requirements

### Requirement: A task group runs only its own test files
On a change stamped with kit version 0.7.0 or later, a subagent that does a task group SHALL run only the group's own test files: the test files it creates or changes and the existing test files of the code it changes. It SHALL NOT run a whole folder of tests or the full suite. It runs them with the one-file command of `openspec/test-commands.md`, or with the project's instructions when the file has none.

#### Scenario: Group runs its two test files
- **GIVEN** a group that changes `api/orders.py` and writes `api/tests/test_orders.py`, in a project whose folder `api/tests/` holds 40 test files
- **WHEN** the subagent runs its tests
- **THEN** it runs `api/tests/test_orders.py` and the existing test file of `api/orders.py`, each with the one-file command
- **AND** it runs neither the folder `api/tests/` nor the full suite

#### Scenario: Fix after a failing own test
- **WHEN** a test of the group's own file fails and the subagent has fixed the code
- **THEN** it reruns that test file, or only the failed tests with the failed-only command, and no wider run

### Requirement: Fix subagents run only the test files of their work
Every other `task-implementer` subagent of apply (a replacement, a collision fix, a review fix, a full-suite fix) SHALL run only the test files of its work, with the one-file or the failed-only command, and no folder or full-suite run. The subagents of the E2E stage keep running the E2E tests through the kit's E2E script.

#### Scenario: Review fix
- **WHEN** a subagent strengthens the assertions of `api/tests/test_orders.py` after the test review
- **THEN** it runs `api/tests/test_orders.py` with the one-file command and no wider run

### Requirement: Wider runs happen at the end, by the main agent
The tests outside the groups' own files (the rest of a folder, the whole suite) SHALL run only in the full-suite run of the main agent at the end of apply. The set of tests SHALL NOT shrink: the full suite at the end covers every test of the project. When it fails, the fix subagent reruns only the failing tests, and the main agent runs the failed commands again itself.

#### Scenario: Neighbouring test broken by a group
- **GIVEN** group 2 breaks a test in `api/tests/test_invoices.py`, a file that is not its own
- **WHEN** apply reaches the end
- **THEN** the main agent's full-suite run reports the failing test, and one fix subagent gets it with the failing output

#### Scenario: Fix subagent reruns only the failing tests
- **WHEN** the fix subagent has changed the code for the failing test in `api/tests/test_invoices.py`
- **THEN** it reruns that test file or the failed tests only
- **AND** the full suite is run again by the main agent, not by the subagent

#### Scenario: No test is left out
- **WHEN** apply of a change ends without a stop
- **THEN** the full suite has run at least once, and its last run covered every test of the project and passed

#### Scenario: Tests of two groups after a collision
- **GIVEN** the changed-files check finds that group 3 changed a file in the area of the accepted group 2
- **WHEN** the main agent runs the tests of both groups
- **THEN** it runs the own test files of group 2 and group 3 with the one-file command and no folder or full-suite run

### Requirement: The kit blocks the full suite inside an implementation subagent
When `openspec/test-commands.md` names a full-suite command, the kit SHALL block it when a `task-implementer` subagent runs it, with a message naming the rule and the one-file command, whatever the stamp of the change. The main agent is not blocked. Without a `Full suite` item nothing is blocked.

#### Scenario: Subagent runs the full suite
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `make test`
- **THEN** the command is blocked and the message says that a group runs only its own test files with `make test FILE=<file>`

#### Scenario: Fix subagent at the end of apply
- **GIVEN** the same file
- **WHEN** the `task-implementer` subagent that fixes a full-suite failure runs `make test`
- **THEN** the command is blocked

#### Scenario: Another kind of subagent
- **GIVEN** the same file
- **WHEN** a subagent that is not a `task-implementer` runs `make test` in the background
- **THEN** the command is not blocked

#### Scenario: Change stamped 0.6.1
- **GIVEN** the same file and an apply of a change stamped 0.6.1
- **WHEN** a `task-implementer` subagent runs `make test`
- **THEN** the command is blocked

#### Scenario: Section of a meta-repository
- **GIVEN** a root file with ``Full suite: `mise run test:backend` `` under `## Repository: backend` and ``Full suite: `mise run test:frontend` `` under `## Repository: frontend`
- **WHEN** a `task-implementer` subagent runs `mise run test:frontend`
- **THEN** the command is blocked, as is `mise run test:backend`
- **AND** the message names the one-file command of the `frontend` section

#### Scenario: Main agent runs the full suite
- **GIVEN** the same file
- **WHEN** the main agent runs `make test` in the background
- **THEN** the command is not blocked

#### Scenario: No commands file
- **GIVEN** a project without `openspec/test-commands.md`
- **WHEN** an implementation subagent runs `make test`
- **THEN** the kit blocks nothing

### Requirement: How a command line is matched with the full-suite command
A command line SHALL match the full-suite command when one of its parts, split at `&&`, `||`, `;`, `|` and line breaks, equals that command, alone or followed only by redirections, with runs of spaces compared as one space and leading variable assignments and the wrappers `env`, `nohup`, `time`, `nice` and `timeout` dropped. The one-file command and a full-suite command inside a quoted shell string SHALL NOT match.

#### Scenario: One-file command passes
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `make test FILE=api/tests/test_orders.py`
- **THEN** the command is not blocked

#### Scenario: Full suite inside a longer command line
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `cd api && make test`
- **THEN** the command is blocked

#### Scenario: Full suite wrapped in another program
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `CI=1 timeout 900 make test`
- **THEN** the command is blocked

#### Scenario: Full suite inside a quoted shell string
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `bash -c "make test"`
- **THEN** the kit does not block it

#### Scenario: Extra spaces
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `make  test`
- **THEN** the command is blocked

#### Scenario: Full suite with its output piped
- **GIVEN** a file with ``Full suite: `make test` `` and ``One file: `make test FILE=<file>` ``
- **WHEN** an implementation subagent runs `make test 2>&1 | tail -20`
- **THEN** the command is blocked

### Requirement: A long run goes into the background
A test run is long when its command's expected duration in `openspec/test-commands.md` is 2 minutes or more, or when it is wider than single test files (the failed-only command, the full suite) and no duration is written. The agent SHALL start a long run in the background and wait for the notice that it ended. It SHALL NOT start it as a foreground command, and SHALL NOT wait for it with repeated sleep-and-check commands.

#### Scenario: Full suite of 12 minutes
- **GIVEN** a file with ``Full suite: `make test` — 12 min``
- **WHEN** the main agent runs the full suite at the end of apply
- **THEN** it starts `make test` in the background and reads the result when the run has ended

#### Scenario: Short one-file run stays in the foreground
- **GIVEN** a file with ``One file: `make test FILE=<file>` — 1 min``
- **WHEN** a subagent runs one test file
- **THEN** the run is not long, and nothing keeps it from the foreground

#### Scenario: Failed-only run without a duration
- **GIVEN** a file with ``Failed only: `make test-failed` `` and no duration
- **WHEN** a subagent reruns the failed tests
- **THEN** it starts the run in the background and waits for its end

#### Scenario: One-file run of 3 minutes
- **GIVEN** a file with ``One file: `make test FILE=<file>` — 3 min``
- **WHEN** a subagent runs one test file
- **THEN** it starts the run in the background and waits for its end

### Requirement: The kit blocks a long full-suite run in the foreground
When the full-suite command of `openspec/test-commands.md` is long (2 minutes or more, or no duration written), the kit SHALL block it when it is started as a foreground command, with a message that tells the agent to run it in the background. A full suite written as shorter than 2 minutes SHALL pass in the foreground. The command is matched as for the block inside a subagent; in a meta-repository each section's command is judged by its own duration, and the stamp of the change does not matter.

#### Scenario: Foreground full suite of 12 minutes
- **GIVEN** a file with ``Full suite: `make test` — 12 min``
- **WHEN** the main agent starts `make test` as a foreground command
- **THEN** the command is blocked and the message says to run it in the background

#### Scenario: Full suite without a duration
- **GIVEN** a file with ``Full suite: `make test` `` and no duration
- **WHEN** the main agent starts `make test` as a foreground command
- **THEN** the command is blocked

#### Scenario: Background full suite passes
- **GIVEN** a file with ``Full suite: `make test` — 12 min``
- **WHEN** the main agent starts `make test` in the background
- **THEN** the command is not blocked

#### Scenario: Two sections with different durations
- **GIVEN** a root file with ``Full suite: `mise run test:backend` — 12 min`` under `## Repository: backend` and ``Full suite: `mise run test:frontend` — 1 min`` under `## Repository: frontend`
- **WHEN** the main agent starts each of them as a foreground command
- **THEN** `mise run test:backend` is blocked and `mise run test:frontend` is not

#### Scenario: Short full suite in the foreground
- **GIVEN** a file with ``Full suite: `make test` — 1 min``
- **WHEN** the main agent starts `make test` as a foreground command
- **THEN** the command is not blocked

### Requirement: The kit code names no test tool
The kit's code, protocols and subagent definitions SHALL NOT contain the test command of any stack as a rule; such commands appear only as values the project writes into `openspec/test-commands.md` and as examples in documentation.

#### Scenario: Kit runs in a project of any stack
- **GIVEN** two projects whose files name ``Full suite: `make test` `` and ``Full suite: `npm test` ``
- **WHEN** an implementation subagent runs the full-suite command of its project
- **THEN** it is blocked in both, by the same rule, from the value in each project's file

### Requirement: Changes started under earlier rules keep their test runs
A change without the kit version stamp, or stamped below 0.7.0, SHALL keep the earlier rule for its test runs: tests scoped to what is being changed, as its protocol says.

#### Scenario: Protocol limits the new rule to new changes
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/testing.md` is read
- **THEN** it says that the rule about a group's own test files applies to changes stamped 0.7.0 or later
