# Tasks

All kit edits go into `kit/` (never the installed copy `openspec/` or `.claude/`); tests into `tests/`. The rules
of this change apply to every change stamped 0.5.0 or later: add no new version gate.

## 1. Worker limit in the E2E runner

Depends on: none
Area: kit/openspec/tooling/bin/e2e-run.mjs, tests/e2e-stage.test.mjs
Shared: none

- [x] 1.1 Write failing integration tests for "Two workers by default", "Worker number from the environment", "Worker argument of the developer wins", "Short worker argument wins" and "Invalid worker number is refused" (run `e2e-run.mjs` as a process against the stub `npx` the existing runner tests use, and assert the arguments it received), and verify they fail
- [x] 1.2 In `e2e-run.mjs` pass `--workers=<n>` to Playwright: 2 by default, the value of `E2E_WORKERS` when set (a positive whole number or a percentage such as `50%`; anything else ends with an error that names `E2E_WORKERS` and the value, before Playwright starts and without a recorded run), and nothing when the arguments after `--` already carry `--workers`, `--workers=<n>` or `-j`; update the usage text and the header comment; run the tests of 1.1 until they pass

## 2. Protocol rules: E2E reruns and the final group

Depends on: none
Area: kit/openspec/protocols/e2e.md, kit/openspec/protocols/subagents.md, kit/openspec/protocols/testing.md, kit/openspec/protocols/apply.md, kit/claude/agents/task-implementer.md, kit/openspec/schemas/, tests/e2e-protocol.test.mjs, tests/subagents-protocol.test.mjs, tests/apply-protocol.test.mjs, tests/schemas.test.mjs
Shared: none

- [x] 2.1 Write failing tests on the kit text for "Protocol config reuses the running application", "Protocol forbids E2E beside another suite", "Protocol limits reruns to the failing tests", "Several review findings go to one subagent", "Failing tests of one E2E run go to one subagent", "Subagent definition allows running its E2E tests", "End-of-apply suite passes", "End-of-apply suite fails", "Testing protocol agrees", "Final group" and "Full-suite subagent finished", and verify they fail; keep the markers of the unchanged scenarios of both capabilities on their existing tests
- [x] 2.2 `e2e.md`: in §3 set `reuseExistingServer: true` and name the worker limit of the runner (`E2E_WORKERS`); in §7 say that E2E never runs at the same time as another test suite; in §8 say that while tests are fixed only the failing tests run again, by file or by title, with one full run when they pass, and that the failing tests of one run go to one subagent
- [x] 2.3 `subagents.md` §8 and §9, `testing.md` §6, `apply.md` and `task-implementer.md`: the main agent runs the full suite and quality checks itself and writes the `full suite` progress line with the main chat's model; a failing command's fix goes to one subagent with the failing output, the main agent runs the failed commands again, and after the second failed fix attempt it stops and shows the developer the failures; every blocker and major finding of one test review goes to one subagent; the failing tests of one E2E run go to one subagent, which reruns only its tests through `e2e-run.mjs`, makes at most three fix attempts per test and reports what still fails; the main agent makes the full E2E run afterwards
- [x] 2.4 Update every schema instruction and existing test that repeats a changed sentence (search `kit/` and `tests/` for "full suite", "one fix attempt", "new subagent"), and run the tests of 2.1 and the touched test files until they pass

## 3. Documentation and version 0.6.1

Depends on: 1, 2
Area: docs/how-it-works.md, docs/decisions.md, docs/roadmap.md, CHANGELOG.md, kit/openspec/tooling/kit.json, package.json, tests/release.test.mjs
Shared: settings

- [x] 3.1 Set the kit version to 0.6.1 in `kit.json` and `package.json` and wherever `tests/release.test.mjs` expects it; add the 0.6.1 entry to `CHANGELOG.md` (what changed, that it applies to changes already in flight, the upgrade command, and that an existing `playwright.config` may set `reuseExistingServer: true`)
- [x] 3.2 Update `docs/how-it-works.md` (E2E stage, apply through subagents), add the decision to `docs/decisions.md` (why fewer E2E tests, the worker limit, the full suite by the main agent) and adjust `docs/roadmap.md`

## 4. Take the narrower E2E selection out

Depends on: 1, 2, 3
Area: kit/openspec/protocols/e2e.md, tests/e2e-protocol.test.mjs, tests/e2e-stage.test.mjs, docs/, CHANGELOG.md
Shared: none

- [x] 4.1 Restore in `e2e.md` §6 the rule that on `clarify` and `lean` every spec scenario that goes through the interface is listed for E2E; remove the tests of the dropped scenarios "Protocol names which scenarios get an E2E test", "Protocol names which scenarios get no E2E test" and "Unlisted scenario does not block the archive"
- [x] 4.2 Remove the narrower selection from `CHANGELOG.md`, `docs/how-it-works.md`, `docs/guide/workflow.md`, `docs/decisions.md` and `docs/roadmap.md`; run `npm test`

## 5. Final checks

Depends on: 1, 2, 3, 4
Area: openspec/changes/faster-test-stage/
Shared: none

- [x] 5.1 Run the `test-reviewer` subagent and fix blocker and major findings (`openspec/protocols/review-tests.md`)
- [x] 5.2 Run `npm test` and fix what fails
- [x] 5.3 Write `apply-report.md` (`openspec/protocols/apply.md` §7) and run `node openspec/tooling/checks/check-traceability.mjs --change faster-test-stage --markers`
