<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# E2E stage protocol

Applies to changes on all four kit schemas (`clarify`, `clarify-ai-qa`, `clarify-qa`, `lean`) that need E2E. The
E2E stage is the last step of apply: after every task is done, the AI writes Playwright tests for the user paths
through the web interface, runs them with the kit's script and fixes what fails. In UI mode it also compares
every built screen with its screenshot. The archive gate waits until the stage is complete.

| Schema | Is the stage part of the workflow? |
|---|---|
| `clarify-ai-qa`, `clarify-qa` | yes, when the change needs E2E; the decision (`e2e.md`) is required, `Mode: skipped` when not needed |
| `clarify` | optional: the Main round E2E question switches it on; no `e2e.md` means no E2E |
| `lean` | optional: the AI asks before the implementation; no `e2e.md` means no E2E |

**`e2e.md` is the source of truth for the stage's decisions, and `e2e-runs.json` for its results.** The AI writes
`e2e.md`; only `node openspec/tooling/bin/e2e-run.mjs` writes `e2e-runs.json`. Results that are only said in
chat, or typed by the AI, do not count.

---

## 1. Does the change need E2E?

E2E applies only to a **web application in a monorepo**: the frontend and the backend it calls are in this
repository. A mobile application, a backend-only change, and a frontend whose backend lives in another
repository get no E2E (`Mode: skipped`).

- **Clarify family.** The Main round asks it (`openspec/protocols/questions.md` §3), one question with the
  backend choice in its options, for example:

  ```markdown
  ### Q7. Should this change get automated tests that click through the web interface in a browser, and against what?
  Why this is asked: decides whether an E2E stage runs after the implementation and how its test data is prepared.
  - A. Yes, against the real backend started locally on an empty test database
  - B. Yes, against stubbed backend responses
  - C. No, not needed for this change
  - D. Not yet defined
  - X. Other (please specify)
  ```

  Ask it on every change of a web application in a monorepo. Do not ask it when E2E cannot apply (mobile,
  backend only, backend in another repository); on the test-case schemas record `Mode: skipped` for such a
  change and say why in `Note:`.
- **`lean`.** There are no question rounds: before the first task ask the developer the same question and
  record the answer in `e2e.md` at once (§2).
- The answer maps to the mode: `real backend`, `stubbed backend` or `skipped`.

## 2. The stage record `e2e.md`

`openspec/changes/<change>/e2e.md`:

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

| Line or section | Rule |
|---|---|
| `Mode:` | `real backend`, `stubbed backend` or `skipped` |
| `Tests:` | required unless skipped: the project folder of the E2E tests (§3). Only tests in it count as E2E tests |
| `Start:` | required unless skipped: `command <cmd>` (the AI starts the application) or `developer at <url>` (§4) |
| `Note:` | optional; for a skip, a short note that E2E was skipped on purpose and why, for whoever reads the change later |
| `## Scenarios` | `clarify` and `lean` only: `- <capability-path> :: <Scenario name>`, the spec scenarios that get an E2E test (§6) |
| `## Accepted cases` | `- <capability-path> :: <case or scenario name> — <reason>` (§8) |
| `## Screens` | UI mode only: one row per screenshot; `Result` is `no differences`, `differences` or `accepted` (reason required) (§9) |
| `## No new run needed` | `- <state id> — <what changed>` (§10) |

- Headings, line labels, modes and results stay exactly as shown and in English: the kit's checks read them.
  `—` or an empty value means none; sections that do not apply may be left out.
- **When to write it.** `Mode: skipped` as soon as the decision is known. Otherwise when the stage starts (on
  `lean`: right after the question before the implementation, together with the start question of §4), with
  the mode, the test folder and the start.
- The artifact feedback hook runs the format check after every write; run it yourself with
  `node openspec/tooling/checks/check-e2e.mjs --change <change>` (`--mode archive` runs the archive checks).

## 3. Playwright

- **Playwright for JavaScript, in its own folder** with its own `package.json` and `@playwright/test`, whatever
  the project's language (one report format for every project). Name the folder in `Tests:`, e.g. `e2e/`.
- **Install only after permission.** When the project has no such folder, ask the developer before installing
  Playwright and its Chromium browser and before adding files. On a refusal write no E2E test, set
  `Mode: skipped` with a `Note:` that Playwright was not allowed, and go on as in §11.
- **Config** (`playwright.config.js` or `.ts` in the folder):
  - `retries: 0` — a test that fails once is failing; a flaky test is a failing test to fix. The archive
    refuses a run made with retries;
  - one project, Chromium only;
  - `baseURL` from the environment variable `E2E_BASE_URL` (set by the script when the developer starts the
    application), otherwise the `webServer` that runs the start command.

  ```js
  const { defineConfig, devices } = require('@playwright/test');
  const url = process.env.E2E_BASE_URL;
  module.exports = defineConfig({
    testDir: '.',
    retries: 0,
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    use: { baseURL: url || 'http://localhost:3000' },
    webServer: url ? undefined : { command: 'npm run e2e:serve', cwd: '..', url: 'http://localhost:3000', reuseExistingServer: false },
  });
  ```

- **Gitignore** Playwright's output and dependencies in the folder: `test-results/`, `playwright-report/`,
  `blob-report/`, `node_modules/`, and any saved sign-in state.

## 4. Starting the application

- At the start of the stage ask **once**: does the developer start the application and give its address, or
  does the AI start it through Playwright with the project's start command? Record the answer in `Start:` and do
  not ask again in this change, also after a failed run.
- **No start command.** When the project has no command that starts the application for E2E (on its test
  database or stubs), offer to write one into the project (a package script, a Makefile target, …), since later
  changes will need it too. Write it only after the developer agrees. On a refusal ask the developer to start the
  application and give its address, and record `Start: developer at <url>`.

## 5. Test data

- **Real backend.** The application runs on a **separate, empty test database**, never the developer's own.
  Each test creates the users and data it needs with the project's own means (fixtures, a seed script, a
  service API) before its steps. Through the interface a test performs only the steps of its case: a case that
  starts with a signed-in accountant creates the accountant first, then signs in.
- **Stubbed backend.** The data lives in the stubs (Playwright route handlers or the project's mock server).
- **Credentials never go into git.** A test creates its own password or reads it from an environment variable.
- **No way to create data** (no fixtures, script or API): ask the developer how test data may be created before
  writing the first test.

## 6. Writing the tests

- **What gets a test.**
  - Test-case schemas: every case labelled `e2e` (alone or with other labels) in `test-cases.md`.
  - `clarify` and `lean`: mark the spec scenarios that go through the interface, list them under
    `## Scenarios` with their exact capability path and name, and show the list to the developer before writing
    the tests.
- **A test follows its case.** It performs the case's Given, When and Then steps with the case's data, and
  asserts every Then on what the user sees. A test without a case of its own is a helper.
- **References** go on the lines directly above the `test(...)` call (only blank, comment and decorator lines
  in between), with the placement rules of `openspec/protocols/testing.md` §3:

  ```ts
  // @case inventory/sale-export :: Export of a month with two sales
  test('exports the two paid sales of March 2026', async ({ page }) => { /* ... */ });
  ```

  Test-case schemas use `@case <capability-path> :: <case name>`; `clarify` and `lean` use
  `@scenario <capability-path> :: <Scenario name>` for each listed scenario. A test outside the `Tests:` folder
  (a unit test with the same reference) does not count as E2E coverage.
- Put code shared by several tests (sign-in, data builders) in helper files of the folder. A change to a shared
  file makes every result invalid (§10), so keep each test's own steps in its own file where you can.

## 7. Running the tests

Run them **only** through the kit's script:

```
node openspec/tooling/bin/e2e-run.mjs --change <change>                      # every test
node openspec/tooling/bin/e2e-run.mjs --change <change> -- export.spec.ts    # one file
node openspec/tooling/bin/e2e-run.mjs --change <change> -- -g "two sales"    # by title
```

- It runs `npx playwright test --reporter=json` in the `Tests:` folder (arguments after `--` go to Playwright),
  sets `E2E_BASE_URL` for `Start: developer at <url>`, and appends the run to `e2e-runs.json` in the change:
  each test with its file, title, status and references, the retries setting, and fingerprints of the project.
  A failing run is recorded too.
- **Never edit `e2e-runs.json`** and never record a result another way: the archive trusts only this file, and
  it is reviewed in the pull request. Do not run `npx playwright test` directly for results that should count.
- A rerun of only the fixed test is enough when the fix touched only that test's file (§10).

## 8. Failing tests

- **At most three fix attempts per test**, in the application code or in how the test performs its steps. A
  flaky test is fixed like any failing one; each attempt counts. After the third failed attempt stop and show
  the developer the failure and what you tried.
- **Change only how a step is performed** (selectors, waits), never what the test checks. When the case itself
  seems wrong (it contradicts the spec, or expects 150.00 where the spec says 145.00), ask the developer which is
  right, and change the case, the spec or the code only by the answer.
- **Accepted cases.** The developer may accept a single case with a reason. Then:
  - list it under `## Accepted cases` as `- <capability-path> :: <name> — <reason>`, with the developer's reason;
  - keep its test in the project, marked as skipped (`test.skip(...)`), with the reason in a comment above it;
  - put it under "Not verified automatically" in `apply-report.md` (§12).

  Every other case or listed scenario must pass. Never skip, delete or weaken a test that is not accepted
  (`openspec/protocols/testing.md` §7).

## 9. Visual check (UI mode)

When the change has screenshots in `sources/ui/` (`openspec/protocols/ui-inventory.md`), compare **every**
screenshot with the built screen. Without screenshots there is no visual check.

1. **Snapshot steps.** Write steps in the test folder that open each screen at the screenshot's window size
   (a mobile variant at a mobile size) and in its state (an empty list, an error, a filled form), and save a
   snapshot with `page.screenshot({ path })` into the system temporary folder (`os.tmpdir()`), never into git.
   They carry no `@case` or `@scenario` reference; run them through `e2e-run.mjs` like any test.
2. **Compare by looking** at the screenshot and the snapshot together. A difference is:
   - a missing or extra element;
   - a different constant text (titles, labels, buttons, messages);
   - a different layout or order;
   - different colours;
   - clearly different sizes, spacing or fonts.

   Data (names, amounts, dates) is compared only by its format: "Test User 1" in place of "Anna Smith" is fine,
   "2026-03-12" in place of "12.03.2026" is a difference. Differences of a few pixels are not bugs.
3. **Record** one `## Screens` row per screenshot (file name as in `sources/ui/`): `no differences`, or
   `differences` with each difference named in the Differences column.
4. **Fix** a difference like a failing test: at most three attempts per screenshot, comparing again after each.
   Then show it to the developer, who may accept it with a reason: Result `accepted`, the reason in the Reason
   column. While a row says `differences`, the archive is blocked.

## 10. When the stage is complete

The stage completes by itself, without a confirmation, when the archive checks of `check-e2e` pass:

- every `e2e` case (test-case schemas) or listed scenario (`clarify`, `lean`) has a test in the `Tests:` folder
  that references it;
- its latest recorded result is `passed`, or it is under `## Accepted cases`; every run used was made with
  `retries: 0`;
- the result is still **valid**:
  - any change to a project file outside `openspec/` and outside the test folder (the application) makes every
    result invalid: run every test again;
  - a change to a test's own file makes only that test's results invalid;
  - a change to a shared file of the test folder (a file no recorded test lives in, such as a helper) makes every
    result invalid;
- in UI mode every screenshot has a `## Screens` row and none says `differences`.

**Changes after the stage** (a review fix, a late task):

- When the change touches business logic (calculations, rules, statuses, data, permissions), run the E2E tests
  again yourself, without asking.
- Otherwise (a comment, a typo, a log line) ask the developer whether to run them again. When the developer
  decides no new run is needed, get the current state id with
  `node openspec/tooling/bin/e2e-run.mjs --change <change> --state` and add
  `- <state id> — <what changed>` under `## No new run needed`. The state id covers application files only; a
  changed E2E test file always needs a new run of its tests.

## 11. Skipping E2E

When the change does not need E2E, the developer skips it on purpose, or Playwright is not allowed:

- write no E2E test, set `Mode: skipped`, and add a `Note:` when it helps a later reader (e.g.
  `Note: skipped on purpose by the developer`, `Note: Playwright not allowed`);
- tell the developer that E2E was skipped;
- the test cases and the tests below the interface stay as they are; the archive is not blocked by the stage;
- put every case labelled `e2e` under "Not verified automatically" in `apply-report.md` (§12): at the end of the
  implementation, or at the end of the stage when E2E is skipped during it. When E2E was switched off or skipped
  after a failed start check, the entries carry the developer's choice as `Consent:`
  (`openspec/protocols/apply.md` §4).

## 12. The report for QA

At the end of the stage (or of the implementation, when E2E is skipped) update `apply-report.md`
(`openspec/protocols/apply.md` §7); QA checks its entries after the archive:

- every accepted case goes under "Not verified automatically" in `apply-report.md` with its reason and a `Consent:`
  line with the developer's acceptance, so it is not asked again at the end;
- when E2E is skipped, every case labelled `e2e` goes there too, with the reason (e.g. "E2E switched off" or
  "tests were not run" and the cause); entries without a `Consent:` line go into the consent list
  (`openspec/protocols/apply.md` §8).

A change without the kit version stamp (`x-sdd-kit` in `.openspec.yaml`) has no `apply-report.md`: list these
cases for the developer as manual checks for QA, by capability and name, with the steps and the expected outcome.
