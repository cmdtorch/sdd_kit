# Test review — add-qa-test-cases-stage

Verdict: READY

Scope: every scenario planned at level `unit` or `integration` in `verification-plan.md` carries a marker
on a test in `tests/test-cases.test.mjs`, `tests/qa-hooks.test.mjs`, `tests/schemas.test.mjs` or
`tests/installer.test.mjs`. Scenarios planned only as `manual` have no marked test, as the plan expects;
they are verified later in the pilot and are not findings here. For "Developer decides after the third
run" (planned `unit, manual`), the unit part is covered by the hook test; the "developer is shown" part
is left to the pilot.

The four files were run with the pinned OpenSpec CLI 1.15.0: 133 tests, 133 pass, 0 skipped. The tests
gated on the CLI ("Archive does not merge test cases", "Change created in a terminal", the schema status
tests, the install test) really ran.

Overall the tests are strong. Each one builds its given state by planting a single defect into a complete
fixture, and the fixture must first pass the gate. Error scenarios assert the exit code together with the
exact message text, and that text names the capability, scenario or case and the finding. Pass scenarios
assert `findings` equal to `[]` or an empty stderr, not just `ok`. Nothing under test is mocked: the gates
run as processes (`answers-gate.mjs`, `archive-gate.mjs`), and the archive and schema tests use the real
CLI.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/qa-hooks.test.mjs:163 | Unknown schema is passed through | Only the first half of the THEN is asserted: the starter returns `null`. The second half, "OpenSpec reports the unknown schema itself", is not checked. | If OpenSpec 1.15 silently fell back to the default schema for `--schema foo`, the test still passes. That is upstream behaviour, so the risk is low. | Optionally add a CLI-gated check that `openspec new change x --schema foo` exits non-zero and names `foo`. Otherwise note in the plan that this half is OpenSpec's behaviour. |
| T2 | minor | tests/qa-hooks.test.mjs:80 | Late review loop has its own limit | The GIVEN "a scenario is added during implementation" is not built. The new loop starts only because the stage confirmation changes from blank to `Looks correct`. Also, the first loop's runs write no review file. | This matches the hook's design (a loop resets on a settled, confirmed stage), so no real break is missed. The test just reads less like the scenario. | Optionally append a late scenario to the delta spec before the late runs, so the test data matches the scenario. |
| T3 | minor | tests/test-cases.test.mjs:585 | Same case name in two active changes | The scenario's data is the case "Empty list". The test copies the whole change instead, so the shared case is "Export of an empty period". | None: the claim tested (one reference covers the case in both active changes, with no findings in either) is the same. | Optionally rename the shared case to "Empty list" to match the scenario's data. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
