# Spec Delta

## MODIFIED Requirements

### Requirement: The AI asks whether the change has mockups
When `sources/ui/` holds no screenshot, the AI SHALL ask whether the change has UI mockups: on the question-round schemas as the first Main round question, marked `(UI mockups)` in its heading; on `lean` in chat before the proposal, recording the answer in it. On "yes" it SHALL create `sources/ui/`, say which files to put there and stop until the developer continues, and ask once more (wait or continue without mockups) if the folder is still empty. On a change stamped 0.6.0 or later on `clarify` or `lean` the developer continues by saying the screenshots are in place; on others with the continue skill.

#### Scenario: Yes without screenshots stops until continue
- **GIVEN** a `clarify` change stamped `x-sdd-kit: 0.5.0` with no screenshots, and the developer answers "yes" to the mockups question
- **WHEN** the AI handles the answer
- **THEN** `sources/ui/` exists, the AI has named the accepted formats and `/openspec-continue-change`, and no further question or artifact is written

#### Scenario: Empty folder on continue is asked again
- **GIVEN** a change whose mockups question is answered "yes" and whose `sources/ui/` is still empty
- **WHEN** the developer runs `/openspec-continue-change`
- **THEN** the AI asks whether to wait or to continue without mockups before writing anything else

#### Scenario: Lean asks about mockups before the proposal
- **GIVEN** a `lean` change with no screenshots
- **WHEN** the AI starts the proposal
- **THEN** it asks in chat whether the change has mockups, and the proposal records the answer

#### Scenario: Yes on a new change waits for the developer's word
- **GIVEN** a `clarify` change stamped 0.6.0 with no screenshots, and the developer answers "yes" to the mockups question
- **WHEN** the AI handles the answer
- **THEN** `sources/ui/` exists, the AI has named the accepted formats and asked the developer to say when the screenshots are in place, its message does not name `/openspec-continue-change`, and no further question or artifact is written

#### Scenario: Screenshots in place on a new change
- **GIVEN** a `clarify` change stamped 0.6.0 whose mockups question is answered "yes"
- **WHEN** the developer puts two PNG files into `sources/ui/` and writes "done"
- **THEN** the AI goes on with the UI inventory

#### Scenario: Done with an empty folder on a new change
- **GIVEN** a `clarify` change stamped 0.6.0 whose mockups question is answered "yes" and whose `sources/ui/` is still empty
- **WHEN** the developer writes "done"
- **THEN** the AI asks whether to wait or to continue without mockups before writing anything else
