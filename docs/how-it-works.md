# How sdd-kit works — what it adds to OpenSpec

This page lists everything sdd-kit adds on top of a plain OpenSpec install, layer by layer, with the file that
implements each part. Read it to understand what this repository is; read [workflow.md](guide/workflow.md) to
learn how to use it.

Paths are given as they appear in a project after installation. In this repository the sources live under
`kit/`: `kit/openspec/…` is installed as `openspec/…`, `kit/claude/…` as `.claude/…`.

## At a glance

| Plain OpenSpec 1.15.0 | sdd-kit adds |
|---|---|
| `spec-driven` schema: proposal → specs → design → tasks → apply | `clarify` and `lean` schemas: question rounds before each artifact, a verification plan, TDD tasks; `clarify-ai-qa` and `clarify-qa` add a stage of Gherkin test cases reviewed by an AI QA reviewer (and a human QA) |
| `openspec new change` takes the project's default schema | a starter hook that makes the agent ask which schema a new change needs |
| an artifact is "done" as soon as its file exists | checks that read the content: answers, sources, specs, traceability |
| rules are text the agent may or may not follow | Claude Code hooks that block an artifact or an archive until its rules hold |
| `propose` writes every artifact in one pass | a workflow profile without `propose`, so no question round is skipped |
| no link between spec scenarios and tests | scenario markers in tests, a verification level per scenario, a test reviewer; `@case` references from tests to test cases |
| requirement sources are text | UI screenshots as sources: a UI inventory of every element and state, a decision for each, a scenario for each built one |
| no browser tests | an E2E stage after the implementation: Playwright tests of the `e2e` cases run through a kit script that records the results, and a comparison of the built screens with the screenshots |
| `openspec archive --yes` archives with open tasks | an archive gate: tasks, checks, marked tests, a test review and a complete E2E stage |
| `openspec init` / `update` | an installer that merges into existing settings, keeps local edits and uninstalls cleanly |

The kit never runs the project's tests and knows no stack. The agent runs the project's own commands. The one
exception is the E2E stage: Playwright tests in their own folder, run through the kit's script so the archive can
trust their results.

## 1. Schemas

OpenSpec lets a project define its own schemas. The kit ships four, all forked from `spec-driven`: the upstream
instruction and template text is kept verbatim at the start, and a `KIT RULES` block is appended after it.

**`openspec/schemas/clarify/schema.yaml`**, the default for new changes:

```
clarifications → proposal → specs → design → verification-plan → tasks → apply
```

- New artifacts: `clarifications.md` (questions and answers) and `verification-plan.md` (how each scenario is
  proven). Apply requires `tasks` and `verification-plan`.
- KIT RULES per artifact:
  - proposal: written only after the Main round is confirmed; every statement cites a source; scope comes only
    from confirmed answers.
  - specs: Specs round first; no source tags in spec text; stable scenario names (they are test keys); then the
    `spec-reviewer` subagent.
  - design: Design round first; always written; grounded like the proposal.
  - tasks: every task group starts with its failing tests (TDD) and every test carries a scenario marker; the
    final group runs the test review, the full test suite and the manual checks.
  - apply: tests first and seen failing; requirement gaps go to an Apply round instead of guesses; the test
    review and the full suite at the end.

**`openspec/schemas/lean/schema.yaml`**, for small and clear changes: proposal → specs → verification-plan →
tasks → apply. No question rounds; tests, markers and gates are the same. If the agent would have to guess
behaviour, it stops and suggests `clarify`.

**`openspec/schemas/clarify-ai-qa/schema.yaml`** and **`openspec/schemas/clarify-qa/schema.yaml`**, the
*test-case schemas*: `clarify` with one more artifact between the specs and the design:

```
clarifications → proposal → specs → test-cases → design → verification-plan → tasks → apply
```

- `test-cases.md`: Gherkin cases (Given / When / Then with concrete data, in English) for every spec scenario,
  each with verification labels `automated`, `e2e`, `manual` (`openspec/protocols/test-cases.md`). The design
  requires it.
- The `test-cases-reviewer` subagent reviews the cases, at most three runs per loop; the developer fixes or
  accepts what remains in the "Stage result" section of `test-cases.md`.
- `clarify-ai-qa`: the developer confirms the result. `clarify-qa`: the cases are then handed over to a human
  QA, who writes remarks in `test-cases.md` until none is open, and confirms. QA remarks may change the specs;
  every spec change of the stage is recorded in the file.
- The verification plan gets a *Test case coverage* table (a level `unit` / `integration` for each `automated`
  case) and the archive needs a test with an `@case` reference for each `automated` case. Test cases stay in
  the archived change; they are not merged into the main specs.
- Every artifact the two schemas share with `clarify` has the same instruction and template (a test holds them
  equal), and the two differ only in the hand-over to QA. Switching between them is an edit of `schema:` in
  the change's `.openspec.yaml`.
- `clarify`, `clarify-ai-qa` and `clarify-qa` form the *clarify family*: every hook and check that applies to
  `clarify` applies to all three (`openspec/tooling/lib/project.mjs`).

**UI mode, on all four schemas.** A change whose `sources/ui/` holds a screenshot (PNG, JPG, WebP) is in UI mode
(`openspec/protocols/ui-inventory.md`). Without one, the agent first asks whether the change has mockups: the
first Main round question, marked `(UI mockups)` (on `lean`: in chat before the proposal); on "yes" it creates
`sources/ui/` and waits for `/opsx:continue`; on "no" nothing changes. Each schema's instructions then add: the
UI inventory `ui-inventory.md` before the Main round questions (on `lean`: before the proposal, with the
decisions recorded by the agent and listed in the proposal); questions about the gaps between the screens and the
requirements; a scenario for every `in scope` or `mock` element; a `## Screens` table in the design; screen
names and screenshot links in UI tasks; opening the screenshots before building a screen.

**E2E stage, on all four schemas.** The last step of apply, when the change needs E2E
(`openspec/protocols/e2e.md`): a web application in a monorepo, decided per change by a Main round question
(on `lean`: the agent asks before the first task). The agent writes the stage record `e2e.md` (mode
`real backend`, `stubbed backend` or `skipped`, the test folder, who starts the application), Playwright tests
for every `e2e` test case (on `clarify` and `lean`: for the spec scenarios it lists), runs them only through
`openspec/tooling/bin/e2e-run.mjs`, fixes a failing test in at most three attempts and, in UI mode, compares
every screenshot with the built screen. On `clarify-ai-qa` and `clarify-qa` the archive needs `e2e.md`;
on `clarify` and `lean` a change without it has no E2E. `Mode: skipped` never blocks; its `e2e` cases are
listed for QA.

The templates are in `openspec/schemas/<schema>/templates/` (`openspec/schemas/clarify-ai-qa/templates/` and
`openspec/schemas/clarify-qa/templates/` also hold `test-cases.md`).

## 2. Protocols

Rules the agent reads while it works, in `openspec/protocols/`:

| File | Defines |
|---|---|
| `openspec/protocols/questions.md` | the question format (options, `Why this is asked`, `Not yet defined`); the rounds Main, Specs, Design, Verification and Apply; answer modes; mandatory analysis of the answers for vagueness and contradictions; the summary confirmed with exactly `Looks correct` |
| `openspec/protocols/grounding.md` | source tags `[Q<n>]`, `[D<n>]`, `[U<n>]` (screenshots), `[desc]`, `[assumption]` and the register of source documents |
| `openspec/protocols/testing.md` | verification levels `unit`, `integration`, `manual`; the verification plan format, incl. *Test case coverage*; scenario markers and `@case` references; what a good test asserts; the end of apply, incl. the lists of `manual` and `e2e` test cases |
| `openspec/protocols/test-cases.md` | the test-case document: format, labels, unique case names; the AI review loop; when the stage may change a spec; QA remarks and their statuses `open` / `closed` / `reopened`; "Stage result" (accepted findings, `Handed over to QA`, the `Looks correct` confirmation); late scenarios; switching between the two test-case schemas |
| `openspec/protocols/ui-inventory.md` | UI mode: screenshots in `sources/ui/` and their `[U<n>]` tags; the `ui-inventory.md` format (screenshots with SHA-256 fingerprints, screens, variants, elements); the five decisions `in scope`, `mock`, `out of scope`, `decoration`, `existing` and their sources; the Main round UI questions; late, replaced and deleted screenshots; scenario links and mock scenarios; the `## Screens` design table; screenshot links in tasks; the `lean` variant |
| `openspec/protocols/e2e.md` | the E2E stage: when a change needs E2E and the Main round question; the `e2e.md` record (mode, test folder, start, scenarios, accepted cases, screens, no new run needed); Playwright for JavaScript in its own folder with `retries: 0`, Chromium only, installed with permission; starting the application; test data on an empty test database or in stubs, credentials out of git; a test follows its case; running only through `e2e-run.mjs`; three fix attempts; accepted cases kept as skipped tests; the visual check with temporary snapshots; result validity and changes after the stage; skipping and the list for QA |
| `openspec/protocols/review-specs.md` | what the spec reviewer checks and how it reports; in UI mode also the inventory and mock scenarios |
| `openspec/protocols/review-tests.md` | what the test reviewer checks and how it reports |
| `openspec/protocols/review-test-cases.md` | what the AI QA reviewer checks (positive, error and boundary cases; a closed checklist of unusual conditions; concrete data; observable outcomes), severities, the READY rule and accepted findings |

The installer also adds a marked block to `context` in `openspec/config.yaml` (from `kit/config-fragment.yaml`),
so every OpenSpec instruction points the agent at these protocols and states the questions language.

## 3. Claude Code hooks

Registered in `.claude/settings.json` (from `kit/claude-settings.fragment.json`), merged with the project's own
hooks:

| Hook | Event | What it does |
|---|---|---|
| `openspec/tooling/hooks/answers-gate.mjs` | before Write, Edit, MultiEdit, Bash | **blocks** writing proposal, specs, design or the verification plan while its question round is unanswered or unconfirmed; on the test-case schemas also `design.md` until `check-test-cases --stage` passes. In UI mode, on all four schemas: runs `check-ui` at the stage of the artifact before the proposal, specs, test cases, design, verification plan and tasks, and blocks adding questions to `clarifications.md` until `ui-inventory.md` exists; shell writes (redirects, `tee`, `sed -i`, …) are caught too |
| `openspec/tooling/hooks/archive-gate.mjs` | before `openspec archive` | **blocks** the archive unless every task is done, every check passes, every automated scenario has a marked test and the test review is READY or has a human decision; on the test-case schemas also unless `test-cases.md` passes its check and every `automated` case has a test with its `@case` reference; in UI mode, on all four schemas, also unless `check-ui` passes in archive mode; on all four schemas unless `check-e2e` passes in archive mode (on the test-case schemas `e2e.md` is required; on `clarify` and `lean` a change without it has no E2E; `Mode: skipped` never blocks) |
| `openspec/tooling/hooks/schema-starter.mjs` | before Bash | **blocks** `openspec new change` (also through the kit wrapper) without `--schema`, and tells the agent to ask the developer a three-choice menu: no test cases (`clarify`), AI QA reviewer only (`clarify-ai-qa`), AI QA reviewer then a human QA (`clarify-qa`). The project default schema does not count; commands run in a terminal are not affected |
| `openspec/tooling/hooks/test-cases-run-limit.mjs` | before Agent / Task | counts runs of the `test-cases-reviewer` subagent per change in `reviews/test-cases-runs.json` and **blocks** a fourth run in a loop; a new loop starts for scenarios added after the stage is confirmed |
| `openspec/tooling/hooks/artifact-feedback.mjs` | after Write, Edit, MultiEdit | runs the check that matches the written artifact and hands its errors back to the agent (never blocks); in UI mode also `check-ui` after `ui-inventory.md` (base stage) and after `tasks.md` (its UI tasks without a screenshot link, found now instead of at the archive); `check-e2e` in format mode after `e2e.md`; when the last task is checked, reminds it of the end-of-apply steps |
| `openspec/tooling/hooks/session-start.mjs` | session start | where each change stands, open questions, unconfirmed rounds, task progress; warns about a wrong OpenSpec version or drifted skills |

## 4. Checks

Content checks that `openspec validate` does not do, in `openspec/tooling/checks/`. Each one runs from the
command line (`--change <name>`, `--json`) and is called by the hooks.

| Check | Verifies |
|---|---|
| `openspec/tooling/checks/check-answers.mjs` | every question is answered, every round whose artifact exists is confirmed, the file format is valid; before the first proposal of a change with no screenshot and no `ui-inventory.md`, the Main round holds the `(UI mockups)` question |
| `openspec/tooling/checks/check-grounding.mjs` | every substantive block of proposal and design carries a source tag; `[Q<n>]` only from confirmed rounds; `[U<n>]` only when registered and its file exists; assumptions only in their section |
| `openspec/tooling/checks/check-specs.mjs` | Purpose of a new capability ≥ 50 characters; ADDED requirement ≤ 500 characters; `#### Scenario:` format and unique names; a THEN in every scenario; no source tags in specs; no `###` headers OpenSpec skips |
| `openspec/tooling/checks/check-traceability.mjs` | every scenario is in the verification plan (with a level, or excluded with a reason); every requirement is traced to its sources; with `--markers`, every `unit` or `integration` scenario has a test carrying its marker; on the test-case schemas also the *Test case coverage* table and, with `--markers`, an `@case` reference for every `automated` case (a reference to an archived case is silent, an unknown one is a warning) |
| `openspec/tooling/checks/check-test-cases.mjs` | test-case schemas: every scenario has a test case and every case sits under a scenario of the delta specs; unique case names per capability; Given / When / Then; labels (in UI mode `e2e` on every case under a scenario of a built inventory element); remark statuses. With `--stage`: the stage is complete (latest AI review READY or its blocker / major findings accepted, `Looks correct`; on `clarify-qa` also `Handed over to QA` and no open remark) |
| `openspec/tooling/checks/check-ui.mjs` | UI mode, all four schemas, in stages by the artifact being written: only PNG / JPG / WebP and `screens.md` in `sources/ui/` (also when the mode is off; hidden files such as `.DS_Store` are ignored); `ui-inventory.md` exists; every screenshot registered and listed with a matching SHA-256 fingerprint, no deleted one; variants; a known decision for every element, backed by its source (clarify family); `[U<n>] <element>` citations; on `lean` the proposal names every element. From the design (`lean`: the verification plan) on: every `in scope` / `mock` element names existing scenarios. Before the verification plan and tasks: a `## Screens` row in the design for every screen with a built element. Archive: tasks naming a screen link its screenshot |
| `openspec/tooling/checks/check-e2e.mjs` | all four schemas, the E2E stage record `e2e.md`. Format mode (after `e2e.md` is written): a known mode; unless skipped, the test folder and the start (`command <cmd>` or `developer at <url>`); a reason for every accepted case and accepted difference; known screen results. Archive mode: the decision exists on the test-case schemas; unless skipped, every `e2e` case (or scenario listed under `## Scenarios`, which must exist in the delta specs) has a test in the test folder that references it, and a valid passed result recorded by `e2e-run.mjs` or an accepted case; runs made with `retries: 0`; no project file changed after the latest run unless its state is under `## No new run needed`; in UI mode every screenshot compared with no open difference |
| `openspec/tooling/checks/lint-kit.mjs` | misspelled fields in `schema.yaml`, `config.yaml` and `.openspec.yaml`, which OpenSpec ignores silently; a `context` over 50 KB, which OpenSpec drops whole |

## 5. Tests linked to scenarios

- **Markers.** A test that proves a scenario carries a comment on its own line, in any language:
  `@scenario <capability-path> :: <Scenario name>`. The kit finds markers by reading git-tracked and untracked
  files outside `openspec/`; paths listed in `openspec/markers-ignore` (the project's file) are skipped.
- **Verification plan.** Every scenario gets a level: `unit`, `integration` or `manual`, or an exclusion with a
  reason. check-traceability and the archive gate hold the plan and the markers together.
- **Case references.** On the test-case schemas a test that proves a test case also carries
  `@case <capability-path> :: <case name>`, with the same placement rules as a marker.
- **E2E runs.** `openspec/tooling/bin/e2e-run.mjs --change <name> [-- <playwright args>]` runs
  `npx playwright test --reporter=json` in the test folder named in `e2e.md` (with `E2E_BASE_URL` when the
  developer starts the application) and appends the run to the change's `e2e-runs.json`: per test its file,
  title, status and the `@case` / `@scenario` references above it, the retries setting, a SHA-256 of the
  application files (outside `openspec/` and the test folder) and one per file of the test folder (Playwright
  output and `node_modules/` skipped). A failed run is recorded too. A result stays valid until the application,
  its own test file or a shared file of the test folder changes; `--state` prints the current state id for
  `## No new run needed`. The archive trusts only this file.
- **Review input.** `openspec/tooling/bin/review-input.mjs` prints every scenario with its THEN clauses, planned
  levels and marked tests: what the test reviewer reads.

## 6. Subagents and command

| File | What |
|---|---|
| `.claude/agents/spec-reviewer.md` | after the specs: can a developer and QA start without asking anything? Writes `reviews/spec-review.md` |
| `.claude/agents/test-cases-reviewer.md` | the AI QA reviewer, on the test-case schemas after the test cases are written: would a QA engineer accept them? Writes `reviews/test-cases-review.md` (`openspec/protocols/review-test-cases.md`) |
| `.claude/agents/test-reviewer.md` | before apply ends: would each test fail if the feature broke? Every THEN asserted, specific assertions, errors asserted. Writes `reviews/test-review.md` |
| `.claude/commands/sdd/clarify.md` | `/sdd:clarify`: run or continue the question round for the current stage of a change |

The reviewers only report; the main agent fixes, and the developer decides what remains.

## 7. Working around OpenSpec

- **Workflow profile without `propose`.** `openspec/tooling/xdg/openspec/config.json` lists the kit workflows
  (new, continue, verify, explore, apply, update, sync, archive). `openspec/tooling/bin/openspec.mjs` runs
  `openspec init` / `update` with it, without reading or rewriting the developer's global OpenSpec config, and
  with telemetry off.
- **Own spec parser.** `openspec/tooling/lib/spec-parser.mjs` reads requirements and scenarios with OpenSpec's
  header rules, so the checks do not depend on `openspec show --json`.
- **Same task counting.** Tasks are counted with OpenSpec 1.15.0's checkbox rules (`openspec/tooling/lib/markdown.mjs`):
  only `[x]` is done, `[~]` or `[]` is open.
- **Pinned version.** `openspec/tooling/kit.json` holds the kit version and the one OpenSpec version it supports;
  doctor and session start warn on a mismatch.

## 8. Installer and doctor

- **`installer/sdd-kit.mjs`**: `install`, `update`, `status`, `uninstall`.
  - `installer/lib/manifest.mjs`: a sha256 manifest (`openspec/tooling/kit-manifest.json`) of every kit file,
    so an update never overwrites a file edited locally and uninstall removes only unedited kit files.
  - `installer/lib/config-edit.mjs`: inserts or replaces the kit block in `openspec/config.yaml` as text,
    keeping the user's comments.
  - `installer/lib/gitignore.mjs`: versions `openspec/` and the shared parts of `.claude/`.
  - `openspec/tooling/lib/settings-merge.mjs`: merges the kit hooks into `.claude/settings.json` and removes
    them again with the kit permissions (kit scripts and the UI fingerprint commands), leaving other hooks,
    plugins and permissions untouched.
- **`openspec/tooling/bin/doctor.mjs`**: checks Node, the OpenSpec version, Claude Code, git, edited kit files,
  hooks and skills, and prints the fix for each problem.

## Internals

Shared libraries in `openspec/tooling/lib/`, used by the checks and hooks:

| File | What |
|---|---|
| `openspec/tooling/lib/clarifications.mjs` | parser for `clarifications.md` |
| `openspec/tooling/lib/plan.mjs` | parser for `verification-plan.md`, incl. *Test case coverage* |
| `openspec/tooling/lib/spec-parser.mjs` | parser for delta and main specs |
| `openspec/tooling/lib/markers.mjs` | finds scenario markers and `@case` references in project files (or in one folder, for the E2E tests), and the references right above a test |
| `openspec/tooling/lib/test-cases.mjs` | parser for `test-cases.md` and `reviews/test-cases-review.md` |
| `openspec/tooling/lib/ui-inventory.mjs` | the `sources/ui/` folder (UI mode, accepted formats) and the parser for `ui-inventory.md` |
| `openspec/tooling/lib/e2e-record.mjs` | parser for the E2E stage record `e2e.md` |
| `openspec/tooling/lib/e2e-runs.mjs` | `e2e-runs.json`: the Playwright JSON report of a run, the fingerprints of the application and the test folder, the state id |
| `openspec/tooling/lib/reviews.mjs` | review input and review status |
| `openspec/tooling/lib/markdown.mjs` | fences, tables, task counting |
| `openspec/tooling/lib/yaml.mjs` | minimal YAML reader (no dependencies) |
| `openspec/tooling/lib/project.mjs` | finds the project root, changes and their schema; the kit schemas, the clarify family and the test-case schemas |
| `openspec/tooling/lib/report.mjs` | shared result format and command-line runner of the checks |
| `openspec/tooling/lib/hook-io.mjs` | Claude Code hook input and output |
| `openspec/tooling/lib/settings-merge.mjs` | `.claude/settings.json` merge (see §8) |

## What the kit does not do

- It does not run the project's tests; the agent does, with the project's commands.
- No backend → frontend contract step yet ([decisions](decisions.md) R7).
- No E2E in CI, in browsers other than Chromium or for mobile applications; no E2E for a frontend whose backend
  lives in another repository ([decisions](decisions.md) R26).
- It does not read mockups from Figma, handle design tokens or compare screens pixel by pixel: screenshots
  exported by hand are the only UI input, and the agent compares them with the built screens by looking.
- Claude Code only.
