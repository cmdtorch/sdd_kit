# workflow/planning-flow Specification

## Purpose
Lets planning run from the first answer to the end of the tasks without a command from the developer: the agent goes on to the next artifact by itself and stops only where a human is needed.

## Requirements

### Requirement: Planning goes on without a command
On a change stamped with kit version 0.6.0 or later, on the `clarify` or `lean` schema, after the agent has written an artifact of the change in this session and nothing waits for the developer, the kit SHALL keep the agent from ending its turn and tell it to write the next artifact. No setting switches this off.

#### Scenario: Next artifact is written without a command
- **GIVEN** a change stamped 0.6.0 on `clarify` whose proposal the agent has just written and whose Technical round is closed
- **WHEN** the agent tries to end its turn
- **THEN** the turn does not end and the agent is told to go on with the specs of that change

#### Scenario: Technical round is prepared next
- **GIVEN** a change stamped 0.6.0 on `clarify` whose proposal the agent has just written and whose clarifications file has no Technical round section
- **WHEN** the agent tries to end its turn
- **THEN** the turn does not end and the agent is told to run the Technical round of that change

#### Scenario: Lean change goes on
- **GIVEN** a change stamped 0.6.0 on `lean` whose proposal the agent has just written
- **WHEN** the agent tries to end its turn
- **THEN** the turn does not end and the agent is told to go on with the specs of that change

#### Scenario: Change not touched in this session is left alone
- **GIVEN** two active changes stamped 0.6.0, and the agent wrote an artifact only of the first one in this session
- **WHEN** the agent tries to end its turn after the first change's planning is complete
- **THEN** the turn ends and the agent is not told to continue the second change

#### Scenario: Change on a test-case schema is not continued
- **GIVEN** a change on `clarify-qa` whose proposal the agent has just written
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

#### Scenario: Older change is not continued
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` on `clarify` whose proposal the agent has just written
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

#### Scenario: Unstamped change is not continued
- **GIVEN** a change on `clarify` without a kit version stamp whose proposal the agent has just written
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

### Requirement: The agent stops where a human is needed
The turn SHALL end, without a continuation, while the change waits for the developer: a question the agent asked, in the clarifications file or in the chat, that has no answer yet; screenshots the developer said they will add; answers that no longer match the written artifacts; an artifact whose check still fails, or whose write stays blocked, after two fix attempts; or a pause the developer asked for.

#### Scenario: Unanswered question ends the turn
- **GIVEN** a change stamped 0.6.0 whose Main round has a question with a blank answer
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

#### Scenario: Question asked in the chat ends the turn
- **GIVEN** a `lean` change stamped 0.6.0 where the agent has just asked in the chat whether the change has mockups
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

#### Scenario: Waiting for screenshots ends the turn
- **GIVEN** a change stamped 0.6.0 where the developer answered that UI mockups exist and the screenshot folder is still empty
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

#### Scenario: Lean change waits for screenshots
- **GIVEN** a `lean` change stamped 0.6.0 where the developer answered in the chat that UI mockups exist and the screenshot folder is still empty
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

#### Scenario: Changed answer ends the turn
- **GIVEN** a change stamped 0.6.0 with a warning that an answer no longer matches the written proposal
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends

### Requirement: The developer pauses planning in plain words
On a change stamped 0.6.0 or later on `clarify` or `lean`, when the developer tells the agent in plain words to stop or pause, the agent SHALL end its turn and the kit SHALL NOT continue the change until the developer tells the agent to go on. While paused, the agent answers the developer's messages and writes no artifact of the change.

#### Scenario: Developer pauses
- **GIVEN** a change stamped 0.6.0 whose proposal the agent has just written
- **WHEN** the developer writes "stop, I want to think about the scope"
- **THEN** the agent ends its turn and the specs are not written

#### Scenario: Question during a pause
- **GIVEN** planning of a change is paused by the developer
- **WHEN** the developer asks "why is the export in scope?"
- **THEN** the agent answers the question, writes no artifact and ends its turn

#### Scenario: Developer resumes
- **GIVEN** planning of a change is paused by the developer
- **WHEN** the developer writes "go on"
- **THEN** the agent writes the next artifact and planning goes on without further commands

### Requirement: A failing artifact check stops after two fix attempts
On a change stamped 0.6.0 or later on `clarify` or `lean`, when a kit check reports errors in an artifact the agent has written, or blocks the write of an artifact, the agent SHALL fix the cause. When the check still fails after the second fix attempt, the agent SHALL stop, show the developer the remaining errors and write no further artifact. A write blocked by an unanswered question is a wait for the answer, not a fix attempt.

#### Scenario: Check passes after a fix
- **GIVEN** the check of a written proposal reports one error
- **WHEN** the agent fixes the proposal and the check passes
- **THEN** the agent goes on to the next artifact without asking the developer

#### Scenario: Check still fails after two attempts
- **GIVEN** the check of a written proposal still reports an error after the agent's second fix attempt
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends and the agent's message lists the remaining errors of the check

#### Scenario: Write blocked by a cause only the developer can remove
- **GIVEN** a change stamped 0.6.0 on `clarify` whose screenshot folder holds a `.svg` file, so the write of the proposal is blocked
- **WHEN** the write is still blocked after the agent's second attempt
- **THEN** the turn ends and the agent's message names the `.svg` file and asks the developer to export it as PNG, JPG or WebP

#### Scenario: Write blocked by an open question is a wait
- **GIVEN** a change stamped 0.6.0 on `clarify` where the write of the proposal was blocked once because a Main round question has a blank answer
- **WHEN** the agent tries to end its turn
- **THEN** the turn ends and the agent's message names the unanswered question, not a failed check

### Requirement: Planning starts and resumes without `/opsx:continue`
On a change stamped 0.6.0 or later on `clarify` or `lean` the agent SHALL write the first artifact right after the change is created, and SHALL NOT tell the developer to run `/opsx:continue` at any point of planning.

#### Scenario: First artifact follows the creation
- **WHEN** the agent creates a change on `clarify` in a project with kit 0.6.0
- **THEN** the agent writes the first questions of the change in the same turn, without waiting for a command

#### Scenario: Developer still runs the command
- **GIVEN** a change stamped 0.6.0 whose Main round is closed and whose proposal is not written
- **WHEN** the developer runs `/opsx:continue`
- **THEN** the agent writes the proposal and goes on with the next artifacts as without the command

### Requirement: The agent settles spec review findings itself
On a change stamped 0.6.0 or later on `clarify`, after the spec reviewer reports findings, the agent SHALL fix the specs itself without waiting for the developer. For a finding that needs a decision about the requirements it SHALL add a question to the Technical round and wait for the answer.

#### Scenario: Finding fixed without the developer
- **GIVEN** the spec review reports that a scenario's outcome says "properly saved" without a value
- **WHEN** the answers already name the saved value
- **THEN** the agent rewrites the scenario with that value and does not ask the developer what to do with the finding

#### Scenario: Finding that needs a requirements decision
- **GIVEN** the spec review reports that no answer says who may cancel an order
- **WHEN** the agent handles the finding
- **THEN** a question about who may cancel an order is added to the Technical round with a blank answer and the turn ends

#### Scenario: Older change waits for the developer
- **GIVEN** a change stamped `x-sdd-kit: 0.5.0` on `clarify` whose spec review reports a finding
- **WHEN** the agent handles the review
- **THEN** it shows the findings to the developer and waits for the decision

### Requirement: At most two spec review runs
On a change stamped 0.6.0 or later on `clarify`, after the agent has fixed findings of the first spec review, the spec reviewer SHALL run once more and never a third time for the same specs. The agent fixes the findings of the second run too. A finding that needs a decision about the requirements becomes a Technical round question; a finding the agent could not fix SHALL be listed in the digest, and planning goes on.

#### Scenario: Second run after fixes
- **GIVEN** the first spec review reported two findings and the agent fixed both
- **WHEN** the fixes are written
- **THEN** the spec reviewer runs a second time

#### Scenario: No third run
- **GIVEN** the second spec review still reports one finding about the wording of a scenario name
- **WHEN** the agent goes on
- **THEN** the agent rewrites the scenario name, the spec reviewer is not started again and the design is written next

#### Scenario: Finding the agent cannot fix
- **GIVEN** the second spec review reports that two requirements overlap, and the agent cannot merge them without changing their meaning
- **WHEN** the agent goes on
- **THEN** the digest lists that finding and the design is written next

#### Scenario: Second run finds a requirements gap
- **GIVEN** the second spec review reports that no answer says what happens to a cancelled order's payment
- **WHEN** the agent handles the finding
- **THEN** a question about it is added to the Technical round with a blank answer, the turn ends and the design is not written

#### Scenario: First review without findings
- **GIVEN** the first spec review reports no finding
- **WHEN** the agent goes on
- **THEN** the spec reviewer is not started a second time

### Requirement: A digest after the specs
On a change stamped 0.6.0 or later on `clarify`, when the spec review is settled, the agent SHALL print a digest of at most 15 lines in the project's questions language with: what will be built (the capabilities and their main rules), what is deliberately left out, the decisions the agent has made itself so far, and the review findings it could not fix. It SHALL then go on without waiting for a reply. The digest contains no scenario counts. A `lean` change gets no digest.

#### Scenario: Digest is printed and planning goes on
- **GIVEN** a change stamped 0.6.0 on `clarify` in a project whose questions language is Russian, with reviewed specs for two capabilities and one decision the agent made itself
- **WHEN** the spec review is settled
- **THEN** the chat shows a digest in Russian of at most 15 lines that names both capabilities, what is left out and that decision
- **AND** the agent writes the design next without a reply from the developer

#### Scenario: Digest without own decisions
- **GIVEN** a change stamped 0.6.0 on `clarify` where every decision came from an answer
- **WHEN** the digest is printed
- **THEN** its part about the agent's own decisions says there are none

### Requirement: A digest that cannot hold every decision points to the full list
When the agent's own decisions do not fit into the 15 lines of the digest, the digest SHALL show first those that change the behaviour a user sees, then the number of the others, and name `proposal.md`, whose assumptions list them all.

#### Scenario: Twenty own decisions
- **GIVEN** a change on `clarify` whose proposal lists twenty decisions the agent made itself
- **WHEN** the digest is printed
- **THEN** it has at most 15 lines, names decisions that change visible behaviour, says how many more there are and names `proposal.md` as the place of the full list

### Requirement: Updated specs are reviewed once and the digest is printed again
On a change stamped 0.6.0 or later on `clarify`, after the agent has rewritten the specs because an answer changed and the developer asked for the update, the spec reviewer SHALL run once on the rewritten specs and the digest SHALL be printed again.

#### Scenario: Specs rewritten after a changed answer
- **GIVEN** a change stamped 0.6.0 on `clarify` whose specs were reviewed twice, and the developer changed an answer and told the agent to update the artifacts
- **WHEN** the agent has rewritten the specs
- **THEN** the spec reviewer runs once more, is not started again after the agent's fixes, and a new digest is printed

### Requirement: The end of planning recommends a new chat for apply
On a change stamped 0.6.0 or later on `clarify` or `lean`, when the last planning artifact is written, the agent SHALL tell the developer that apply can start, name the apply command, and strongly recommend running `/clear` or opening a new chat first. It SHALL NOT start apply itself.

#### Scenario: Planning is complete
- **GIVEN** a change stamped 0.6.0 whose tasks the agent has just written
- **WHEN** the agent ends its turn
- **THEN** its message says apply can start, names `/opsx:apply` and recommends `/clear` or a new chat before it
- **AND** no task of the change has been started

### Requirement: The kit adds no waiting notification
The kit SHALL NOT register a notification of its own for the moments when the agent waits for the developer. The kit's guide SHALL recommend switching on Claude Code's built-in notifications.

#### Scenario: Guide recommends the built-in notifications
- **WHEN** a developer reads the kit's workflow guide
- **THEN** it recommends Claude Code's built-in notifications for the moments when the agent waits

#### Scenario: No notification hook is installed
- **WHEN** the kit is installed into a project
- **THEN** the project's Claude Code settings get no kit hook on the notification event
