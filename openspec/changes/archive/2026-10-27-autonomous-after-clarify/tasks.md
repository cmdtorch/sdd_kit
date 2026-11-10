# Tasks

## 1. Manual reasons in the plan and the test cases

- [x] 1.1 Write failing tests for "Manual row with a reason", "Lean change with a manual row" and "Dangerous scenario in the plan" (workflow/manual-checks, unit: `check-traceability` on temp plans with a `Manual reason` column, a `dangerous:` row with and without a `unit` row) and integration tests that run `answers-gate` as a process for "Manual row without a reason" (write of `tasks.md` blocked) and "Manual test case without a reason" (write of `design.md` blocked on `clarify-ai-qa`); every test carries its `@scenario` marker; verify they fail
- [x] 1.2 Extend `kit/openspec/tooling/lib/plan.mjs` and `check-traceability.mjs` (design D3): a `manual` row needs a `Manual reason` that starts with `cannot be automated:` or `dangerous:`; a `dangerous:` scenario also needs a `unit` or `integration` row or an E2E test; only for changes stamped with this kit version (D5)
- [x] 1.3 Extend `kit/openspec/tooling/lib/test-cases.mjs` and `check-test-cases.mjs` with the `Manual reason:` line of a `manual` case; make `answers-gate` block `tasks.md` (and `design.md` on the test-case schemas) on these errors; run the group 1 tests and verify they pass

## 2. Implementation report and its check

- [x] 2.1 Write failing unit tests for "Report after the tasks", "Manual check entry", "Check that could not run", "Two manual checks, one dangerous" (workflow/manual-checks), "Relaxed assertion with consent" and "Switched-off quality rule with consent" (workflow/autonomous-apply) on `apply-report.md` fixtures; verify they fail
- [x] 2.2 Add `kit/openspec/tooling/checks/check-apply-report.mjs` (design D2; CLI like the other checks, exported `checkApplyReport({ root, change })`): the three sections, `None.` for an empty one, a reason on every entry, dangerous checks first and marked "required before release", entries without a `Consent:` line listed; run it from `artifact-feedback` after `apply-report.md` is written; run the group 2 tests and verify they pass

## 3. Kit version stamp and the archive gate

- [x] 3.1 Write failing tests: unit "New change during apply" (workflow/manual-checks: `artifact-feedback` adds `x-sdd-kit: <kitVersion>` to `.openspec.yaml` on the first artifact write and keeps an existing value); integration tests that run `archive-gate` as a process on temp projects from fixtures for "Unverified case with consent", "Unverified case without consent", "Plan with manual rows", "Old change with open manual tasks" (workflow/manual-checks), "Developer switches off E2E", "Developer skips E2E deliberately" and "Developer skips the integration checks" (workflow/environment-check); verify they fail
- [x] 3.2 Add the stamp to `kit/openspec/tooling/hooks/artifact-feedback.mjs` and a stamp reader to `lib/project.mjs` (design D5); confirm with the pinned OpenSpec CLI that `openspec validate --strict` and `openspec status` stay silent on the `x-` key
- [x] 3.3 Extend `archive-gate.mjs` for stamped changes (design D4): `apply-report.md` passes its check; a scenario or `automated` case without a test counts as covered only under "Not verified automatically" with a `Consent:` line (also for `e2e` cases when `e2e.md` says `Mode: skipped`); a `start-check.json` when the plan's Environment says `Running application: yes`; unstamped changes keep today's gate; run the group 3 tests and verify they pass

## 4. Tasks check

- [x] 4.1 Write a failing unit test for "No task for the developer in the task list" (workflow/autonomous-apply): a `tasks.md` with "Verify by hand …" gets a warning; verify it fails
- [x] 4.2 Add the warning for tasks that ask a human to check by hand (design D9) to the check that `artifact-feedback` runs after `tasks.md`; run the test and verify it passes

## 5. Start-check script

- [x] 5.1 Write failing integration tests that run `start-check.mjs` as a process against a small HTTP server started by the test, with a shortened wait, for "Application starts" (status 200) and "Application does not answer in time" (status 503, and no answer) (workflow/environment-check); verify they fail
- [x] 5.2 Add `kit/openspec/tooling/bin/start-check.mjs` (design D6): `--change`, `--start`, `--url`, optional `--stop`; polls every 2 seconds up to 2 minutes (overridable for tests), success below status 500, stops the stop command or the started process group, writes `start-check.json` in the change root; run the group 5 tests and verify they pass

## 6. Command guard

- [x] 6.1 Write failing integration tests that run `boundary-guard.mjs` as a process with sample hook input for "Other application holds a needed port" (`kill`, `pkill`, `killall`), "Tool missing on the system" (`sudo apt-get install`, `brew install`, `npm i -g`, `pip install --user`) and "Foreign Docker container in the way" (`docker stop`, `docker rm`, `docker kill`, `docker volume rm`, `docker network rm`, `docker system prune` ask; `docker compose down` passes) (workflow/autonomous-apply); verify they fail
- [x] 6.2 Add `kit/openspec/tooling/hooks/boundary-guard.mjs` (design D7, PreToolUse Bash, answers "ask" with the reason) and register it in `kit/claude-settings.fragment.json` and `lib/settings-merge.mjs`; run the group 6 tests and verify they pass

## 7. Project tools, doctor and install

- [x] 7.1 Write failing tests for "Listed tool missing", "All listed tools present", "No tool list", "Developer declines the list" (unit: doctor run with a controlled PATH on a temp project with `openspec/project-tools`) and "Install shows the result" (integration: installer run into a temp project) (workflow/environment-check); verify they fail
- [x] 7.2 Extend `kit/openspec/tooling/bin/doctor.mjs` with the project-tools warnings (design D8; missing file or `none` reports nothing); make the installer run doctor at the end and print its result; keep `openspec/project-tools` a project file that install and update never touch; run the group 7 tests and verify they pass

## 8. Protocols and schema texts

- [x] 8.1 Write failing text tests (protocol and four schema files read by the test) for "Planning complete, nothing blocks", "Requirement gap during apply", "Test still fails after two fix attempts", "Environment blocks the start during the work", "Situation outside the plan", "Case needs a real phone", "Application itself does not start", "Stop on one test with independent tasks left", "Requirement gap stops at once", "Agent suggests freeing a port", "Mail service missing in a test", "Weakening without consent", "Change ready to archive" (workflow/autonomous-apply), "Agent proposes the list", "No running application needed", "No instructions or no address", "Ports unreachable", "Developer chooses to fix inside the project", "Fix outside the project" (workflow/environment-check), "Hourly payout to cards", "Role check only", "Two unverified entries", "Entry already agreed", "Developer refuses an entry", "Effort given as the reason", "Verification round on an infrastructure change" and "Report after the E2E stage" (workflow/manual-checks); verify they fail
- [x] 8.2 Add `kit/openspec/protocols/apply.md` (design D1: the stops, independent work first, options suggested not carried out, workarounds inside the application only, the project boundary, weakening with consent, the start check and the failed-start ways, single checks recorded, `apply-report.md`, the consent list and a refused entry, the ready message, the project tool list)
- [x] 8.3 Update `testing.md` (§1 manual levels and reasons, dangerous functions, §2 `Manual reason` column and `Running application:` line, §6 end of apply with `apply-report.md`), `test-cases.md` (`Manual reason:`), `review-test-cases.md` and the `test-cases-reviewer` agent (effort as a reason is major), `questions.md` (no automate-or-manual question), `e2e.md` §11–12 (skipped and accepted cases go to `apply-report.md` with `Consent:`)
- [x] 8.4 Update the apply, tasks and verification-plan instructions of `clarify`, `clarify-ai-qa`, `clarify-qa` (identical text) and `lean`: start check first, the protocol `apply.md`, no "verify by hand" tasks, the report instead of a manual list; run `node --test tests/schemas.test.mjs` and the group 8 tests and verify they pass

## 9. Docs and permissions

- [x] 9.1 Allow `start-check.mjs` and `check-apply-report.mjs` in `kit/claude-settings.fragment.json`; extend the installer test so an install contains the new protocol, script, check and hook
- [x] 9.2 Update `docs/how-it-works.md` (every new kit file, the gate and hook changes), `docs/guide/workflow.md` (autonomous apply, the report, the start check), `docs/decisions.md` (manual checks no longer tasks, the command guard, the version stamp) and the CHANGELOG `Unreleased` entry; run `npm test` to confirm the docs check passes

## 10. Final verification

- [x] 10.1 Run the `test-reviewer` subagent (`openspec/protocols/review-tests.md`) and fix its blocker and major findings
- [x] 10.2 Run the full suite `npm test` and `node openspec/tooling/bin/doctor.mjs`; fix what fails and report the commands and results
- [x] 10.3 Run `node openspec/tooling/checks/check-traceability.mjs --change autonomous-after-clarify --markers` and `openspec validate autonomous-after-clarify --strict`
- [x] 10.4 Write `apply-report.md` for this change: the 7 `manual` rows of the verification plan (repeat pilot) under "Manual checks", with steps, expected outcome and their reason

## Workflow follow-up

- The developer runs the repeat pilot in the same project and environment as the first one (re-plan the monorepo scaffold with the updated kit): the agent stops before the first task with the failed-start ways, and no manual task reaches the developer at the end.
- Archive the change after the pilot.
