# Spec Delta

## Purpose

Defines the question rounds of a change: which rounds exist, when a round is closed, how the developer chooses the way to answer, and what happens when an answer changes after its round is closed.

## ADDED Requirements

### Requirement: Two question rounds before the code
On a change stamped with kit version 0.6.0 or later on the `clarify` schema, the questions before the code SHALL be asked in two rounds: the Main round before the proposal and the Technical round before the specs. The Technical round covers the completeness of the specs and the design forks. There SHALL be no Design round and no Verification round; the Apply round during the implementation stays.

#### Scenario: Design is written without a round of its own
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Main and Technical rounds are closed and whose specs are written
- **WHEN** the agent writes the design
- **THEN** the design is written and the clarifications file has no Design round

#### Scenario: Design fork is asked in the Technical round
- **GIVEN** a change stamped 0.6.0 on `clarify` where the request can be built with a new table or a new column of an existing one
- **WHEN** the agent asks its questions before the specs
- **THEN** the question about that choice is in the Technical round

#### Scenario: Requirement gap during the implementation
- **GIVEN** a change stamped 0.6.0 on `clarify` in apply
- **WHEN** the agent finds behaviour that no answer decides
- **THEN** the question is added to an Apply round of the clarifications file

### Requirement: The agent decides what the Verification round asked
On a change stamped 0.6.0 or later on `clarify` the agent SHALL decide itself which scenarios are critical, which test data they need and which environment the checks need, and SHALL record these decisions in the verification plan as assumptions.

#### Scenario: Verification plan without questions
- **GIVEN** a change stamped 0.6.0 on `clarify` whose design is written
- **WHEN** the agent writes the verification plan
- **THEN** the plan is written without a question to the developer and lists the test data and the environment it assumes under its assumptions

### Requirement: A round is closed when every question is answered
On a change stamped 0.6.0 or later on `clarify` a round SHALL be closed when its section exists in the clarifications file and no question in it has a blank answer. The kit SHALL NOT ask for a summary confirmation, and the artifact that depends on the round may be written as soon as the round is closed.

#### Scenario: Proposal after the last answer
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Main round has five answered questions and no summary confirmation
- **WHEN** the agent writes the proposal
- **THEN** the proposal is written and no check reports a missing confirmation

#### Scenario: Blank answer still blocks
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Main round has one question with a blank answer
- **WHEN** the agent tries to write the proposal
- **THEN** the write is blocked and the message names the unanswered question

#### Scenario: Round not started blocks
- **GIVEN** a change stamped 0.6.0 on `clarify` whose clarifications file has no Technical round section
- **WHEN** the agent tries to write a spec file
- **THEN** the write is blocked and the message says the Technical round has not been run

#### Scenario: Follow-up reopens the round
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Main round is closed and whose proposal is not written yet
- **WHEN** the agent adds a follow-up question to the Main round
- **THEN** writing the proposal is blocked until that question is answered

### Requirement: A round may have no question
On a change stamped 0.6.0 or later on `clarify`, when the agent finds nothing to ask in a round, it SHALL write the round's section with the line `No questions.`; such a round is closed.

#### Scenario: Technical round without questions
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Technical round section holds only the line `No questions.`
- **WHEN** the agent writes the spec files
- **THEN** the spec files are written without a question to the developer

### Requirement: A closed round counts as a confirmed round
On a change stamped 0.6.0 or later on `clarify`, wherever a kit rule requires a confirmed round, a closed round SHALL count as confirmed, and wherever a kit rule names the Specs round, the Technical round takes its place.

#### Scenario: Answer of a closed round is a valid source
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Main round is closed without a summary confirmation
- **WHEN** the proposal cites the answer to Q3 of that round as the source of a statement
- **THEN** the source check of the proposal reports no error for that citation

#### Scenario: Answer of an open round is not a source
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Technical round has a question with a blank answer
- **WHEN** the design cites an answered question of that round
- **THEN** the source check reports that the round is not closed

### Requirement: The answer mode is asked once per change
On a change stamped 0.6.0 or later on `clarify` the agent SHALL ask how the developer wants to answer (questions in the chat, editing the file, free discussion) once, before the first batch of questions, record the choice in the clarifications file as the line `Answer mode: chat`, `Answer mode: file` or `Answer mode: discussion`, and use it for every later batch, the Apply round included. The developer may name another mode at any time; the record is then updated.

#### Scenario: Second round does not ask again
- **GIVEN** a change stamped 0.6.0 on `clarify` whose clarifications file has the line `Answer mode: file`
- **WHEN** the agent has written the Technical round questions
- **THEN** it gives the file path and waits, without asking the answer mode again

#### Scenario: New chat does not ask again
- **GIVEN** a change stamped 0.6.0 on `clarify` whose clarifications file records the answer mode, continued in a new chat
- **WHEN** the agent asks the next batch of questions
- **THEN** it uses the recorded mode without asking

#### Scenario: Developer switches the mode
- **GIVEN** a change stamped 0.6.0 on `clarify` whose recorded mode is editing the file
- **WHEN** the developer writes "ask me here instead" before the Technical round
- **THEN** the Technical round questions are asked in the chat and the clarifications file has the line `Answer mode: chat`

### Requirement: A changed answer of a closed round stops planning
On a change stamped 0.6.0 or later on `clarify`, when the text of an answer of a closed round differs (spaces at its ends ignored) from the answer an already written artifact was based on, the agent SHALL warn the developer, naming the question and the artifacts written after its round was closed, and SHALL write no further artifact until the developer tells it to update those artifacts or restores the earlier answer.

#### Scenario: Answer changed after the proposal
- **GIVEN** a change stamped 0.6.0 on `clarify` whose proposal was written when the answer to Q3 was "B"
- **WHEN** the developer changes that answer to "C" and the agent tries to write the specs
- **THEN** the write is blocked and the message names Q3 and the proposal as written from the earlier answer

#### Scenario: Technical round answer changed after the tasks
- **GIVEN** a change stamped 0.6.0 on `clarify` whose specs, design, verification plan and tasks were written when the Technical round answer to Q9 was "A"
- **WHEN** the developer changes that answer to "B"
- **THEN** the warning names Q9 and the specs, the design, the verification plan and the tasks, and does not name the proposal

#### Scenario: Earlier answer restored
- **GIVEN** the warning about the changed answer to Q3
- **WHEN** the developer changes the answer back to "B"
- **THEN** the agent writes the specs without a warning

#### Scenario: Developer asks to update
- **GIVEN** the warning about the changed answer to Q3
- **WHEN** the developer tells the agent to update the affected artifacts
- **THEN** the agent rewrites the proposal from the new answer and then writes the specs

#### Scenario: Added spaces are not a change
- **GIVEN** a change stamped 0.6.0 on `clarify` whose proposal was written when the answer to Q3 was "B"
- **WHEN** the developer adds a space after "B" and the agent writes the specs
- **THEN** the specs are written without a warning

#### Scenario: Answer changed before any artifact
- **GIVEN** a change stamped 0.6.0 on `clarify` whose Main round is closed and whose proposal is not written yet
- **WHEN** the developer changes the answer to Q3 from "B" to "C"
- **THEN** the proposal is written from "C" without a warning

### Requirement: A changed answer also stops the implementation
On a change stamped 0.6.0 or later on `clarify`, after planning is complete, while an answer of a closed round differs from the answer the written artifacts were based on, the implementation SHALL NOT start or go on: the agent warns the developer and waits until the developer tells it to update the artifacts or restores the earlier answer.

#### Scenario: Answer changed before apply
- **GIVEN** a change stamped 0.6.0 on `clarify` with complete planning, whose answer to Q3 was changed after the tasks were written
- **WHEN** the developer starts apply
- **THEN** no task is started and the agent's message names Q3 and the artifacts written from the earlier answer

#### Scenario: Answer changed during apply
- **GIVEN** a change stamped 0.6.0 on `clarify` with two of five task groups done
- **WHEN** the developer changes the answer to Q3 and tells the agent to go on
- **THEN** the third group is not started and the agent warns about Q3

### Requirement: Earlier changes and test-case schemas keep their rounds
A change without a kit version stamp, a change stamped below 0.6.0, and a change on `clarify-ai-qa` or `clarify-qa` SHALL keep the Main, Specs, Design and Verification rounds and the `Looks correct` summary confirmation of each round.

#### Scenario: Older change still needs the confirmation
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` on `clarify` whose Main round is answered and has no summary confirmation
- **WHEN** the agent tries to write the proposal
- **THEN** the write is blocked until the summary answer is `Looks correct`

#### Scenario: Test-case schema still needs the confirmation
- **GIVEN** a change created with kit 0.6.0 on `clarify-qa` whose Main round is answered and has no summary confirmation
- **WHEN** the agent tries to write the proposal
- **THEN** the write is blocked until the summary answer is `Looks correct`
