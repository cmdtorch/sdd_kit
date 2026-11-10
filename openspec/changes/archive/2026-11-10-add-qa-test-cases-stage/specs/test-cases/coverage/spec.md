# Spec Delta

## Purpose

Defines how test cases become tests: the verification plan chooses the level for automated cases, tests reference the cases they prove, and the archive accepts a change only when every automated case has a test.

## ADDED Requirements

### Requirement: Verification plan covers every test case
On the `clarify-ai-qa` and `clarify-qa` schemas, the verification plan SHALL list every test case of the change with its verification labels. For a test case labelled `automated` it SHALL name one or more of the levels `unit` and `integration`; a test case labelled only `e2e` or `manual` needs no level.

#### Scenario: Automated case without a level is reported
- **GIVEN** a test case labelled `automated` that the verification plan lists with no level
- **WHEN** the traceability check runs on the change
- **THEN** it reports an error that names the test case and says a level `unit` or `integration` is required

#### Scenario: Test case missing from the plan is reported
- **GIVEN** a test case in `test-cases.md` that the verification plan does not list
- **WHEN** the traceability check runs on the change
- **THEN** it reports an error that names the capability and the test case

#### Scenario: Manual case needs no level
- **GIVEN** a test case labelled only `manual` that the verification plan lists without a level
- **WHEN** the traceability check runs on the change
- **THEN** it reports no level error for that test case

### Requirement: Tests reference the test cases they prove
A test that proves a test case SHALL carry a case reference on its own line, `@case <capability-path> :: <test case name>`, with the same placement rules as a scenario marker. One test MAY reference several cases, and a case MAY be referenced by several tests.

#### Scenario: Case reference is found
- **GIVEN** a test file with the line `// @case inventory/sale-export :: Export of an empty period`
- **WHEN** the traceability check runs with marker checking on the change that has this test case
- **THEN** the test case is reported as covered by that test file

#### Scenario: Reference inside a string is not counted
- **GIVEN** a test file where `@case inventory/sale-export :: Export of an empty period` appears only inside a string literal, after other code on the line
- **WHEN** the traceability check runs with marker checking on the change
- **THEN** the test case is not reported as covered

#### Scenario: Same case name in two active changes
- **GIVEN** two active changes that both have the test case "Empty list" in the capability `inventory/sale-export`, and one test referencing it
- **WHEN** the traceability check runs with marker checking on either change
- **THEN** the test case is reported as covered in that change

### Requirement: Archive requires a test for every automated case
On the `clarify-ai-qa` and `clarify-qa` schemas, the archive SHALL be blocked while a test case labelled `automated` has no test referencing it. Test cases labelled only `e2e` or `manual` SHALL NOT block the archive.

#### Scenario: Uncovered automated case blocks the archive
- **GIVEN** a test case labelled `automated` with no test referencing it
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names the capability and the test case

#### Scenario: E2E-only case does not block the archive
- **GIVEN** a test case labelled only `e2e` with no test referencing it, and every other check passing
- **WHEN** the change is archived
- **THEN** the archive is not blocked by that test case

#### Scenario: Automated and e2e case needs its automated test
- **GIVEN** a test case labelled `automated` and `e2e` with no test referencing it
- **WHEN** the change is archived
- **THEN** the archive is blocked with a message that names the test case

### Requirement: Manual and e2e cases are listed at the end of apply
At the end of apply, the test cases labelled `manual` SHALL be listed for the developer with what to check and the expected outcome, together with the manual scenarios. The test cases labelled `e2e` SHALL be listed as waiting for the E2E stage.

#### Scenario: Manual case is listed for the developer
- **GIVEN** a test case labelled `manual` named "Long name wraps in the header"
- **WHEN** apply ends
- **THEN** the list of manual checks shown to the developer contains "Long name wraps in the header" with its expected outcome

#### Scenario: E2E case is listed as waiting
- **GIVEN** a test case labelled `automated` and `e2e`
- **WHEN** apply ends
- **THEN** the test case is listed among the cases waiting for the E2E stage

### Requirement: Unknown case references are warned, archived ones are not
A case reference that names a test case of an archived change and of no active change SHALL NOT be reported. A case reference that names a test case of no active and no archived change SHALL be reported as a warning naming the reference.

#### Scenario: Reference to an archived case stays silent
- **GIVEN** a test file with a case reference to a test case of a change that has been archived
- **WHEN** the traceability check runs with marker checking on another active change
- **THEN** it reports no warning and no error for that reference

#### Scenario: Reference with a typo is warned
- **GIVEN** a test file with the reference `@case inventory/sale-export :: Export of an emty period` and no active or archived change with that test case
- **WHEN** the traceability check runs with marker checking on the change
- **THEN** it reports a warning that names the reference "Export of an emty period"

### Requirement: Schemas without test cases are unchanged
On the `clarify` and `lean` schemas, the checks and the archive gate SHALL NOT require a test-case document, test-case entries in the verification plan or case references.

#### Scenario: Clarify change without test cases archives as before
- **GIVEN** a change on the `clarify` schema with no `test-cases.md` and every existing check passing
- **WHEN** the change is archived
- **THEN** the archive is not blocked for missing test cases
