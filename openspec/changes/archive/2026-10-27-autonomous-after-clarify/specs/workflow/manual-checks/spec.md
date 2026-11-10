# Spec Delta

## Purpose

Keeps manual checks rare and justified, and hands the ones that remain to QA, who works outside the kit after the archive, in one list that never turns into work the developer must do before the archive.

## ADDED Requirements

### Requirement: Manual only with a reason
A verification plan row at level `manual` (in its "Manual reason" column) and a test case labelled `manual` (on a `Manual reason:` line under its labels) SHALL carry a reason that starts with `cannot be automated:` or `dangerous:` followed by an explanation. Difficulty or effort SHALL NOT count as a reason.

#### Scenario: Manual row with a reason
- **WHEN** a verification plan row at level `manual` gives the reason `cannot be automated: a new developer judges whether the README is clear`
- **THEN** the kit's checks accept the row

#### Scenario: Manual row without a reason
- **WHEN** a verification plan row at level `manual` has no reason
- **THEN** the kit's check reports an error that names the scenario
- **AND** the tasks cannot be written until the row has a reason

#### Scenario: Manual test case without a reason
- **WHEN** a test case in `test-cases.md` is labelled `manual` without a reason
- **THEN** the test-case check reports an error that names the case
- **AND** the design cannot be written until the case has a reason

#### Scenario: Effort given as the reason
- **WHEN** a test case labelled `manual` gives the reason `cannot be automated: too much work`
- **THEN** the test-case reviewer reports it as a major finding

#### Scenario: Lean change with a manual row
- **WHEN** the verification plan of a `lean` change has a `manual` row without a reason
- **THEN** the kit's check reports the same error as on `clarify`

### Requirement: Dangerous functions
The agent SHALL treat a function as dangerous when it moves money (payments, payouts, charges, balances), acts on many users or records at once, or deletes or changes data irreversibly. Sign-in, roles and access rights alone SHALL NOT make a function dangerous.

#### Scenario: Hourly payout to cards
- **WHEN** a scenario sends a payout to the card of every user whose balance is above 1000, every hour
- **THEN** the verification plan marks it with a `manual` row whose reason starts with `dangerous:` and names money and many users

#### Scenario: Role check only
- **WHEN** a scenario only checks that a user without the admin role cannot open the admin page
- **THEN** the verification plan has no `dangerous:` row for it

### Requirement: Dangerous functions get both
A dangerous function SHALL be tested automatically like any other scenario, and SHALL get a manual check in addition; the agent decides that a function is dangerous and records the reason in the verification plan.

#### Scenario: Dangerous scenario in the plan
- **WHEN** the verification plan covers a dangerous scenario
- **THEN** the scenario is proven by a `unit` or `integration` row, or by an E2E test, and has an additional `manual` row whose reason starts with `dangerous:`

### Requirement: No automate-or-manual question
The Verification round SHALL NOT ask the developer whether a check should be automated or stay manual.

#### Scenario: Verification round on an infrastructure change
- **WHEN** the agent writes the Verification round for a change that sets up Docker, ports and linters
- **THEN** no question offers to keep a check manual

### Requirement: Manual checks are not apply tasks
A manual check SHALL NOT become a task in `tasks.md` and SHALL NOT block the archive; QA performs it outside the kit after the archive.

#### Scenario: Plan with manual rows
- **WHEN** the verification plan has three `manual` rows, one of them `dangerous:`
- **THEN** `tasks.md` has no task for them
- **AND** the archive is not blocked by them

### Requirement: Implementation report
The agent SHALL keep one implementation report, `apply-report.md`, in the change folder: written at the end of the tasks, updated after the E2E stage and after the consent list. It stays in the archived change.

#### Scenario: Report after the tasks
- **WHEN** the last task is done
- **THEN** `apply-report.md` exists with the sections "Manual checks", "Not verified automatically" and "Weakened tests"
- **AND** an empty section says "None."

#### Scenario: Report after the E2E stage
- **WHEN** the E2E stage ends with a case the developer accepted at the stop after the fix attempts
- **THEN** `apply-report.md` lists that case under "Not verified automatically" with the accepted reason
- **AND** the entry carries a `Consent:` line with the developer's acceptance, so it is not asked again at the end

### Requirement: List for QA
"Manual checks" SHALL hold every manual check and "Not verified automatically" every check that should have been automated but was not verified; each entry names its capability and scenario or case, its steps, the expected outcome and its reason.

#### Scenario: Manual check entry
- **WHEN** a case is labelled `manual` because a person must judge whether the README is clear
- **THEN** it appears under "Manual checks" with its steps, expected outcome and that reason

#### Scenario: Check that could not run
- **WHEN** the live-reload check could not be run and the developer chose to skip it
- **THEN** it appears under "Not verified automatically" with the reason "tests were not run" and the cause

### Requirement: Dangerous checks first
In "Manual checks", the checks of dangerous functions SHALL come first, each marked "required before release" with the reason it is dangerous.

#### Scenario: Two manual checks, one dangerous
- **WHEN** the list holds a README check and a payout check
- **THEN** the payout check comes first, marked "required before release" with the reason that names money and many users

### Requirement: Consent list at the end
When "Not verified automatically" has entries without consent, the agent SHALL ask the developer once, after everything else is done, to agree to them all at once or one by one, and SHALL record each consent next to its entry.

#### Scenario: Two unverified entries
- **WHEN** the work is done and two entries have no consent
- **THEN** the agent asks one question that lists both entries
- **AND** after the answer each agreed entry carries a `Consent:` line with the developer's words

#### Scenario: Entry already agreed
- **WHEN** an entry was added after the developer chose to skip checks at a failed start check
- **THEN** it already carries its `Consent:` line and is not in the question

#### Scenario: Developer refuses an entry
- **WHEN** the developer does not agree to one of the entries
- **THEN** the agent reports that the change is not ready to archive and names that entry
- **AND** it waits for the developer's instructions without a `Consent:` line on that entry

### Requirement: Unverified checks need consent to archive
A case or scenario that should be proven by a test and is listed under "Not verified automatically" SHALL count as covered at archive only when its entry carries a `Consent:` line.

#### Scenario: Unverified case with consent
- **WHEN** an `automated` case has no test and is listed under "Not verified automatically" with a `Consent:` line
- **THEN** the archive check does not report it as missing a test

#### Scenario: Unverified case without consent
- **WHEN** an `automated` case has no test and is listed under "Not verified automatically" without a `Consent:` line
- **THEN** the archive check reports it as missing a test and blocks the archive

### Requirement: Changes started under the old rules
The kit SHALL record its version in the change's `.openspec.yaml` when the change is created; a change without a recorded version, or with a version older than the one that brings this capability, SHALL be checked by the rules it started with.

#### Scenario: Old change with open manual tasks
- **WHEN** a change created by an older kit version has open "verify by hand" tasks
- **THEN** the archive stays blocked until those tasks are done
- **AND** no check asks it for `apply-report.md`

#### Scenario: New change during apply
- **WHEN** a change created by this kit version has no `apply-report.md` yet because apply is still running
- **THEN** it is checked by the new rules
