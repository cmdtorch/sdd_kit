# Spec Delta

## MODIFIED Requirements

### Requirement: The agent works in the group's repository
The meta-repository protocol `openspec/protocols/metarepo.md` SHALL tell the agent to do a group's tasks in the folder of the repository the group names and run that repository's tests with its own commands: first those of the repository's section in the root's `openspec/test-commands.md`, otherwise those found in the meta-repository's instructions and mise tasks. The kit stores no commands inside a clone and does not switch or create branches.

#### Scenario: Protocol names the group's repository
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/metarepo.md` is read
- **THEN** it says that the tasks of a group are done in the folder of the repository the group names, with that repository's own test commands, otherwise found in the meta-repository's instructions and mise tasks

#### Scenario: Protocol names the commands file first
- **GIVEN** the installed kit
- **WHEN** `openspec/protocols/metarepo.md` is read
- **THEN** it says that a repository's test commands are taken first from its section `## Repository: <name>` of the root's `openspec/test-commands.md`
