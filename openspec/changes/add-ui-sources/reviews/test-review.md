# Test review — add-ui-sources

Verdict: READY

Input: `node openspec/tooling/bin/review-input.mjs --change add-ui-sources`. Every unit and integration scenario
has a marked test. The 7 scenarios without a test are all planned `manual` in `verification-plan.md` (pilot).

Group-2 check (coverage and implementation scenarios that were never seen failing). Each one was mutation-tested
on a scratch copy of `kit/` + `tests/` + `fixtures/` (the repository was not touched). For every mutation the marked
test failed:

| Mutation of the code under test | Marked tests that failed |
|---|---|
| `checkScenarios` treats every decision as built | `ui-sources.test.mjs:596` (not built need no scenario) |
| `checkScenarios` skips `mock` elements | `ui-hooks.test.mjs:386` (mock blocks the design) |
| scenario existence check removed | `ui-sources.test.mjs:568` (scenario does not exist) |
| `checkScenarios` disabled | `ui-hooks.test.mjs:366`, `:374`, `:386`, `ui-sources.test.mjs:568` |
| `checkScreens` requires a row only for `in scope` screens | `ui-sources.test.mjs:640` (mock-only screen) |
| `checkScreens` requires a row for every screen | `ui-sources.test.mjs:655` (nothing to build) |
| `checkScreens` disabled | `ui-hooks.test.mjs:395`, `:403`, `ui-sources.test.mjs:640` |
| task accepts a link to any screenshot | `ui-sources.test.mjs:699` (another screen's screenshot) |
| `checkTaskLinks` disabled | `ui-hooks.test.mjs:410`, `ui-sources.test.mjs:683`, `:699` |
| `e2e` label check disabled | `ui-sources.test.mjs:736` |

The THEN text is asserted, not only the exit code. Every hook block goes through `blocked()`, which checks exit 2
and the message regexes. The unit errors go through `assertCaught()`, which checks the message. Examples:
`/element "export-button".*names no scenario/`, `/element "open-export".*"Export starts".*not in the change's delta specs/`,
`/screen "share-dialog"/`, `/task "2\.1 Build the \`export-modal\` dialog" names the screen "export-modal".*links no screenshot/`,
``/test case "Click export".*"open-export".*`e2e` label is required/``. Most error tests also pin the number
of errors, and some pin the line.

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | minor | tests/ui-sources.test.mjs:330 | Desktop and mobile screenshots form one screen | Only "no error" is asserted. The THEN "the element is marked as shown in both variants" is asserted only in the unmarked parser test at :180. | If the parser dropped the variants of a two-variant screen and the variant check went quiet with it, this marked test would still pass. The paired test at :337 limits the risk. | In this test, also assert `parseInventory(...)` gives `variants` `['desktop','mobile']` for the element. |
| T2 | minor | tests/ui-hooks.test.mjs:239 | Screenshots are archived with the change | The test is skipped when the pinned OpenSpec CLI is missing (`cliSkipReason()`). | On a machine without the CLI, the scenario passes without being proven. | This is acceptable because CLAUDE.md requires the CLI for `npm test`. Make sure CI installs it. |
| T3 | minor | tests/ui-sources.test.mjs:641 | Screen with only a mock element needs a design row | The THEN is "the write is blocked". The test proves it at the unit level through `uiStageFor('clarify','verification-plan')`, not through a hook. | If answers-gate did not run check-ui for `verification-plan.md`, this would be missed. Other hook tests (:395 tasks, :383 lean plan) cover the gate's stage wiring. | Optional: add a hook test that writes `verification-plan.md`. |
| T4 | minor | tests/ui-sources.test.mjs:337, :391, :569 | Element without a variant / In scope backed only by a screenshot / Element names a scenario that does not exist | The tests use the element "open-export" where the scenarios name "export-button". | Nothing: the behaviour is the same. This is only a mismatch with the scenario text. | Rename, or leave as is. |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
