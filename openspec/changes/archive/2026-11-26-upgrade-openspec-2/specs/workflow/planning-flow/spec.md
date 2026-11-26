# Spec Delta

## MODIFIED Requirements

### Requirement: Planning starts and resumes without `/opsx:continue`
On a change stamped 0.6.0 or later on `clarify` or `lean` the agent SHALL write the first artifact right after the change is created, and SHALL NOT tell the developer to run `/openspec-continue-change` at any point of planning.

#### Scenario: First artifact follows the creation
- **WHEN** the agent creates a change on `clarify` in a project with kit 0.6.0
- **THEN** the agent writes the first questions of the change in the same turn, without waiting for a command

#### Scenario: Developer still runs the command
- **GIVEN** a change stamped 0.6.0 whose Main round is closed and whose proposal is not written
- **WHEN** the developer runs `/openspec-continue-change`
- **THEN** the agent writes the proposal and goes on with the next artifacts as without the command

### Requirement: The end of planning recommends a new chat for apply
On a change stamped 0.6.0 or later on `clarify` or `lean`, when the last planning artifact is written, the agent SHALL tell the developer that apply can start, name the apply command, and strongly recommend running `/clear` or opening a new chat first. It SHALL NOT start apply itself.

#### Scenario: Planning is complete
- **GIVEN** a change stamped 0.6.0 whose tasks the agent has just written
- **WHEN** the agent ends its turn
- **THEN** its message says apply can start, names `/openspec-apply-change` and recommends `/clear` or a new chat before it
- **AND** no task of the change has been started
