# Design

## Context

See `proposal.md` (Why). The facts below were checked against OpenSpec 2.2.0 in scratch copies of this repository and decide the approach. [desc]

- `openspec init --tools claude` without `--scope` resolves to global skills and fails in the kit's installer (`claude-code did not install openspec-explore`); with `--scope project` and the kit XDG profile it installs nine skills into `.agents/skills/` and links them from `.claude/skills/`. [Q3]
- `openspec update` run through the kit XDG profile on this repository (installed with 1.15.0) keeps project scope without a question when not interactive, deletes the eight generated `.claude/commands/opsx/*.md`, replaces the `.claude/skills/openspec-*` folders with links, and leaves `openspec/tooling/xdg/` unchanged. In a terminal it asks once where to keep the skills unless `openspec/config.yaml` holds `skillsScope: project` (`dist/core/update.js`, `dist/core/project-config.js`). [Q3][Q4]
- `openspec update --dry-run --json` takes about 0.7 s and lists a deleted skill link as `{path, action: "add"}` in `changes[]`. [Q11]
- The full suite run against 2.2.0 with the pin raised fails 8 of 968 tests: four schema prefix tests (the upstream `specs` instruction gained one rule line about WHEN/THEN), the installer test (global scope), and three tests that still found the 1.15.0 CLI. [desc][Q8]
- The kit's `.gitignore` rule `!.claude/skills/openspec-*/` matches folders only, so git ignores the new links in a project whose `.claude/` was ignored. [Q4]
- `openspec validate` 2.2.0 reads scenario steps with `scenarioStepCoverage` (`dist/core/parsers/requirement-text.js`) and flags a MODIFIED requirement whose text is over 500 characters and longer than the main spec's (`dist/core/validation/validator.js:681`). [Q9][Q15]

## Goals / Non-Goals

**Goals:**

- The kit installs and updates on OpenSpec 2.2.0 with no question from OpenSpec and no write outside the project. [Q3]
- One shared drift check used by `doctor` and `session-start`. [Q11]
- `check-specs` reads scenario steps and MODIFIED length exactly as `openspec validate` 2.2.0 does. [Q9][Q15]

**Non-Goals:**

- Handling RENAMED in `check-specs` (found while writing the specs); it stays for a later change. [Q8]
- Native Windows link handling: native Windows is a non-goal of the kit (`docs/goals.md`). [Q4]

## Decisions

### 1. Project scope is set twice: flag and config

The installer runs `openspec init --scope project --tools claude --no-animation`, and the installer's config merge writes the top-level key `skillsScope: project` into `openspec/config.yaml` (outside the kit's `context` block). `openspec.mjs` adds `--scope project` to an `init` that names no scope. The config key stops the one-time terminal question of `update` for every developer; the flag covers the first `init`, before the config exists. `lint-kit` adds `skillsScope` to its known config keys. Alternative: only the flag. Rejected: a developer running `openspec.mjs update` in a terminal would still be asked and could pick "global". [Q3]

Flag and config are not enough: OpenSpec 2.2.0 `update` always refreshes skills it finds in `~/.agents/skills/` and writes `~/.local/share/openspec/projects.json`, with no switch to stop it. So every OpenSpec process the kit starts (the installer, `openspec.mjs`, the drift check of decision 3) runs with `HOME` set to an empty temporary folder, removed afterwards; the kit XDG profile is passed as before. [Q16]

### 2. `.gitignore`: match links, and the `.agents/` twin of the `.claude/` rule

The selective `.claude/` rules end with `!.claude/skills/openspec` and `!.claude/skills/openspec-*` (no trailing slash, so links and folders both match). A line ignoring `.agents/` as a whole (the forms of `WHOLE_CLAUDE`) is disabled like the `.claude/` one and replaced by `.agents/*`, `!.agents/skills/`, `.agents/skills/*`, `!.agents/skills/.openspec-target`, `!.agents/skills/openspec`, `!.agents/skills/openspec-*`. The block is rebuilt on every install and update, so a 0.7.0 project loses the old rule on `sdd-kit update`. `uninstall` already restores every disabled line. [Q4][Q12]

### 3. One drift module, OpenSpec's dry run first

A new `openspec/tooling/lib/skills.mjs` exports `skillDrift(root, kit)`, used by `doctor.mjs` and `session-start.mjs`. [Q11]

- CLI equal to the pinned version: run `openspec update --dry-run --json` with the kit XDG profile and telemetry off, timeout 10 s. Each entry of `changes[]` is a drift path. A non-zero exit, a timeout or unreadable JSON returns `failed`. `notes[]` (for example "missing core workflow: propose") are ignored. [Q8][Q11]
- CLI missing or another version: the current file check (`openspec-propose` present, `openspec-continue-change` missing). [Q11]
- The result is the same for both callers; `doctor` reports it on its `skills` line and `session-start` adds a warning line. A `failed` result is a warning in both. [Q11]

Alternative: keep two copies of the check. Rejected: the two would drift apart, as they nearly have. [Q11]

### 4. The update message reads the old pin before files are replaced

`sdd-kit update` reads `openspec/tooling/kit.json` of the project before it writes kit files. When its `openspecVersion` has major version 1 and `openspec/changes/` holds any folder other than `archive/`, the output lists those folders and names `/openspec-continue-change` and `/openspec-apply-change`; then the update goes on. [Q7]

### 5. Node 22.12 everywhere

`doctor` compares the full version with `versionAtLeast(process.versions.node, '22.12.0')` instead of the major only. `package.json` `engines` becomes `>=22.12`, `README.md` says Node 22.12+, and the CI matrix becomes `node: [22, 24]`. [Q6][Q14]

### 6. `check-specs` mirrors `openspec validate`

- Steps: the kit uses the same patterns as `scenarioStepCoverage`: bold `WHEN`/`GIVEN`/`THEN` in any case with an optional colon, or a bare upper-case word; header line and fenced lines skipped. It replaces the current THEN-only regex. [Q9]
- MODIFIED length: the kit parser already measures requirement text as OpenSpec does (fact J9); `check-specs` compares with the same requirement of the main spec. [Q15]
- Severity: `versionAtLeast(changeKitVersion(root, name), '0.8.0')` makes both findings errors; otherwise warnings. A new constant `SPEC_STEPS_VERSION = '0.8.0'` in `lib/project.mjs`, as for the earlier stamp-gated rules. [Q9][Q15]

### 7. Leftover command files

`doctor` lists every file under `.claude/commands/opsx/` as one warning per file, fix "delete it: OpenSpec 2 has no /opsx commands". [Q13]

### 8. Command names: one mapping, one test

Every `/opsx:<x>` in `kit/`, the installer, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` and `docs/` is replaced by its skill: `new` → `/openspec-new-change`, `continue` → `/openspec-continue-change`, `apply` → `/openspec-apply-change`, `verify` → `/openspec-verify-change`, `archive` → `/openspec-archive-change`, `explore` → `/openspec-explore`, `sync` → `/openspec-sync-specs`, `update` → `/openspec-update-change`. A test installs the kit and searches the installed files and `openspec/config.yaml` for `/opsx:`. Archived changes and `docs/decisions.md` history entries keep their text. [Q2]

### 9. Re-base, pin and facts

`fixtures/upstream/spec-driven-2.2.0/` is a byte copy of the 2.2.0 built-in schema; the four kit schemas take the new `specs` instruction as their prefix. `kit.json`, `PINNED_VERSION` and the install commands name 2.2.0; `xdg/openspec/config.json` drops `delivery`. `docs/openspec-facts.md` is re-run on 2.2.0: W7 (layout), V5 (MODIFIED), new rows for `skillsScope`, the router skill and step validation. Kit version 0.8.0, **Breaking** in `CHANGELOG.md`. [desc][Q8]

### 10. Tests that prove "nothing outside the project"

The installer test sets `HOME` and `XDG_CONFIG_HOME` to fresh temporary folders and compares `.claude/skills/`, `.agents/skills/` and `.config/openspec/` there before and after the install. [Q3]

### 11. This repository

The installed copy (`openspec/`, `.claude/`) is refreshed with `node installer/sdd-kit.mjs update --yes` only after this change is archived, as `CLAUDE.md` requires; this change runs under the 0.7.0 kit and the 1.15.0 CLI, with 2.2.0 used by the tests through `OPENSPEC_BIN`. [desc]

## Risks / Trade-offs

- [Session start is slower by about 0.7 s.] → Accepted by Q11; the 10 s timeout bounds a hung CLI. [Q11]
- [`openspec update` in 2.x may change the scope question or the config key in a later minor.] → The pin (D12) and the facts rows for `skillsScope` make such a change visible on the next upgrade. [Q3]
- [Developers on Windows without `core.symlinks` get link stubs.] → Native Windows is a non-goal; `openspec update` replaces stubs with copies. [Q4]
- [Tests run against the real CLI; CI must install 2.2.0, which needs Node 22.12.] → The CI matrix moves to `[22, 24]` in the same change. [Q14]

## Migration Plan

1. Each developer installs Node 22.12+ and `npm i -g @fission-ai/openspec@2.2.0`. [Q6]
2. In each project: `npx github:cmdtorch/sdd_kit#v0.8.0 update`, read the list of active changes, commit `.agents/skills/`, the new `.claude/skills/` links, the removed `.claude/commands/opsx/` files, `.gitignore` and `openspec/config.yaml`. [Q4][Q7]
3. Run `node openspec/tooling/bin/doctor.mjs`; delete any `.claude/commands/opsx/` file it names. [Q13]
4. Rollback: reinstall kit 0.7.0 and OpenSpec 1.15.0, then `node openspec/tooling/bin/openspec.mjs update`, which brings back the command files. [desc]

## Assumptions & Open Questions

- [assumption] The dry-run timeout is 10 seconds; a timeout counts as a failed check (a warning).
- [assumption] `notes[]` of the dry run are not drift; only `changes[]` entries are reported.
- [assumption] `skillsScope: project` is written by the installer as a top-level key of `openspec/config.yaml`, kept on update, and removed by `uninstall` only when the installer added it.
- [assumption] Archived changes and the history entries of `docs/decisions.md` keep their `/opsx:` text.
