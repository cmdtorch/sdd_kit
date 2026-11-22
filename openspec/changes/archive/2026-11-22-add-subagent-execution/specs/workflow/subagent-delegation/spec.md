# Spec Delta

## Purpose

Keeps the main chat's context clean outside apply: the final check of the implementation against the specs runs in a subagent, and reading the project's code at other stages may be handed to a subagent, while decisions and artifacts stay with the main agent.

## ADDED Requirements

### Requirement: Verify runs in a subagent
On a change stamped with kit version 0.5.0 or later, on a kit schema, the final check of the implementation against the change's artifacts (verify) SHALL be done by a subagent that only reports its findings to the main agent and changes no file. The main agent shows the findings to the developer. Fixes that follow go through subagents. A change stamped below 0.5.0 or without a stamp is verified by the main agent, as before.

#### Scenario: Developer runs verify
- **GIVEN** a change stamped 0.5.0 whose tasks are all done
- **WHEN** the developer runs verify
- **THEN** the check of the implementation against the artifacts is done by a subagent and its findings are shown to the developer by the main agent

#### Scenario: Verify finding is fixed
- **GIVEN** verify reports that a scenario has no implementation
- **WHEN** the developer asks for the fix
- **THEN** the code is changed by a newly started subagent, not by the main agent

#### Scenario: Verify subagent changes nothing
- **GIVEN** a change stamped 0.5.0 whose implementation misses one scenario
- **WHEN** the verify subagent ends
- **THEN** its report names the missing scenario and no file of the project or the change was changed by it

#### Scenario: Older change verified by the main agent
- **GIVEN** a change stamped `x-sdd-kit: 0.4.0`
- **WHEN** the developer runs verify
- **THEN** the main agent does the check itself without a verify subagent

### Requirement: Code reading may be handed to a subagent
At stages other than apply and verify, the main agent MAY hand reading and studying the project's code to a subagent and use its summary. It SHALL say in the chat why before it starts that subagent.

#### Scenario: Code study before the questions
- **GIVEN** a new change in the Main round whose request touches code in several folders of the project
- **WHEN** the main agent hands the study of the code areas the request touches to a subagent
- **THEN** the chat first says why it does so, and the subagent returns a summary of what it found

### Requirement: Decisions and artifacts stay with the main agent
A subagent started outside apply SHALL NOT write or edit the change's planning artifacts (`clarifications.md`, `proposal.md`, specs, `design.md`, `verification-plan.md`, `tasks.md`, test cases), and SHALL NOT answer clarifying questions or make decisions that belong to the developer. The existing reviewer subagents keep writing only their review files.

#### Scenario: Reading subagent proposes a decision
- **GIVEN** a code-reading subagent finds two possible places for a new module
- **WHEN** it returns its summary
- **THEN** the summary describes both places and no planning artifact is changed by the subagent

#### Scenario: Protocol limits what is delegated
- **GIVEN** the installed kit
- **WHEN** the kit's protocol for subagents is read
- **THEN** it says that outside apply only reading and studying code may be handed to a subagent, never decisions or edits to planning artifacts, and that the reason is given in the chat
