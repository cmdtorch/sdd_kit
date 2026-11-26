# Proposal

## Why

The kit is pinned to OpenSpec 1.15.0, and the latest release is 2.2.0. OpenSpec 2.x no longer writes `/opsx:*`
command files, keeps one copy of each skill in `.agents/skills/` linked from `.claude/skills/`, and its `init`
installs skills machine-wide unless told otherwise. This breaks the kit's install and leaves the kit naming commands
that no longer exist; the stricter 2.x validation should also reach the kit's own checks. [desc][Q2][Q3][Q8]

## What Changes

- **BREAKING** Pin OpenSpec 2.2.0 (kit 0.8.0), re-base the kit schemas on the 2.2.0 built-in `spec-driven` schema and re-verify `docs/openspec-facts.md`. [desc][Q8]
- **BREAKING** The `/opsx:*` commands are gone: every kit protocol, schema instruction, hook message, spec and document names the OpenSpec skills instead (`/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-archive-change` and the rest); the kit ships no `/opsx:*` wrappers. [Q2]
- The installer and the kit's `openspec.mjs` wrapper install the OpenSpec skills into the project (`--scope project`), never machine-wide. [Q3]
- The skills are versioned in the project: the `.agents/skills/` files and the `.claude/skills/openspec*` links, the `openspec` router skill included; the kit's `.gitignore` rules let both into git. [Q4]
- The new `openspec` router skill stays installed as OpenSpec ships it; the kit adds nothing for it. [Q5]
- **BREAKING** The kit needs Node 22.12 or newer, the minimum of the OpenSpec npm package; `doctor` reports an older Node as an error. [Q6]
- `sdd-kit update` from a kit pinned to OpenSpec 1.x lists the active changes of the project and says how to continue them with the new command names, then updates. [Q7]
- Skill drift (the installed skills differ from the kit profile) is found with `openspec update --dry-run --json`, in both `doctor` and `session-start`. [Q8][Q11]
- `check-specs` reports a scenario without a WHEN/GIVEN step or without a THEN step as an error. [Q8][Q9]
- `check-specs` reports a MODIFIED requirement whose text is over 500 characters and longer than in the main spec as an error; one over 500 characters but not longer than before only warns. [Q8][Q15] (narrows [Q10])

## Capabilities

### New Capabilities

- `kit/openspec-cli`: how the kit installs and runs the pinned OpenSpec CLI: the pinned version, the project-scope skills and their versioning, the skill drift check, the Node minimum and the update warning about active changes. [desc][Q3][Q4][Q6][Q7][Q11]
- `checks/delta-specs`: the kit's rules for delta specs beyond `openspec validate`: the scenario steps and the requirement length. [Q9][Q15]

### Modified Capabilities

- `workflow/planning-flow`: the planning messages name `/openspec-continue-change` and `/openspec-apply-change` instead of `/opsx:continue` and `/opsx:apply`. [Q2]
- `workflow/autonomous-apply`: the ready message names `/openspec-archive-change` instead of `/opsx:archive`. [Q2]
- `ui-sources/screenshots`: the mockups messages name `/openspec-continue-change` instead of `/opsx:continue`. [Q2]

## Impact

- `installer/sdd-kit.mjs` (`init --scope project`, the warning about active changes, the commit hint) and `installer/lib/gitignore.mjs` (the rules for the skills). [Q3][Q4][Q7]
- `kit/openspec/tooling/`: `kit.json` (pin), `xdg/openspec/config.json` (the retired `delivery` field), `bin/openspec.mjs`, `bin/doctor.mjs`, `hooks/session-start.mjs`, `hooks/schema-starter.mjs`, `hooks/planning-continue.mjs`, `checks/check-specs.mjs`. [desc][Q2][Q3][Q6][Q9][Q11][Q13][Q15]
- `kit/openspec/schemas/*` (re-based `specs` instruction, command names), `kit/openspec/protocols/*` and `kit/config-fragment.yaml`. [desc][Q2]
- `fixtures/upstream/spec-driven-2.2.0/` replaces `spec-driven-1.15.0/`; `tests/helpers/openspec.mjs` (`PINNED_VERSION`), the tests naming `/opsx:*` or the old pin, and `package.json` (`engines`). [desc][Q2][Q6]
- Docs: `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/how-it-works.md`, `docs/openspec-facts.md`, `docs/decisions.md`, `CHANGELOG.md`. [desc][Q2][Q8]
- Developers install `@fission-ai/openspec@2.2.0` and Node 22.12+, run `sdd-kit update` in each project and commit the moved skills. [desc][Q4][Q6]

## Assumptions & Open Questions

- [assumption] The new blocking `check-specs` rules (missing WHEN/GIVEN, a MODIFIED requirement over 500 characters that grew) apply only to changes stamped 0.8.0 or later; earlier changes keep a warning, as the kit gated stricter rules by stamp in 0.6.0 and 0.7.0, so changes in flight do not start failing after an update.
- [assumption] When the OpenSpec CLI is missing or differs from the pinned version, the drift check falls back to the current file check (`openspec-propose` present, `openspec-continue-change` missing) and does not run `update --dry-run`.
- [assumption] A drift check that `update --dry-run` cannot complete (non-zero exit or unreadable JSON) is a warning, never an error, and never blocks the session.
- [assumption] The kit version for this change is 0.8.0 with the breaking parts marked **Breaking** in `CHANGELOG.md`, per its versioning rule before 1.0.0.
- [assumption] The `workflow/planning-flow` requirement keeps its header `Planning starts and resumes without `/opsx:continue``; only its text and scenarios name `/openspec-continue-change`. `check-specs` does not handle RENAMED yet, so a renamed header would collide with its own scenario names; the rename waits for a change that fixes that.
- [assumption] A MODIFIED requirement over 500 characters with no requirement of that name in the main spec is a warning, as `check-specs` reports any long MODIFIED requirement today.
- [assumption] The update message lists every folder of `openspec/changes/` except `archive/`, changes on `spec-driven` included, and appears only when the update moves a project from a kit pinned to OpenSpec 1.x.
- [assumption] The mockups requirement of `ui-sources/screenshots` says "the continue skill" rather than `/openspec-continue-change`: the requirement is already over 500 characters, and a longer text would fail `openspec validate --strict`; its scenarios name `/openspec-continue-change`.
