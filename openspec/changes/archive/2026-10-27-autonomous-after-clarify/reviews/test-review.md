# Test review — autonomous-after-clarify

Verdict: READY

Round 2: T1, T2, T4 and T6 are fixed and re-checked (see "Round 2" below). No blocker or major remains; T3 and T5 stay open as minor.

Input: `node openspec/tooling/bin/review-input.mjs --change autonomous-after-clarify` (60 scenarios, every one has a
marked test). Read in full: `tests/autonomous-apply.test.mjs`, `tests/apply-protocol.test.mjs`, the
"autonomous apply after install" block of `tests/installer.test.mjs`. Both change test files pass (69 tests, none
skipped). Rows at level `manual` are left to the repeat pilot, as the plan says.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | major | tests/autonomous-apply.test.mjs:589 | Developer declines the list | The AND "the agent does not propose a list again" is not asserted anywhere. The test only runs doctor on a `none` file. The plan row says "doctor run by the test; protocol text", but no test reads the protocol text for this rule. | If the sentence "write the single line `none` and do not propose a list again" were removed from `apply.md` §10 (or changed to "propose it again on the next apply"), every test still passes. | Add a text assertion on `section(protocol('apply.md'), 10)` that matches "write the single line `none` and do not propose a list again", either in this test or in a second test with the same marker in `tests/apply-protocol.test.mjs`. |
| T2 | major | tests/autonomous-apply.test.mjs:518 | Tool missing on the system | The scenario is critical and its AND says the agent "may install it into its temporary folder or into a container". The test only shows that in-project installs pass (`npm i`, `pip install -r`, `pnpm add -D`). It never runs an install into a temp folder or inside a container through the guard. The guard passes these today (checked by hand: `docker run --rm node:20 npm i -g pnpm`, `docker exec api apt-get install -y make`, `npm i --prefix <tmp> pnpm`, `pip install --target <tmp> httpie`), but no test holds that. | A guard change that asks on any `apt-get install`, `npm i -g` or `--prefix`, even inside `docker run`/`docker exec` or into the temp folder, still passes. The agent would then stop for consent on exactly the workaround the spec allows. | Add the commands above to the `pass` loop of this test. |
| T3 | minor | tests/autonomous-apply.test.mjs:358, :370, :382 | Developer switches off E2E / Developer skips E2E deliberately / Developer skips the integration checks | The gate does not check the reason text ("E2E switched off", "tests were not run" plus the cause), so the tests only prove that the entry and its `Consent:` line exist. Also, `assert.match(... e2e.md, /^Mode: skipped$/m)` at :361 checks the fixture's given data, not an outcome. | An entry with any non-empty reason (e.g. "later") passes the archive the same way. | Either accept that the wording is agent conduct (the protocol text is the source), or add a text assertion on `apply.md` §4 for the two reasons. Drop the e2e.md assertion or turn it into setup. |
| T4 | minor | tests/autonomous-apply.test.mjs:196 | Check that could not run | No test removes the `Reason:` line from an entry under "Not verified automatically". `REQUIRED.unverified = ['reason']` is not exercised. The missing-reason case is only tested under "Manual checks". | If the reason requirement for unverified entries were dropped, an entry without a cause still passes. | Add a variant of `LIVE_RELOAD` without `Reason:` and assert the "has no \"Reason:\" line" error. |
| T5 | minor | tests/apply-protocol.test.mjs:213 | Report after the E2E stage | The plan also lists "apply-report.md with an accepted case and `Consent:`". The marked test reads only the E2E protocol. The report side is proven indirectly by `readyAiQa()` in the archive tests, which are not marked with this scenario. | None for the protocol rule. The link from scenario to report check is just not visible from the marker. | Optionally add a `checkApplyReport` assertion on an accepted E2E entry with `Consent:` (unconsented list empty) to this test. |
| T6 | minor | tests/autonomous-apply.test.mjs:522 | Tool missing on the system | `asks('pip install --user httpie', /global\|user/)` matches any reason that contains "user", which is a weak reason check. | A wrong reason text that happens to say "user" still passes. | Match the specific reason wording the guard emits for `--user` installs. |

Notes (no finding):
- The text tests in `tests/apply-protocol.test.mjs` match exact, section-scoped sentences (via `section()` on `## N.`) and the four schema files where relevant. That matches the plan's choice of unit text tests for agent conduct.
- The integration tests run the hooks and `start-check.mjs` as processes on fixture copies. Each one has a passing and a failing variant and checks the specific error text (archive gate, answers-gate, check-apply-report). `start-check` checks the status, the record and that the application has stopped.
- `tests/installer.test.mjs:415` ("autonomous apply after install") has no scenario marker. It checks installation, manifest tracking, hook registration and permissions, so it supports the change but does not prove any spec scenario. Fine as-is.

## Round 2

- T1 resolved: `tests/autonomous-apply.test.mjs:592` now matches "When the developer declines, write the single line `none` and do not propose a list again" in `apply.md` (whitespace-collapsed), next to the doctor assertions.
- T2 resolved: `tests/autonomous-apply.test.mjs:527` pass loop now has `npm i --prefix <tmp> pnpm`, `pip install --target <tmp> httpie`, `docker run --rm node:20 npm i -g pnpm`, `docker exec api apt-get install -y make`.
- T4 resolved: `tests/autonomous-apply.test.mjs:202` asserts the "under \"Not verified automatically\" has no \"Reason:\" line" error.
- T6 resolved: `tests/autonomous-apply.test.mjs:524` matches "installs a package for the user, outside the project".
- T3, T5: open, minor.
- Both files pass: 69 tests, 0 failed, 0 skipped.

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
