# Test review — add-ui-sources

Verdict: READY

Input: `node openspec/tooling/bin/review-input.mjs --change add-ui-sources`. Every unit and integration scenario
has a marked test. The 10 scenarios without a test are all planned `manual` in `verification-plan.md` (pilot,
task 5.4). Three of them belong to "The AI asks whether the change has mockups". That is correct: that requirement
describes what the AI does, and no check can see it.

This is round 2 of the group 7 re-review (Q31–Q34): "The proposal waits for the mockups question", with the tests in
`tests/ui-sources.test.mjs` (describe 'the mockups question (check-answers, design D8)', :473) and
`tests/ui-hooks.test.mjs` (describe 'ui-sources/screenshots: the mockups question (hooks, design D8)', :190).

Round 1 findings, now resolved:
- **T1 (major).** `ui-sources.test.mjs:490` now builds a change with one screenshot (`01-orders-list.png`) and no
  inventory. It asserts that the inventory is absent, then that no `(UI mockups)` error is reported.
- **T2.** The CI-mode assertion that could never fail was removed from `ui-sources.test.mjs:503`.
- **T3.** The new test at `ui-sources.test.mjs:511` marks a Specs round question first and expects the error to
  remain. It then marks a Main round question and expects no error.

Mutation check of `needsMockupsQuestion` / the rule in `kit/openspec/tooling/checks/check-answers.mjs`. It ran on a
scratch copy of `kit/` + `tests/` + `fixtures/`; the repository was not touched. Without any mutation, both files
pass (108/108). Each mutation was caught:

| Mutation of the code under test | Tests that failed |
|---|---|
| the rule never runs | `ui-hooks.test.mjs:199` (blocked without the question), baseline `ui-sources.test.mjs:485`, `:511` |
| a `(UI mockups)` question is never accepted | `ui-hooks.test.mjs:205` (answered question lets the proposal through), `ui-sources.test.mjs:511` |
| the mark is accepted in any round | `ui-sources.test.mjs:511` |
| screenshots in `sources/ui/` do not turn the rule off | `ui-sources.test.mjs:490` (screenshots in the folder) |
| `ui-inventory.md` does not turn the rule off | `ui-sources.test.mjs:497` (inventory left after deleting screenshots) |
| an existing `proposal.md` does not turn the rule off | `ui-sources.test.mjs:503` (change past the proposal) |

The hook tests assert the exit code and the message. The block at :199 must match both the gate text and
`/\(UI mockups\)/`. The only difference between :205 and :199 is the answered question. The unit tests filter
errors by the mark. The baseline at :485 proves that an empty result means something.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/ui-sources.test.mjs:503 | Change past the proposal is not checked | The test name still says "in the hook mode and in the CI mode", but the CI-mode assertion was removed. | None. The name is misleading. | Rename to "an existing proposal.md turns the rule off". |
| T2 | minor | tests/ui-hooks.test.mjs:137 | Screenshots are archived with the change | The test is skipped when the pinned OpenSpec CLI is missing (`cliSkipReason()`). | On a machine without the CLI, the scenario passes without being proven. | Acceptable, because CLAUDE.md requires the CLI for `npm test`. Make sure CI installs it. |
| T3 | minor | tests/ui-sources.test.mjs:705 | Screen with only a mock element needs a design row | The THEN is "the write is blocked". It is proven at the unit level, not through a hook. | If answers-gate did not run check-ui for `verification-plan.md`, this test would not catch it. Other hook tests cover the gate's stage wiring. | Optional: add a hook test that writes `verification-plan.md`. |
| T4 | minor | tests/ui-sources.test.mjs:355, :409, :633 | Element without a variant / In scope backed only by a screenshot / Element names a scenario that does not exist | The tests use the element "open-export" where the scenarios name "export-button". | Nothing: the behaviour is the same. | Rename, or leave as is. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
