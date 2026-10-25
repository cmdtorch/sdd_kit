# Spec Delta

## Purpose

Defines how test cases are reviewed before design: an AI QA reviewer first, then, on the `clarify-qa` schema, a loop of remarks from a human QA until no remark is open and QA confirms the result.

## ADDED Requirements

### Requirement: AI QA reviewer checks the test cases
After the test cases are written, the AI QA reviewer subagent SHALL review them and write `reviews/test-cases-review.md` in the change with a verdict READY or NOT-READY and its findings, each with a severity blocker, major or minor. It SHALL only report; it SHALL NOT edit the test cases, the specs or other artifacts.

#### Scenario: Review report is written
- **GIVEN** a change on the `clarify-ai-qa` schema with a written `test-cases.md`
- **WHEN** the AI QA reviewer runs on the change
- **THEN** `reviews/test-cases-review.md` exists with the verdict READY or NOT-READY and a severity for each finding
- **AND** `test-cases.md` and the delta specs are unchanged by the reviewer

### Requirement: What the AI QA reviewer checks
The AI QA reviewer SHALL report as findings: a requirement without a positive case, without an error case, or without boundary values where it has a numeric limit; an unusual condition from its closed checklist (empty input, duplicate entries, repeated submission, an unavailable external service) left unsettled; a case without concrete data or with a Then that cannot be observed.

#### Scenario: Missing positive case is a finding
- **GIVEN** a requirement whose test cases cover only error paths
- **WHEN** the AI QA reviewer runs
- **THEN** the review has a major finding that names the requirement and says a positive case is missing
- **AND** the verdict is NOT-READY

#### Scenario: Missing error case is a finding
- **GIVEN** a requirement whose test cases cover only the successful path
- **WHEN** the AI QA reviewer runs
- **THEN** the review has a major finding that names the requirement and says an error case is missing
- **AND** the verdict is NOT-READY

#### Scenario: Missing boundary values are a finding
- **GIVEN** a requirement that limits a name to 255 characters and test cases that never use a 255- or 256-character name
- **WHEN** the AI QA reviewer runs
- **THEN** the review has a major finding that names the requirement and the missing boundary values
- **AND** the verdict is NOT-READY

#### Scenario: Unsettled repeated submission is a finding
- **GIVEN** a requirement for submitting an order and no test case for submitting the same order twice
- **WHEN** the AI QA reviewer runs
- **THEN** the review has a major finding that names the requirement and the unusual condition "repeated submission"
- **AND** the verdict is NOT-READY

#### Scenario: Vague outcome is a finding
- **GIVEN** a test case whose Then says "the system works correctly"
- **WHEN** the AI QA reviewer runs
- **THEN** the review has a major finding that names the test case and says its outcome is not observable
- **AND** the verdict is NOT-READY

### Requirement: READY means no open blocker or major finding
The AI QA reviewer's verdict SHALL be READY when no finding of severity blocker or major remains, not counting findings the developer has explicitly accepted. Minor findings alone SHALL NOT make the verdict NOT-READY.

#### Scenario: Only minor findings
- **GIVEN** test cases whose only findings are minor
- **WHEN** the AI QA reviewer runs
- **THEN** the verdict is READY and the minor findings are listed

#### Scenario: Accepted major finding does not block READY
- **GIVEN** a major finding from the previous run that the developer explicitly accepted, and no other blocker or major finding
- **WHEN** the AI QA reviewer runs again
- **THEN** the verdict is READY

### Requirement: The AI review loop runs at most three times
The AI SHALL fix the reviewer's findings and run the reviewer again, at most three reviewer runs in total. When the verdict is still NOT-READY after the third run, the AI SHALL stop the loop and ask the developer to fix or accept each remaining blocker and major finding.

#### Scenario: Loop ends early when the review is READY
- **GIVEN** the second reviewer run returns READY
- **WHEN** the AI continues the stage
- **THEN** the reviewer is not run a third time

#### Scenario: Developer decides after the third run
- **GIVEN** the third reviewer run returns NOT-READY with two major findings
- **WHEN** the AI continues the stage
- **THEN** the reviewer is not run a fourth time
- **AND** the developer is shown both findings and asked to fix or accept each one

### Requirement: Spec changes from AI reviewer findings
When a reviewer finding needs a scenario the spec lacks, the AI SHALL add it itself only if it adds an error case, an empty state, a boundary value or an unusual condition, changes no existing scenario's outcome and contradicts no confirmed answer. Otherwise the AI SHALL ask the developer a follow-up question and change the spec only after the answer.

#### Scenario: Missing error scenario is added by the AI
- **GIVEN** a finding that exporting with an unavailable export service is not covered, and no confirmed answer about it
- **WHEN** the AI handles the finding
- **THEN** the delta spec has a new scenario for exporting while the export service is unavailable
- **AND** `test-cases.md` has at least one test case under it

#### Scenario: New business rule goes to the developer
- **GIVEN** a finding that would need a new discount rule in the spec
- **WHEN** the AI handles the finding
- **THEN** the delta spec is unchanged
- **AND** `clarifications.md` has a new follow-up question about the discount rule with a blank answer

#### Scenario: Finding that contradicts a confirmed answer goes to the developer
- **GIVEN** a confirmed answer "no error message is shown for an empty period" and a finding that asks for an error message there
- **WHEN** the AI handles the finding
- **THEN** the delta spec is unchanged
- **AND** `clarifications.md` has a new follow-up question about that error message with a blank answer

### Requirement: Follow-up questions from the test-cases stage
A follow-up question asked during the test-cases stage SHALL go into the Specs round of `clarifications.md` and reset that round's summary answer, as any follow-up does. The AI SHALL NOT run the reviewer again or complete the stage until the round is answered and confirmed with `Looks correct`.

#### Scenario: Stage waits for the answer
- **GIVEN** a follow-up question added to the Specs round during the test-cases stage, with a blank answer
- **WHEN** the AI continues the stage
- **THEN** the Specs round summary answer is blank
- **AND** the reviewer is not run again and the stage is not completed

### Requirement: Spec changes during the test-cases stage are recorded
Every spec change made during the test-cases stage, from a QA remark, an AI QA reviewer finding or the answer to a follow-up question, SHALL be recorded in the section "Spec changes during test-case review" of `test-cases.md`, with the remark or finding that caused it and the changed scenario. The verification plan SHALL cite these records as the source of the changed requirements.

#### Scenario: AI reviewer finding is recorded
- **GIVEN** the AI added the scenario "Export while the export service is unavailable" because of a reviewer finding
- **WHEN** the AI finishes handling the finding
- **THEN** the section "Spec changes during test-case review" lists that finding together with the added scenario

#### Scenario: Change after a follow-up answer is recorded
- **GIVEN** the developer answered a follow-up question about a discount rule and the AI then added a scenario for it
- **WHEN** the AI finishes the spec change
- **THEN** the section "Spec changes during test-case review" lists the change with the question it answers

### Requirement: Hand-over to a human QA
On the `clarify-qa` schema, the AI SHALL hand the test cases to a human QA only after every blocker and major finding of the latest AI QA review is listed as fixed by hand or accepted in "Stage result" or absent from that review. The hand-over SHALL be recorded as the line `Handed over to QA` in "Stage result" and told to the developer.

#### Scenario: Hand-over waits for the AI findings
- **GIVEN** a change on the `clarify-qa` schema with one open major finding from the AI QA reviewer
- **WHEN** the AI continues the stage
- **THEN** "Stage result" has no line `Handed over to QA`
- **AND** the developer is shown the open finding

#### Scenario: Hand-over is recorded
- **GIVEN** a change on the `clarify-qa` schema whose latest AI QA review is READY
- **WHEN** the AI continues the stage
- **THEN** "Stage result" has the line `Handed over to QA`
- **AND** the developer is told that the test cases are ready for QA

### Requirement: Human QA writes remarks in the test-case document
QA, or the developer on QA's behalf, SHALL write each remark under the test case it is about, or in the general remarks section at the end of `test-cases.md` for a remark not tied to one case. Each remark SHALL record a status: open, closed or reopened; the test-case check SHALL report any other status as an error, and the gates SHALL count such a remark as open. QA is asked no questions. Remarks MAY be in any language; test cases stay in English.

#### Scenario: Remark under a test case
- **GIVEN** QA finds that the case "Export of an empty period" expects the wrong message
- **WHEN** QA writes the remark
- **THEN** the remark is placed under that test case in `test-cases.md` with the status open

#### Scenario: General remark about a forgotten case
- **GIVEN** QA finds that no case covers exporting while the export service is unavailable
- **WHEN** QA writes the remark
- **THEN** the remark is placed in the general remarks section at the end of `test-cases.md` with the status open

#### Scenario: Unknown status is reported
- **GIVEN** a remark whose status is `fixed`
- **WHEN** the test-case check runs on the change
- **THEN** it reports an error that names the remark and lists the allowed statuses open, closed, reopened

#### Scenario: Remark in Russian
- **GIVEN** an open remark written in Russian that asks for a case with an empty period
- **WHEN** the AI handles the remark
- **THEN** the new test case is written in English

### Requirement: Remarks are answered by the AI and closed only by QA
On `done` from whoever works in Claude Code, the AI SHALL handle every open or reopened remark: write under it how it was handled and revise the test cases. Only QA SHALL close a remark, and MAY reopen it with an explanation; the developer MAY enter these decisions on QA's behalf.

#### Scenario: Done starts a new pass
- **GIVEN** QA wrote two open remarks
- **WHEN** the AI is told `done`
- **THEN** each of the two remarks has an answer under it that says how it was handled

#### Scenario: AI answers a remark without closing it
- **GIVEN** an open remark under a test case
- **WHEN** the AI handles it
- **THEN** the remark keeps the status open

#### Scenario: QA reopens a remark
- **GIVEN** a remark the AI has answered
- **WHEN** QA sets its status to reopened with an explanation and the AI is told `done`
- **THEN** the AI handles the remark again and writes a new answer under it

### Requirement: Closed remarks are removed except spec-changing ones
A closed remark SHALL be removed from `test-cases.md` at the AI's next pass or when the stage is completed, whichever comes first, except a remark that changed a spec: it SHALL stay in the section "Spec changes during test-case review", which the developer is shown at the end of the stage.

#### Scenario: Closed remark is removed
- **GIVEN** QA closes a remark that changed only test cases
- **WHEN** the AI starts its next pass
- **THEN** that remark is no longer in `test-cases.md`

#### Scenario: Last closed remarks are removed at completion
- **GIVEN** QA closed the last two remarks, which changed only test cases, and confirmed with `Looks correct`
- **WHEN** the test-cases stage is completed
- **THEN** neither remark is in `test-cases.md`

#### Scenario: Spec-changing remark is kept and shown
- **GIVEN** QA closed a remark that made the AI add a scenario to a spec
- **WHEN** the test-cases stage is completed
- **THEN** the remark is listed in the section "Spec changes during test-case review" together with the added scenario
- **AND** the developer is shown that list

### Requirement: Human QA remarks change the spec
When a QA remark shows behaviour that is missing, wrong or not wanted in a spec, the AI SHALL add, change or remove the scenario itself, also when the remark contradicts a confirmed answer, without asking the developer. Test cases of a removed scenario SHALL be removed; those of a changed scenario SHALL be rewritten for the new behaviour.

#### Scenario: Remark adds a scenario
- **GIVEN** a general remark that the export of a period with no sales is not specified
- **WHEN** the AI handles the remark
- **THEN** the delta spec has a new scenario for exporting a period with no sales
- **AND** `test-cases.md` has at least one test case under that scenario

#### Scenario: Remark changes a scenario
- **GIVEN** the scenario "Export of an empty period" expects an empty file and a remark says an error message must be shown instead
- **WHEN** the AI handles the remark
- **THEN** the scenario in the delta spec expects the error message
- **AND** the test cases under it expect the error message instead of an empty file

#### Scenario: Remark removes a scenario
- **GIVEN** a remark that the scenario "Export to PDF" is not wanted
- **WHEN** the AI handles the remark
- **THEN** the delta spec no longer has the scenario "Export to PDF"
- **AND** `test-cases.md` has no test case under "Export to PDF"

### Requirement: Spec reviewer runs again after spec changes
After any change to a delta spec during the test-cases stage, the AI SHALL run the spec reviewer again on the changed specs before the stage is complete; the new report replaces `reviews/spec-review.md`, and its verdict and findings SHALL be shown to the developer, who decides: fix the spec, ask a follow-up or accept.

#### Scenario: Spec reviewer runs after a change
- **GIVEN** a scenario was changed in a delta spec because of a remark
- **WHEN** the AI is about to complete the test-cases stage
- **THEN** the spec reviewer has been run after that change and the developer has been shown its verdict

### Requirement: Stage decisions are recorded in the test-case document
The section "Stage result" at the end of `test-cases.md` SHALL list the reviewer findings the developer accepted or fixed by hand, each naming its requirement or test case with a short reason, and hold the stage confirmation: blank, `Looks correct`, or `Request changes` with what to change. The reviewer and the gates SHALL read these records there.

#### Scenario: Accepted finding is read by the next run
- **GIVEN** the "Stage result" section lists the major finding "No case for a 256-character name" as accepted by the developer
- **WHEN** the AI QA reviewer runs again
- **THEN** that finding does not count against the verdict READY

#### Scenario: Request changes starts another pass
- **GIVEN** the stage confirmation is `Request changes` with "add a case for a closed shop"
- **WHEN** the AI is told `done`
- **THEN** `test-cases.md` has a case for a closed shop
- **AND** the stage confirmation is blank again

### Requirement: Stage completion with the AI reviewer only
On the `clarify-ai-qa` schema, the test-cases stage SHALL be complete only when every blocker and major finding of the latest AI QA review is listed in "Stage result" as accepted or fixed by hand, unless that review is READY, and the developer has confirmed with exactly `Looks correct`. Until then `design.md` SHALL NOT be written.

#### Scenario: Design is blocked before confirmation
- **GIVEN** a change on the `clarify-ai-qa` schema whose test-case result is not yet confirmed
- **WHEN** the AI tries to write `design.md`
- **THEN** the write is blocked with a message that names the unconfirmed test-cases stage

#### Scenario: Unlisted major finding blocks the design
- **GIVEN** the latest AI QA review is NOT-READY with the major finding "No error case for export", which "Stage result" does not list, and the confirmation is `Looks correct`
- **WHEN** the AI tries to write `design.md`
- **THEN** the write is blocked with a message that names the finding "No error case for export"

#### Scenario: Design is allowed after confirmation
- **GIVEN** every blocker and major finding of the latest review is listed in "Stage result" as accepted or fixed by hand, and the developer confirmed with `Looks correct`
- **WHEN** the AI writes `design.md`
- **THEN** the write is not blocked by the test-cases stage

### Requirement: Stage completion with a human QA
On the `clarify-qa` schema, the test-cases stage SHALL be complete only when "Stage result" has the line `Handed over to QA`, no remark is open or reopened, and QA, or the developer on QA's behalf, has confirmed with exactly `Looks correct`. Until then `design.md` SHALL NOT be written.

#### Scenario: Open remark blocks the design
- **GIVEN** a change on the `clarify-qa` schema with one open remark
- **WHEN** the AI tries to write `design.md`
- **THEN** the write is blocked with a message that says one remark is still open

#### Scenario: Confirmation without a hand-over blocks the design
- **GIVEN** a change on the `clarify-qa` schema whose "Stage result" has no line `Handed over to QA` and whose confirmation is `Looks correct`
- **WHEN** the AI tries to write `design.md`
- **THEN** the write is blocked with a message that says the test cases were not handed over to QA

#### Scenario: Confirmed result allows the design
- **GIVEN** the test cases were handed over to QA, no remark is open or reopened and the QA confirmation is `Looks correct`
- **WHEN** the AI writes `design.md`
- **THEN** the write is not blocked by the test-cases stage

#### Scenario: Developer confirms on QA's behalf
- **GIVEN** the test cases were handed over to QA, and QA told the developer that the last open remark is fixed and the result is correct
- **WHEN** the developer closes that remark and enters `Looks correct` as the stage confirmation
- **THEN** writing `design.md` is not blocked by the test-cases stage

### Requirement: Late scenarios get test cases
When a scenario is added to a delta spec after the test-cases stage is complete, the AI SHALL write test cases for it and review them in a new AI review loop with its own limit of three reviewer runs, after which the developer decides on what remains. A human QA SHALL NOT be asked again, and the stage confirmation SHALL NOT be reset.

#### Scenario: Scenario added during implementation
- **GIVEN** a change on the `clarify-qa` schema whose test-cases stage is complete
- **WHEN** a scenario is added to a delta spec during implementation
- **THEN** `test-cases.md` gets at least one test case under the new scenario
- **AND** the AI QA reviewer is run on the change
- **AND** no new hand-over to the human QA is requested
- **AND** the stage confirmation stays `Looks correct`

#### Scenario: Late review loop has its own limit
- **GIVEN** the stage's AI review loop used all three reviewer runs, and a scenario is added during implementation
- **WHEN** the AI writes test cases for it
- **THEN** the AI QA reviewer runs on them, and at most three runs are made for this new loop
