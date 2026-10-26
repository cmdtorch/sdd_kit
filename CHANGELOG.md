# Changelog

All notable changes to sdd-kit. Versions follow [Semantic Versioning](https://semver.org/):
MAJOR — a change a project must act on (format of an artifact, a gate that blocks more, a removed command);
MINOR — new capability, backwards compatible; PATCH — fixes.
Before 1.0.0 a breaking change raises MINOR (0.2 → 0.3) and is marked **Breaking**.

## Unreleased

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
- Test-cases stage, after an automated pilot: a repeated AI QA review re-checks its previous findings and looks
  for new ones only in what changed, so the loop converges; cases changed after the last review run are listed
  under "Stage result" as not reviewed by the AI; the answers gate says when a follow-up question reopened the
  Specs round; follow-up questions are written without asking permission first.

## 0.4.0-beta.1 — 2026-10-25

**Pre-release for a pilot.** The test-cases stage is experimental: it has passed the kit's test suite but not yet
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
