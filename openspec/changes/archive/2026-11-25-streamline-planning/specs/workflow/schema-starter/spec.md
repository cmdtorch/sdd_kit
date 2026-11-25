# Spec Delta

## MODIFIED Requirements

### Requirement: Creating a change without a schema starts the menu
When the agent in Claude Code runs `openspec new change`, directly or through the kit's OpenSpec wrapper, without naming a schema, a kit hook SHALL block the command and tell the agent to show the developer the starter menu first. A schema counts as named when given as `--schema <name>` or `--schema=<name>`.

#### Scenario: Unnamed schema is blocked
- **GIVEN** a project with the kit installed
- **WHEN** the agent runs `openspec new change "add-export"`
- **THEN** the command is blocked
- **AND** the block message tells the agent to show the starter menu and lists its three depth levels

#### Scenario: Unnamed schema through the wrapper is blocked
- **GIVEN** a project with the kit installed
- **WHEN** the agent runs the kit's OpenSpec wrapper with `new change "add-export"` and no schema
- **THEN** the command is blocked with the same message

#### Scenario: Schema named with a space is not blocked
- **WHEN** the agent runs `openspec new change "add-export" --schema lean`
- **THEN** the command is not blocked by the starter

#### Scenario: Schema named with an equals sign is not blocked
- **WHEN** the agent runs `openspec new change "add-export" --schema=clarify-qa`
- **THEN** the command is not blocked by the starter

#### Scenario: Unknown schema is passed through
- **WHEN** the agent runs `openspec new change "add-export" --schema foo`
- **THEN** the command is not blocked by the starter and OpenSpec reports the unknown schema itself

## ADDED Requirements

### Requirement: The menu asks the depth level
The starter menu SHALL ask one question, the depth level of the questions, with exactly three choices: `low`, `medium` and `high`, `medium` marked as recommended. The change SHALL then be created on the `clarify` schema, and its clarifications file records the chosen level. The menu SHALL NOT offer `clarify-ai-qa`, `clarify-qa` or `lean`.

#### Scenario: Choosing the high level
- **GIVEN** the starter menu is shown for "add-export"
- **WHEN** the developer chooses `high`
- **THEN** the change "add-export" is created on the `clarify` schema and its clarifications file has the line `Depth: high`

#### Scenario: Medium is marked as recommended
- **WHEN** the starter block message lists the menu choices
- **THEN** it lists `low`, `medium` and `high` and marks `medium` as recommended

#### Scenario: Only depth levels are offered
- **WHEN** the starter block message lists the menu choices
- **THEN** it names neither `clarify-ai-qa` nor `clarify-qa` nor `lean` as a choice

### Requirement: A test-case schema can still be named in the command
A change created with `--schema clarify-ai-qa` or `--schema clarify-qa` SHALL be created on that schema without the menu and follow that schema's rules; no depth level is asked for it.

#### Scenario: Test-case schema named explicitly
- **WHEN** the agent runs `openspec new change "add-export" --schema clarify-qa`
- **THEN** the change is created on `clarify-qa` and the developer is not asked a depth level

## REMOVED Requirements

### Requirement: The menu offers three choices
**Reason**: The test-case schemas leave the menu; the menu now asks the depth level and always creates the change on `clarify`.
**Migration**: To start a change on a test-case schema, name it in the command: `openspec new change "<name>" --schema clarify-qa`.
