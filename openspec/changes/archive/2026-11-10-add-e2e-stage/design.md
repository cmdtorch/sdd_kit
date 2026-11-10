# Design

## Context

The kit never runs tests: checks read files, and the markers library finds `@scenario` / `@case` references in the project's test files [Q40]. The test-case stage labels cases `e2e` and the end of apply only lists them as waiting for an E2E stage [Q4]. The archive gate is the only gate after the planning artifacts [Q1]. This change adds a stage after the implementation that runs Playwright through a kit script and gates the archive on what that script recorded [Q1][Q39][Q40].

## Goals / Non-Goals

**Goals:**
- The archive trusts only results that the kit's script recorded, never results typed by the AI [Q40].
- One report format in every project, whatever its language [Q41].
- Results go stale when the code they tested changes, by the rule of Q38 and Q24 [Q38][Q24].

**Non-Goals:**
- CI, browsers other than Chromium, mobile E2E, load tests [Q11].
- Enforcing the three fix attempts or the AI's visual judgement by a check; these are protocol rules checked in the pilot [Q17][Q18].
- Keeping snapshots of built screens [Q42].

## Decisions

### D1. The stage is the last step of apply

The apply instruction of all four kit schemas ends with the E2E stage when the change needs it: after every task is done, the AI follows the new protocol `openspec/protocols/e2e.md` [Q39]. On `lean` the apply instruction first asks whether the change needs E2E [Q13]. The Main round question about E2E is added to `openspec/protocols/questions.md` for the three clarify schemas [Q3][Q21]. Rejected: a separate command or a generated task group [Q39].

### D2. The stage record `e2e.md`

Written by the AI, in the change root [Q40]:

```markdown
# E2E Stage

Mode: real backend
Tests: e2e/
Start: command `npm run e2e:serve`
Note: —

## Scenarios
- inventory/sale-export :: Successful export

## Accepted cases
- inventory/sale-export :: Export of a month with two sales — export service sandbox is down

## Screens
| Screenshot | Result | Differences | Reason |
|---|---|---|---|
| 01-orders-list.png | no differences | — | — |
| 02-orders-list-mobile.png | accepted | new header colour | approved by the designer |

## No new run needed
- 7c1e09a2 — typo fix in an export label comment
```

| Line or section | Rule | Source |
|---|---|---|
| `Mode:` | `real backend`, `stubbed backend` or `skipped` | [Q3][Q21][Q35] |
| `Tests:`, `Start:` | required unless skipped; `Start:` is `command <cmd>` or `developer at <url>` | [Q6][Q36] |
| `Note:` | optional | [Q35] |
| `## Scenarios` | `clarify` and `lean` only: the spec scenarios that get an E2E test | [Q14] |
| `## Accepted cases` | `<capability-path> :: <case or scenario name> — <reason>` | [Q9][Q30] |
| `## Screens` | UI mode only; `Result` is `no differences`, `differences` or `accepted` (reason required) | [Q20][Q31] |
| `## No new run needed` | `<state id> — <what changed>`; the state id comes from the script (D3) | [Q24] |

Rejected: results in this file, typed by the AI [Q40].

### D3. `e2e-run.mjs` runs Playwright and records the runs

`node openspec/tooling/bin/e2e-run.mjs --change <name> [-- <playwright args>]` runs `npx playwright test --reporter=json` in the `Tests:` folder, sets `E2E_BASE_URL` when the developer starts the application, and appends one entry to `e2e-runs.json` in the change [Q40][Q6]:

- `at`, `retries` (from the report's config), and per test: file, title, line, `@case` / `@scenario` references (read with the markers library), status [Q26][Q40];
- `appState`: one SHA-256 over the files outside `openspec/` and outside the test folder (the file list of the markers library: files git tracks or would track) [Q38];
- `testFiles`: SHA-256 per file of the test folder [Q38].

`--state` prints the current state id (the first 8 hex of `appState`) for `## No new run needed` [Q24]. Rejected: a fingerprint per project file per run, which grows the change by megabytes [Q38].

### D4. `check-e2e.mjs`

A new check, run by `archive-gate` and by `artifact-feedback` after `e2e.md` is written [Q1]:

| Check | When | Source |
|---|---|---|
| format of `e2e.md` (mode, tests, start, accepted reasons, screens results) | always | [Q3][Q6][Q9][Q20] |
| decision present on `clarify-ai-qa` / `clarify-qa`; absent `e2e.md` on `clarify` / `lean` means no E2E | archive | [Q2][Q13] |
| every `e2e` case (or listed scenario) has a test in the test folder | archive | [Q4][Q14] |
| every required test has a valid passed result or is accepted; `retries` is 0 | archive | [Q9][Q23][Q26][Q37] |
| a result is valid while `appState` matches the current state (or that state is listed under `## No new run needed`) and its own test file and the shared files of the folder are unchanged | archive | [Q24][Q38] |
| every inventory screenshot has a `## Screens` row with no open difference | archive, UI mode | [Q20][Q31] |

### D5. Playwright for JavaScript in its own folder

The test folder has its own `package.json` with `@playwright/test`, a `playwright.config` with `retries: 0`, Chromium only and `baseURL` from `E2E_BASE_URL` or the `webServer` command [Q41][Q26][Q11]. The AI installs it only after the developer allows it [Q7]. Test data comes from the project's means; credentials come from the tests themselves or from environment variables [Q33][Q28].

### D6. Visual check with temporary snapshots

The AI writes snapshot steps in the test folder that open each screen at the screenshot's window size and state and save the snapshot to the system temporary folder; they carry no `@case` marker and need no coverage [Q31][Q42]. The AI compares each pair by looking at both images and writes the result row [Q18][Q19][Q22][Q32].

### D7. Protocols, schemas and docs

A new protocol `openspec/protocols/e2e.md` (decision, setup, start, data, writing a test from its case, the fix loop, accepted cases, the visual check, changes after the stage, skipping) [Q1][Q8][Q27]. `testing.md` lists skipped and accepted `e2e` cases for QA at the end of apply or of the stage [Q25][Q30]. `docs/decisions.md` replaces the deferred-E2E decision; `docs/how-it-works.md` and `docs/guide/workflow.md` describe the stage [Q1].

## Risks / Trade-offs

- [Risk] The AI could edit `e2e-runs.json` by hand → the protocol forbids it and the file is reviewed in the pull request; a signature is out of scope [Q40].
- [Trade-off] The kit now runs a project tool (Playwright) for the first time; the script is only a runner, the tests stay the project's [Q40][Q41].
- [Risk] A Node.js test folder in a Python project is a second toolchain → accepted for one report format [Q41].
- [Risk] Visual judgement by the AI misses or invents differences → only clear differences count, and the developer may accept [Q22][Q20].

## Assumptions & Open Questions

None.
