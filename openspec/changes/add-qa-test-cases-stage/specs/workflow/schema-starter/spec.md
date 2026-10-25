# Spec Delta

## Purpose

Defines the schema starter: when the agent in Claude Code creates a change without naming a schema, the developer chooses from a menu whether QA is needed and which kind, and the change gets the matching schema.

## ADDED Requirements

### Requirement: Creating a change without a schema starts the menu
When the agent in Claude Code runs `openspec new change`, directly or through the kit's OpenSpec wrapper, without naming a schema, a kit hook SHALL block the command and tell the agent to show the developer the starter menu first. A schema counts as named when given as `--schema <name>` or `--schema=<name>`.

#### Scenario: Unnamed schema is blocked
- **GIVEN** a project with the kit installed
- **WHEN** the agent runs `openspec new change "add-export"`
- **THEN** the command is blocked
- **AND** the block message tells the agent to show the starter menu and lists its three choices

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

### Requirement: The menu offers three choices
The starter menu SHALL offer exactly three choices, each mapped to one schema: no test cases (`clarify`), test cases reviewed by the AI QA reviewer only (`clarify-ai-qa`), and test cases reviewed by the AI QA reviewer and then a human QA (`clarify-qa`). The change SHALL then be created with the chosen schema; `lean` SHALL NOT be offered.

#### Scenario: Choosing a human QA
- **GIVEN** the starter menu is shown for "add-export"
- **WHEN** the developer chooses review by the AI QA reviewer and then a human QA
- **THEN** the change "add-export" is created on the `clarify-qa` schema

#### Scenario: Choosing no test cases
- **GIVEN** the starter menu is shown for "add-export"
- **WHEN** the developer chooses no test cases
- **THEN** the change "add-export" is created on the `clarify` schema

#### Scenario: Lean is not offered
- **WHEN** the starter block message lists the menu choices
- **THEN** it lists `clarify`, `clarify-ai-qa` and `clarify-qa` and does not list `lean`

### Requirement: No change without a choice
When the developer dismisses the starter menu without a choice, the change SHALL NOT be created and the agent SHALL say how to start again. When the developer answers with free text instead of a choice, the agent SHALL discuss it and show the menu again.

#### Scenario: Menu dismissed
- **GIVEN** the starter menu is shown for "add-export"
- **WHEN** the developer dismisses it without choosing
- **THEN** no change "add-export" exists
- **AND** the agent tells the developer how to start the change again

#### Scenario: Free-text answer
- **GIVEN** the starter menu is shown for "add-export"
- **WHEN** the developer answers "not sure, what is the difference?"
- **THEN** no change "add-export" exists yet
- **AND** the agent explains the choices and shows the menu again

### Requirement: The project default schema is not a choice
The default schema in the project's OpenSpec settings SHALL NOT count as a named schema: the starter SHALL block an unnamed creation even when a default schema is set.

#### Scenario: Default schema in settings still starts the menu
- **GIVEN** the project's OpenSpec settings set `clarify` as the default schema
- **WHEN** the agent runs `openspec new change "add-export"`
- **THEN** the command is blocked and the starter menu is requested

### Requirement: The terminal is not affected
The starter SHALL act only on commands the agent runs in Claude Code. A change the developer creates in a terminal without a schema SHALL get the project's default schema.

#### Scenario: Change created in a terminal
- **GIVEN** the project's default schema is `clarify`
- **WHEN** the developer runs `openspec new change "add-export"` in a terminal
- **THEN** the change is created on the `clarify` schema without any menu
