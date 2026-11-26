## MODIFIED Requirements

### Requirement: Every element has a decision
Every inventory element SHALL have exactly one decision: `in scope`, `mock`, `out of scope`, `decoration` or `existing`; "not yet defined" is not one. While an element has none or an unknown one, the next artifact and the archive SHALL be blocked with a message naming the element and the allowed decisions. The developer sees all decisions in the round summary, or, on a `clarify` change stamped 0.6.0 or later, in a short message the AI writes before the proposal without waiting for a reply.

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
