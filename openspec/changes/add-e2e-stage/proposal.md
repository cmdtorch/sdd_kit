# Proposal

## Why

The kit stops at unit and integration tests, so a feature can pass every test and still break on the user's path through the web interface; QA finds those bugs by hand [desc]. The test-case stage already marks the cases that need that path with the `e2e` label and leaves them waiting for an E2E stage, which this change adds, with Playwright for web applications [desc][Q4].

## What Changes

- A new E2E stage runs after the implementation and before the archive; the archive is blocked until the stage is complete, which happens by itself when the latest run is green apart from accepted cases [Q1][Q23][desc].
- The stage is part of the test-case workflows (`clarify-ai-qa`, `clarify-qa`) whenever the change needs E2E; in `clarify` and `lean` it is optional [Q2].
- Whether a change needs E2E is decided per change by a Main round question: a web application in a monorepo needs it; a mobile application, a backend-only change or a frontend whose backend lives in another repository does not [Q3][Q5][desc]. The same question decides whether the tests run against a real backend started locally or against stubbed backend responses [Q21].
- In `clarify` the developer switches E2E on with that same question; in `lean`, which has no question rounds, the AI asks before the implementation [Q13].
- On the test-case workflows the stage runs every case labelled `e2e`; without test cases the AI marks the spec scenarios that go through the interface and shows the list to the developer [Q4][Q14][desc].
- Tests are written with Playwright; when the project has none, the AI installs and configures it after asking the developer's permission [Q7][desc].
- At the start of the stage the AI asks once whether the developer starts the application or the AI starts it through Playwright with the project's command [Q6][Q16].
- With a real backend the application runs on a separate empty test database and each test creates its users and data with the project's own means; through the interface a test performs only the steps of its case; with stubs the data lives in the stubs [Q33][Q28].
- A failing test is fixed by the AI, at most three attempts per test, then shown to the developer; the developer may accept a single case with a reason recorded in the change, and every other case must pass [Q8][Q9][Q17].
- When the change has UI screenshots, the stage compares each built screen with its screenshot: the AI looks at both images for missing or extra elements, different texts, layout, colours, and clearly different sizes, spacing and fonts; differences of a few pixels are not bugs [Q11][Q18][Q19][Q22].
- A difference from the screenshot is handled like a failing test: the AI fixes it with the same three attempts, the developer may accept it with a reason, otherwise the archive stays blocked [Q20].
- Out of scope: running E2E in CI, browsers other than Chromium, E2E for mobile applications, load and performance tests [Q11].

## Capabilities

### New Capabilities
- `e2e/stage`: when a change needs the E2E stage, where it sits in each workflow, the stage record, when the stage is complete, skipped E2E, project changes after the stage, and the archive gate [Q1][Q2][Q3][Q5][Q9][Q13][Q21][Q23][Q24][Q25][Q34]
- `e2e/tests`: which cases or scenarios get an E2E test, Playwright setup, starting the application, test data, the link from each test to its case, and the fix loop for failing tests [Q4][Q6][Q7][Q8][Q14][Q16][Q17][Q26][Q27][Q30][Q33]
- `e2e/visual-check`: comparing built screens with the UI screenshots, what counts as a difference, and how differences are fixed or accepted [Q11][Q18][Q19][Q20][Q22]

### Modified Capabilities

None.

## Impact

| Area | Change |
|---|---|
| Kit schemas `clarify`, `clarify-ai-qa`, `clarify-qa`, `lean` | the Main round E2E question, the stage after the implementation [Q1][Q2][Q3][Q13] |
| Kit protocols | a protocol for the E2E stage; testing rules for `e2e` cases [Q4][Q8][Q9] |
| Kit checks and hooks | the archive gate waits for a complete E2E stage; coverage of `e2e` cases by tests [Q1][Q4] |
| Projects that use the kit | Playwright is added to a web project on the first E2E stage, with permission [Q7] |
| Kit docs | `docs/how-it-works.md`, the workflow guide, the decision log (replaces the deferred-E2E decision) [Q1] |
| Success measure | a pilot on a real web project: every `e2e` case has a passing test and QA finds no bug in the covered scenarios [Q12] |

## Assumptions & Open Questions

- The visual comparison runs only in changes with screenshots (UI mode, `sources/ui/`) [assumption]
- E2E tests live with the project's tests and reference their case with `@case`, so the kit can check coverage [assumption]
- The stage record (decision, runs, accepted cases and differences) is one file in the change, like the test-case stage result [assumption]
