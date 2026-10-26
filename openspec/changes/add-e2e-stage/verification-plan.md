# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| e2e/stage | Each change decides whether it needs E2E | Web change in a monorepo gets the E2E question | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/stage | Each change decides whether it needs E2E | Lean change is asked before the implementation | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/stage | Each change decides whether it needs E2E | Unknown mode is reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/stage | The stage record names the E2E tests and the application | Missing test folder is reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/stage | The stage record names the E2E tests and the application | Developer start without an address is reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/stage | The stage runs after the implementation and gates the archive | Archive is blocked before the first E2E run | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | The stage runs after the implementation and gates the archive | Failing case blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | The stage runs after the implementation and gates the archive | Green run with an accepted case allows the archive | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | The stage runs after the implementation and gates the archive | Test-case change without an E2E decision blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | The stage runs after the implementation and gates the archive | Clarify change without E2E archives as before | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | The stage runs after the implementation and gates the archive | Lean change without E2E archives as before | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Test results stay valid until the code they tested changes | Rerun of a test fixed in its own file completes the stage | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Test results stay valid until the code they tested changes | Shared E2E helper change needs every test again | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Test results stay valid until the code they tested changes | Application fix needs every test again | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Skipped E2E is marked and listed for QA | Skipped E2E does not block the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Skipped E2E is marked and listed for QA | Developer skips E2E on purpose | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/stage | Skipped E2E is marked and listed for QA | Skipped E2E lists the e2e cases for QA | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/stage | Project changes after the stage are caught | Code changed after the stage blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Project changes after the stage are caught | Developer decides no new run is needed | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/stage | Project changes after the stage are caught | Business logic change is run again | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/stage | Project changes after the stage are caught | Minor change asks the developer | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Every e2e case gets an E2E test | E2E case without a test blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/tests | Every e2e case gets an E2E test | Listed scenario without a test blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/tests | Every e2e case gets an E2E test | Listed scenario that does not exist is reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/tests | Every e2e case gets an E2E test | Unit test does not count as E2E coverage | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/tests | Every e2e case gets an E2E test | Case that is not e2e needs no E2E test | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/tests | Playwright is installed with permission | Playwright is installed after permission | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Playwright is installed with permission | Permission refused skips E2E | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | The application is started as the developer chooses | The start question is asked once | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | The application is started as the developer chooses | Missing start command is offered | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | The application is started as the developer chooses | Refused start command falls back to the developer | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Tests prepare their own data | Test creates its user before the case steps | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Tests prepare their own data | Credentials stay out of git | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Tests prepare their own data | Project without a way to create data | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | A test follows its case | Wrong case is asked about | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Failing tests are fixed in at most three attempts | Automatic retries are reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/tests | Failing tests are fixed in at most three attempts | Third failed attempt goes to the developer | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/tests | Failing tests are fixed in at most three attempts | Accepted case without a reason is reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |
| e2e/tests | Accepted cases stay as skipped tests for QA | Accepted case is listed for QA | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/visual-check | Every screenshot is compared with the built screen | Screenshot without a comparison blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/visual-check | Every screenshot is compared with the built screen | Change without screenshots needs no visual check | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/visual-check | Every screenshot is compared with the built screen | Mobile screenshot is compared at its size | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/visual-check | Every screenshot is compared with the built screen | Empty-state screenshot is compared in that state | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/visual-check | What counts as a difference | Missing button is a difference | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/visual-check | What counts as a difference | Different sample data is not a difference | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/visual-check | What counts as a difference | Different data format is a difference | manual | no | pilot on a real web project (monorepo, Playwright not yet installed) |
| e2e/visual-check | Differences are fixed or accepted | Open difference blocks the archive | integration | yes | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/visual-check | Differences are fixed or accepted | Accepted difference allows the archive | integration | no | temp project from a fixture, fake `npx playwright` on PATH emitting a JSON report, `e2e-run.mjs` and archive-gate run as processes |
| e2e/visual-check | Differences are fixed or accepted | Accepted difference without a reason is reported | unit | no | temp change with `e2e.md`, delta specs, `e2e-runs.json` written by the test |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| e2e/stage | Each change decides whether it needs E2E | [Q2][Q3][Q5][Q13][Q21][desc] |
| e2e/stage | The stage record names the E2E tests and the application | [Q6][Q36][Q40] |
| e2e/stage | The stage runs after the implementation and gates the archive | [Q1][Q9][Q23][Q37][Q39] |
| e2e/stage | Test results stay valid until the code they tested changes | [Q24][Q38][Q40] |
| e2e/stage | Skipped E2E is marked and listed for QA | [Q25][Q29][Q34][Q35] |
| e2e/stage | Project changes after the stage are caught | [Q24] |
| e2e/tests | Every e2e case gets an E2E test | [Q4][Q14][desc] |
| e2e/tests | Playwright is installed with permission | [Q7][Q11][Q29][Q41] |
| e2e/tests | The application is started as the developer chooses | [Q6][Q16][Q36] |
| e2e/tests | Tests prepare their own data | [Q28][Q33] |
| e2e/tests | A test follows its case | [Q27] |
| e2e/tests | Failing tests are fixed in at most three attempts | [Q8][Q9][Q17][Q26] |
| e2e/tests | Accepted cases stay as skipped tests for QA | [Q30] |
| e2e/visual-check | Every screenshot is compared with the built screen | [Q11][Q31][Q42] |
| e2e/visual-check | What counts as a difference | [Q18][Q19][Q22][Q32] |
| e2e/visual-check | Differences are fixed or accepted | [Q20] |

## Environment

- `npm test` with the pinned OpenSpec CLI; no browser: a fake `npx` placed first on PATH answers `playwright test --reporter=json` with a prepared report (passing, failing, `retries: 2`) [Q43].
- Temp projects are git repositories, so the app-state fingerprint uses the same file list as the markers library; tests change a project file between runs to cover stale results [Q38].
- Manual rows run in the pilot on a real web monorepo with a test-case schema and UI screenshots, Playwright not installed beforehand; the pilot is the last task and the archive waits for it [Q44][Q12].
