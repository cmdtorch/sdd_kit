# Spec Delta

## Purpose

Defines the depth level of the clarifying questions of a change: how far the agent investigates before it asks and what it may settle itself, so that a higher level digs deeper instead of only asking more.

## ADDED Requirements

### Requirement: Three depth levels
On a change stamped with kit version 0.6.0 or later on the `clarify` schema, the depth of the questions SHALL be one of `low`, `medium` or `high`. The agent SHALL record it in the change's clarifications file as the line `Depth: <level>` when it writes that file: the level the developer chose in the starter menu, otherwise `medium`. A `lean` change has no depth level.

#### Scenario: Level not chosen
- **GIVEN** a change created on `clarify` with kit 0.6.0 without the starter menu
- **WHEN** the agent writes the clarifications file
- **THEN** the file has the line `Depth: medium`

#### Scenario: Missing level line
- **GIVEN** a change stamped 0.6.0 on `clarify` whose clarifications file has no `Depth:` line
- **WHEN** the check of the clarifications file runs
- **THEN** it reports that the `Depth:` line is missing and names the three levels

#### Scenario: Test-case schema keeps its depth names
- **GIVEN** a change created with kit 0.6.0 on `clarify-qa` whose clarifications file has the line `Depth: Comprehensive`
- **WHEN** the check of the clarifications file runs
- **THEN** it reports no error for that line

#### Scenario: Unknown level
- **GIVEN** a change stamped 0.6.0 on `clarify` whose clarifications file has the line `Depth: extreme`
- **WHEN** the check of the clarifications file runs
- **THEN** it reports that the level must be `low`, `medium` or `high`

#### Scenario: Older change keeps its depth names
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` whose clarifications file has the line `Depth: Comprehensive`
- **WHEN** the check of the clarifications file runs
- **THEN** it reports no error for that line

### Requirement: The level sets what the agent investigates
Before it writes the questions of a round the agent SHALL investigate: on `low` the registered sources and the developer's description; on `medium` also the existing specs and the code of the area the change touches; on `high` also the code affected outside that area, every requirement under the lenses roles, states, errors, boundaries, concurrent use and existing data, and the bugs QA would likely file after the release.

#### Scenario: High level finds an affected module
- **GIVEN** a change on `high` that adds a debt list, in a project where a separate permissions module decides who sees lists
- **WHEN** the agent writes the Main round
- **THEN** a question asks who may see the debt list and names that permissions module as its finding

#### Scenario: Low level asks from the sources only
- **GIVEN** a change on `low` whose description names a new report
- **WHEN** the agent writes the Main round
- **THEN** no question and no recommendation of the round names the project's code or an existing spec as its basis

#### Scenario: Medium level reads the touched area
- **GIVEN** a change on `medium` that changes the export of reports, in a project whose existing export spec limits a file to 10 000 rows
- **WHEN** the agent writes the Main round
- **THEN** it does not ask what the row limit is

### Requirement: The level sets what the agent settles itself
On `low` the agent SHALL settle itself every decision that does not change the behaviour a user sees. On `medium` it SHALL also settle minor details of visible behaviour (an order, a label, a default value), and SHALL ask every decision about permissions, money and data, visible or not. On `high` it SHALL ask about every decision that no source, spec or code settles.

#### Scenario: Low level settles what the user does not see
- **GIVEN** a change on `low` where no source says how often a cached report total is recalculated
- **WHEN** the agent writes the proposal
- **THEN** the recalculation interval was not asked and is listed among the proposal's assumptions

#### Scenario: Low level asks about visible behaviour
- **GIVEN** a change on `low` where no source says in which order the debt list is sorted
- **WHEN** the agent writes the Main round
- **THEN** a question asks about the sort order

#### Scenario: Medium level settles a visible detail
- **GIVEN** a change on `medium` where no source says in which order the debt list is sorted
- **WHEN** the agent writes the proposal
- **THEN** the sort order was not asked and is listed among the proposal's assumptions

#### Scenario: Medium level asks about permissions
- **GIVEN** a change on `medium` where no source says who may delete a record
- **WHEN** the agent writes the Main round
- **THEN** a question asks who may delete the record

#### Scenario: Medium level asks about data the user does not see
- **GIVEN** a change on `medium` where no source says how long a generated export file is kept in storage
- **WHEN** the agent writes the Main round
- **THEN** a question asks about the storage period

#### Scenario: High level asks about the storage period
- **GIVEN** a change on `high` where no source, spec or code says how long a generated export file is kept
- **WHEN** the agent writes its questions
- **THEN** a question asks about the storage period

### Requirement: The agent's own decisions are recorded as assumptions
Every decision the agent settles itself SHALL be listed as an assumption: in the proposal when it is made before or while the proposal or the specs are written (the agent adds it to the proposal's assumptions), otherwise in the assumptions of the design or of the verification plan.

#### Scenario: Decision made while writing the specs
- **GIVEN** a change on `medium` whose proposal is written
- **WHEN** the agent decides, while writing the specs, that a list is sorted by date
- **THEN** the proposal's assumptions list that sort order after the specs are written

### Requirement: Every question names what its answer changes
On every level the `Why this is asked:` line of a question SHALL say what in the specs depends on the answer; a question for which the agent cannot say it SHALL NOT be asked. On `high` the line SHALL also name the finding that raised the question: the place in the code, the source or the spec.

#### Scenario: Reason names the dependent rule
- **WHEN** the agent writes a question about who may export a report
- **THEN** its `Why this is asked:` line names the permission rule that depends on the answer

#### Scenario: High level names the finding
- **GIVEN** a change on `high`
- **WHEN** the agent writes a question raised by the existing export spec
- **THEN** the `Why this is asked:` line names that spec and what depends on the answer

### Requirement: On the high level every answer is checked for its consequences
On `high` the agent SHALL check each answer for what it implies for existing behaviour and data, and SHALL ask one follow-up question that quotes the answer for each consequence that no source, spec, code or answer decides.

#### Scenario: Consequence of a narrowed permission
- **GIVEN** a change on `high` where the developer answered that only accountants may export reports, in a project where other staff have already created exports
- **WHEN** the agent analyses the answers
- **THEN** a follow-up question quotes that answer and asks what happens to the exports created by other staff

#### Scenario: Consequence already decided
- **GIVEN** a change on `high` where an earlier answer already says that existing exports stay visible to their authors
- **WHEN** the developer answers that only accountants may export reports
- **THEN** no follow-up question about the existing exports is asked

### Requirement: A changed level applies to later questions only
The developer MAY change the depth level at any time, by telling the agent or by editing the `Depth:` line. The new level SHALL apply only to questions not asked yet; the agent SHALL NOT add questions to a closed round, or rewrite questions already asked, because of the new level.

#### Scenario: Level raised after the Main round
- **GIVEN** a change on `low` whose Main round is closed
- **WHEN** the developer tells the agent to use `high`
- **THEN** the clarifications file has the line `Depth: high`, the Main round gets no new question and the Technical round is prepared on `high`

#### Scenario: Level lowered during a round
- **GIVEN** a change on `high` whose Main round has six questions, two of them unanswered
- **WHEN** the developer changes the level to `low`
- **THEN** the six questions stay as they are and the Technical round is prepared on `low`
