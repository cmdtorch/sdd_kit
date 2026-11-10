# Spec Delta

## Purpose

Defines the UI inventory of a change in UI mode: the screens, interactive elements and screen states seen on the screenshots, and the decision recorded for every element.

## ADDED Requirements

### Requirement: The AI writes the inventory before the first questions
In UI mode the AI SHALL write `ui-inventory.md` before the Main round questions. It SHALL list every screen with its screenshots, and for each screen its interactive elements (buttons, links, fields, toggles, menus) and screen states (empty, error, loading). Other visible content is not listed (judged by the spec reviewer, who also reads `ui-inventory.md`). While screenshots exist and the inventory does not, writing the Main round questions and writing `proposal.md` SHALL be blocked.

#### Scenario: Main round questions are blocked without an inventory
- **GIVEN** a `clarify` change with a registered screenshot and no `ui-inventory.md`
- **WHEN** the AI writes the Main round questions into `clarifications.md`
- **THEN** the write is blocked with a message that says to write the UI inventory first

#### Scenario: Lean proposal is blocked without an inventory
- **GIVEN** a `lean` change with a screenshot in `sources/ui/` and no `ui-inventory.md`
- **WHEN** the AI writes `proposal.md`
- **THEN** the write is blocked with a message that says the UI inventory is missing

#### Scenario: Proposal is blocked without an inventory
- **GIVEN** a change with registered screenshots and a confirmed Main round, but no `ui-inventory.md`
- **WHEN** the AI writes `proposal.md`
- **THEN** the write is blocked with a message that says the UI inventory is missing

### Requirement: Variants of a screen are one screen
Screenshots of variants of one screen (desktop and mobile, different user roles) SHALL be listed under one screen of the inventory. When a screen has more than one variant, each element SHALL name the variants that show it.

#### Scenario: Desktop and mobile screenshots form one screen
- **GIVEN** the screenshots `04-export-modal.png` and `05-export-modal-mobile.png` listed under the one screen "export-modal"
- **AND** the element "export-button" marked as shown in both variants
- **WHEN** the UI check runs on the change
- **THEN** it reports no error for the screen "export-modal"

#### Scenario: Element without a variant is reported
- **GIVEN** a screen with two variants and an element that names no variant
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names the element

### Requirement: Every element has a decision
Every inventory element SHALL have exactly one decision: `in scope`, `mock`, `out of scope`, `decoration` or `existing`; "not yet defined" is not a decision. While an element has no decision or an unknown one, writing the next artifact and the archive SHALL be blocked with a message that names the element and lists the allowed decisions. The developer sees all decisions in the round summary.

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

### Requirement: Decisions are backed by a source
On the question-round schemas, an `in scope` decision SHALL cite the developer's description, a requirement document or an answered question; a screenshot alone SHALL NOT back it. The decisions `out of scope`, `decoration` and `mock` SHALL cite an answered question of a confirmed round. An `existing` decision needs no citation.

#### Scenario: Out of scope without an answer is reported
- **GIVEN** an inventory element "bulk-delete" with the decision `out of scope` and no question cited
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names "bulk-delete" and says an answered question is required

#### Scenario: Decoration citing an unanswered question is reported
- **GIVEN** an inventory element "promo-banner-link" with the decision `decoration` that cites a question whose answer is blank
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names "promo-banner-link"

#### Scenario: Decision citing a question that does not exist is reported
- **GIVEN** an inventory element "bulk-delete" with the decision `out of scope` that cites Q99, and no question Q99 exists
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names "bulk-delete" and Q99

#### Scenario: Mock citing an unconfirmed round is reported
- **GIVEN** an inventory element "share-button" with the decision `mock` that cites an answered question of a round whose summary is not yet `Looks correct`
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names "share-button"

#### Scenario: In scope backed only by a screenshot is reported
- **GIVEN** an inventory element "export-button" with the decision `in scope` that cites only `[U1]`
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names "export-button"

#### Scenario: Mock backed by an answer passes
- **GIVEN** an inventory element "share-button" with the decision `mock` that cites a confirmed answered question
- **WHEN** the UI check runs on the change
- **THEN** it reports no decision error for "share-button"

#### Scenario: Existing element needs no citation
- **GIVEN** an inventory element "logout-button" with the decision `existing` and no citation
- **WHEN** the UI check runs on the change
- **THEN** it reports no decision error for "logout-button"

### Requirement: The Main round asks about the gaps between the UI and the requirements
On the question-round schemas, the AI SHALL ask in the Main round about every element shown on a screenshot that no registered source or answer names, about every behaviour in the requirements with no element or state on the screenshots, and about the screen states (empty, error, loading) that are not shown. An element that a source names, and an `existing` element, needs no question.

#### Scenario: Button not in the requirements gets a question
- **GIVEN** a screenshot with a "Delete" button that no requirement source names
- **WHEN** the AI writes the Main round questions
- **THEN** the round has a question about what the "Delete" button does and whether it belongs to the change

#### Scenario: Requirement without a UI element gets a question
- **GIVEN** a requirement source that says the accountant sees an import error, and no screenshot that shows one
- **WHEN** the AI writes the Main round questions
- **THEN** the round has a question about where and how the import error is shown

#### Scenario: Missing screen state gets a question
- **GIVEN** screenshots of the orders list with orders, and none of an empty list
- **WHEN** the AI writes the Main round questions
- **THEN** the round has a question about what the orders list shows when there are no orders

### Requirement: Lean changes decide without questions
On the `lean` schema the AI SHALL write the inventory and record the decision for every element in the inventory, and list every element with its decision in `proposal.md`, without questions and without citations. The other inventory rules and the scenario coverage apply unchanged.

#### Scenario: Lean decisions need no citation
- **GIVEN** a `lean` change with registered screenshots and an inventory element "bulk-delete" with the decision `out of scope` and no citation
- **WHEN** the UI check runs on the change
- **THEN** it reports no citation error for "bulk-delete"

#### Scenario: Lean proposal missing a decision blocks the specs
- **GIVEN** a `lean` change whose inventory has the elements "export-button" and "bulk-delete", and a proposal that names only "export-button"
- **WHEN** the AI writes a spec file
- **THEN** the write is blocked with a message that names "bulk-delete" as missing from the proposal
