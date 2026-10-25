# Tasks

Edit only `kit/` and `installer/` (plus `tests/`, `fixtures/`, `docs/`); never the installed copy in `openspec/` or `.claude/`. Every test carries `// @scenario <capability-path> :: <Scenario name>` on the line above it. Test data inside `tests/` must not start a line with `@scenario` or `@case` (use a placeholder, as `tests/checks.test.mjs` does with `@S`).

## 1. Clarify family and the two test-case schemas

- [x] 1.1 Write failing tests for "Same artifacts in both schemas", "Test cases come after the specs", "Clarify has no test-cases artifact", "Lean has no test-cases artifact", "Question gate applies" and "Archive gate applies to scenarios" (workflow/test-case-schemas): schema files, `openspec status` on temp projects, answers-gate and archive-gate on `clarify-ai-qa` / `clarify-qa` fixtures; plus a test that the artifacts shared with `clarify` have identical instructions and templates; verify they fail
- [x] 1.2 Add `CLARIFY_FAMILY`, `TEST_CASE_SCHEMAS`, `isClarifyFamily()` and `hasTestCases()` to `kit/openspec/tooling/lib/project.mjs`; extend `KIT_SCHEMAS`; replace every `schema === 'clarify'` / `!== 'clarify'` in hooks and checks (answers-gate, archive-gate, artifact-feedback, session-start, check-answers, check-grounding, check-traceability) and in `installer/sdd-kit.mjs`
- [x] 1.3 Create `kit/openspec/schemas/clarify-ai-qa/` and `kit/openspec/schemas/clarify-qa/` as copies of `clarify` with the `test-cases` artifact (`requires: [specs]`, `design.requires: [proposal, test-cases]`) and its instruction (AI review loop; hand-over to QA only in `clarify-qa`); add `session-start` artifact lists for both
- [x] 1.4 Add fixture changes for both schemas under `fixtures/` (two capabilities, complete `test-cases.md`, verification plan with the test-case table); run the group 1 tests and verify they pass

## 2. Test-case document and its check

- [x] 2.1 Write failing unit tests for "Test cases are grouped by capability and scenario", "Scenario without a test case is reported", "Test case under an unknown scenario is reported", "Several cases for one scenario pass", "Test case without a Then is reported", "Test case without a Given is reported", "Duplicate test case name is reported", "Same name in different capabilities is allowed", "Several labels on one case", "Missing label is reported", "Unknown label is reported" (test-cases/document) and "Unknown status is reported", "Developer confirms on QA's behalf" (test-cases/review); verify they fail
- [x] 2.2 Add the parser `kit/openspec/tooling/lib/test-cases.mjs` for the format in design D3 (capabilities, scenarios, cases, labels, steps, remarks with status, "Spec changes during test-case review", "Stage result")
- [x] 2.3 Add `kit/openspec/tooling/checks/check-test-cases.mjs` (structure, coverage, labels, steps, statuses; skipped for schemas without test cases) and its `--stage` completion mode (design D4); run the group 2 tests and verify they pass

## 3. Gates for design and archive

- [x] 3.1 Write failing integration tests for "Design is blocked by a coverage error", "Late scenario without a test case blocks the archive", "Archive does not merge test cases" (test-cases/document), "Design is blocked before confirmation", "Unlisted major finding blocks the design", "Design is allowed after confirmation", "Open remark blocks the design", "Confirmation without a hand-over blocks the design", "Confirmed result allows the design" (test-cases/review), running the hooks as processes on fixture projects; verify they fail
- [x] 3.2 Extend `answers-gate.mjs`: for test-case schemas, writing `design.md` also requires `check-test-cases --stage` to pass, with a message naming what is missing
- [x] 3.3 Extend `archive-gate.mjs` with `check-test-cases` for test-case schemas; run the group 3 tests and verify they pass

## 4. Case references and the verification plan

- [x] 4.1 Write failing unit tests for "Automated case without a level is reported", "Test case missing from the plan is reported", "Manual case needs no level", "Case reference is found", "Reference inside a string is not counted", "Same case name in two active changes", "Reference to an archived case stays silent", "Reference with a typo is warned" (test-cases/coverage) and "Renamed case loses its coverage" (test-cases/document), and integration tests for "Uncovered automated case blocks the archive", "E2E-only case does not block the archive", "Automated and e2e case needs its automated test", "Clarify change without test cases archives as before" (test-cases/coverage); verify they fail
- [x] 4.2 Teach `kit/openspec/tooling/lib/markers.mjs` the `@case <capability-path> :: <case name>` reference with the `@scenario` placement rules
- [x] 4.3 Parse the "Test case coverage" table in `kit/openspec/tooling/lib/plan.mjs`; extend `check-traceability.mjs` (plan rows per case, levels for `automated`, `--markers` coverage of `automated` cases, archived-case lookup, typo warning); add the table to the template of both new schemas; run the group 4 tests and verify they pass

## 5. AI QA reviewer and the run limit

- [x] 5.1 Write failing unit tests for "Developer decides after the third run" and "Late review loop has its own limit" (test-cases/review) against the run-limit hook's gate function; verify they fail
- [x] 5.2 Add `kit/openspec/protocols/review-test-cases.md` (closed checklist, positive / error / boundary rule, severities, READY rule, reading "Stage result") and `kit/claude/agents/test-cases-reviewer.md`
- [x] 5.3 Add the PreToolUse hook `kit/openspec/tooling/hooks/test-cases-run-limit.mjs` with the counter in `reviews/test-cases-runs.json` (design D6) and register it in `kit/claude-settings.fragment.json`; run the group 5 tests and verify they pass

## 6. Schema starter

- [x] 6.1 Write failing unit tests for "Unnamed schema is blocked", "Unnamed schema through the wrapper is blocked", "Schema named with a space is not blocked", "Schema named with an equals sign is not blocked", "Unknown schema is passed through", "Lean is not offered", "Default schema in settings still starts the menu" (workflow/schema-starter) against the hook's gate function, and an integration test for "Change created in a terminal"; verify they fail
- [x] 6.2 Add the PreToolUse Bash hook `kit/openspec/tooling/hooks/schema-starter.mjs` (design D7), with the block message for the three-choice menu, dismissed menu and free-text answer, and register it in `kit/claude-settings.fragment.json`; run the group 6 tests and verify they pass

## 7. Protocols, installer and docs

- [x] 7.1 Write a failing integration test for "Both schemas are available after install" (workflow/test-case-schemas): the installer puts both schemas, the agent, the protocols and both hooks into a temp project; verify it fails
- [x] 7.2 Add `kit/openspec/protocols/test-cases.md` (writing test cases, remarks, statuses, "Stage result", hand-over, follow-up questions, late scenarios, switching schemas by editing `schema:`) and the `test-cases.md` template in both new schemas; update `kit/openspec/protocols/testing.md` (labels, `@case`, the test-case table, end-of-apply lists of `manual` and `e2e` cases) and `kit/config-fragment.yaml`
- [x] 7.3 Update the installer and its manifest for the new files and hooks; run the group 7 test and verify it passes
- [x] 7.4 Update `docs/how-it-works.md` (every new kit file), `docs/guide/workflow.md` and `docs/decisions.md` (new decision entry); run `npm test` to confirm the docs check passes

## 8. Final verification

- [x] 8.1 Run the `test-reviewer` subagent (`openspec/protocols/review-tests.md`) and fix its blocker and major findings
- [x] 8.2 Run the full suite `npm test` and `node openspec/tooling/bin/doctor.mjs`; fix what fails and report the commands and results
- [x] 8.3 Run `node openspec/tooling/checks/check-traceability.mjs --change add-qa-test-cases-stage --markers` and `openspec validate add-qa-test-cases-stage --strict`
- [ ] 8.4 List the manual checks for the developer: every `manual` row of the verification plan with what to check and the expected outcome, to be done in the pilot (a separate test project with the kit installed, a change on `clarify-qa` with a real tester as QA, a short change on `clarify-ai-qa` and the starter menu); record the outcome and fix usability findings in this change
