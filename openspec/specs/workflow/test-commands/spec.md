# workflow/test-commands Specification

## Purpose
Keeps the project's test commands in one project file, so that the agent runs one test file, only the failed tests or the full suite with the project's own commands and flags instead of searching for them in every change.

## Requirements

### Requirement: Test commands file
The project MAY keep its test commands in `openspec/test-commands.md`. A command SHALL be a list item ``- <label>: `<command>` `` with the label `One file`, `Failed only` or `Full suite`, optionally followed by ` — <n> min`, a whole number of minutes. The one-file command holds the placeholder `<file>`. Every other line is free text and is ignored. The file SHALL hold test commands only: no quality-check commands, and no start or stop command or address of the application.

#### Scenario: File with three commands
- **WHEN** `openspec/test-commands.md` holds the lines ``- One file: `make test FILE=<file>` — 1 min``, ``- Failed only: `make test-failed` `` and ``- Full suite: `make test` — 12 min``
- **THEN** the agent runs the test file `tests/orders.test` with `make test FILE=tests/orders.test`
- **AND** it treats the full suite as a run of 12 minutes and the failed-only run as a run of unknown duration

#### Scenario: Line that is not a command item
- **WHEN** the file holds the heading `# Test commands`, a sentence of notes and the line `- Full suite: make test` without backticks
- **THEN** the heading and the notes are ignored
- **AND** the file counts as having no full-suite command

#### Scenario: Duration in another form
- **WHEN** the file holds ``- Full suite: `make test` — 90 s``
- **THEN** the command counts and has no duration

#### Scenario: Same label twice
- **WHEN** the file, outside a meta-repository, holds two `- Full suite:` items
- **THEN** the first one counts

#### Scenario: Quality checks stay in the instructions
- **WHEN** the agent drafts the file for a project whose README names `make test` and `make lint`
- **THEN** the draft holds `make test` and no line for `make lint`

### Requirement: The kit never overwrites the file
`openspec/test-commands.md` is a project file: the kit's install and update SHALL NOT create, change or delete it, and the kit's health check SHALL NOT report anything about it.

#### Scenario: Update keeps the file
- **GIVEN** a project whose `openspec/test-commands.md` was written by the developer
- **WHEN** the kit is updated
- **THEN** the file has the same content as before

#### Scenario: Health check ignores the file
- **WHEN** the health check runs in a project whose `openspec/test-commands.md` names a command that is not on the system path
- **THEN** it prints nothing about that file

### Requirement: The agent drafts the file and the developer confirms it
When the file is missing, the agent SHALL draft it from the project's instructions (README, CLAUDE.md, Makefile, package scripts, CI configuration), show the draft to the developer and write it only after the developer confirms. When the developer declines, the agent SHALL write the single line `none` and SHALL NOT propose the file again.

#### Scenario: Developer confirms the draft
- **WHEN** the agent shows a draft with `make test FILE=<file>` and `make test`, and the developer confirms
- **THEN** `openspec/test-commands.md` holds exactly the confirmed commands

#### Scenario: Developer corrects the draft
- **WHEN** the developer answers that the full suite needs the flag `--reuse-db`
- **THEN** the written file's `Full suite:` command carries `--reuse-db`

#### Scenario: Developer declines
- **WHEN** the developer declines the draft
- **THEN** `openspec/test-commands.md` holds the single line `none`
- **AND** the agent does not propose the file in a later change

#### Scenario: Nothing written before the answer
- **WHEN** the agent has shown the draft and the developer has not answered yet
- **THEN** `openspec/test-commands.md` does not exist

### Requirement: The file is proposed right after the Main round
On a `clarify` change stamped with kit version 0.7.0 or later, when `openspec/test-commands.md` is missing, the agent SHALL propose the file as soon as the Main round is closed, before the proposal is written, in the same message as the project tool list when that list is missing too. Changes on `lean`, `clarify-ai-qa` and `clarify-qa` get no proposal during planning.

#### Scenario: First change of a project
- **GIVEN** a project without `openspec/test-commands.md` and a change stamped 0.7.0 whose Main round has just been closed
- **WHEN** the agent goes on
- **THEN** it shows the draft of the file and waits for the developer before it writes the proposal

#### Scenario: File already exists
- **GIVEN** a project whose `openspec/test-commands.md` exists, with commands or with `none`
- **WHEN** the Main round of a change is closed
- **THEN** the agent does not propose the file

#### Scenario: Test-case schema change
- **GIVEN** a project without `openspec/test-commands.md` and a `clarify-qa` change whose Main round is confirmed
- **WHEN** the agent goes on
- **THEN** it writes the proposal without proposing the file

#### Scenario: Tool list and commands in one message
- **GIVEN** a project with neither `openspec/project-tools` nor `openspec/test-commands.md`
- **WHEN** the Main round of a change stamped 0.7.0 is closed
- **THEN** the agent proposes both in one message and asks once
- **AND** it runs the early start check after the developer's answer, before the proposal

### Requirement: Expected duration is written once
The expected duration of a command SHALL come from the project's instructions or from the developer's words at the confirmation. When it is unknown, the command has no duration. The agent SHALL NOT run the project's tests to measure it when it drafts the file, and the kit SHALL NOT update a duration from real runs.

#### Scenario: Duration from the developer
- **WHEN** the developer confirms the draft and says that the full suite takes about 12 minutes
- **THEN** the `Full suite:` line ends with `— 12 min`

#### Scenario: Unknown duration
- **WHEN** neither the instructions nor the developer name a duration for the failed-only command
- **THEN** its line has no duration

#### Scenario: No test run while drafting
- **WHEN** the agent drafts the file during planning
- **THEN** it runs none of the project's test commands

#### Scenario: A slower real run changes nothing
- **GIVEN** a file whose full suite is written as `— 12 min`
- **WHEN** a full-suite run takes 20 minutes
- **THEN** the file still says `— 12 min`

### Requirement: A missing file or command never blocks the work
When the file is missing, holds `none`, or lacks the command the agent needs, the agent SHALL find the command in the project's instructions, as before, and go on. Unless the file holds `none`, the agent SHALL propose the commands it used and the file lacks (a missing file, section or line) in the ready message at the end of apply, and SHALL write them only after the developer confirms.

#### Scenario: No file at apply
- **GIVEN** a `lean` change in a project without `openspec/test-commands.md` whose README runs the tests with `make test`
- **WHEN** apply starts
- **THEN** the agent runs the tests with the README's commands and does not stop for the file
- **AND** the ready message proposes `openspec/test-commands.md` with the commands it used

#### Scenario: One command missing
- **GIVEN** a file with a `Full suite:` line and no `One file:` line, and a README that runs one file with `make test FILE=<path>`
- **WHEN** a task group needs to run one test file
- **THEN** the file is run with the README's command
- **AND** the ready message proposes adding ``One file: `make test FILE=<file>` `` to the file

#### Scenario: File says none
- **GIVEN** a file with the single line `none`
- **WHEN** apply ends
- **THEN** the ready message proposes no command

### Requirement: A command that does not work is a stop
A command of the file does not work when the shell or the tool it calls rejects the command itself before the project's tests are loaded: the command is not found, an option is unknown, a task or target is missing. The agent SHALL then stop, show the developer the command and its output, and wait. It SHALL NOT replace the command or edit the file on its own. An error in the project's code or tests (an import, syntax or collection error) is a failing test, not this stop.

#### Scenario: Unknown flag
- **WHEN** the file's one-file command ends with the error "unknown option --reuse-db" before any test runs
- **THEN** the agent stops and shows the developer the command and that error
- **AND** `openspec/test-commands.md` is unchanged

#### Scenario: Failing tests are not this stop
- **WHEN** the file's one-file command runs the tests and two of them fail
- **THEN** the agent handles them as failing tests, with fix attempts, and does not stop for the command

#### Scenario: Import error in the group's code
- **WHEN** the file's one-file command starts the test tool and the run ends with an import error in the file the group has just changed
- **THEN** the agent fixes the code as for a failing test and does not stop for the command

#### Scenario: Command from the instructions does not work
- **GIVEN** a project without `openspec/test-commands.md`
- **WHEN** a test command the agent found in the README is rejected with "command not found"
- **THEN** the agent handles it as before this rule: it looks for the right command in the instructions and asks the developer once when it finds none

#### Scenario: Developer gives the right command
- **WHEN** the developer answers the stop with the corrected command
- **THEN** the agent writes it into the file and goes on with the stopped work

#### Scenario: Subagent meets the broken command
- **WHEN** a task-group subagent meets a command of the file that does not start the tests
- **THEN** it ends and reports the stop, and the main agent asks the developer

### Requirement: Independent work goes on before the stop for a command
The stop for a command that does not work SHALL be handled like the environment stop: the main agent lets the running subagents finish, completes through subagents the groups that do not need that command and do not depend on the stopped group, and then asks the developer.

#### Scenario: Other repository's groups go on
- **GIVEN** a meta-repository change where the one-file command of the `backend` section does not work, and a `[frontend]` group that does not depend on the stopped `[backend]` group
- **WHEN** the backend subagent reports the stop
- **THEN** the main agent completes the frontend group through a subagent and then shows the developer the backend command and its output

#### Scenario: Every remaining group needs the command
- **GIVEN** a project with one repository where the one-file command does not work
- **WHEN** the subagent of group 1 reports the stop
- **THEN** the main agent starts no further group and asks the developer

### Requirement: One file with a section per repository in a meta-repository
In a meta-repository the file SHALL be the root's `openspec/test-commands.md`, with one section `## Repository: <name>` per repository (a declared clone name or `root`), each with its own command items; items outside a section are ignored. The agent SHALL use the section of the repository a task group names; a repository without a section is handled as a missing command. The kit SHALL NOT write a commands file inside a clone.

#### Scenario: Group uses its repository's section
- **GIVEN** a root file with `## Repository: backend` holding ``One file: `mise run test:backend -- <file>` `` and `## Repository: frontend` holding ``One file: `mise run test:frontend -- <file>` ``
- **WHEN** the group `## 2. [backend] Order API` runs its test file `orders/tests/test_api.py`
- **THEN** the command is `mise run test:backend -- orders/tests/test_api.py`

#### Scenario: Repository without a section
- **GIVEN** a root file with a section for `backend` only
- **WHEN** a `[frontend]` group needs its test command
- **THEN** the agent takes it from the meta-repository's instructions and goes on
- **AND** the ready message proposes a `## Repository: frontend` section with the commands it used

#### Scenario: Draft covers every declared clone
- **WHEN** the agent drafts the file in a meta-repository with the clones `backend` and `frontend`
- **THEN** the draft has the sections `## Repository: backend` and `## Repository: frontend`, and no file is written inside a clone
- **AND** it has a section `## Repository: root` only when the root's instructions name test commands of the root itself

### Requirement: Changes started under earlier rules keep them
A change without the kit version stamp, or stamped below 0.7.0, SHALL be planned and implemented as before: the agent proposes no test-commands file for it and finds the commands in the project's instructions.

#### Scenario: Change stamped 0.6.1
- **GIVEN** a change stamped 0.6.1 in a project without `openspec/test-commands.md`
- **WHEN** its Main round is closed
- **THEN** the agent writes the proposal without proposing the file
