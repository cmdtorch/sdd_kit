# Spec Delta

## MODIFIED Requirements

### Requirement: Implementation report
The agent SHALL keep one implementation report, `apply-report.md`, in the change folder: written at the end of the tasks, updated after the E2E stage and after the consent list. It stays in the archived change. On a change implemented through subagents the report also has a section "Subagent runs" with one line per run: the task group (or `fix: <what>` / `full suite`), the tasks done, the model and the test result. Its absence never blocks the archive.

#### Scenario: Report after the tasks
- **WHEN** the last task is done
- **THEN** `apply-report.md` exists with the sections "Manual checks", "Not verified automatically" and "Weakened tests"
- **AND** an empty section says "None."

#### Scenario: Report after the E2E stage
- **WHEN** the E2E stage ends with a case the developer accepted at the stop after the fix attempts
- **THEN** `apply-report.md` lists that case under "Not verified automatically" with the accepted reason
- **AND** the entry carries a `Consent:` line with the developer's acceptance, so it is not asked again at the end

#### Scenario: Report records the subagent runs
- **GIVEN** a change whose groups 1 and 2 were done by subagents, group 2 after one replacement subagent
- **WHEN** the last task is done
- **THEN** the section "Subagent runs" of `apply-report.md` has three lines, each with its task group, the tasks done, the model and the test result

#### Scenario: Missing subagent record does not block
- **GIVEN** a stamped change whose `apply-report.md` has the three sections and no section "Subagent runs"
- **WHEN** `check-apply-report` runs on the change
- **THEN** it reports no error and no warning about subagent runs
