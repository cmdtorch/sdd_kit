# Spec Delta

## Purpose

Makes `tasks.md` the execution plan for apply through subagents: each task group is small enough for one fresh subagent and states what it depends on, what it touches and which shared resources it uses, so that the main agent can tell which groups may run in parallel.

## ADDED Requirements

### Requirement: Group plan lines
On every kit schema (`clarify`, `clarify-ai-qa`, `clarify-qa`, `lean`), the `tasks` instruction SHALL tell the agent to write three lines right under each task group heading of `tasks.md`, before its tasks: `Depends on:`, `Area:` and `Shared:`.

#### Scenario: Tasks instruction shows the plan lines
- **GIVEN** the installed kit
- **WHEN** the `tasks` instruction of any of the four kit schemas is read
- **THEN** it tells the agent to write the lines `Depends on:`, `Area:` and `Shared:` under every task group heading, with an example

#### Scenario: Group with its plan lines
- **GIVEN** a group `## 2. Order API` that depends on group 1, changes `src/api/orders/` and adds a library
- **WHEN** the agent writes `tasks.md`
- **THEN** the group heading is followed by `Depends on: 1`, `Area: src/api/orders/` and `Shared: dependencies`

### Requirement: Every task group states its dependencies
The `Depends on:` line SHALL list the numbers of the groups this group depends on, or say `none`. A group that depends on another group runs only after that group is done.

#### Scenario: Independent group
- **GIVEN** a group whose work needs nothing from the other groups
- **WHEN** the agent writes `tasks.md`
- **THEN** its line reads `Depends on: none`

#### Scenario: Dependent group waits
- **GIVEN** a `tasks.md` whose group 3 has `Depends on: 2`
- **WHEN** the main agent runs apply
- **THEN** no subagent starts group 3 before group 2 is accepted

### Requirement: Every task group declares its area
The `Area:` line SHALL list the files or folders the group's tasks change. When the area cannot be named in advance, for example a rename across the whole project, it SHALL say `unknown`.

#### Scenario: Area of a frontend group
- **GIVEN** a group that changes only files under `web/src/orders/`
- **WHEN** the agent writes `tasks.md`
- **THEN** its line reads `Area: web/src/orders/`

#### Scenario: Rename across the project
- **GIVEN** a group that renames a term in every module of the project
- **WHEN** the agent writes `tasks.md`
- **THEN** its line reads `Area: unknown`

### Requirement: Every task group names its shared resources
The `Shared:` line SHALL list the shared resources the group changes or its tests use, from this set: `dependencies` (dependency manifests and lock files), `migrations` (database migrations and schema), `settings` (shared project settings: build, linter, test configuration, environment variables), `assembly` (shared assembly points: route files, module registration), `database`, `ports`, `docker`; or say `none`.

#### Scenario: Tasks instruction lists the shared resources
- **GIVEN** the installed kit
- **WHEN** the `tasks` instruction of any of the four kit schemas is read
- **THEN** it names the shared resources `dependencies`, `migrations`, `settings`, `assembly`, `database`, `ports` and `docker`, each with what it covers

#### Scenario: Group installs a library
- **GIVEN** a task group whose tasks add a new library to the project
- **WHEN** the agent writes `tasks.md`
- **THEN** its `Shared:` line contains `dependencies`

#### Scenario: Group whose tests use the database
- **GIVEN** a task group whose tests read and write the project's test database and that changes no shared file
- **WHEN** the agent writes `tasks.md`
- **THEN** its `Shared:` line contains `database` and none of `dependencies`, `migrations`, `settings`, `assembly`

### Requirement: Group size limit
The `tasks` instruction SHALL tell the agent to keep each task group to at most 5 tasks and about 10 touched files, so that one subagent doing the group stays within about 200 to 300 thousand tokens of context, and to split a larger group into several groups. The limit is a rule for the agent only: no check SHALL block or report a group above it.

#### Scenario: Tasks instruction states the limit
- **GIVEN** the installed kit
- **WHEN** the `tasks` instruction of any of the four kit schemas is read
- **THEN** it says that a task group has at most 5 tasks and about 10 touched files and that a larger group is split

#### Scenario: Large group is split
- **GIVEN** a piece of work that needs 9 tasks
- **WHEN** the agent writes `tasks.md`
- **THEN** the work is spread over at least two task groups of at most 5 tasks each

#### Scenario: Group above the limit is not blocked
- **GIVEN** a `tasks.md` with a task group of 7 tasks
- **WHEN** the agent writes `tasks.md`
- **THEN** the write is not blocked and the kit's checks report no error or warning about the group size

### Requirement: Plan lines are not checked
No kit check SHALL block or report a missing or malformed `Depends on:`, `Area:` or `Shared:` line. The main agent treats a group with any of them missing or unreadable as depending on every earlier group, with an unknown area.

#### Scenario: Group without plan lines
- **GIVEN** a `tasks.md` whose group 2 has no plan lines
- **WHEN** the agent writes `tasks.md` and later runs apply
- **THEN** the write is not blocked, and group 2 runs alone after group 1 is accepted

#### Scenario: Malformed plan line
- **GIVEN** a `tasks.md` whose group 3 has `Depends on: the API group`
- **WHEN** the main agent runs apply
- **THEN** group 3 runs alone after every earlier group is accepted

### Requirement: Final group depends on every other group
The final group of `tasks.md` (test review, full suite, implementation report) SHALL depend on every other group.

#### Scenario: Final group depends on all
- **GIVEN** a `tasks.md` with groups 1 to 4, where group 4 is the final group
- **WHEN** the agent writes `tasks.md`
- **THEN** group 4 has `Depends on: 1, 2, 3`
