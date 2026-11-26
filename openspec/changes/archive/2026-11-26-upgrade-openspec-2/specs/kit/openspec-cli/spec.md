# Spec Delta

## Purpose

How the kit installs, runs and checks the pinned OpenSpec CLI and its skills in a project, so every developer of the
project works with the same OpenSpec version and the same set of skills.

## ADDED Requirements

### Requirement: The kit is pinned to OpenSpec 2.2.0
The kit SHALL be pinned to OpenSpec 2.2.0. The installer SHALL refuse to install or update with another OpenSpec version unless `--allow-version-mismatch` is passed, and its message SHALL name the command that installs the pinned version.

#### Scenario: Install with an older OpenSpec is refused
- **GIVEN** OpenSpec 1.15.0 is the installed CLI
- **WHEN** the developer runs `sdd-kit install --yes` in a git project
- **THEN** the installer exits with an error, writes no file, and its message names `npm i -g @fission-ai/openspec@2.2.0`

#### Scenario: Update with an older OpenSpec is refused
- **GIVEN** a project with kit 0.7.0 and OpenSpec 1.15.0 as the installed CLI
- **WHEN** the developer runs `sdd-kit update --yes` with the new kit
- **THEN** the installer exits with an error, changes no file, and its message names `npm i -g @fission-ai/openspec@2.2.0`

#### Scenario: Install with the pinned OpenSpec goes on
- **GIVEN** OpenSpec 2.2.0 is the installed CLI
- **WHEN** the developer runs `sdd-kit install --yes` in a git project
- **THEN** the install completes and `openspec/tooling/kit.json` holds `"openspecVersion": "2.2.0"`

### Requirement: OpenSpec skills are installed into the project
The installer and `node openspec/tooling/bin/openspec.mjs init|update` SHALL install the OpenSpec skills of the kit profile into the project: one copy in `.agents/skills/<skill>/` and a link `.claude/skills/<skill>` to it. They SHALL NOT write skills outside the project or change the developer's own OpenSpec configuration.

#### Scenario: New project gets the kit profile skills in the project
- **GIVEN** a git project without `openspec/` and OpenSpec 2.2.0
- **WHEN** the developer runs `sdd-kit install --yes`
- **THEN** `.agents/skills/` holds `openspec-new-change`, `openspec-continue-change`, `openspec-apply-change`, `openspec-verify-change`, `openspec-archive-change`, `openspec-explore`, `openspec-update-change`, `openspec-sync-specs` and `openspec`, each with a `SKILL.md`
- **AND** `.claude/skills/<name>` is a link to `.agents/skills/<name>` for each of them
- **AND** there is no `openspec-propose` skill in either folder

#### Scenario: Nothing is written outside the project
- **GIVEN** a git project, OpenSpec 2.2.0, and a home folder whose `.claude/skills/`, `.agents/skills/` and `.config/openspec/` folders have known contents, and `XDG_CONFIG_HOME` unset
- **WHEN** the developer runs `sdd-kit install --yes`
- **THEN** those three folders hold the same files with the same contents as before

#### Scenario: Update of a project installed with OpenSpec 1.15.0 moves the skills
- **GIVEN** a project with kit 0.7.0 installed with OpenSpec 1.15.0: skills as folders in `.claude/skills/openspec-*` and command files in `.claude/commands/opsx/`
- **WHEN** the developer runs `sdd-kit update --yes` with OpenSpec 2.2.0
- **THEN** `.claude/skills/openspec-new-change` is a link to `.agents/skills/openspec-new-change`
- **AND** `.claude/commands/opsx/` holds none of `new.md`, `continue.md`, `apply.md`, `verify.md`, `archive.md`, `explore.md`, `sync.md` and `update.md` that OpenSpec 1.15.0 generated unedited

### Requirement: The project's skills are versioned
The kit's `.gitignore` rules SHALL let git track `.agents/skills/openspec*/` and the links `.claude/skills/openspec*`, the `openspec` router skill included. A line that ignores `.agents/` as a whole (the same forms as for `.claude/`) SHALL be commented out like a whole-`.claude/` line, with only `.agents/skills/openspec*` let in, and `uninstall` SHALL restore it.

#### Scenario: Skill links are tracked when `.claude/` was ignored
- **GIVEN** a git project whose `.gitignore` holds the line `.claude/`, after `sdd-kit install --yes`
- **WHEN** the developer runs `git add -A`
- **THEN** the index holds `.claude/skills/openspec` and `.claude/skills/openspec-new-change` as symbolic links, and `.agents/skills/openspec-new-change/SKILL.md`

#### Scenario: Update of a 0.7.0 project tracks the links
- **GIVEN** a project with kit 0.7.0 whose `.gitignore` holds the line `.claude/` and the kit rule `!.claude/skills/openspec-*/`
- **WHEN** the developer runs `sdd-kit update --yes` with OpenSpec 2.2.0 and then `git add -A`
- **THEN** `.gitignore` no longer holds `!.claude/skills/openspec-*/`
- **AND** the index holds `.claude/skills/openspec` and `.claude/skills/openspec-new-change` as symbolic links, and `.agents/skills/openspec-new-change/SKILL.md`

#### Scenario: Other forms of the whole-`.agents/` line are commented out
- **GIVEN** a git project whose `.gitignore` holds the line `/.agents`
- **WHEN** the developer runs `sdd-kit install --yes`
- **THEN** `.gitignore` holds `# sdd-kit disabled: /.agents` in place of that line

#### Scenario: A whole-`.agents/` ignore line is commented out
- **GIVEN** a git project whose `.gitignore` holds the line `.agents/`
- **WHEN** the developer runs `sdd-kit install --yes` and then `git add -A`
- **THEN** `.gitignore` holds `# sdd-kit disabled: .agents/` in place of that line
- **AND** the index holds `.agents/skills/openspec-new-change/SKILL.md`
- **AND** a file `.agents/other/notes.md` present in the project is not in the index

#### Scenario: Uninstall restores the `.agents/` line
- **GIVEN** a project whose `.gitignore` line `.agents/` the installer commented out
- **WHEN** the developer runs `sdd-kit uninstall --yes`
- **THEN** `.gitignore` holds the line `.agents/` again and no `# sdd-kit disabled:` line

### Requirement: The router skill is kept as OpenSpec ships it
The `openspec` router skill that OpenSpec installs with every profile SHALL stay installed, and the kit's skill checks SHALL NOT report it.

#### Scenario: Router skill is not reported as drift
- **GIVEN** a project after `sdd-kit install --yes` with OpenSpec 2.2.0
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** `.claude/skills/openspec` exists and the `skills` line of the report is `ok`

### Requirement: The kit needs Node 22.12 or newer
The kit SHALL require Node 22.12.0 or newer. `doctor` SHALL report an older Node as an error whose fix names Node 22.12.

#### Scenario: Node 20 is an error
- **GIVEN** the doctor runs under Node 20.20.2
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `node` line is an error naming `20.20.2`, and its fix says to install Node 22.12 or newer

#### Scenario: Node 22.12.0 is accepted
- **GIVEN** the doctor runs under Node 22.12.0
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `node` line is `ok`

#### Scenario: Node 22.11 is an error
- **GIVEN** the doctor runs under Node 22.11.0
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `node` line is an error

### Requirement: Update names the active changes
When `sdd-kit update` moves a project from a kit pinned to OpenSpec 1.x, it SHALL list every active change (every folder of `openspec/changes/` except `archive/`) by name and say that it goes on with the OpenSpec skills (`/openspec-continue-change`, `/openspec-apply-change`), and SHALL then update. Other updates, and projects without active changes, get no such message.

#### Scenario: Active changes are listed and the update completes
- **GIVEN** a project with kit 0.7.0 and the active changes `add-export` on `clarify` and `old-fix` on `spec-driven`
- **WHEN** the developer runs `sdd-kit update --yes`
- **THEN** the output names `add-export` and `old-fix`, `/openspec-continue-change` and `/openspec-apply-change`
- **AND** the update completes and `openspec/tooling/kit.json` holds the new kit version

#### Scenario: No active changes, no message
- **GIVEN** a project with kit 0.7.0 whose `openspec/changes/` holds only `archive/`
- **WHEN** the developer runs `sdd-kit update --yes`
- **THEN** the output names no change and does not name `/openspec-continue-change`

#### Scenario: A later update does not repeat the message
- **GIVEN** a project with kit 0.8.0 pinned to OpenSpec 2.2.0 and the active change `add-export`
- **WHEN** the developer runs `sdd-kit update --yes`
- **THEN** the output does not name `add-export` or `/openspec-continue-change`

### Requirement: Skill drift is found with OpenSpec's own dry run
`doctor` and the session-start hook SHALL find skill drift with `openspec update --dry-run --json` run with the kit profile, and report every listed path with the fix `node openspec/tooling/bin/openspec.mjs update`. With the CLI missing or not the pinned version they SHALL fall back to the file check (`openspec-propose` present, `openspec-continue-change` missing); a dry run that fails is a warning.

#### Scenario: A missing skill is reported by doctor
- **GIVEN** a project after `sdd-kit install --yes` whose link `.claude/skills/openspec-continue-change` was deleted
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `skills` line is a warning naming `.claude/skills/openspec-continue-change`, with the fix `node openspec/tooling/bin/openspec.mjs update`

#### Scenario: A missing skill is reported at session start
- **GIVEN** a project after `sdd-kit install --yes` whose link `.claude/skills/openspec-continue-change` was deleted
- **WHEN** a Claude Code session starts
- **THEN** the session context holds a warning naming `.claude/skills/openspec-continue-change` and `node openspec/tooling/bin/openspec.mjs update`

#### Scenario: No drift, no warning
- **GIVEN** a project right after `sdd-kit install --yes`
- **WHEN** a Claude Code session starts
- **THEN** the session context holds no skills warning

#### Scenario: Another CLI version falls back to the file check
- **GIVEN** a project after install whose `.claude/skills/openspec-propose` exists, and OpenSpec 1.15.0 as the installed CLI
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `skills` line is a warning naming `openspec-propose`, and `openspec update --dry-run` was not run

#### Scenario: Session start falls back to the file check with another CLI version
- **GIVEN** a project after install whose `.claude/skills/openspec-propose` exists, and OpenSpec 1.15.0 as the installed CLI
- **WHEN** a Claude Code session starts
- **THEN** the session context holds a warning naming `openspec-propose`, and `openspec update --dry-run` was not run

#### Scenario: A missing CLI falls back to the file check
- **GIVEN** a project after install whose `.claude/skills/openspec-continue-change` was deleted, and no `openspec` command on the path
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `skills` line is a warning naming `openspec-continue-change`

#### Scenario: A failed dry run in doctor is a warning
- **GIVEN** a project after install where `openspec update --dry-run --json` exits with status 1
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the `skills` line is a warning, not an error, saying the skill check could not run

#### Scenario: A failed dry run is a warning
- **GIVEN** a project after install where `openspec update --dry-run --json` exits with status 1
- **WHEN** a Claude Code session starts
- **THEN** the session starts, and its context holds a warning that the skill check could not run

### Requirement: Leftover `/opsx` command files are reported
`doctor` SHALL report each file left in `.claude/commands/opsx/` as a warning that names the file and says to delete it.

#### Scenario: An edited command file is left behind
- **GIVEN** a project after `sdd-kit update --yes` with OpenSpec 2.2.0 that still holds an edited `.claude/commands/opsx/apply.md`
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the report holds a warning naming `.claude/commands/opsx/apply.md` that says to delete it

#### Scenario: No command files, no warning
- **GIVEN** a project after `sdd-kit install --yes` with OpenSpec 2.2.0
- **WHEN** the developer runs `node openspec/tooling/bin/doctor.mjs`
- **THEN** the report names no file under `.claude/commands/opsx/`

### Requirement: Kit texts name the OpenSpec skills
The kit's protocols, schema instructions, hook messages and installer output SHALL name the OpenSpec skills (`/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-archive-change`) and SHALL NOT name an `/opsx:` command.

#### Scenario: No `/opsx:` in installed kit files
- **GIVEN** a project after `sdd-kit install --yes`
- **WHEN** `openspec/config.yaml`, the files under `openspec/protocols/`, `openspec/schemas/`, `openspec/tooling/` and the kit's files under `.claude/` are searched for `/opsx:`
- **THEN** no file matches

#### Scenario: No `/opsx:` in the installer output
- **GIVEN** a project with kit 0.7.0 and the active change `add-export`
- **WHEN** the developer runs `sdd-kit update --yes`
- **THEN** the output does not contain `/opsx:`

#### Scenario: The starter hook names the new-change skill
- **GIVEN** a project after `sdd-kit install --yes`
- **WHEN** the schema starter hook blocks `openspec new change "add-export"` without `--schema`
- **THEN** its message says that a dismissed menu means starting again with `/openspec-new-change <name>`, and does not name `/opsx:new`
