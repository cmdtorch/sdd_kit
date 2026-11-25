# Spec Delta

## MODIFIED Requirements

### Requirement: Every element has a decision
Every inventory element SHALL have exactly one decision: `in scope`, `mock`, `out of scope`, `decoration` or `existing`; "not yet defined" is not a decision. While an element has no decision or an unknown one, writing the next artifact and the archive SHALL be blocked with a message that names the element and lists the allowed decisions. The developer sees all decisions in the round summary; on a `clarify` change stamped 0.6.0 or later, which has no round summary, in a short message the AI writes before the proposal, without waiting for a reply.

#### Scenario: Element without a decision blocks the proposal
- **GIVEN** a confirmed Main round and an inventory element "bulk-delete" with no decision
- **WHEN** the AI writes `proposal.md`
- **THEN** the write is blocked with a message that names the element "bulk-delete"

#### Scenario: Not yet defined blocks the proposal
- **GIVEN** an inventory element "export-button" whose decision is "not yet defined"
- **WHEN** the AI writes `proposal.md`
- **THEN** the write is blocked with a message that names the element and lists the allowed decisions

#### Scenario: Late element without a decision blocks the design
- **GIVEN** a change whose specs are written and an element "retry-button" added to the inventory with no decision
- **WHEN** the AI writes `design.md`
- **THEN** the write is blocked with a message that names "retry-button"

#### Scenario: Element without a decision blocks the archive
- **GIVEN** a change ready to archive and an inventory element "retry-button" with no decision
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names "retry-button"

#### Scenario: Decisions are shown before the proposal on a new change
- **GIVEN** a `clarify` change stamped 0.6.0 in UI mode whose Main round is closed, with the elements "export-button" (`in scope`) and "search-field" (`existing`)
- **WHEN** the AI is about to write the proposal
- **THEN** the chat shows a message that names both elements with their decisions, and the proposal is written without a reply from the developer

## ADDED Requirements

### Requirement: On new changes a closed round backs a decision
On a `clarify` change stamped 0.6.0 or later, the decisions `out of scope`, `decoration` and `mock` SHALL cite an answered question of a closed round: a round with no blank answer, without a summary confirmation.

#### Scenario: Mock citing a closed round is accepted
- **GIVEN** a `clarify` change stamped 0.6.0 whose Main round has no blank answer and no summary confirmation, and an inventory element "share-button" with the decision `mock` that cites an answered question of that round
- **WHEN** the UI check runs before the proposal
- **THEN** it reports no error for "share-button"

#### Scenario: Mock citing an open round is reported
- **GIVEN** a `clarify` change stamped 0.6.0 whose Main round has one blank answer, and an inventory element "share-button" with the decision `mock` that cites an answered question of that round
- **WHEN** the UI check runs before the proposal
- **THEN** it reports that "share-button" cites a round that is not closed
