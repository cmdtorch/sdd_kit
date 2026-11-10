# metarepo/apply Specification

## Purpose
Defines how a meta-repository change is implemented across repositories: every task group names the repository it runs in, the agent uses each repository's own commands, and the implementation report has a section for every repository the change touches.

## Requirements

### Requirement: Every task group names its repository
In a meta-repository change every task group of `tasks.md` SHALL name exactly one repository at the start of its heading, `## 2. [backend] Order API`: a declared clone name or `root`. Only the last group of a `tasks.md` with two or more groups (the final checks) is exempt. A group without it, with two names or with an unknown name SHALL be a check error, and writing `tasks.md` SHALL be blocked while it remains.

#### Scenario: Group without a repository blocks the tasks
- **GIVEN** a meta-repository change whose `tasks.md` being written has the group `## 2. Order API`, which is not the last group
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is blocked with a message that names the group "Order API"

#### Scenario: Group with an unknown repository blocks the tasks
- **GIVEN** a group `## 2. [mobile] Order screen` and no clone named `mobile`
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is blocked with a message that names `mobile` as an unknown repository

#### Scenario: Group with two repositories blocks the tasks
- **GIVEN** a group `## 2. [backend, frontend] Orders`
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is blocked with a message that a group names exactly one repository

#### Scenario: Final checks group needs no repository
- **GIVEN** every group names a repository except the last group `## 4. Final checks`
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is not blocked for repositories

#### Scenario: Single group needs a repository
- **GIVEN** a `tasks.md` with the single group `## 1. Order API`
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is blocked with a message that names the group "Order API"

### Requirement: The agent works in the group's repository
The meta-repository protocol `openspec/protocols/metarepo.md` SHALL tell the agent to do a group's tasks in the folder of the repository the group names and run that repository's tests with its own commands, found in the meta-repository's instructions and mise tasks. The kit stores no commands and does not switch or create branches.

#### Scenario: Protocol names the group's repository
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/metarepo.md` is read
- **THEN** it says that the tasks of a group are done in the folder of the repository the group names, with that repository's own test commands from the meta-repository's instructions and mise tasks

### Requirement: Missing commands are proposed for AGENTS.md
The meta-repository protocol SHALL tell the agent to ask the developer once when it cannot find how to run the tests, the quality checks or the application, and to suggest writing the commands into `AGENTS.md`, never into `CLAUDE.md`. In a project without clones the current suggestion stays.

#### Scenario: Protocol suggests AGENTS.md in a meta-repository
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/metarepo.md` is read
- **THEN** it says that missing commands are suggested for `AGENTS.md` and not for `CLAUDE.md`

#### Scenario: Kit block points to the protocol
- **GIVEN** a project with the kit installed, with or without `openspec/clones`
- **WHEN** the kit block of `openspec/config.yaml` is read
- **THEN** it says to follow `openspec/protocols/metarepo.md` when `openspec/clones` exists

### Requirement: The full suite runs per touched repository
At the end of apply the agent SHALL run the full suite and quality checks in every repository a task group names, with its own commands. `apply-report.md` SHALL have a section `## Repository: <name>` for each, holding at least one `Command:` line and one `Result:` line. A missing, repeated or incomplete section SHALL be a check error and block the archive; a section for another repository is allowed. The result is not judged.

#### Scenario: Report with a section per repository
- **GIVEN** a change whose task groups name `backend` and `frontend`, and `apply-report.md` with the sections `## Repository: backend` and `## Repository: frontend`, each with a `Command:` and a `Result:` line
- **WHEN** `check-apply-report` runs on the change
- **THEN** it reports no error about repositories

#### Scenario: Missing section blocks the archive
- **GIVEN** a change whose task groups name `backend` and `frontend`, and `apply-report.md` with only `## Repository: backend`
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names `frontend`

#### Scenario: Empty section is reported
- **GIVEN** a section `## Repository: frontend` with no `Command:` line
- **WHEN** `check-apply-report` runs on the change
- **THEN** it reports an error that the section for `frontend` names no command

#### Scenario: Root without tests reports no tests
- **GIVEN** a change whose task group `## 1. [root] Shared rules` names `root`, and the root has no test command
- **WHEN** `apply-report.md` has `## Repository: root` with `Command: none` and `Result: no tests`
- **THEN** `check-apply-report` reports no error about that section

#### Scenario: Section without a result is reported
- **GIVEN** a section `## Repository: frontend` with `Command: mise run test:frontend` and no `Result:` line
- **WHEN** `check-apply-report` runs on the change
- **THEN** it reports an error that the section for `frontend` has no result

#### Scenario: Repeated section is reported
- **GIVEN** `apply-report.md` with two sections `## Repository: backend`
- **WHEN** `check-apply-report` runs on the change
- **THEN** it reports an error that `backend` has two sections

#### Scenario: Failed result does not block by itself
- **GIVEN** a section `## Repository: frontend` with `Command: mise run test:frontend` and `Result: 2 tests failed`
- **WHEN** `check-apply-report` runs on the change
- **THEN** it reports no error about that section

#### Scenario: Repository named only in the plan needs no section
- **GIVEN** a change whose plan names `root` but whose task groups name only `backend`
- **WHEN** `check-apply-report` runs on the change
- **THEN** it does not ask for a section for `root`
