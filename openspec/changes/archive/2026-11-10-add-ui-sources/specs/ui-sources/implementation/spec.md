# Spec Delta

## Purpose

Defines how the screenshots and the inventory of a change in UI mode reach the implementation: the design maps screens to the code they change, UI tasks link their screenshots, and the AI looks at them before building a screen.

## ADDED Requirements

### Requirement: The design maps screens to pages and components
On the schemas with a design, in UI mode `design.md` SHALL have a section `## Screens` with a table whose columns are `Screen` and `Pages and components`, and a row for every inventory screen that has an `in scope` or `mock` element, the `Screen` cell holding the screen name from the inventory. While a screen lacks its row, writing the verification plan, writing the tasks and the archive SHALL be blocked with a message that names the screen.

#### Scenario: Screen without a design row blocks the tasks
- **GIVEN** an inventory screen "export-modal" with an `in scope` element and a `## Screens` table with no row for it
- **WHEN** the AI writes `tasks.md`
- **THEN** the write is blocked with a message that names the screen "export-modal"

#### Scenario: Screen without a design row blocks the archive
- **GIVEN** an inventory screen "export-modal" with an `in scope` element and no row for it in `## Screens`
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names the screen "export-modal"

#### Scenario: Screen with only a mock element needs a design row
- **GIVEN** an inventory screen "share-dialog" whose only built element has the decision `mock`, and no row for it in `## Screens`
- **WHEN** the AI writes `verification-plan.md`
- **THEN** the write is blocked with a message that names the screen "share-dialog"

#### Scenario: Screen with nothing to build needs no row
- **GIVEN** an inventory screen "settings" whose elements are all `existing` or `out of scope`
- **WHEN** the UI check runs on the change
- **THEN** it reports no design-table error for "settings"

### Requirement: UI tasks link their screenshots
A task in `tasks.md` names an inventory screen when its text holds the screen name in backticks, for example `` `export-modal` ``. Such a task SHALL link at least one screenshot of that screen by its path under `sources/ui/`; a link to a screenshot of another screen does not count. A task that names a screen without such a link SHALL be reported, and the archive SHALL be blocked while it is. After a write of `tasks.md` such a task SHALL be shown to the AI without blocking the write.

#### Scenario: UI task without a screenshot is reported
- **GIVEN** the task "Build the `export-modal` dialog" with no screenshot link
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names the task and the screen "export-modal"

#### Scenario: Missing screenshot link is shown after the tasks are written
- **GIVEN** a change in UI mode with the inventory screen "export-modal"
- **WHEN** the AI writes `tasks.md` with the task "Build the `export-modal` dialog" that links no screenshot
- **THEN** the write is not blocked
- **AND** the AI is shown a message that names the task and the screen "export-modal"

#### Scenario: UI task without a screenshot blocks the archive
- **GIVEN** a change ready to archive with the task "Build the `export-modal` dialog" that links no screenshot
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names the task

#### Scenario: UI task linking another screen's screenshot is reported
- **GIVEN** the task "Build the `export-modal` dialog" that links only `sources/ui/01-orders-list.png`, a screenshot of the screen "orders-list"
- **WHEN** the UI check runs on the change
- **THEN** it reports an error that names the task and the screen "export-modal"

#### Scenario: UI task with its screenshot passes
- **GIVEN** the task "Build the `export-modal` dialog" that links `sources/ui/04-export-modal.png`, a screenshot of "export-modal"
- **WHEN** the UI check runs on the change
- **THEN** it reports no task error for it

### Requirement: The AI looks at the screen before building it
During implementation, before writing the code of a screen, the AI SHALL open that screen's screenshots and its inventory entry. This is checked by hand.

#### Scenario: Screenshots are opened before the screen is built
- **GIVEN** a change in implementation with the UI task for the screen "export-modal"
- **WHEN** the AI starts that task
- **THEN** it reads the screenshots of "export-modal" and its inventory entry before it writes the code of that screen
