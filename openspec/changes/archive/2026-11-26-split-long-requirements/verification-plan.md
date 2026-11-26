# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| ui-sources/inventory | Every element has a decision | Element without a decision blocks the proposal | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/ui-hooks.test.mjs`) | — |
| ui-sources/inventory | Every element has a decision | Not yet defined blocks the proposal | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/ui-hooks.test.mjs`) | — |
| ui-sources/inventory | Every element has a decision | Late element without a decision blocks the design | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/ui-hooks.test.mjs`) | — |
| ui-sources/inventory | Every element has a decision | Element without a decision blocks the archive | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/ui-hooks.test.mjs`) | — |
| ui-sources/inventory | Every element has a decision | Decisions are shown before the proposal on a new change | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Yes without screenshots stops until continue | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Empty folder on continue is asked again | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Lean asks about mockups before the proposal | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Yes on a new change waits for the developer's word | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Screenshots in place on a new change | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| ui-sources/screenshots | The AI asks whether the change has mockups | Done with an empty folder on a new change | unit | no | the kit file text (existing test in `tests/planning-protocol.test.mjs`) | — |
| workflow/autonomous-apply | Stops that remain | Requirement gap during apply | unit | no | the kit file text (existing test in `tests/apply-protocol.test.mjs`) | — |
| workflow/autonomous-apply | Stops that remain | Test still fails after two fix attempts | unit | no | the kit file text (existing test in `tests/apply-protocol.test.mjs`) | — |
| workflow/autonomous-apply | Stops that remain | Environment blocks the start during the work | unit | no | the kit file text (existing test in `tests/apply-protocol.test.mjs`) | — |
| workflow/autonomous-apply | Stops that remain | Situation outside the plan | unit | no | the kit file text (existing test in `tests/apply-protocol.test.mjs`) | — |
| workflow/autonomous-apply | Stops that remain | Test command of the file does not start | unit | no | the kit file text (existing test in `tests/test-runs-protocol.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | Application starts | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/autonomous-apply.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | Application does not answer in time | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/autonomous-apply.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | No running application needed | unit | no | the kit file text (existing test in `tests/apply-protocol.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | No instructions or no address | unit | no | the kit file text (existing test in `tests/apply-protocol.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | Early check already passed | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/start-check-early.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | Lean change keeps the check at the start of apply | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/start-check-early.test.mjs`) | — |
| workflow/environment-check | Start check at the beginning of apply | Early check was skipped | integration | no | fixture project, kit hooks or scripts run as processes (existing test in `tests/start-check-early.test.mjs`) | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Fix after the test review | unit | no | the kit file text (existing test in `tests/subagents-protocol.test.mjs`) | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Failing E2E test | unit | no | the kit file text (existing test in `tests/subagents-protocol.test.mjs`) | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Several review findings go to one subagent | unit | no | the kit file text (existing test in `tests/subagents-protocol.test.mjs`) | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Failing tests of one E2E run go to one subagent | unit | no | the kit file text (existing test in `tests/subagents-protocol.test.mjs`) | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Subagent definition allows running its E2E tests | unit | no | the kit file text (existing test in `tests/subagents-protocol.test.mjs`) | — |

## Exclusions

None.

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| ui-sources/inventory | Every element has a decision | [desc] |
| ui-sources/screenshots | The AI asks whether the change has mockups | [desc] |
| workflow/autonomous-apply | Stops that remain | [desc] |
| workflow/environment-check | Start check at the beginning of apply | [desc] |
| workflow/subagent-apply | Every code edit goes through a subagent | [desc] |

## Environment

- Only the requirement text changes; every scenario keeps its existing marked test, which must still pass.
- The goal of the change, `openspec validate --specs --strict` passing on OpenSpec 2.2.0, is checked by archiving a
  scratch copy of the repository and validating its specs (task 1.2).
- Running application: no
