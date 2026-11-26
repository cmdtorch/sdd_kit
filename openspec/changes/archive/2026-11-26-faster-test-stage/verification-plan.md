# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| e2e/tests | E2E runs use a limited number of workers | Two workers by default | integration | no | fixture project with a stub `npx` that records its arguments | — |
| e2e/tests | E2E runs use a limited number of workers | Worker number from the environment | integration | no | fixture project with a stub `npx` that records its arguments | — |
| e2e/tests | E2E runs use a limited number of workers | Worker argument of the developer wins | integration | no | fixture project with a stub `npx` that records its arguments | — |
| e2e/tests | E2E runs use a limited number of workers | Short worker argument wins | integration | no | fixture project with a stub `npx` that records its arguments | — |
| e2e/tests | E2E runs use a limited number of workers | Invalid worker number is refused | integration | no | fixture project with a stub `npx` that records its arguments | — |
| e2e/tests | A running application is reused | Protocol config reuses the running application | unit | no | the kit file text | — |
| e2e/tests | A running application is reused | Protocol forbids E2E beside another suite | unit | no | the kit file text | — |
| e2e/tests | Only the failing tests run while they are fixed | Protocol limits reruns to the failing tests | unit | no | the kit file text | — |
| workflow/subagent-apply | The final group is run by the main agent | Final group | unit | no | the kit file text | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Fix after the test review | unit | no | the kit file text | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Failing E2E test | unit | no | the kit file text | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Several review findings go to one subagent | unit | no | the kit file text | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Failing tests of one E2E run go to one subagent | unit | no | the kit file text | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Subagent definition allows running its E2E tests | unit | no | the kit file text | — |
| workflow/subagent-apply | Progress line after each subagent | Group finished, tests pass | unit | no | the kit file text | — |
| workflow/subagent-apply | Progress line after each subagent | Full-suite subagent finished | unit | no | the kit file text | — |
| workflow/subagent-apply | Progress line after each subagent | Group finished, tests fail | unit | no | the kit file text | — |
| workflow/subagent-apply | Full suite at the end is run by the main agent | End-of-apply suite passes | unit | no | the kit file text | — |
| workflow/subagent-apply | Full suite at the end is run by the main agent | End-of-apply suite fails | unit | no | the kit file text | — |
| workflow/subagent-apply | Full suite at the end is run by the main agent | Testing protocol agrees | unit | no | the kit file text | — |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| e2e/tests | E2E runs use a limited number of workers | proposal: Clarifications |
| e2e/tests | A running application is reused | proposal: Clarifications |
| e2e/tests | Only the failing tests run while they are fixed | proposal: Clarifications |
| workflow/subagent-apply | The final group is run by the main agent | proposal: Clarifications |
| workflow/subagent-apply | Every code edit goes through a subagent | proposal: Clarifications |
| workflow/subagent-apply | Progress line after each subagent | proposal: Clarifications |
| workflow/subagent-apply | Full suite at the end is run by the main agent | proposal: Clarifications |

## Environment

- Node and the pinned OpenSpec CLI, as for `npm test`. The worker scenarios run `e2e-run.mjs` as a process
  against a stub `npx`; no browser and no Playwright are needed.
- Running application: no
