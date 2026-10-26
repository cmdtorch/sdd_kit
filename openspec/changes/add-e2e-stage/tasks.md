# Tasks

## 1. Stage record and its format check

- [x] 1.1 Write failing unit tests in `tests/e2e-stage.test.mjs` for "Unknown mode is reported", "Missing test folder is reported", "Developer start without an address is reported" (e2e/stage), "Accepted case without a reason is reported" (e2e/tests) and "Accepted difference without a reason is reported" (e2e/visual-check), on temp changes with a written `e2e.md`; verify they fail
- [x] 1.2 Add the parser `kit/openspec/tooling/lib/e2e-record.mjs` for `e2e.md` (design D2: `Mode:`, `Tests:`, `Start:`, `Note:`, `## Scenarios`, `## Accepted cases`, `## Screens`, `## No new run needed`)
- [x] 1.3 Add `kit/openspec/tooling/checks/check-e2e.mjs` (CLI like the other checks, exported `checkE2e({ root, change, mode })` with `format` and `archive` modes) with the format checks of design D4; run the group 1 tests and verify they pass

## 2. Run script, coverage and result validity

- [x] 2.1 Write failing tests for "Listed scenario that does not exist is reported", "Unit test does not count as E2E coverage", "Case that is not e2e needs no E2E test" (e2e/tests, unit), "Automatic retries are reported" (e2e/tests, unit on a written `e2e-runs.json`), and integration tests that run `e2e-run.mjs` with a fake `npx` first on PATH for "Rerun of a test fixed in its own file completes the stage", "Shared E2E helper change needs every test again", "Application fix needs every test again" (e2e/stage); verify they fail
- [x] 2.2 Add `kit/openspec/tooling/bin/e2e-run.mjs` (design D3): runs `npx playwright test --reporter=json` in the `Tests:` folder, sets `E2E_BASE_URL` for a developer-started application, appends a run to `e2e-runs.json` with `at`, `retries`, per-test file, title, line, `@case` / `@scenario` references and status, `appState` and `testFiles` fingerprints; `--state` prints the state id
- [x] 2.3 Add the archive-mode checks to `check-e2e.mjs`: E2E coverage of every `e2e` case (test-case schemas) or listed scenario (`clarify`, `lean`) by tests in the test folder only, `retries` 0, and result validity by `appState`, the test's own file, the shared files of the folder and `## No new run needed`; run the group 2 tests and verify they pass

## 3. Archive gate and feedback

- [x] 3.1 Write failing integration tests that run `archive-gate` as a process on temp projects from fixtures (with runs recorded by `e2e-run.mjs` and the fake `npx`) for "Archive is blocked before the first E2E run", "Failing case blocks the archive", "Green run with an accepted case allows the archive", "Test-case change without an E2E decision blocks the archive", "Clarify change without E2E archives as before", "Lean change without E2E archives as before", "Skipped E2E does not block the archive", "Code changed after the stage blocks the archive", "Developer decides no new run is needed" (e2e/stage), "E2E case without a test blocks the archive", "Listed scenario without a test blocks the archive" (e2e/tests), "Screenshot without a comparison blocks the archive", "Change without screenshots needs no visual check", "Open difference blocks the archive", "Accepted difference allows the archive" (e2e/visual-check); verify they fail
- [x] 3.2 Extend `kit/openspec/tooling/hooks/archive-gate.mjs` with `check-e2e` in archive mode for all four kit schemas (decision required on `clarify-ai-qa` / `clarify-qa`, no `e2e.md` on `clarify` / `lean` means no E2E) and `artifact-feedback.mjs` with the format check after `e2e.md` is written; map `e2e.md` in `lib/project.mjs` if needed; run the group 3 tests and verify they pass

## 4. Protocols, schemas, installer and docs

- [x] 4.1 Add `kit/openspec/protocols/e2e.md` (design D1, D5–D7: the decision and backend mode, Playwright for JavaScript in its own folder with `retries: 0` and Chromium only, installing with permission, starting the application and the missing start command, test data and credentials, a test follows its case, running only through `e2e-run.mjs`, the three fix attempts, accepted cases as skipped tests, the visual check with temporary snapshots, changes after the stage, skipping); add the Main round E2E question to `questions.md`; update `testing.md` (skipped and accepted `e2e` cases listed for QA, `e2e` cases no longer "waiting")
- [x] 4.2 Add the E2E step to the apply instructions of `clarify`, `clarify-ai-qa`, `clarify-qa` (identical text) and the lean variant that asks first; run `node --test tests/schemas.test.mjs` and verify it passes
- [x] 4.3 Allow `node openspec/tooling/bin/e2e-run.mjs` and `check-e2e.mjs` in `kit/claude-settings.fragment.json` (recognised by `settings-merge.mjs` as kit permissions); extend the installer test so an install contains the protocol, the script and the check
- [x] 4.4 Update `docs/how-it-works.md` (every new kit file, the hook changes), `docs/guide/workflow.md` (the E2E stage), `docs/decisions.md` (replace the deferred-E2E decision R19; the kit now runs Playwright through a script) and the CHANGELOG `Unreleased` entry; run `npm test` to confirm the docs check passes

## 5. Final verification

- [x] 5.1 Run the `test-reviewer` subagent (`openspec/protocols/review-tests.md`) and fix its blocker and major findings
- [x] 5.2 Run the full suite `npm test` and `node openspec/tooling/bin/doctor.mjs`; fix what fails and report the commands and results
- [x] 5.3 Run `node openspec/tooling/checks/check-traceability.mjs --change add-e2e-stage --markers` and `openspec validate add-e2e-stage --strict`
- [ ] 5.4 Write `manual-checks.md` with the 22 manual rows of the verification plan and run them in the pilot on a real web monorepo (test-case schema, UI screenshots, Playwright not installed beforehand): every `e2e` case gets a passing test and QA finds no bug in the covered scenarios; record the outcome and fix usability findings in this change

## Workflow follow-up

- Archive the change only after the pilot of task 5.4.
