## MODIFIED Requirements

### Requirement: Stops that remain
After planning the agent SHALL stop and wait for the developer only on: a requirement gap; a test still failing after two fix attempts; a failed start check or missing start instructions; an environment that blocks the start the project describes; a test-commands file command that does not start the tests; an action that needs consent (outside the project, weakening a test); a situation the plan and the kit's rules do not cover that needs a decision; and the consent list at the end.

#### Scenario: Requirement gap during apply
- **WHEN** the agent finds behaviour that no source, answer or spec decides
- **THEN** it appends the question to the Apply round of `clarifications.md` and waits for the answer

#### Scenario: Test still fails after two fix attempts
- **WHEN** a test still fails after the agent's second fix attempt
- **THEN** the agent stops and shows the developer the failing test and both attempts

#### Scenario: Environment blocks the start during the work
- **WHEN** during a task the application or the stack no longer starts with the project's own instructions, for example a container is unreachable, Docker does not see the project folders or a port is closed
- **THEN** the agent stops, describes what blocks it and waits for the developer's decision

#### Scenario: Situation outside the plan
- **WHEN** the agent meets a situation that the plan and the kit's rules do not cover and that needs a decision, for example a library version that the design relies on has been withdrawn from the package registry
- **THEN** the agent reports it to the developer and waits instead of choosing a way around it

#### Scenario: Test command of the file does not start
- **WHEN** during a task the one-file command of `openspec/test-commands.md` ends with "no rule to make target 'test'" before any test runs
- **THEN** the agent stops, shows the developer the command and that output, and waits instead of running another command
