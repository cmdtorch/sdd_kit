# Spec Delta

## Purpose

Finds out before the work starts whether the agent can run the project the way its instructions describe, so that an environment problem is decided by the developer up front instead of surfacing after the implementation.

## ADDED Requirements

### Requirement: Project tool list
The project MAY keep a tool list in `openspec/project-tools`, one line per tool: `<command> — <checks it is needed for>`, or the single line `none` when the developer declined a list. At the first start check of a change, when the file is missing, the agent SHALL propose a list from the project's instructions and SHALL write it only after the developer confirms.

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
When the verification plan's Environment section says that the checks need a running application (integration checks through the stack, or the E2E stage), the agent SHALL, before the first task, start it with the project's own instructions, request an address from those instructions (the main page or a health check), and stop it again. The start succeeds when that address returns an HTTP status below 500 within 2 minutes.

#### Scenario: Application starts
- **WHEN** the plan needs the running application and the chosen address returns status 200 within 2 minutes
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
