# Test review — docs-site-checks

Verdict: READY

All 21 planned scenarios have a marked test at the planned level (unit). `tests/release.test.mjs` passes
(31/31). Every THEN / AND clause is asserted on the returned problem list or on the real file text. The error
scenarios check the exact number of problems (`length === 1`) and match both the page path and the offending
value. The positive tests use `deepEqual(..., [])`, so a check that reports nothing at all is still caught,
because the negative tests expect exactly one problem. No skipped tests, no mocks, and every marker sits on
the test that runs its scenario.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/release.test.mjs:122 | A slash command the kit does not have | Only the command name is matched. The message is not checked to say the command is missing as a skill. | If `checkCommands` sent `/openspec-propose` to the "unknown command" branch and never looked in `.agents/skills`, this test still passes. The positive test at :116 catches the reverse case (an existing skill rejected), so the break that slips through is narrow. | Also assert `/not an OpenSpec skill/` (and `/not a kit command/` at :129), so the test pins which branch made the decision. |
| T2 | minor | tests/release.test.mjs:116 | Commands of the kit | Skills are looked up in the repo's installed `.agents/skills/` and not in any kit-source list of the profile. The spec says "an OpenSpec skill of the kit profile". The test is only as accurate as the installed copy. | If the installed copy ever held a skill that the profile does not include, the page could list it and still pass. | Acceptable for now: the installer has no profile list to check against. Note it in the helper comment, or point the check at a profile source if one is added later. |
| T3 | minor | tests/release.test.mjs:215 | The site workflow installs and builds in site/ | The step parser accepts only a per-step `working-directory: site` line and only the first `steps:` block in the file. | Nothing is missed today. A valid rewrite that uses job-level `defaults.run.working-directory: site` would fail the test even though the workflow is correct. | Leave as is, or also accept `defaults.run.working-directory` if the workflow is ever restructured. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
