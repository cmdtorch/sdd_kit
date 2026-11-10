# metarepo/clones Specification

## Purpose
Defines how a project becomes a meta-repository: the list of application clones it declares, how the installer and the health check set it up and report missing or undeclared clones, how a clone's own OpenSpec folder is protected from edits made from the root, and that projects without clones keep working as before.

## Requirements

### Requirement: Clone list
A project SHALL be a meta-repository while `openspec/clones` exists, even with no clone line. One line per clone: a path relative to the root (`repos/backend`) or `name=path`; a clone without a name is named after its folder. Names use letters, digits, `-`, `_`, `.`, case-sensitive; `root` is reserved; `#` and blank lines are skipped. A bad or repeated name, a repeated path or a path outside the root SHALL be an error of every check reading the list.

#### Scenario: Clone named after its folder
- **GIVEN** `openspec/clones` holds the line `repos/backend`
- **WHEN** the kit reads the clone list
- **THEN** the project has one clone named `backend` at `repos/backend`

#### Scenario: Clone with its own name
- **GIVEN** `openspec/clones` holds the line `api=repos/backend`
- **WHEN** the kit reads the clone list
- **THEN** the project has one clone named `api` at `repos/backend`

#### Scenario: Repeated clone name is reported
- **GIVEN** `openspec/clones` holds the lines `repos/backend` and `api/backend`
- **WHEN** the health check runs
- **THEN** it reports an error that the name `backend` is declared twice

#### Scenario: Repeated clone path is reported
- **GIVEN** `openspec/clones` holds the lines `repos/backend` and `api=repos/backend`
- **WHEN** the health check runs
- **THEN** it reports an error that the path `repos/backend` is declared twice

#### Scenario: Reserved name is reported
- **GIVEN** `openspec/clones` holds the line `root=repos/core`
- **WHEN** the health check runs
- **THEN** it reports an error that the name `root` is reserved for the root

#### Scenario: Path outside the root is reported
- **GIVEN** `openspec/clones` holds the line `../backend`
- **WHEN** the health check runs
- **THEN** it reports an error that `../backend` is outside the root

#### Scenario: Invalid clone list blocks the archive
- **GIVEN** `openspec/clones` declares the name `backend` twice and a change otherwise ready to archive
- **WHEN** the change is archived
- **THEN** the archive is blocked with the clone list error

#### Scenario: Name with a space is reported
- **GIVEN** `openspec/clones` holds the line `order api=repos/backend`
- **WHEN** the health check runs
- **THEN** it reports an error that the name `order api` has a character that is not allowed

#### Scenario: Invalid clone list is reported by the checks
- **GIVEN** `openspec/clones` declares the name `backend` twice
- **WHEN** `check-traceability` runs on a meta-repository change
- **THEN** it reports the clone list error

#### Scenario: Empty clone list is a meta-repository
- **GIVEN** `openspec/clones` holds only a comment, and a new change with three plan rows that name no repository, `backend` and `root`
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports the first row as having no repository and the second as naming the unknown repository `backend`
- **AND** it reports nothing about the repository of the third row

#### Scenario: Empty clone list needs root in task groups
- **GIVEN** `openspec/clones` holds only a comment and a change whose `tasks.md` has the groups `## 1. [root] Rules` and `## 2. [backend] API`, followed by a final checks group
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is blocked with a message that names `backend` as an unknown repository

### Requirement: Projects without clones are unchanged
While `openspec/clones` does not exist, every check, hook and protocol rule SHALL behave as in kit 0.4 (except for a change marked `x-sdd-kit-metarepo: true`, below): no repository column in the verification plan, no repository in task groups, no report section per repository, no `e2e` plan level, no clone messages from the health check. The installer differs only by the repository-kind question.

#### Scenario: Single repository change archives as before
- **GIVEN** a project without `openspec/clones` and a change whose plan has no *Repository* column, whose task groups name no repository and whose marked tests are in the project
- **WHEN** the change is archived
- **THEN** the archive gate decides exactly as kit 0.4 does

#### Scenario: Health check says nothing about clones
- **GIVEN** a project without `openspec/clones` that holds a nested folder with its own `.git`
- **WHEN** the health check runs
- **THEN** its output does not mention clones or nested repositories

### Requirement: Root changes keep their gates
In a meta-repository the gates for the root's own changes SHALL be as strict as in a single repository: an artifact stays blocked until its question round is answered and confirmed, and the archive gate applies every rule of kit 0.4 in addition to the meta-repository rules.

#### Scenario: Unanswered Main round blocks the proposal in a meta-repository
- **GIVEN** a meta-repository change on `clarify` whose Main round has a blank `[Answer]:`
- **WHEN** the agent writes `proposal.md` of that change
- **THEN** the write is blocked with a message that the Main round has an unanswered question

#### Scenario: Open task blocks the archive in a meta-repository
- **GIVEN** a meta-repository change with every scenario covered in its repositories and one open task
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names the open task

### Requirement: Missing clone is reported as missing
A declared clone whose folder does not exist SHALL be reported by name and path as a missing clone: by the health check as a warning, and by the traceability check and the archive gate instead of reporting its scenarios as having no test.

#### Scenario: Health check reports a missing clone
- **GIVEN** `openspec/clones` declares `repos/frontend` and that folder does not exist
- **WHEN** the health check runs
- **THEN** it prints a warning that the clone `frontend` at `repos/frontend` is missing
- **AND** it still ends with "Ready." when nothing else is wrong

#### Scenario: Checks name the missing clone instead of the test
- **GIVEN** a plan row for the scenario "Order list is shown" names the repository `frontend` and `repos/frontend` does not exist
- **WHEN** `check-traceability --markers` runs on the change
- **THEN** it reports that the clone `frontend` is missing
- **AND** it does not report "Order list is shown" as having no test

### Requirement: Undeclared nested repositories are offered
In a meta-repository the health check SHALL look up to three folder levels below the root for undeclared folders with their own `.git`, skipping hidden, declared and dependency or build folders (`node_modules`, …). In a terminal without `--yes` it asks whether to add each and appends it on "yes"; otherwise it only prints the line. A taken name becomes `<parent>-<folder>`. The offer never changes "Ready.".

#### Scenario: Doctor adds a clone in a terminal
- **GIVEN** a meta-repository whose `openspec/clones` declares `repos/backend` and the folder `repos/frontend` holds its own `.git`
- **WHEN** the health check runs in a terminal and the developer answers "yes"
- **THEN** `openspec/clones` gets the line `repos/frontend`

#### Scenario: Developer answers no
- **GIVEN** the same project
- **WHEN** the health check runs in a terminal and the developer answers "no"
- **THEN** `openspec/clones` is unchanged
- **AND** the next health check run asks about `repos/frontend` again

#### Scenario: Doctor only prints without a terminal
- **GIVEN** the same project
- **WHEN** the health check runs without a terminal
- **THEN** it prints the line `repos/frontend` to add to `openspec/clones`
- **AND** `openspec/clones` is unchanged

#### Scenario: Offered line avoids a known name
- **GIVEN** `openspec/clones` declares `repos/backend` and the undeclared folder `services/backend` holds its own `.git`
- **WHEN** the health check runs without a terminal
- **THEN** it prints the line `services-backend=services/backend`

#### Scenario: Install never asks about nested repositories
- **GIVEN** a meta-repository root with the clone `repos/backend` and an undeclared `repos/frontend` that holds its own `.git`
- **WHEN** `sdd-kit install --yes --metarepo repos/backend` runs
- **THEN** the installer asks no question, its health check result prints the line `repos/frontend` and ends with "Ready."

#### Scenario: Repository inside dependencies is not offered
- **GIVEN** a meta-repository with a folder `repos/frontend/node_modules/pkg` that holds its own `.git`
- **WHEN** the health check runs
- **THEN** it does not offer `repos/frontend/node_modules/pkg`

### Requirement: Install and update set up a meta-repository
In a terminal `sdd-kit install` SHALL ask "meta-repository or single repository" next to the language question and, after "meta-repository", clone paths until an empty answer; `update` asks neither. `--metarepo` chooses it without a question; `--metarepo <entry>,…` adds clones written as in the list, skipping known entries. Without clones the list holds only a format comment. An invalid entry, or a known path under another name, SHALL stop the installer before it writes.

#### Scenario: Installer in a terminal asks for the repository kind
- **WHEN** `sdd-kit install` runs in a terminal without `--yes` and without `--metarepo`
- **THEN** it asks whether the project is a meta-repository or a single repository, next to the language question

#### Scenario: Single repository answer creates no list
- **WHEN** the developer answers "single repository" to that question
- **THEN** `openspec/clones` does not exist after the install

#### Scenario: Invalid path in a terminal is asked again
- **GIVEN** the developer answered "meta-repository"
- **WHEN** the developer enters `../backend` as a clone path
- **THEN** the installer says the path is outside the root and asks for the path again

#### Scenario: Path not yet on disk is accepted
- **GIVEN** the folder `repos/frontend` does not exist yet
- **WHEN** the developer enters `repos/frontend` as a clone path, or passes it in `--metarepo`
- **THEN** `openspec/clones` declares `frontend`, and the health check reports it as a missing clone

#### Scenario: Installer in a terminal asks the clone paths
- **GIVEN** `sdd-kit install` runs in a terminal and the developer answers "meta-repository"
- **WHEN** the developer enters `repos/backend`, then `repos/frontend`, then an empty answer
- **THEN** `openspec/clones` declares `backend` and `frontend`

#### Scenario: Update asks no repository question
- **WHEN** `sdd-kit update` runs in a terminal without `--metarepo` in a project without `openspec/clones`
- **THEN** it does not ask about the repository kind
- **AND** `openspec/clones` does not exist

#### Scenario: Install with clones in the flag
- **GIVEN** a meta-repository root with the clones `repos/backend` and `repos/frontend` and no kit
- **WHEN** `sdd-kit install --yes --metarepo backend=repos/backend,frontend=repos/frontend` runs
- **THEN** `openspec/clones` declares `backend` and `frontend`
- **AND** the installer asks no question

#### Scenario: Flag with a bare path
- **WHEN** `sdd-kit install --yes --metarepo repos/backend` runs
- **THEN** `openspec/clones` declares the clone `backend` at `repos/backend`

#### Scenario: Install with the flag alone
- **WHEN** `sdd-kit install --yes --metarepo` runs
- **THEN** `openspec/clones` exists with a comment on its format and no clone lines

#### Scenario: Install without the flag stays a single repository
- **WHEN** `sdd-kit install --yes` runs without `--metarepo`
- **THEN** `openspec/clones` does not exist

#### Scenario: Invalid flag entry writes nothing
- **WHEN** `sdd-kit install --yes --metarepo backend=` runs in a project without the kit
- **THEN** the installer exits with an error that names the entry `backend=`
- **AND** it creates no file

#### Scenario: Update switches a single repository to a meta-repository
- **GIVEN** a project with the kit installed and no `openspec/clones`
- **WHEN** `sdd-kit update --yes --metarepo repos/backend` runs
- **THEN** `openspec/clones` declares `backend`

#### Scenario: Update adds clones to an existing list
- **GIVEN** a meta-repository whose `openspec/clones` declares `repos/backend`
- **WHEN** `sdd-kit update --yes --metarepo repos/backend,repos/frontend` runs
- **THEN** `openspec/clones` declares `backend` once and `frontend`

#### Scenario: Known path under another name writes nothing
- **GIVEN** a meta-repository whose `openspec/clones` declares `repos/backend`
- **WHEN** `sdd-kit update --yes --metarepo api=repos/backend` runs
- **THEN** the installer exits with an error that `repos/backend` is already declared as `backend`
- **AND** `openspec/clones` is unchanged

#### Scenario: Update keeps the clone list
- **GIVEN** a meta-repository whose `openspec/clones` declares `repos/backend`
- **WHEN** `sdd-kit update --yes` runs
- **THEN** `openspec/clones` is unchanged

### Requirement: The kit changes nothing inside a clone
Install, update, uninstall and the health check SHALL create, change or delete no file inside a declared clone. Uninstall keeps `openspec/clones`, a project file.

#### Scenario: Install leaves the clones untouched
- **GIVEN** a meta-repository root with the clones `repos/backend` and `repos/frontend`, each a git repository with a clean status
- **WHEN** `sdd-kit install --yes --metarepo repos/backend,repos/frontend` runs and then the health check
- **THEN** `git status` in each clone shows no change
- **AND** the health check ends with "Ready."

#### Scenario: Uninstall leaves the clones and the list
- **GIVEN** a meta-repository with the kit installed and the clones `repos/backend` and `repos/frontend`, each with a clean status
- **WHEN** `sdd-kit uninstall --yes` runs
- **THEN** `git status` in each clone shows no change
- **AND** `openspec/clones` still exists

### Requirement: Changes started before the switch keep their rules
The meta-repository rules SHALL apply to a change whose first kit artifact (`clarifications.md`, or `proposal.md` on `lean`) is written while the project is a meta-repository; the kit SHALL then write `x-sdd-kit-metarepo: true` to its `.openspec.yaml`, at the same moment as the kit version stamp `x-sdd-kit`. A change without that key keeps the single-repository rules. A change with it keeps the meta-repository rules and its checks report an error while `openspec/clones` is missing.

#### Scenario: Change started before the switch archives under the old rules
- **GIVEN** a change whose `.openspec.yaml` has no `x-sdd-kit-metarepo` key and whose plan has no *Repository* column
- **WHEN** the project becomes a meta-repository and the change is archived
- **THEN** the archive gate does not ask for repositories in its plan, tasks or report

#### Scenario: Change started after the switch is marked
- **GIVEN** a meta-repository and a new change with no artifact yet
- **WHEN** its `clarifications.md` is written
- **THEN** its `.openspec.yaml` holds `x-sdd-kit-metarepo: true`

#### Scenario: Change created before the switch but written after it
- **GIVEN** a change created while the project had no `openspec/clones`, with no artifact written
- **WHEN** the project becomes a meta-repository and the first artifact of the change is written
- **THEN** its `.openspec.yaml` holds `x-sdd-kit-metarepo: true`

#### Scenario: Clone list removed during a meta-repository change
- **GIVEN** a change with `x-sdd-kit-metarepo: true` and `openspec/clones` deleted
- **WHEN** `check-traceability` runs on the change
- **THEN** it reports an error that the change follows the meta-repository rules but `openspec/clones` is missing

### Requirement: A clone's own OpenSpec is not edited from the root
In a meta-repository, writing a file in a declared clone's `openspec/` folder from a session started in the root SHALL be blocked, by file tools or the shell writes answers-gate detects (redirects, `tee`, `sed -i`, `cp`/`mv` targets, `rm`) with a relative or absolute path. The message names the clone and says to work from a session in it. Reading, paths reached after `cd` in the same command and undeclared repositories are not guarded.

#### Scenario: Editing a clone's proposal is blocked
- **GIVEN** a meta-repository whose clone `backend` has `repos/backend/openspec/changes/add-export/proposal.md`
- **WHEN** the agent in a session started in the root writes that file
- **THEN** the write is blocked with a message that names `backend` and says to work on it from a session started in `repos/backend`

#### Scenario: Shell write to a clone's OpenSpec is blocked
- **WHEN** the agent in a session started in the root runs `echo x >> repos/backend/openspec/config.yaml`
- **THEN** the command is blocked with the same message

#### Scenario: Write through an absolute path is blocked
- **WHEN** the agent in a session started in the root writes `<root>/repos/backend/openspec/specs/orders/spec.md` by its absolute path
- **THEN** the write is blocked with the same message

#### Scenario: Removing a clone's OpenSpec file is blocked
- **WHEN** the agent in a session started in the root runs `rm repos/backend/openspec/changes/add-export/tasks.md`
- **THEN** the command is blocked with the same message

#### Scenario: Reading a clone's OpenSpec is allowed
- **WHEN** the agent in a session started in the root reads `repos/backend/openspec/specs/orders/spec.md`
- **THEN** nothing is blocked
