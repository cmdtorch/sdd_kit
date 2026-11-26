## MODIFIED Requirements

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
