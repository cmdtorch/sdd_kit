# Test review — project-test-commands

Verdict: READY

Round 2. Scope: every scenario listed by `review-input.mjs` (each has at least one marked test; none is skipped
or marked as an expected failure). The five test files of the change pass (93 tests, 0 fail, 0 skipped).
This round re-read the tests behind the findings from round 1, plus the marked tests around them.

Round 1 findings:

- **T1 (major), fixed.** `tests/start-check-early.test.mjs:70` ("Application starts during planning") now also
  checks `planning.md` §14. Step 2 must name the early check with `start-check.mjs --change <name> --start
  "<command>" --url <address> [--stop "<command>"]`. Step 3 must say `Passed or skipped: write the proposal and
  go on with planning in the same turn.` The assertions match whole sentences. If step 3 were deleted, or
  changed so the agent waits for the developer after a passed check, the test now fails. The script part is
  still asserted: 200, the application stopped afterwards, the record `{ok: true, status: 200}`, `--status`
  prints `passed`, and `startCheckPassed` returns true.
- **T5 (minor), fixed.** `tests/test-run-guard.test.mjs:155` ("Extra spaces") now passes `/only its own test
  files/` in all three `blocked()` calls. Those calls cover doubled spaces, spaces with tabs at the edges, and
  extra spaces inside the file's own command.

Round 1 minor findings that were left as they were. They are not blocking, and they are listed again so they
stay on record:

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T2 | minor | tests/test-run-guard.test.mjs:229 | workflow/test-commands :: Change stamped 0.6.1 | The hook reads no stamp and writes no file, so this test's assertions hold for any change. The real proof of the scenario's THEN is `tests/test-commands-protocol.test.mjs:61`. | If the planning text proposed the file to a change stamped 0.6.1, this test would still pass. Only the protocol test would catch it. | Remove this marker, or keep the test without a marker as a fail-open check. |
| T3 | minor | tests/test-commands-protocol.test.mjs:196 | workflow/environment-check :: Developer declines the list | The AND "does not propose a list again" is covered only by other tests taken together: the "File already exists" test and `tests/autonomous-apply.test.mjs:595`. | None: the other tests catch it. | Optional: assert the "do not propose it" sentence here too, so this test proves the scenario by itself. |
| T4 | minor | tests/start-check-early.test.mjs:70 | workflow/environment-check :: Application starts during planning | The test runs the check with `--timeout 20`. Nothing asserts that the check made during planning keeps the 2-minute default. | If the planning text passed a different `--timeout`, no test would notice. | Low value. Accept it, or assert the default timeout once. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
