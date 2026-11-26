# workflow/environment-check Specification

## Purpose

Finds out before the work starts whether the agent can run the project the way its instructions describe, so that an environment problem is decided by the developer up front instead of surfacing after the implementation.

## Requirements

### Requirement: Project tool list
The project MAY keep a tool list in `openspec/project-tools`, one line per tool: `<command> — <checks it is needed for>`, or the single line `none` when the developer declined a list. At the first start check of a change, when the file is missing, the agent SHALL propose a list from the project's instructions and SHALL write it only after the developer confirms. On a `clarify` change stamped 0.7.0 or later that moment is right after the Main round, also when the early start check is skipped.

#### Scenario: Agent proposes the list
- **WHEN** the start check begins, `openspec/project-tools` is missing, and the README starts the stack with `docker compose` and runs the tests with `make test`
- **THEN** the agent proposes the lines `docker — stack, E2E` and `make — tests`
- **AND** writes `openspec/project-tools` only after the developer confirms

#### Scenario: Developer declines the list
- **WHEN** the developer declines the proposed list
- **THEN** `openspec/project-tools` holds the single line `none`
- **AND** the agent does not propose a list again

### Requirement: Doctor warns about missing project tools
The kit's health check SHALL report each command of `openspec/project-tools` that is not found on the system path as a warning naming the checks it is needed for. A missing project tool SHALL NOT make the health check fail; without the file, or with `none`, it reports nothing about project tools. The installer shows the health check's result at the end.

#### Scenario: Listed tool missing
- **WHEN** `openspec/project-tools` has the line `docker — stack, E2E` and no `docker` command is on the system path
- **THEN** the health check prints a warning that names docker and the checks "stack, E2E"
- **AND** it still ends with "Ready." when nothing else is wrong

#### Scenario: All listed tools present
- **WHEN** every command of `openspec/project-tools` is on the system path
- **THEN** the health check prints no warning about project tools

#### Scenario: No tool list
- **WHEN** `openspec/project-tools` is missing or holds `none`
- **THEN** the health check prints nothing about project tools

#### Scenario: Install shows the result
- **WHEN** the installer finishes in a project whose tool list names a missing command
- **THEN** its output ends with the health check's result, including that warning

### Requirement: Start check at the beginning of apply
When the verification plan's Environment says the checks need a running application (integration checks through the stack, or the E2E stage), the agent SHALL, before the first task, start it with the project's own instructions, request an address they give (the main page or a health check) and stop it again; it succeeds when that address returns a status below 500 within 2 minutes. A change with a record of a start check that passed right after the Main round SHALL NOT repeat it.

#### Scenario: Application starts
- **WHEN** the plan needs the running application, the change has no record of a passed start check, and the chosen address returns status 200 within 2 minutes
- **THEN** the agent stops the application and goes on with the first task

#### Scenario: Application does not answer in time
- **WHEN** the chosen address returns no response, or a status of 500 or above, within 2 minutes
- **THEN** the start check has failed

#### Scenario: No running application needed
- **WHEN** the verification plan's Environment section does not say that a running application is needed
- **THEN** the agent does not start the application before the first task

#### Scenario: No instructions or no address
- **WHEN** the plan needs the running application and the project's instructions do not say how to start it or which address it serves
- **THEN** the agent asks the developer once and suggests writing the commands and the address into CLAUDE.md

#### Scenario: Early check already passed
- **GIVEN** a change whose start check passed right after the Main round and whose plan needs a running application
- **WHEN** apply starts
- **THEN** the agent does not run the start check again and goes on with the first task

#### Scenario: Lean change keeps the check at the start of apply
- **GIVEN** a `lean` change stamped 0.7.0 whose plan needs a running application
- **WHEN** apply starts
- **THEN** the agent runs the start check before the first task

#### Scenario: Early check was skipped
- **GIVEN** a change stamped 0.7.0 whose early start check was skipped because the instructions did not say how to start the application, and whose plan needs a running application
- **WHEN** apply starts
- **THEN** the agent asks the developer once how to start it and runs the start check before the first task

### Requirement: Failed start is decided by the developer
When the start check fails, the agent SHALL stop before the first task, report what failed, and offer ways from which the developer chooses: for the E2E stage, switch it off, fix the cause, or deliberately skip it; for integration checks that need the running stack, fix the cause or deliberately skip them. The agent SHALL NOT pick one itself.

#### Scenario: Ports unreachable
- **WHEN** the stack starts but its published ports are refused, and the plan has E2E and integration checks through the stack
- **THEN** the agent stops before the first task, reports the refused ports, offers three ways for E2E and two for the integration checks
- **AND** it does nothing else until the developer chooses

#### Scenario: Developer switches off E2E
- **WHEN** the developer chooses to switch off the E2E stage
- **THEN** the change goes on as if E2E had not been chosen at the start: the E2E stage record says the stage is skipped
- **AND** every case labelled `e2e` goes under "Not verified automatically" with the reason "E2E switched off" and a `Consent:` line with the developer's choice

#### Scenario: Developer skips E2E deliberately
- **WHEN** the developer chooses to skip the E2E stage deliberately
- **THEN** the E2E stage record says the stage is skipped
- **AND** every case labelled `e2e` goes under "Not verified automatically" with the reason "tests were not run", the cause and a `Consent:` line with the developer's choice

#### Scenario: Developer chooses to fix inside the project
- **WHEN** the developer chooses to fix the cause and the fix lies inside the project
- **THEN** the agent fixes it and runs the start check again

#### Scenario: Fix outside the project
- **WHEN** the developer chooses to fix the cause and the fix lies outside the project
- **THEN** the agent changes nothing outside the project unless the developer allows that specific change
- **AND** after the fix the agent runs the start check again

#### Scenario: Developer skips the integration checks
- **WHEN** the developer chooses to skip the integration checks that need the stack
- **THEN** each of them goes under "Not verified automatically" with the reason "tests were not run", the cause and a `Consent:` line with the developer's choice

### Requirement: Early start check right after the Main round
On a `clarify` change stamped with kit version 0.7.0 or later, the agent SHALL run the start check as soon as the Main round is closed, before the proposal is written, whenever the project's instructions name the start command and the address of the application, even when the change may not need it. The result is recorded in the change's `start-check.json`. When either is missing, the agent SHALL skip the early check without a question. Other schemas have no early check.

#### Scenario: Application starts during planning
- **GIVEN** a change stamped 0.7.0 whose Main round has just been closed, in a project whose README starts the application and names its address
- **WHEN** the agent goes on
- **THEN** it runs the start check, the address returns status 200 within 2 minutes, and the agent stops the application again
- **AND** the change's `start-check.json` records a passed check and the agent writes the proposal

#### Scenario: Change that does not need the application
- **GIVEN** the same project and a change that only renames a field in a report
- **WHEN** its Main round is closed
- **THEN** the agent still runs the early start check

#### Scenario: No start instructions
- **GIVEN** a project whose instructions do not say how to start the application
- **WHEN** the Main round of a change stamped 0.7.0 is closed
- **THEN** the agent runs no start check, asks nothing about it and writes the proposal

#### Scenario: Start command without an address
- **GIVEN** a project whose instructions name the start command and no address the application serves
- **WHEN** the Main round of a change stamped 0.7.0 is closed
- **THEN** the agent runs no start check, asks nothing about it and writes the proposal

#### Scenario: Test-case schema change
- **GIVEN** a `clarify-qa` change in a project whose README starts the application and names its address
- **WHEN** its Main round is confirmed
- **THEN** the agent runs no start check before the proposal, and the check stays at the start of apply

#### Scenario: Meta-repository
- **GIVEN** a meta-repository whose instructions name one command, run from the root, that starts every clone the application needs, and its address
- **WHEN** the Main round of a change stamped 0.7.0 is closed
- **THEN** the early start check uses that command from the root

### Requirement: A failed early start check stops planning
When the early start check fails, the agent SHALL write no further artifact, report what failed, and offer two ways from which the developer chooses: fix the cause and run the check again, or go on with planning without a passed check. The agent SHALL NOT pick one itself. The ways about E2E and the integration checks belong to a failed check before the first task only. After "go on", the change has no passed check, and the start check at the beginning of apply applies to it.

#### Scenario: Ports refused during planning
- **WHEN** the early start check fails because the published ports are refused
- **THEN** the agent reports the refused ports, offers the two ways and writes no proposal until the developer chooses

#### Scenario: Developer fixes the cause
- **WHEN** the developer chooses to fix the cause and says it is fixed
- **THEN** the agent runs the start check again and, when it passes, writes the proposal

#### Scenario: Developer goes on without a passed check
- **WHEN** the developer chooses to go on with planning
- **THEN** the agent writes the proposal
- **AND** before the first task of apply the start check runs again when the plan needs a running application
