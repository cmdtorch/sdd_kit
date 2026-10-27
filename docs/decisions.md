# Decision log (append-only)

The 0.1.0 log is on the `archive/v0.1` branch (`docs/decisions.md`). Decisions below replace it where they differ.

## 2026-10-18 — Restart: 0.2.0, a stack-agnostic kit

Why: 0.1.0 tied the kit to one setup (Django + pytest + Playwright presets, monorepo/split adapters, an install
wizard that asked for the stack). The owner wants one kit that any project can use as is.

| # | Decision |
|---|---|
| R1 | **No stack, no layout.** No presets, no adapters, no `verify.yaml`. The kit never runs the project's tests; the agent runs the project's own commands (README, CLAUDE.md). |
| R2 | **Markers are plain comments**: `@scenario <capability-path> :: <Scenario name>`, any language. The kit finds them by reading git-tracked and untracked (not ignored) files outside `openspec/`. |
| R3 | **Levels:** `unit`, `integration`, `manual`. **No browser E2E for now** (too heavy at this stage). |
| R4 | **No role labels on questions** (`For: Dev | PO/PM` removed). Every question is written so it can be forwarded as is; the developer decides who answers. The question protocol itself is unchanged otherwise (the owner tested it and liked it). |
| R5 | **Removed**: Stop-hook test gate, `verify.mjs` / `verification.md` / run fingerprints, weak-test heuristics for pytest/Playwright (the `test-reviewer` subagent reads tests in any language), generated GitHub workflow and `ci.mjs`, install wizard. |
| R6 | **Archive gate** checks: all tasks done; check-answers, check-grounding, check-specs, check-traceability pass; every automated scenario has a marked test; test review READY or a human decision. |
| R7 | **Backend → frontend handoff removed** (`api.mjs`, OpenAPI diff, `handoff.mjs`, `check-handoff`, stores). It ran only after the backend was finished, so the frontend still waited. To be redesigned **contract-first**: the API contract is agreed during design, and both sides start from it. |
| R8 | Kept from 0.1.0: Node ESM with zero dependencies; OpenSpec pinned to 1.13.0; the `clarify` and `lean` schemas; grounding; spec and test reviewers; answers-gate; artifact-feedback; session-start; installer with a hash manifest; the kit workflow profile (no `propose`). |

## 2026-10-25 — Fewer false scenario markers

Why: in a repository whose docs and samples show markers (the kit's own repository: 28 false hits), every hit
became a "marker names unknown scenario" warning.

| # | Decision |
|---|---|
| R9 | A marker counts only at the start of its line (indentation and a comment opener of at most five characters before it). Paths in `openspec/markers-ignore` are not scanned. The file belongs to the project: the installer never ships, updates or removes it. |

## 2026-10-25 — OpenSpec 1.15.0

Why: 1.15.0 changed the `spec-driven` instructions and templates the kit schemas fork, and how `openspec`
counts tasks; staying on 1.13.0 would keep teams on guidance upstream has since corrected.

| # | Decision |
|---|---|
| R10 | **OpenSpec pinned to 1.15.0.** The kit schemas take the 1.15.0 upstream text verbatim as a prefix (pristine copy in `fixtures/upstream/spec-driven-1.15.0/`); kit rules are unchanged. The kit follows upstream where they overlap: tasks are counted with OpenSpec's checkbox rules (only `x` is done), a MODIFIED requirement over 500 characters only warns (upstream: keep an existing requirement whole), `x-` keys of `.openspec.yaml` are allowed, the kit-only `verification-plan.md` template gets a `# Verification Plan` title like the upstream ones. Facts re-verified in `docs/openspec-facts.md`. |

## 2026-10-25 — Test-cases stage (`clarify-ai-qa`, `clarify-qa`)

Why: question rounds find gaps in requirements, but nothing made the AI think through the cases a manual QA
engineer would check; they surfaced later as QA bugs, and tests were written from the developer's point of
view. The owner wants Gherkin test cases before the code, reviewed by QA in a loop, as the common source of TDD
tests and the later E2E stage. The stage stays optional while it is tried out.

| # | Decision |
|---|---|
| R11 | **Two new schemas, `clarify-ai-qa` and `clarify-qa`**: full copies of `clarify` with a `test-cases` artifact between the specs and the design (the design requires it). `clarify-ai-qa`: the AI QA reviewer only; `clarify-qa`: the AI QA reviewer, then a human QA. They differ only in the hand-over; a test holds every shared artifact equal to `clarify`. `clarify` and `lean` are unchanged; `lean` gets no stage. Only the schema decides the flow. |
| R12 | **Clarify family.** `clarify`, `clarify-ai-qa` and `clarify-qa` are recognised by helpers in `openspec/tooling/lib/project.mjs` (`isClarifyFamily`, `hasTestCases`, `KIT_SCHEMAS`) instead of the literal `clarify` in each hook and check. |
| R13 | **`test-cases.md` format** (`openspec/protocols/test-cases.md`): `## <capability>` / `### Scenario:` / `#### Case:`, a `Labels:` line (`automated`, `e2e`, `manual`; never `unit`/`integration`), Given / When / Then with concrete data, in English; case names unique per capability. QA remarks are blockquotes with status `open` / `closed` / `reopened`; only QA closes. "Spec changes during test-case review" records every spec change; "Stage result" holds accepted findings (matched by Finding text, no IDs), `Handed over to QA` and the `Looks correct` confirmation. |
| R14 | **Gates.** `check-test-cases` checks structure and coverage; with `--stage` the completion of the stage. The answers gate blocks `design.md` until `--stage` passes; the archive gate runs the check and needs an `@case` test for every `automated` case. |
| R15 | **AI review loop limit.** At most three runs of the `test-cases-reviewer` subagent per loop, enforced by the `test-cases-run-limit` hook (counter in `reviews/test-cases-runs.json`); then the developer fixes or accepts. A scenario added after the stage is confirmed starts a new loop; QA is not asked again. |
| R16 | **Schema starter.** A `schema-starter` hook blocks `openspec new change` without `--schema` and makes the agent ask a three-choice menu (`clarify`, `clarify-ai-qa`, `clarify-qa`); the project default does not count, `lean` is not offered, the terminal is not affected. Code, not instruction text. |
| R17 | **`@case <capability-path> :: <case name>`** references in tests, with the marker placement rules. The verification plan gets a *Test case coverage* table with a level for each `automated` case. A reference to an archived change's case is silent; an unknown one is a warning. |
| R18 | **Test cases are not merged on archive**: `test-cases.md` stays in the archived change. Switching between the two test-case schemas is a manual edit of `schema:` in `.openspec.yaml`; no command. |
| R19 | **E2E stage deferred.** `e2e` cases are only listed at the end of apply, waiting for it; executable Gherkin and test-case management tools are out of scope. *Replaced by R26 (the E2E stage); executable Gherkin and test-case management tools stay out of scope.* |

## 2026-10-26 — UI screenshots as requirement sources

Why: the kit should drive frontend work too, but mockups never reached the question rounds; a button that is on
the mockup and not in the written requirements was found only during implementation or by QA. Figma's own tools
are paid, so screenshots exported by hand are the input. Change `add-ui-sources`.

| # | Decision |
|---|---|
| R20 | **UI mode by presence.** A change is in UI mode while `sources/ui/` holds a PNG, JPG/JPEG or WebP (any case); no new schema or menu choice (*the agent now asks about mockups first, R33*). Only those files and the notes file `screens.md` may sit there; anything else blocks. With every screenshot deleted the mode is off and the inventory ignored. All four kit schemas. |
| R21 | **Screenshots are sources `[U<n>]`**, registered under `## Sources` (on `lean`: in the inventory), kept in git and archived with the change, never merged into the main specs. An element is cited as `[U<n>] <element-name>`. A screenshot alone never backs an `in scope` decision. |
| R22 | **`ui-inventory.md` in Markdown** (`openspec/protocols/ui-inventory.md`): a screenshots table with SHA-256 fingerprints written by the AI (`sha256sum` / `shasum -a 256`; no kit command), one section per screen with its variants, and an element table (Element, Type, Variants, Decision, Source, Scenarios). Only interactive elements and screen states are listed. Written before the Main round questions; a hook blocks the questions without it. |
| R23 | **Five decisions**: `in scope`, `mock`, `out of scope`, `decoration`, `existing`. On the clarify family `in scope` cites `[desc]`, `[D<n>]` or an answered `[Q<n>]`; `mock`, `out of scope` and `decoration` cite an answered question of a confirmed round; `existing` cites nothing. On `lean` the AI decides without questions or citations and lists every element in the proposal. |
| R24 | **Gates in `check-ui`**, run by the answers gate before every planning artifact and by the archive gate: decisions before the proposal; a scenario for every `in scope` / `mock` element before the design (`lean`: the verification plan); a `## Screens` design row per built screen before the verification plan and tasks; screenshot links in tasks that name a screen at the archive. Late, replaced (fingerprint) and deleted screenshots block until the inventory is updated; questions about them go to the current round. |
| R25 | **`e2e` label** on every test case under a scenario of a built element (test-case schemas). Comparing the built screen with the screenshot, Figma and design tokens are out of scope. |

## 2026-10-26 — E2E stage

Why: a feature could pass every unit and integration test and still break on the user's path through the web
interface; QA found those bugs by hand. The test-case stage already labelled such cases `e2e` and left them
waiting (R19). Change `add-e2e-stage`. Replaces R19, R3's "no browser E2E" and the "comparing the built screen
with the screenshot is out of scope" part of R25.

| # | Decision |
|---|---|
| R26 | **An E2E stage, last step of apply**, on all four schemas (`openspec/protocols/e2e.md`), for a web application in a monorepo only; mobile apps, backend-only changes and frontends whose backend lives in another repository get no E2E. Decided per change by a Main round question (`real backend` / `stubbed backend` / no); on `lean` the agent asks before the first task. No separate command or generated task group. Out of scope: CI, browsers other than Chromium, mobile E2E, load tests. |
| R27 | **The kit runs Playwright, through a script.** `openspec/tooling/bin/e2e-run.mjs` is the first kit tool that runs project tests: it runs `npx playwright test --reporter=json` in the test folder and appends the run (per-test status and `@case` / `@scenario` references, retries, SHA-256 fingerprints of the application files and of each test file) to `e2e-runs.json` in the change. The archive trusts only that file, never results typed by the agent; a signature is out of scope (the file is reviewed in the pull request). R1 otherwise stands: the kit runs no other project tests. |
| R28 | **Playwright for JavaScript in its own folder** with its own `package.json`, whatever the project's language (one report format); `retries: 0` (a flaky test is a failing test), Chromium only, `baseURL` from `E2E_BASE_URL` or the `webServer` start command. Installed only with the developer's permission; a refusal skips E2E. |
| R29 | **Stage record `e2e.md`** (Markdown, written by the agent): `Mode:`, `Tests:`, `Start:` (`command <cmd>` / `developer at <url>`), `Note:`, `## Scenarios` (`clarify` / `lean`), `## Accepted cases` (reason required), `## Screens` (UI mode), `## No new run needed` (state id from `e2e-run.mjs --state`). Required on `clarify-ai-qa` / `clarify-qa` (**Breaking** for their archive); on `clarify` / `lean` its absence means no E2E. `Mode: skipped` never blocks; the `e2e` cases then go to QA as manual checks. |
| R30 | **Gate in `check-e2e`**, run by the archive gate (and in format mode by artifact feedback): every `e2e` case or listed scenario has a test in the test folder (tests elsewhere do not count) with a valid passed result or an accepted case. A result is invalidated by any application change (every test), a change to its own test file (that test) or to a shared file of the test folder (every test); a developer's "no new run needed" for the current state keeps them. The stage completes without a confirmation. |
| R31 | **Rules the checks cannot see stay protocol rules**, checked in the pilot: three fix attempts per test or screenshot, then the developer decides; a test changes only how a step is performed, never what it checks; test data created per test with the project's means on an empty test database (or in stubs), credentials never in git; rerun by itself after a business-logic change, otherwise ask. |
| R32 | **Visual check by looking.** In UI mode the agent opens every screenshot's screen at its window size and state, saves a snapshot to the system temporary folder (never in git), compares both by looking (missing / extra elements, constant texts, layout, colours, clearly different sizes; data only by format; a few pixels never count) and records a `## Screens` row; an open difference blocks the archive until fixed or accepted with a reason. No pixel diff, no stored snapshots. |

## 2026-10-26 — The mockups question (pilot feedback)

Why: in the pilot the developer did not learn that mockups could be given, so UI mode never switched on (R20
relied on the developer knowing the folder). Change `add-ui-sources`, Apply round.

| # | Decision |
|---|---|
| R33 | **The agent asks about mockups.** Without a screenshot in `sources/ui/`, the first Main round question is "Are there UI mockups for this change?", marked `(UI mockups)` and asked alone (on `lean`: in chat before the proposal). "Yes" → the agent creates `sources/ui/`, names the formats and stops until `/opsx:continue`; an empty folder then gets one more question, wait or continue without. `check-answers` blocks the first proposal while the mark is missing and the change has no screenshot and no `ui-inventory.md`; changes past the proposal and `lean` are not checked. The stop after "yes" is a protocol rule, checked in the pilot. Rejected: a question in the schema menu, whose answer is recorded nowhere. |

## 2026-10-27 — Autonomous apply after the planning rounds

Why: in the `setup-monorepo` pilot the kit handed the developer 62 manual cases and "verify by hand" tasks
that blocked the archive, and the agent worked around a remote Docker on its own. The owner wants a kit that,
after the question rounds, runs to "ready to archive" without manual tasks and never leaves the project. Change
`autonomous-after-clarify`. Replaces the "listed for a human" part of R3 and extends R6.

| # | Decision |
|---|---|
| R34 | **Protocol `openspec/protocols/apply.md`** holds the agent's conduct after planning: the only stops (requirement gap, a test failing after two attempts, a failed start check, the environment, consent, a situation outside the plan, the consent list), independent work before a stop, options suggested but not carried out, workarounds inside the application only, nothing outside the project without consent, weakening a test only with consent, the ready message. The agent never archives; the developer does. |
| R35 | **Manual checks are not tasks.** A `manual` plan row or test case needs a reason starting with `cannot be automated:` or `dangerous:` (effort is not a reason); a dangerous function (money, many users or records, irreversible changes) is tested automatically and checked by hand in addition. `check-traceability` / `check-test-cases` report a missing reason and answers-gate blocks `tasks.md` (and `design.md` on the test-case schemas). The Verification round no longer asks automate-or-manual. |
| R36 | **One report, `apply-report.md`**: "Manual checks" (for QA after the archive, dangerous first), "Not verified automatically" (with the developer's `Consent:`), "Weakened tests". Checked by `check-apply-report`; the archive gate accepts a missing test only as an agreed entry and blocks on an entry without consent. Rejected: separate files for QA and for the report. |
| R37 | **Start check** before the first task when the plan says `Running application: yes`: `start-check.mjs` starts the application with the project's command, requests one address (status below 500 within 2 minutes), stops it and records `start-check.json`, which the archive gate asks for. On failure the developer chooses (E2E: switch off / fix / skip; integration: fix / skip). The second kit tool that runs project commands, next to `e2e-run.mjs` (R27). |
| R38 | **Command guard `boundary-guard`** (PreToolUse Bash) answers "ask" for `sudo`, system and global installs, `kill` / `pkill` / `killall`, system services and Docker commands that stop or remove containers, images, volumes or networks, at every stage; `docker compose` of the project passes. The protocol rule covers what the patterns miss. |
| R39 | **Kit version stamp** `x-sdd-kit: <version>` in `.openspec.yaml`, written by artifact feedback with the first artifact of a new change (OpenSpec 1.15.0 ignores `x-` keys silently). Only stamped changes follow R35–R37; changes started earlier keep their rules. Rejected: the creation date, which breaks when a kit update and a change happen on the same day. |
| R40 | **Project tool list `openspec/project-tools`** (`<command> — <checks>` or `none`), a project file like `markers-ignore`: proposed by the agent at the first start check, written only after confirmation; doctor warns about a listed command that is missing; the installer prints doctor's result at the end. |
