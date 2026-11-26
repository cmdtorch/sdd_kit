# Tasks

## 1. Pin OpenSpec 2.2.0 and re-base the kit schemas

Depends on: none
Area: fixtures/upstream/, kit/openspec/schemas/, kit/openspec/tooling/kit.json, kit/openspec/tooling/xdg/, tests/helpers/openspec.mjs, tests/schemas.test.mjs, tests/release.test.mjs, tests/hooks.test.mjs
Shared: settings

- [x] 1.1 Install OpenSpec 2.2.0 into a scratch folder for the tests (`OPENSPEC_BIN`), replace `fixtures/upstream/spec-driven-1.15.0/` with a byte copy `spec-driven-2.2.0/` of the 2.2.0 built-in schema, and verify `diff -r` against the package's `schemas/spec-driven` is empty
- [x] 1.2 Raise `PINNED_VERSION` in `tests/helpers/openspec.mjs` and `openspecVersion` in `kit/openspec/tooling/kit.json` to 2.2.0, run `tests/schemas.test.mjs` with `OPENSPEC_BIN` and verify the four "upstream instructions are kept verbatim as a prefix" tests fail
- [x] 1.3 Re-base the `specs` instruction of `clarify`, `lean`, `clarify-ai-qa` and `clarify-qa` on the 2.2.0 upstream text (the new WHEN/THEN rule line), keeping the kit rules unchanged, and verify `tests/schemas.test.mjs` passes
- [x] 1.4 Drop the retired `delivery` field from `kit/openspec/tooling/xdg/openspec/config.json`, update the tests that expected 1.15.0 (`tests/release.test.mjs`, `tests/hooks.test.mjs` session-start) and verify they pass against 2.2.0

## 2. Install the OpenSpec skills into the project

Depends on: 1
Area: installer/sdd-kit.mjs, installer/lib/config-edit.mjs, kit/openspec/tooling/bin/openspec.mjs, kit/openspec/tooling/checks/lint-kit.mjs, tests/openspec-cli-install.test.mjs, tests/installer.test.mjs, docs/how-it-works.md
Shared: none

- [x] 2.1 Write failing integration tests in `tests/openspec-cli-install.test.mjs` for "Install with an older OpenSpec is refused", "Update with an older OpenSpec is refused", "Install with the pinned OpenSpec goes on", "New project gets the kit profile skills in the project", "Nothing is written outside the project" and "Update of a project installed with OpenSpec 1.15.0 moves the skills" (temporary `HOME` and `XDG_CONFIG_HOME`), and verify they fail
- [x] 2.2 Run `init` with `--scope project` in the installer, add `--scope project` to an `init` without a scope in `openspec.mjs`, and make the installer write the top-level `skillsScope: project` into `openspec/config.yaml` (kept on update, removed on uninstall only when the installer added it); verify the 2.1 tests pass
- [x] 2.3 Add `skillsScope` to `CONFIG_KEYS` in `lint-kit.mjs`, fix `tests/installer.test.mjs` "new project: init + kit profile skills" for the new layout, and verify `tests/installer.test.mjs` and the lint-kit tests pass
- [x] 2.4 Describe the project-scope install and `skillsScope` in `docs/how-it-works.md` and verify `npm test` reports no kit file missing from it

## 3. Version the skills in git

Depends on: 2
Area: installer/lib/gitignore.mjs, tests/gitignore-skills.test.mjs, tests/gitignore.test.mjs, docs/how-it-works.md
Shared: none

- [x] 3.1 Write failing tests in `tests/gitignore-skills.test.mjs` for "Skill links are tracked when `.claude/` was ignored", "Update of a 0.7.0 project tracks the links", "A whole-`.agents/` ignore line is commented out", "Other forms of the whole-`.agents/` line are commented out" and "Uninstall restores the `.agents/` line" (real `git add -A`, links checked as mode 120000), and verify they fail
- [x] 3.2 Change the selective `.claude/` rules to `!.claude/skills/openspec` and `!.claude/skills/openspec-*`, add the whole-`.agents/` handling of design decision 2, and verify the 3.1 tests and the existing `.gitignore` tests pass
- [x] 3.3 Update the `.gitignore` section of `docs/how-it-works.md` and the commit hint of the installer output (`.agents/skills/`), and verify the installer output test names `.agents/skills/`

## 4. Skill drift check and doctor

Depends on: 2
Area: kit/openspec/tooling/lib/skills.mjs, kit/openspec/tooling/bin/doctor.mjs, kit/openspec/tooling/hooks/session-start.mjs, tests/skill-drift.test.mjs, tests/doctor.test.mjs, docs/how-it-works.md
Shared: none

- [x] 4.1 Write failing tests in `tests/skill-drift.test.mjs` and `tests/doctor.test.mjs` for "Router skill is not reported as drift", "A missing skill is reported by doctor", "A missing skill is reported at session start", "No drift, no warning", "Another CLI version falls back to the file check", "Session start falls back to the file check with another CLI version", "A missing CLI falls back to the file check", "A failed dry run in doctor is a warning", "A failed dry run is a warning", "An edited command file is left behind" and "No command files, no warning", and verify they fail
- [x] 4.2 Add `openspec/tooling/lib/skills.mjs` (`skillDrift`: dry run with the kit profile and a 10 s timeout when the CLI is the pinned version, file check otherwise, `failed` on a non-zero exit, timeout or bad JSON) and use it in `doctor.mjs` and `session-start.mjs`; verify the drift tests pass
- [x] 4.3 Add the `doctor` warning for each file under `.claude/commands/opsx/` and verify the two command-file tests pass
- [x] 4.4 Write failing tests for "Node 20 is an error", "Node 22.12.0 is accepted" and "Node 22.11 is an error" (version injected), change the `doctor` Node check to `versionAtLeast(…, '22.12.0')`, and verify they pass
- [x] 4.5 Describe `lib/skills.mjs`, the drift check and the new doctor lines in `docs/how-it-works.md`, and verify `npm test` reports no kit file missing from it

## 5. The update message about active changes

Depends on: 2
Area: installer/sdd-kit.mjs, tests/openspec-cli-update.test.mjs, docs/how-it-works.md
Shared: none

- [x] 5.1 Write failing integration tests in `tests/openspec-cli-update.test.mjs` for "Active changes are listed and the update completes", "No active changes, no message", "A later update does not repeat the message" and "No `/opsx:` in the installer output", and verify they fail
- [x] 5.2 Read the project's old `openspec/tooling/kit.json` before files are written; when its `openspecVersion` has major version 1, list every folder of `openspec/changes/` except `archive/` and name `/openspec-continue-change` and `/openspec-apply-change`; verify the 5.1 tests pass
- [x] 5.3 Describe the message in the update section of `docs/how-it-works.md` and verify `npm test` passes its docs check

## 6. check-specs follows OpenSpec 2.2.0

Depends on: none
Area: kit/openspec/tooling/checks/check-specs.mjs, kit/openspec/tooling/lib/project.mjs, tests/checks.test.mjs, tests/delta-specs.test.mjs, docs/how-it-works.md
Shared: none

- [x] 6.1 Write failing unit tests in `tests/delta-specs.test.mjs` for every scenario of "Every scenario has a trigger step and an outcome step" (8 scenarios, the blocking one through the artifact feedback hook) and verify they fail
- [x] 6.2 Add `SPEC_STEPS_VERSION = '0.8.0'` to `lib/project.mjs` and the step rule of design decision 6 to `check-specs.mjs` (patterns of `scenarioStepCoverage`, error from 0.8.0, warning before); verify the 6.1 tests and `tests/checks.test.mjs` pass
- [x] 6.3 Write failing unit tests for every scenario of "A MODIFIED requirement may not grow past 500 characters" (8 scenarios), implement the comparison with the main spec's requirement, and verify they pass
- [x] 6.4 Update the `check-specs` line of `docs/how-it-works.md` and the header comment of `check-specs.mjs`, and verify `npm test` passes its docs check

## 7. Command names in the kit

Depends on: 1
Area: kit/openspec/protocols/, kit/openspec/schemas/, kit/openspec/tooling/hooks/schema-starter.mjs, kit/openspec/tooling/hooks/planning-continue.mjs, kit/config-fragment.yaml, tests/planning-protocol.test.mjs, tests/apply-protocol.test.mjs, tests/planning-continue.test.mjs, tests/schemas.test.mjs, tests/opsx-names.test.mjs
Shared: none

- [x] 7.1 Write failing tests: `tests/opsx-names.test.mjs` for "No `/opsx:` in installed kit files" and "The starter hook names the new-change skill"; change the expected command names in the existing tests of "First artifact follows the creation", "Developer still runs the command", "Planning is complete", "Change ready to archive" and the six `ui-sources/screenshots` scenarios; verify they fail
- [x] 7.2 Replace every `/opsx:<x>` in `kit/` (protocols, schema instructions, hooks, `config-fragment.yaml`) by its skill per design decision 8, keeping the planning-flow requirement header and the mockups requirement wording of the proposal assumptions; verify the 7.1 tests pass and `grep -rn "/opsx:" kit` is empty
- [x] 7.3 Verify `tests/schemas.test.mjs` still finds the upstream prefix in the four kit schemas after the rename

## 8. Node minimum, CI and project documents

Depends on: 2, 3, 7
Area: package.json, .github/workflows/test.yml, .github/workflows/release.yml, README.md, CONTRIBUTING.md, CLAUDE.md, docs/guide/
Shared: settings

- [x] 8.1 Set `engines.node` to `>=22.12` in `package.json` and the CI matrix to `node: [22, 24]` (and the release workflow's Node to 22 or newer), and verify `npm test` and the release test pass
- [x] 8.2 Replace `/opsx:*` with the skill names and Node 20 / OpenSpec 1.15.0 with Node 22.12 / OpenSpec 2.2.0 in `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` and `docs/guide/`; verify `grep -rn "/opsx:\|1\.15\.0\|Node 20" README.md CONTRIBUTING.md CLAUDE.md docs/guide` is empty
- [x] 8.3 Add the commit of `.agents/skills/` and the moved links to the upgrade steps of `docs/guide/install.md` and verify the release test's install command check passes

## 9. OpenSpec facts, decisions and changelog

Depends on: 2, 3, 4, 5, 6, 7
Area: docs/openspec-facts.md, docs/decisions.md, CHANGELOG.md
Shared: none

- [x] 9.1 Re-run `docs/openspec-facts.md` sections 1–8 on OpenSpec 2.2.0 by its method (scratch project, isolated XDG): update W7 (layout), V5 (MODIFIED length), W4/W6 (profile), add rows for `skillsScope`, the `--scope` default, the router skill, `update --dry-run` drift and scenario step validation; verify every row names 2.2.0 or is marked not re-run
- [x] 9.2 Record the decisions of this change in `docs/decisions.md` (project scope, versioned links, no `/opsx` wrappers, dry-run drift check, stamp-gated `check-specs` rules) and verify the decisions tests pass
- [x] 9.3 Add the `## Unreleased` entry to `CHANGELOG.md` with the **Breaking** parts (OpenSpec 2.2.0, `/opsx:*` gone, Node 22.12) and the migration steps of the design, and verify the changelog test passes

## 10. Final checks

Depends on: 1, 2, 3, 4, 5, 6, 7, 8, 9
Area: unknown
Shared: settings

- [x] 10.1 Run the `test-reviewer` subagent and fix its blocker and major findings
- [x] 10.2 Run the full suite (`npm test`) with OpenSpec 2.2.0 through `OPENSPEC_BIN` and `node openspec/tooling/bin/doctor.mjs`, and fix what fails
- [x] 10.3 Write `apply-report.md` (`openspec/protocols/apply.md` section 7) and run `node openspec/tooling/checks/check-traceability.mjs --change upgrade-openspec-2 --markers`; verify it reports no error

## Workflow follow-up

- Archive the change with `/opsx:archive` (this repository still runs kit 0.7.0 until the refresh below).
- After the archive: `npm i -g @fission-ai/openspec@2.2.0`, then `node installer/sdd-kit.mjs update --yes`, and commit the refreshed installed copy (`.agents/skills/`, `.claude/skills/` links, removed `.claude/commands/opsx/`).
- Release 0.8.0 per `CONTRIBUTING.md`.
