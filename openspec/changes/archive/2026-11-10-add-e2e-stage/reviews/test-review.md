# Test review — add-e2e-stage

Verdict: READY

Scope: the 26 scenarios planned as unit or integration in `verification-plan.md`, each with a marked test in
`tests/e2e-stage.test.mjs` or `tests/e2e-hooks.test.mjs`. The 24 scenarios planned as manual are left to the pilot
(the last task), as the plan says. Both files pass (`node --test`: 60 pass, 0 fail, 0 skipped, 0 todo).

What makes these tests strong:
- Every "blocked" THEN checks exit code 2, the gate's "cannot be archived yet" text and a regex on the exact
  check-e2e message, which includes the case, scenario or screenshot name.
- Every "not blocked" THEN checks exit 0 and that no `check-e2e` line was printed. Most also show the same project
  blocked first: before the run, before the acceptance, or before the no-new-run decision. So the test cannot pass
  just because the gate never runs.
- Tests that name one item also check that the others are not named (`assert.doesNotMatch(e2eLines(r), …)`,
  `assertNoError`). A check that reports every case would fail them.
- The run state is real. A fake `npx` returns real-shaped Playwright JSON. `e2e-run.mjs` and the hooks run as
  processes. Files change on disk between runs.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/e2e-stage.test.mjs:553, :566, :577 | Rerun of a test fixed in its own file completes the stage; Shared E2E helper change needs every test again; Application fix needs every test again | The plan sets these to integration with archive-gate run as a process. The tests call `checkE2e({mode:'archive'})` directly (`e2e-run.mjs` does run as a process). The hook tests already show that the gate runs check-e2e in archive mode, so the risk is low. | If archive-gate filtered or rewrote the stale-result messages (for example, only showed the first error), these three scenarios would still pass. | Run `archive-gate.mjs` once on one of the three projects and match the same message in stderr, or move them to e2e-hooks.test.mjs. |
| T2 | minor | tests/e2e-stage.test.mjs:174 | Accepted difference without a reason is reported | The scenario's given data and THEN name `01-orders-list.png`; the test leaves the reason out on `02-orders-list-mobile.png`. The behaviour is the same, but the given data does not match the scenario. | None in practice (the check is per row). | Use the row of `01-orders-list.png` with result `accepted`, or change the scenario's example. |
| T3 | minor | tests/e2e-hooks.test.mjs:263 | Accepted difference allows the archive | The test only checks the allowed outcome. It does not show that the same row with the result `differences` is blocked. That is covered by the Open difference test (:255), but on another project. | If every screens row passed, whatever its result, this test alone would still pass. The neighbouring test would catch it. | Optional: first write the row as `differences`, check that the archive is blocked, then accept it. |
| T4 | minor | tests/e2e-stage.test.mjs:115 | Unknown mode is reported | The regex in `assertError` has two alternative branches, which makes it hard to read. The loop over `MODES` that follows is what actually checks the listed modes. | None. | Match only `/"staging server"/` and keep the loop. |
| T5 | minor | tests/e2e-hooks.test.mjs:238 | Screenshot without a comparison blocks the archive | The scenario has two screenshots. The fixture has three, and the missing one is the second, as in the scenario. That is fine; noted only as a difference in the given data. | None. | None needed. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
