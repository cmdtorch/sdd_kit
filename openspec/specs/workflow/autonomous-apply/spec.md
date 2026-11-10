# workflow/autonomous-apply Specification

## Purpose

Lets a change on a kit schema go from the end of planning to ready-to-archive without the developer, while the agent stops only on decisions that belong to a human and never leaves the project to get work done.

## Requirements

### Requirement: Implementation runs without the developer after planning
On every kit schema (`clarify`, `lean`, `clarify-ai-qa`, `clarify-qa`), once the planning artifacts are complete the agent SHALL carry out the implementation, the tests, the test review, the full suite and the E2E stage without asking the developer anything, except at the stops listed in "Stops that remain".

#### Scenario: Planning complete, nothing blocks
- **WHEN** the developer starts apply on a change whose planning artifacts are complete and no stop occurs
- **THEN** the agent finishes every task, the test review, the full suite and the E2E stage without a question to the developer

#### Scenario: No task for the developer in the task list
- **WHEN** the agent writes `tasks.md`
- **THEN** no task asks a human to check something by hand

### Requirement: Stops that remain
After planning the agent SHALL stop and wait for the developer only: on a requirement gap; on a test that still fails after two fix attempts; when the start check fails or the project has no start instructions; when the environment blocks the start described by the project; before an action that needs consent (outside the project, weakening a test); on a situation the plan and the kit's rules do not cover and that needs a decision; and for the consent list at the end.

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

### Requirement: A single check that cannot run is recorded
When the application starts with the project's instructions but one check still cannot be run, the agent SHALL NOT stop: it records the check under "Not verified automatically" with the cause and goes on.

#### Scenario: Case needs a real phone
- **WHEN** the application runs and a case requires an SMS to arrive on a real phone
- **THEN** the agent records the case under "Not verified automatically" with that cause
- **AND** continues with the next task without asking

#### Scenario: Application itself does not start
- **WHEN** the application no longer starts with the project's instructions
- **THEN** this is the environment stop, not a recorded check

### Requirement: Independent work goes on before a stop
When a stop during the tasks concerns a single test or the environment, the agent SHALL first finish the tasks that do not depend on it and then ask. A failed start check stops before the first task, and a requirement gap stops at once.

#### Scenario: Stop on one test with independent tasks left
- **WHEN** a test in task group 3 still fails after two attempts and task group 4 does not depend on it
- **THEN** the agent completes task group 4 before it shows the failing test to the developer

#### Scenario: Requirement gap stops at once
- **WHEN** the agent finds a requirement gap in task group 2
- **THEN** it asks the question before it starts any other task

### Requirement: Options are suggested, not carried out
When the agent stops for the environment it MAY suggest options, and it SHALL NOT carry out any of them until the developer has chosen.

#### Scenario: Agent suggests freeing a port
- **WHEN** the agent stops because port 5432 is taken by another program
- **THEN** its message may suggest stopping that program or changing the port
- **AND** the agent does neither until the developer answers

### Requirement: Workarounds inside the application only
The agent MAY work around a problem inside the application and its tests, for example by creating test data in advance or replacing an external service with a stub. It SHALL NOT work around the system, the environment or the kit's workflow.

#### Scenario: Mail service missing in a test
- **WHEN** a registration test fails because no mail server is available
- **THEN** the agent may replace mail sending in the test with a stub and go on

#### Scenario: Other application holds a needed port
- **WHEN** another application on the machine holds a port that the project's Docker stack needs
- **THEN** the agent does not stop, kill or reconfigure that application
- **AND** it stops and reports the conflict to the developer

### Requirement: Nothing outside the project without consent
Without the developer's explicit consent the agent SHALL NOT change anything outside the project folder and its own temporary folder: no system or Docker settings, no programs installed into the system, and no Docker containers, volumes or networks it did not create itself.

#### Scenario: Tool missing on the system
- **WHEN** a tool that the tests need is not installed on the system
- **THEN** the agent does not install it into the system without the developer's consent
- **AND** it may install it into its temporary folder or into a container

#### Scenario: Foreign Docker container in the way
- **WHEN** a Docker container that the agent did not create blocks the project's stack
- **THEN** the agent does not stop or remove it and reports it to the developer

### Requirement: Weakening a test needs consent and a record
The agent SHALL NOT weaken a test or a check without the developer's explicit consent; weakening covers relaxing an assertion, skipping or deleting a test, lowering a threshold and switching off a quality rule. It asks at the stop after two failed fix attempts. Each agreed weakening SHALL be recorded under "Weakened tests" in the implementation report.

#### Scenario: Weakening without consent
- **WHEN** a test fails and the agent has no consent from the developer
- **THEN** the test keeps its assertions and stays enabled

#### Scenario: Relaxed assertion with consent
- **WHEN** the developer agrees to relax the assertion of a test
- **THEN** "Weakened tests" lists that test, the relaxed assertion, the reason and the developer's consent

#### Scenario: Switched-off quality rule with consent
- **WHEN** the developer agrees to switch off a lint rule for one file
- **THEN** "Weakened tests" lists the rule, the file, the reason and the developer's consent

### Requirement: Ready message
When everything is done the agent SHALL tell the developer that the change is ready to archive, name the implementation report, and give the archive command; it SHALL NOT archive the change itself.

#### Scenario: Change ready to archive
- **WHEN** every task is done, the consent list is answered and the archive checks pass
- **THEN** the agent's message names `apply-report.md` and the command `/opsx:archive`
- **AND** the agent does not run the archive
