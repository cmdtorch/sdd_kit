# Changelog

All notable changes to sdd-kit. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR — a change a project must act on (format of an artifact, a gate that blocks more, a removed command);
MINOR — new capability, backwards compatible; PATCH — fixes.
Before 1.0.0 a breaking change raises MINOR (0.2 → 0.3) and is marked **Breaking**.

## 0.6.1 — 2026-11-26

A faster end of apply: E2E runs that do not lag the machine, and fewer subagent starts.

The rules apply to every change stamped 0.5.0 or later, changes already in flight included: they only remove work,
so there is no new version gate.

Upgrading: team lead runs `npx github:cmdtorch/sdd_kit#v0.6.1 update`, reviews the diff (changed protocols, the
`task-implementer` agent and `e2e-run.mjs`) and commits. An existing project `playwright.config` keeps working
unchanged; it may set `reuseExistingServer: true` in its `webServer` by hand so that a running application is used
instead of a second one.

- **Two Playwright workers by default**: `e2e-run.mjs` passes `--workers=2`; the developer sets another number
  with `E2E_WORKERS` (`4`, `50%`) or with `--workers` / `-j` after `--`. An invalid `E2E_WORKERS` ends the script
  before Playwright starts, without a recorded run.
- **A running application is reused**: the Playwright config of the protocol sets `reuseExistingServer: true`;
  E2E never runs at the same time as another test suite.
- **Only the failing tests rerun while they are fixed**, by file or by title; one full run at the end proves the
  stage.
- **One fix subagent per E2E run and per test review**: the failing tests of one E2E run go to one subagent, which
  reruns only its tests through `e2e-run.mjs`, with at most three fix attempts per test; every blocker and major
  finding of one test review goes to one subagent.
- **The main agent runs the full suite** and quality checks itself, no longer a subagent, and writes the
  `full suite` progress line; a subagent is started only when a command fails, with the failing output, and after the second failed fix
  attempt the main agent stops and shows the developer the failures.

## 0.6.0 — 2026-11-25

Planning without stops: after the first answers the agent writes the rest of planning by itself and stops only
where a human is needed.

The new planning rules apply only to changes on `clarify` and `lean` created with 0.6.0 or later (stamped
`x-sdd-kit: 0.6.0`). Changes started with an older kit, and every change on `clarify-ai-qa` or `clarify-qa`, keep
the rounds, `Looks correct` and `/opsx:continue` they started with.

Upgrading: team lead runs `npx github:cmdtorch/sdd_kit#v0.6.0 update`, reviews the diff (two new hooks, `Stop` and
`UserPromptSubmit`, in `.claude/settings.json`; the new protocol; changed schemas and checks) and commits. To start
a change on a test-case schema, name it: `/opsx:new <name> --schema clarify-qa`.

- **Planning goes on by itself** (new protocol `openspec/protocols/planning.md`): after an artifact is written and
  nothing waits for the developer, the new `Stop` hook `planning-continue` keeps the agent writing the next
  artifact; no `/opsx:continue`, no setting to switch it off. It stops on a blank answer, a question asked in the
  chat, awaited screenshots, a changed answer, an artifact check that still fails after two fix attempts, or a
  pause. The developer pauses and resumes in plain words; the agent marks it with
  `node openspec/tooling/bin/planning.mjs wait|pause|resume --change <name>` (session state in the system
  temporary folder, never in the change). New `UserPromptSubmit` hook `planning-prompt` ends a wait.
- **Breaking:** `Looks correct` is removed on new changes: a round is closed when none of its answers is blank; a
  round without questions holds `No questions.`.
- **Breaking:** two rounds, Main and Technical, on new `clarify` changes: the Technical round, before the specs,
  asks about the specs' completeness and the design forks; the Specs, Design and Verification rounds are gone (the
  verification plan's decisions are recorded as assumptions). The Apply round stays.
- **Answer mode asked once** per change and recorded as `Answer mode: chat|file|discussion`.
- **Recommendations**: a question may carry `Recommended: <letters> — <reason>` when a source, an existing spec or
  the code supports it; never an answer, no "accept all". `check-answers` reports a letter that is not an option.
- **Depth levels** `low`, `medium` (default) and `high`, as `Depth:` in `clarifications.md`: how deep the agent
  investigates and what it settles itself, not how many questions it asks; every question says what depends on its
  answer; on `high` the consequences of each answer are checked.
- **Breaking:** the starter menu asks the depth level and creates the change on `clarify`; the test-case schemas
  leave the menu (`--schema clarify-qa` still works when named).
- **Changed answers**: `answers-lock.json` records the answers each artifact was written from; answers-gate blocks
  later artifacts and task check-offs while an answer differs, `check-answers` reports it, session start lists it,
  and apply starts no task until the developer restores the answer or has the artifacts updated.
- **Spec review settled by the agent**: it fixes the findings itself and asks only about requirements decisions; the
  run-limit hook allows two `spec-reviewer` runs (`reviews/spec-review-runs.json`), one more after specs rewritten
  for a changed answer.
- **Digest after the specs** (at most 15 lines, the agent's own decisions included) and, at the end of planning,
  the recommendation to start `/opsx:apply` after `/clear` or in a new chat. In UI mode the element decisions are
  shown in a message before the proposal.
- **No waiting notification** in the kit; the workflow guide recommends Claude Code's built-in notifications.
- Doctor reports the two new hooks when they are missing from `.claude/settings.json`; the kit permissions allow
  `planning.mjs`.

## 0.5.0 — 2026-11-22

Apply through subagents: one fresh subagent per task group, independent groups in parallel, verify in a
read-only subagent.

**Beta.** Subagent apply and the model setting have not finished a pilot; the plan lines, the protocol and the
report section may still change. It applies only to changes started with 0.5.0 or later; changes started with an
older kit keep the single-agent apply.

- **Subagent model setting** (beta): `x-sdd-kit-subagent-model: <value>` at the top level of `openspec/config.yaml`
  chooses the model of the implementation subagents (`opus`, `sonnet`, `haiku`, `fable`, `inherit` or a full model
  ID starting with `claude-`); `node openspec/tooling/bin/subagent-model.mjs` prints the model to pass, doctor warns
  about an unknown value, lint-kit accepts the key, and a kit update keeps the line.
- **Version gate for subagent apply**: only changes stamped 0.5.0 or later (a pre-release such as `0.5.0-beta.1`
  counts) are implemented and verified through subagents; older and unstamped changes keep the single-agent apply.
- **Subagent apply** (beta, changes stamped 0.5.0 or later): new protocol `openspec/protocols/subagents.md`; the
  main agent hands every task group before the final one to a new subagent, runs independent groups in parallel,
  checks the changed files against `git status`, edits no project code itself and runs verify in a subagent.
- **Agents `task-implementer` and `change-verifier`** in `.claude/agents/`: the implementation subagent of apply
  and the read-only verify subagent.
- **Plan lines in tasks**: the `tasks` instruction of all four schemas asks for `Depends on:` / `Area:` /
  `Shared:` under every task group, at most 5 tasks per group and a final group depending on all others; no check
  reads them. The `apply` instruction points to the subagents protocol.
- **`## Subagent runs` in `apply-report.md`**: an optional section, one line per subagent run; never checked.

## 0.4.0 — 2026-11-10

Test cases, UI screenshots, an E2E stage, autonomous apply and meta-repositories.

**Beta.** The test-case schemas `clarify-ai-qa` and `clarify-qa` are beta: the schema menu and their
descriptions say so. UI screenshots, the E2E stage, autonomous apply and meta-repositories are new in this
release and have had only partial pilots; their formats and gates may change in a later 0.x release.
`clarify` and `lean` are stable.

Upgrading:

1. Team lead: `npx github:cmdtorch/sdd_kit#v0.4.0 update`, review the diff (new hooks in `.claude/settings.json`,
   new protocols and checks), commit. For a meta-repository add `--metarepo <clone paths>`.
2. Active changes finish under the rules they started with: autonomous apply and the meta-repository rules apply
   only to changes created with 0.4.0 (stamped in `.openspec.yaml`).
3. From 0.3.0: in Claude Code `openspec new change` without `--schema` now opens the schema menu (see 0.4.0-beta.1
   below, which is part of this release). From 0.4.0-beta.1: active `clarify-ai-qa` / `clarify-qa` changes need
   `e2e.md` before the archive (see **Breaking** below).

**Meta-repositories** (`openspec/protocols/metarepo.md`): a root with the kit and application clones in
sub-folders, each with its own git, listed in the new project file `openspec/clones` (`repos/backend` or
`name=path` per line). Projects without the file, and changes started before it existed, work as before.

- Marked tests and `@case` references are found inside the clones, read by each clone's own git rules (without
  its `openspec/` and `.claude/`); the review input, the archive gate and the E2E run fingerprints see them too.
- Changes started in a meta-repository are marked `x-sdd-kit-metarepo: true` and follow its rules: a
  *Repository* column in the verification plan (a marked test is needed in each named repository) and the new
  level `e2e`; every task group names one repository, `## 2. [backend] Order API` (new check `check-tasks`;
  `tasks.md` is blocked otherwise); `apply-report.md` gets one `## Repository: <name>` section with `Command:`
  and `Result:` per repository of the task groups; a missing clone the change names blocks its archive.
- E2E: the clones count as one web application; the E2E question is asked only for changes that touch the web
  interface; E2E tests live in a root folder outside every clone.
- answers-gate blocks writes into a declared clone's own `openspec/` from a session started in the root.
- Installer: in a terminal `install` asks "meta-repository or single repository" and the clone paths; new option
  `--metarepo [<entries>]` (comma-separated) for unattended installs and to add clones on `update`. Uninstall
  keeps `openspec/clones`; nothing is written inside a clone.
- Doctor reports clone list errors, warns about missing clones and offers undeclared nested repositories (asking
  in a terminal, printing the line otherwise).
- The archive gate names the open tasks instead of only counting them.

**Autonomous apply** (`openspec/protocols/apply.md`), for changes created with this kit version (the kit
records `x-sdd-kit: <version>` in a new change's `.openspec.yaml`; older changes finish under their old rules):

- After the planning rounds apply runs to the end without the developer: every task, the test review, the full
  suite and the E2E stage. The agent stops only on a requirement gap, a test that still fails after two
  attempts, a failed start check or a blocked environment, an action that needs consent, a situation the plan
  does not cover, and the consent list at the end. It suggests options in a stop but carries out none until the
  developer chooses, works around problems only inside the application, and never archives by itself.
- Manual checks are no longer tasks: a `manual` plan row (new *Manual reason* column) or test case
  (`Manual reason:` line) needs a reason starting with `cannot be automated:` or `dangerous:`; dangerous
  functions are tested automatically and checked by hand in addition. A missing reason blocks `tasks.md` (on the
  test-case schemas `design.md`). The Verification round no longer asks whether a check should stay manual.
- New report `apply-report.md` ("Manual checks" for QA after the archive, "Not verified automatically",
  "Weakened tests"), checked by the new `check-apply-report`; the archive gate accepts a missing test only as an
  entry the developer agreed to (`Consent:`), and blocks on entries without consent. Weakening a test needs the
  developer's consent.
- New script `openspec/tooling/bin/start-check.mjs`: when the plan says `Running application: yes`, the agent
  starts the application before the first task, requests one address and stops it (`start-check.json`); on
  failure the developer chooses how to go on.
- New hook `boundary-guard`: asks the developer before commands outside the project (`sudo`, system and global
  installs, `kill`, Docker commands that stop or remove containers, volumes or networks).
- Project tool list `openspec/project-tools`: doctor warns about a missing listed tool, and the installer prints
  doctor's result at the end.
- `start-check.mjs` and `check-apply-report.mjs` are allowed without a prompt.

**Breaking:** on `clarify-ai-qa` and `clarify-qa` the archive now needs `e2e.md`, the E2E decision of the change.
For a change without E2E write `e2e.md` with `# E2E Stage` and `Mode: skipped`; active changes on these schemas
need it before they can be archived. `clarify` and `lean` changes without `e2e.md` archive as before.

- E2E stage (`openspec/protocols/e2e.md`), on all four schemas, for web applications in a monorepo: the last step
  of apply. The Main round asks whether the change needs E2E and against which backend (real, on an empty test
  database, or stubbed); on `lean` the agent asks before the first task. The agent records the stage in `e2e.md`,
  installs Playwright (JavaScript, its own folder, Chromium only, `retries: 0`) only with permission, asks once
  who starts the application, writes a Playwright test for every `e2e` test case (on `clarify` and `lean`: for
  the spec scenarios it lists), fixes a failing test in at most three attempts, and lets the developer accept a
  case with a reason. In UI mode it compares every screenshot with the built screen. Skipped E2E lists the `e2e`
  cases for QA. New script `openspec/tooling/bin/e2e-run.mjs` runs Playwright and records every run in the
  change's `e2e-runs.json` (the only results the archive trusts; results go stale when the application or the
  test changes); new check `check-e2e`, run by the archive gate and, in format mode, after `e2e.md` is written.
  The script and the check are allowed without a prompt.
- UI screenshots as requirement sources, on all four schemas: PNG, JPG or WebP files in a change's `sources/ui/`
  switch it into UI mode (`openspec/protocols/ui-inventory.md`). The agent writes `ui-inventory.md` (screens,
  interactive elements, states, SHA-256 fingerprints) before the Main round questions and asks about the gaps
  between the screens and the requirements; every element gets a decision (`in scope`, `mock`, `out of scope`,
  `decoration`, `existing`) and every built element a scenario. New check `check-ui`, run by the answers gate
  and the archive gate; `[U<n>]` source tags; `e2e` labels on UI test cases; a `## Screens` table in the design
  and screenshot links in UI tasks. Changes without screenshots get only the mockups question below. The artifact feedback hook
  shows `check-ui` errors right after `ui-inventory.md` or `tasks.md` is written; hidden files such as
  `.DS_Store` in `sources/ui/` are ignored; `sha256sum` and `shasum -a 256` are allowed without a prompt.
  Without screenshots the agent first asks whether the change has mockups (`(UI mockups)`, the first Main round
  question; on `lean` in chat); on "yes" it creates `sources/ui/` and waits for `/opsx:continue`.
- E2E runs record each test file by its project path also when the project is reached through a symlink (the
  macOS temp folder, a symlinked home folder); before, such a file was recorded as `../…` and never matched its case.
- Test-cases stage, after an automated pilot: a repeated AI QA review re-checks its previous findings and looks
  for new ones only in what changed, so the loop converges; cases changed after the last review run are listed
  under "Stage result" as not reviewed by the AI; the answers gate says when a follow-up question reopened the
  Specs round; follow-up questions are written without asking permission first.

## 0.4.0-beta.1 — 2026-10-25

**Pre-release for a pilot**, included in 0.4.0. The test-cases stage is experimental: it has passed the kit's test suite but not yet
a pilot on a real project. Formats and gates may change before 0.4.0.

**Breaking:** in Claude Code, `openspec new change` without `--schema` is now blocked until the developer picks a
schema from the starter menu (a terminal is not affected).

Upgrading from 0.3.0:

1. Team lead: `npx github:cmdtorch/sdd_kit#v0.4.0-beta.1 update`, review the diff (two new hooks in
   `.claude/settings.json`), commit.
2. Active `clarify` changes keep working as before; nothing to migrate.

Changes:

- Test-cases stage (optional): two new schemas, `clarify-ai-qa` and `clarify-qa`, are `clarify` plus a
  `test-cases` artifact. Gherkin test cases are written after the specs and before the design, one or more per
  spec scenario, each labelled `automated`, `e2e` and/or `manual`. Protocol: `openspec/protocols/test-cases.md`.
- AI QA reviewer: the `test-cases-reviewer` subagent (`openspec/protocols/review-test-cases.md`) reviews the test
  cases; a hook limits it to three runs per loop, then the developer decides. On `clarify-qa` a human QA reviews
  next, with remarks (`open` / `closed` / `reopened`) in `test-cases.md` until none is open.
- `check-test-cases.mjs`: structure, scenario coverage, labels, Given/When/Then and remark statuses; with
  `--stage`, completion of the stage. The design and the archive are blocked until it passes.
- `@case <capability-path> :: <case name>` markers and a "Test case coverage" table in the verification plan;
  `check-traceability --markers` requires a marked test for every `automated` case.
- Schema starter: a hook makes the agent ask which schema to use (`clarify`, `clarify-ai-qa`, `clarify-qa`) when
  a change is created without one.
- `docs/how-it-works.md`: what the kit adds to OpenSpec, part by part, with the file behind each part. A test
  keeps it complete.

## 0.3.0 — 2026-10-25

**Breaking:** the archive gate blocks more (a `- [~]` or `- []` task is now open), and the pinned OpenSpec CLI is
1.15.0.

Upgrading from 0.2.0:

1. Every developer: `npm i -g @fission-ai/openspec@1.15.0`.
2. Team lead: `npx github:cmdtorch/sdd_kit#v0.3.0 update`, review the diff, commit.
3. If your docs or sample code show `@scenario` markers, list those paths in `openspec/markers-ignore`.

Changes:

- `openspec/markers-ignore` (the project's file): paths where the kit does not look for scenario markers,
  e.g. documentation or sample code that shows them.
- A marker counts only when it starts its line (after indentation and a comment opener), as `testing.md` §3
  already required. Markers mentioned in prose or inside string literals are no longer picked up.
- OpenSpec CLI pinned to **1.15.0** (was 1.13.0). Every developer runs `npm i -g @fission-ai/openspec@1.15.0`;
  doctor and session start warn until they do. The `clarify` and `lean` schemas are re-based on the 1.15.0
  `spec-driven` text (kit rules unchanged); what the agent is now told:
  - proposal: name each new capability for a durable behaviour (`user-auth`), not for the work (`add-login-endpoint`);
  - specs: write the spec files one at a time; keep each requirement description to 500 characters
    (`validate --strict` fails on longer ADDED requirements); never trim an existing requirement under MODIFIED;
  - tasks: only an `x` box is done (`[~]`, `[-]`, `[]` are open); each task group lands its own tests and
    docs; steps that need the archived change go to a `## Workflow follow-up` section of plain bullets;
  - templates start with a title: `# Proposal`, `# Spec Delta`, `# Design`, `# Tasks`, and the kit's
    `# Verification Plan`.
- The archive gate, session start and the "all tasks checked" reminder count tasks as OpenSpec 1.15.0 does:
  a `- [~]` or `- []` task is not done, `+` and `1.` list items count, plain bullets do not.
- check-specs: a MODIFIED requirement over 500 characters is a warning, no longer an error (ADDED stays an error).
- lint-kit: `x-` keys in a change's `.openspec.yaml` (e.g. `x-jiraKey`) are allowed, as in OpenSpec 1.15.0.
- Installer: `--version` prints the kit version and the pinned OpenSpec version.
- doctor: the restore and update commands it suggests name the installed kit version (`#v<version>`), so they
  never pull a newer kit by accident.
- Released under the MIT license. The repository now has `CONTRIBUTING.md`, `SECURITY.md`, issue and pull request
  templates, CI on Linux and macOS with Node 20 and 22, and a release workflow that publishes the notes below
  each version as a GitHub release.

## 0.2.0 — 2026-10-18

The kit no longer depends on the project's stack or layout. **Breaking** for projects on 0.1.0.

- Removed: stack presets (`django`, `playwright`, the pytest plugin), topology adapters (`monorepo`, `split`),
  `verify.yaml`, `verify.mjs` and `verification.md`, the Stop-hook test gate, browser E2E, the frontend handoff
  (`api.mjs`, `handoff.mjs`, `check-handoff`, stores), the generated GitHub workflow and `ci.mjs`, the install wizard.
- Scenario markers are plain comments in any language: `@scenario <capability> :: <Scenario name>`. The kit finds
  them by reading the project files and never runs tests; the agent runs the project's own test commands.
- Verification levels are `unit`, `integration`, `manual`.
- Clarifying questions no longer carry `For: Dev | PO/PM`: every question is written so it can be forwarded to
  whoever knows the answer.
- The archive gate checks: all tasks done, kit checks pass, every automated scenario has a marked test, test review.

## 0.1.0 — 2026-10-04

First version, ready for the pilot.

- Schemas `clarify` (features, question rounds) and `lean` (small changes), forked from OpenSpec 1.13.0 `spec-driven`.
- Protocols: questions, grounding, testing, handoff, spec review, test review.
- Checks: answers, grounding, specs, traceability, verification, handoff, lint-kit; CI entry point `ci.mjs`.
- Hooks: answers-gate, archive-gate, test-gate (Stop), artifact-feedback, session-start.
- `verify.mjs` (verification matrix from real test results), `api.mjs` (API baseline and diff), `handoff.mjs`
  (frontend import), `review-input.mjs`, `doctor.mjs`, `openspec.mjs` (kit profile wrapper).
- Subagents `spec-reviewer`, `test-reviewer`; command `/sdd:clarify`.
- Presets `django` (pytest plugin, drf-spectacular), `playwright`; adapters `monorepo`, `split`.
- Installer: install / update / status / uninstall with a manifest of hashes; GitHub Actions workflow (`--ci`).
