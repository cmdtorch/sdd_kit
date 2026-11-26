# Test review — faster-test-stage

Verdict: READY

Scope: the scenarios of this change in `tests/e2e-stage.test.mjs` (worker limit, "Unlisted scenario does not
block the archive"), `tests/e2e-protocol.test.mjs` and `tests/subagents-protocol.test.mjs`. Input from
`review-input.mjs`; every scenario of the delta specs has a marked test. The four files were run on their own
and pass (e2e-protocol 5, e2e-stage 54, subagents-protocol 56, e2e-hooks 16; no skipped or todo tests).

Notes on what was checked:

- Worker limit: every scenario runs `e2e-run.mjs` as a process against a stub `npx` that logs its arguments.
  `pwArgsOf` requires exactly one Playwright call, and the assertions use `deepEqual` on the full argument
  list, so an extra or a duplicate `--workers` argument fails the test. `E2E_WORKERS` from the developer's shell
  is removed at module load and set per process only. "Invalid worker number is refused" checks a non-zero
  non-null exit, `E2E_WORKERS` and the quoted value in stderr, no Playwright call and no `e2e-runs.json`, for
  `many` and five other invalid values.
- "Unlisted scenario does not block the archive": the delta spec has "Successful export" and "Export list is
  sorted by date", the record lists only the first, the test file of the second is removed, and the recorded
  run is checked to hold one passed test that references "Successful export". If check-e2e still required a test
  for every scenario, the archive would report "Export list is sorted by date" and the test would fail.
- Protocol text tests read the section the scenario names (`e2e.md` §3, §6, §7, §8; `subagents.md` §8, §9;
  `testing.md` §6; the installed `task-implementer` definition) and match the full rule sentence. They also
  check that the replaced wording is gone ("A rerun of only the fixed test is enough", "Hand the full suite to a
  new subagent", "Each E2E fix subagent makes one fix attempt").

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/e2e-protocol.test.mjs:42 | Protocol config reuses the running application | The section is flattened before `/webServer: [^\n]*?\{([^}]*)\}/` runs, so `[^\n]*?` can cross into later text. If the `webServer` entry stopped being an inline object, the match would stop at the next `{ ... }` anywhere later in §3. | If the example were changed to `webServer: makeServer(),` and a later object in §3 contained `reuseExistingServer: true`, the test would still pass. | Match on the raw (not flattened) config line, e.g. `/^\s*webServer: [^\n]*\{[^}\n]*reuseExistingServer: true[^}\n]*\}/m` against the fenced block of §3. |
| T2 | minor | tests/subagents-protocol.test.mjs:349 | Full-suite subagent finished | This test checks only the example line `full suite — — opus — every test passes`. The rule (one line after the main agent's own full-suite run, starting with `full suite`) is checked in the neighbouring test at :341. The scenario name still says "subagent", but the spec now has the main agent run the suite. | No missed break, because :341 checks the rule. This is a readability point only. | Optionally also match the rule clause "after your own full-suite run … `full suite`" here so the test proves its scenario by itself. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
