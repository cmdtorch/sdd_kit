# questions/recommendations Specification

## Purpose
Lets the agent name the answer it recommends in a clarifying question, so the developer answers faster, while the answer itself still comes only from the developer.

## Requirements

### Requirement: A question carries a recommended option when there is a basis
On a change stamped with kit version 0.6.0 or later on the `clarify` schema, a clarifying question SHALL name the option it recommends, with the reason, whenever the recommendation rests on a registered source, an existing spec or the project's code; the reason names that basis. A question without such a basis SHALL carry no recommendation. A question that allows several answers may recommend several options.

#### Scenario: Recommendation from the code
- **GIVEN** a question about who may export a report, in a project whose code already limits exports to accountants
- **WHEN** the agent writes the question
- **THEN** the question names the accountants-only option as recommended and its reason names the existing export rule in the code

#### Scenario: No basis, no recommendation
- **GIVEN** a question about a business rule that no source, spec or code decides
- **WHEN** the agent writes the question
- **THEN** the question has no recommended option

#### Scenario: Several recommended options
- **GIVEN** a question "Which roles get the report? (select all that apply)" where a requirement document names accountants and administrators
- **WHEN** the agent writes the question
- **THEN** the question recommends both options and its reason names that document

#### Scenario: Older change has no recommendations
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` on `clarify`
- **WHEN** the agent writes a question
- **THEN** the question names no recommended option

#### Scenario: Test-case schema has no recommendations
- **GIVEN** a change created with kit 0.6.0 on `clarify-qa`
- **WHEN** the agent writes a question
- **THEN** the question names no recommended option

### Requirement: The recommendation is recorded with the question
On a change stamped 0.6.0 or later on `clarify`, the recommendation SHALL be written in the clarifications file on its own line under the question, as `Recommended: <option letters, comma-separated> — <reason>` (for example `Recommended: A, C — …`), and shown with the question when it is asked in the chat.

#### Scenario: Recommendation in the file
- **WHEN** the agent writes a question whose option B is recommended because the existing export spec limits exports to accountants
- **THEN** the clarifications file has under that question a line that starts with `Recommended: B — ` and names the export spec

#### Scenario: Recommendation names an unknown option
- **GIVEN** a question with the options A, B and X whose recommendation line names option D
- **WHEN** the check of the clarifications file runs
- **THEN** it reports that the recommended option D is not an option of the question

### Requirement: A recommendation is never an answer
On a change stamped 0.6.0 or later on `clarify`, the agent SHALL leave the answer of a question blank until the developer answers it, whatever the question recommends. A question with a recommendation and a blank answer keeps its round open.

#### Scenario: Recommended question stays unanswered
- **GIVEN** a Main round whose only question recommends option B and has a blank answer
- **WHEN** the agent tries to write the proposal
- **THEN** the write is blocked and the message names that question as unanswered

### Requirement: No answer accepts all recommendations at once
On a change stamped 0.6.0 or later on `clarify`, the kit SHALL NOT offer the developer an answer that accepts the recommendations of several questions at once. When the developer asks in free text to accept all recommendations, the agent SHALL fill in no answer and ask the developer to answer each question.

#### Scenario: Batch of questions in the chat
- **GIVEN** three questions with recommendations asked in the chat
- **WHEN** the developer sees the batch
- **THEN** each question is shown with its own options and no choice accepts all recommendations together

#### Scenario: Developer asks to accept everything
- **GIVEN** three unanswered questions with recommendations
- **WHEN** the developer writes "just take all your recommendations"
- **THEN** the three answers stay blank and the agent asks the developer to answer each question
