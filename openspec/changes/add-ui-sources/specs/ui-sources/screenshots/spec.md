# Spec Delta

## Purpose

Defines UI screenshots as requirement sources of a change: where they are placed, which formats are accepted, how they are registered, and what happens when they arrive or change after the first question round.

## ADDED Requirements

### Requirement: Screenshots switch the UI mode on
A change SHALL be in UI mode when its `sources/ui/` folder holds at least one screenshot, on the `clarify`, `clarify-ai-qa`, `clarify-qa` and `lean` schemas. A change without screenshots SHALL behave exactly as before: no inventory and no UI check is required, also when an inventory was written and all screenshots were deleted later.

#### Scenario: Change without screenshots needs no inventory
- **GIVEN** a `clarify` change with no `sources/ui/` folder and no `ui-inventory.md`
- **WHEN** the AI writes `proposal.md` after a confirmed Main round
- **THEN** the write is not blocked by any UI rule

#### Scenario: Notes file alone does not switch the mode on
- **GIVEN** a `clarify` change whose `sources/ui/` holds only `screens.md`
- **WHEN** the AI writes `proposal.md` after a confirmed Main round
- **THEN** the write is not blocked by any UI rule

#### Scenario: Deleting every screenshot switches the mode off
- **GIVEN** a `clarify` change with `ui-inventory.md` listing two screenshots, and both files deleted from `sources/ui/`
- **WHEN** the AI writes the next artifact
- **THEN** the write is not blocked by any UI rule

#### Scenario: One screenshot switches the mode on
- **GIVEN** a `clarify` change with the screenshot `sources/ui/01-orders-list.png` and no `ui-inventory.md`
- **WHEN** the AI writes `proposal.md` after a confirmed Main round
- **THEN** the write is blocked with a message that says the UI inventory is missing

### Requirement: UI check errors block the next artifact and the archive
The UI check SHALL run before every planning artifact after `clarifications.md` (on `lean`, before every planning artifact) and before the archive, judging the files already in the change; while it reports errors, that write and the archive SHALL be blocked with its messages. Writing `ui-inventory.md` (its errors SHALL be shown to the AI after it) and the questions and answers in `clarifications.md` SHALL NOT be blocked by a UI rule, except that the Main round questions wait for the inventory.

#### Scenario: Out of scope without an answer blocks the proposal
- **GIVEN** a confirmed Main round and an inventory element "bulk-delete" with the decision `out of scope` and no question cited
- **WHEN** the AI writes `proposal.md`
- **THEN** the write is blocked with a message that names "bulk-delete"

#### Scenario: Inventory and questions are written while elements have no decision
- **GIVEN** a `clarify` change with registered screenshots
- **WHEN** the AI writes `ui-inventory.md` with no decisions yet, and then the Main round questions about its elements
- **THEN** neither write is blocked

#### Scenario: Questions about a late screenshot are not blocked
- **GIVEN** a change whose inventory does not yet list the new screenshot `04-export-modal.png`
- **WHEN** the AI writes Specs round questions about it into `clarifications.md`
- **THEN** the write is not blocked

#### Scenario: Inventory errors are shown after the inventory is written
- **GIVEN** a `clarify` change with the registered screenshots `01-orders-list.png` and `02-orders-list-empty.png`
- **WHEN** the AI writes `ui-inventory.md` that does not list `02-orders-list-empty.png`
- **THEN** the write is not blocked
- **AND** the AI is shown a message that names `02-orders-list-empty.png` as missing from the inventory

### Requirement: Each screenshot is a registered source
Each screenshot SHALL be registered as `[U<n>]` with its file name: under `## Sources` of `clarifications.md` on the question-round schemas, and in `ui-inventory.md` on `lean`. Planning artifacts MAY cite `[U<n>]` like any other source tag, and an element on it as `[U<n>] <element-name>` with the element name from the inventory; a `[U<n>]` tag that is not registered, or whose file is gone, and an element name that the inventory does not list for that screenshot SHALL be reported.

#### Scenario: Unregistered screenshot is reported
- **GIVEN** a `clarify` change with the screenshots `01-orders-list.png` and `02-orders-list-empty.png`, and only the first registered as `[U1]`
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names `02-orders-list-empty.png` as not registered

#### Scenario: Lean screenshots are registered in the inventory
- **GIVEN** a `lean` change with the screenshot `01-orders-list.png` registered as `[U1]` in `ui-inventory.md`
- **WHEN** the UI check runs on the change
- **THEN** it reports no registration error

#### Scenario: Citation of an element not on that screenshot is reported
- **GIVEN** a proposal that cites `[U1] export-button` while the inventory lists "export-button" only for `[U4]`
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names `[U1] export-button`

#### Scenario: Unknown screenshot tag is reported
- **GIVEN** a proposal that cites `[U3]` while only `[U1]` and `[U2]` are registered
- **WHEN** the grounding check runs on the change
- **THEN** it reports an error that names the tag `[U3]`

### Requirement: Only PNG, JPG and WebP are accepted
The folder `sources/ui/` SHALL hold only files with the extensions `.png`, `.jpg`, `.jpeg` and `.webp` (in any letter case) and the optional notes file `screens.md`, with no subfolders. Hidden files (names starting with `.`, such as `.DS_Store`) SHALL be ignored. Any other file or a subfolder SHALL block the next artifact with a message that names it and asks to export the mockup as PNG, whether or not the folder also holds a screenshot.

#### Scenario: SVG file blocks the next artifact
- **GIVEN** a change with the screenshot `sources/ui/01-orders-list.png` and the file `sources/ui/03-export-modal.svg`
- **WHEN** the AI writes the next artifact
- **THEN** the write is blocked with a message that names `03-export-modal.svg` and says to export it as PNG

#### Scenario: SVG-only folder blocks the next artifact
- **GIVEN** a change whose `sources/ui/` holds only the file `03-export-modal.svg`
- **WHEN** the AI writes the next artifact
- **THEN** the write is blocked with a message that names `03-export-modal.svg` and says to export it as PNG

#### Scenario: Upper-case extensions are accepted
- **GIVEN** the registered screenshots `01-list.JPG` and `02-list-empty.webp`, both in the inventory with a decision for every element
- **WHEN** the UI check runs on the change
- **THEN** it reports no format error

#### Scenario: Hidden system files are ignored
- **GIVEN** a change whose `sources/ui/` holds `01-orders-list.png` and `.DS_Store`
- **WHEN** the UI check runs on the change
- **THEN** it reports no format error

### Requirement: Screenshots stay with the change
Screenshots SHALL be kept in git in the change folder and SHALL move with the change to the archive. Archiving SHALL NOT copy them into the main specs.

#### Scenario: Screenshots are archived with the change
- **GIVEN** a change in UI mode with two screenshots, ready to archive
- **WHEN** the change is archived
- **THEN** both screenshots exist in `sources/ui/` of the archived change directory
- **AND** no file under `openspec/specs/` is a screenshot

### Requirement: Late and replaced screenshots are caught
The inventory SHALL record a fingerprint of every screenshot. A screenshot that is not in the inventory, or whose content no longer matches its fingerprint, SHALL block the next artifact and the archive until the inventory is updated. On the question-round schemas the AI then asks about the new or changed elements only, in the current question round (the Apply round during implementation); on `lean` it records their decisions without questions.

#### Scenario: Screenshot added after the Main round blocks the specs
- **GIVEN** a change whose Main round is confirmed and whose inventory lists `01-orders-list.png`
- **WHEN** the developer adds `04-export-modal.png` and the AI writes a spec file
- **THEN** the write is blocked with a message that names `04-export-modal.png` as missing from the inventory

#### Scenario: Replaced screenshot is caught by its fingerprint
- **GIVEN** an inventory that lists `01-orders-list.png` with its fingerprint
- **WHEN** the file is replaced by a different image with the same name and the AI writes the next artifact
- **THEN** the write is blocked with a message that names `01-orders-list.png` as changed since the inventory was written

#### Scenario: Screenshot added during implementation blocks the archive
- **GIVEN** a change with all planning artifacts done and a new screenshot `05-export-done.png` that is not in the inventory
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names `05-export-done.png`

### Requirement: Deleted screenshots are caught
A screenshot listed in the inventory but no longer in `sources/ui/` SHALL block the next artifact and the archive until the AI removes its screen and elements from the inventory or moves them to another screenshot.

#### Scenario: Deleted screenshot blocks the next artifact
- **GIVEN** an inventory that lists `02-orders-list-empty.png` under the screen "orders-list", and the file is deleted from `sources/ui/`
- **WHEN** the AI writes the next artifact
- **THEN** the write is blocked with a message that names `02-orders-list-empty.png` as missing

#### Scenario: Screenshot deleted during implementation blocks the archive
- **GIVEN** a change ready to archive whose inventory lists `02-orders-list-empty.png`, and the file is deleted
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names `02-orders-list-empty.png` as missing

#### Scenario: Elements moved to another screenshot pass
- **GIVEN** `02-orders-list-empty.png` deleted, its registration removed, and its elements moved in the inventory to `06-orders-list-empty-v2.png`, which is registered
- **WHEN** the UI check runs on the change
- **THEN** it reports no error for the deleted screenshot
