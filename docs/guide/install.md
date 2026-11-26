# Install, update, uninstall, onboarding

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js ≥ 22.12 | the kit's tooling and the OpenSpec CLI | your usual way (nvm, package manager) |
| OpenSpec CLI **2.2.0** (pinned) | specs and changes | `npm i -g @fission-ai/openspec@2.2.0` |
| Claude Code | the agent; the kit's hooks run inside it | https://code.claude.com |
| git | the kit finds test markers through git | — |

Linux, macOS and WSL are supported. Native Windows is not.

The kit does not depend on the project's language, framework or repository layout. It never runs the project's tests (except
the Playwright tests of the E2E stage, through its own script): the agent uses the project's own commands. Write them into `CLAUDE.md` or the README (how to run one test file, the whole
suite, lint and type checks).

## Installing into a repository (once, by the team lead)

```bash
npx github:cmdtorch/sdd_kit#v0.8.0 install --dry-run   # show the plan, write nothing
npx github:cmdtorch/sdd_kit#v0.8.0 install
```

Always name a release tag (`#v0.5.0`): without one, npx installs whatever is on `main`. Releases and their notes:
https://github.com/cmdtorch/sdd_kit/releases.

In a terminal `install` asks two questions: the language of the clarifying questions, and whether the project is
a meta-repository or a single repository (see [Meta-repositories](#meta-repositories)). `update` asks neither.

Options:

| Option | Meaning |
|---|---|
| `--target <dir>` | project root (default: current directory) |
| `--questions-language <lang>` | language of the clarifying questions. They are often forwarded as they are, so use the language the team speaks. Default: keep the current setting, else English. Artifacts stay English |
| `--keep-default-schema` | do not make `clarify` the default schema for new changes |
| `--metarepo [<entries>]` | the project is a meta-repository; comma-separated clone entries (`repos/backend`, `web=repos/frontend`) are added to `openspec/clones`. Alone it creates the list with no clone. Works with `update` too |
| `--skip-openspec` | do not run the OpenSpec CLI (no `init`/`update` of the skills) |
| `--allow-version-mismatch` | accept an OpenSpec CLI other than the pinned one (not recommended) |
| `--force` | replace kit files you edited locally (a `.sdd-kit-backup` copy is kept); uninstall: remove the kit even if changes still use its schemas |
| `--dry-run` | show the plan, write nothing |
| `--yes` | never ask questions |
| `--json` | machine-readable output |
| `--version` | print the kit version and the pinned OpenSpec version |
| `--help` | show the usage |

What the installer does:

1. Runs `openspec init --tools claude` with the kit's workflow profile if the repository has no `openspec/` yet.
2. Copies the kit into `openspec/`: protocols, schemas, `tooling/` (checks, hooks, tools). It also copies the
   subagents and `/sdd:clarify` into `.claude/`.
3. Adds the kit block to `context` in `openspec/config.yaml` and makes `clarify` the default schema. In-flight
   changes keep their own schema.
4. Merges the kit's hooks and permissions into `.claude/settings.json`. Your own hooks and plugins stay as they are.
5. Edits `.gitignore` so that `openspec/`, the shared parts of `.claude/` (settings.json, agents, commands, the
   OpenSpec skill links) and `.agents/skills/openspec*/` are versioned, while `settings.local.json`, plugin data and
   worktrees are not.
6. Runs `openspec update` with the kit profile: `new`, `continue`, `apply`, `verify`, … but not `propose`, which writes
   every artifact in one pass and so skips the question rounds. The skills go into the project only: one copy in
   `.agents/skills/<skill>/` and a link `.claude/skills/<skill>` to it. Nothing is written into your home folder.
7. Ends with a self-check (`lint-kit`).

Nothing is written if a step cannot be done safely (e.g. invalid `settings.json`). Review the diff, then commit:
`openspec/`, `.claude/settings.json`, `.claude/agents/`, `.claude/commands/`, `.agents/skills/openspec*/`, the links
`.claude/skills/openspec*`, `.gitignore`.

## Meta-repositories

A meta-repository is a root folder with its own git that holds the shared instructions (`AGENTS.md`, mise tasks)
and the kit, and application clones in sub-folders, each with its own git, usually ignored by the root
(`repos/*` in `.gitignore`). Install the kit in the root:

```bash
npx github:cmdtorch/sdd_kit#v<version> install --yes --metarepo repos/backend,repos/frontend
```

or answer "meta-repository" in a terminal and enter the clone paths one by one (an empty answer ends the list).
The installer writes `openspec/clones`, one clone per line:

```text
# One clone per line: <path> or <name>=<path>
repos/backend
web=repos/frontend
```

- A clone is named after its folder (`backend`) unless the line gives a name (`web`). Names use letters, digits,
  `-`, `_`, `.`; `root` is reserved for the root itself.
- A path that does not exist yet is accepted; doctor reports it as a missing clone until it is cloned.
- Add clones later with `update --yes --metarepo repos/admin`, by editing the file, or by answering "yes" when
  doctor offers a folder with its own `.git` that the list does not declare. A known entry is skipped; a known
  path under another name stops the installer before it writes anything.
- `openspec/clones` is your file: update and uninstall never change it. The kit writes nothing inside a clone,
  and blocks edits to a clone's own `openspec/` from a session started in the root.
- Run Claude Code from the root. Write each repository's commands (tests, checks, starting the application)
  into `AGENTS.md` or mise tasks; the agent uses them.

How changes work in a meta-repository: [workflow](workflow.md#meta-repositories).

## Onboarding a developer

The kit is committed with the repository; nothing is installed per developer except the prerequisites.

1. `npm i -g @fission-ai/openspec@2.2.0` (and Node 22.12+, Claude Code).
2. Clone the repository.
3. `node openspec/tooling/bin/doctor.mjs` — checks Node, the OpenSpec version, Claude Code, hooks, skills and edited
   kit files, and says how to fix each problem. In a meta-repository it also checks `openspec/clones`, warns about
   clones that are not cloned yet and offers undeclared nested repositories (in a terminal it asks; with `--yes`
   or without a terminal it only prints the line to add).
4. Open Claude Code in the repository and **accept the workspace trust dialog**. Until then Claude Code ignores
   the project's `permissions.allow` entries, so the kit's read-only scripts ask for approval.

## Updating the kit

```bash
npx github:cmdtorch/sdd_kit#v<version> update     # same as install
npx github:cmdtorch/sdd_kit#v<version> status      # version, edited files, hooks, questions language
```

- Kit files you did not edit are replaced; files the new version no longer ships are removed.
- Kit files you edited are kept and reported. `--force` replaces them and keeps a `.sdd-kit-backup` copy.
- Files that are not the kit's are never touched.
- Read the [changelog](../../CHANGELOG.md) before a MAJOR update.

### Upgrading from kit 0.7.0 (OpenSpec 1.x)

Kit 0.8.0 is pinned to OpenSpec 2.2.0 and needs Node 22.12 or newer. OpenSpec 2 has no commands in
`.claude/commands/opsx/` any more: use the skills (`/openspec-new-change`, `/openspec-continue-change`,
`/openspec-apply-change`, `/openspec-verify-change`, `/openspec-archive-change`, `/openspec-explore`,
`/openspec-sync-specs`, `/openspec-update-change`).

1. Every developer installs Node 22.12+ and `npm i -g @fission-ai/openspec@2.2.0`.
2. In the project: `npx github:cmdtorch/sdd_kit#v<version> update`. It lists the active changes; they go on with
   `/openspec-continue-change` and `/openspec-apply-change`.
3. Commit `.agents/skills/` (the skills now live there), the `.claude/skills/openspec*` folders that became links
   to it, the removed `.claude/commands/opsx/` files, `.gitignore` and `openspec/config.yaml`.
4. Run `node openspec/tooling/bin/doctor.mjs` and delete any `.claude/commands/opsx/` file it names (update removes
   only the command files that OpenSpec generated and nobody edited).
5. Rollback: install the OpenSpec version that kit 0.7.0 pins (`openspecVersion` in its
   `openspec/tooling/kit.json`), update the project to kit 0.7.0, then run
   `node openspec/tooling/bin/openspec.mjs update`, which brings back the command files.

**Never run a plain `openspec update`.** It applies your personal OpenSpec profile, which puts `propose` back. If the
global config has no profile, it even rewrites your machine-wide settings. Use
`node openspec/tooling/bin/openspec.mjs update`; session start warns when the skills drifted.

## Uninstalling

```bash
npx github:cmdtorch/sdd_kit#v<version> uninstall --dry-run
npx github:cmdtorch/sdd_kit#v<version> uninstall
```

- Removes the kit files you did not edit.
- Restores `config.yaml`, `settings.json` and `.gitignore`.
- Refuses while active changes still use the kit schemas: archive them first, or use `--force`.
- OpenSpec skills stay as they are; run `openspec update` afterwards to return to your personal profile.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "answers-gate: proposal … cannot be written yet" | a question round is open. Answer the questions in `clarifications.md` and confirm the summary with exactly `Looks correct` |
| "archive-gate: … no test carries the marker for …" | add `@scenario <capability> :: <Scenario name>` as a comment above the test (`openspec/protocols/testing.md` §3) |
| "archive-gate: … no test review" | run the `test-reviewer` subagent, or record a human decision in `reviews/test-review.md` |
| check-traceability: "marker names unknown scenario" in docs or sample code | list those paths in `openspec/markers-ignore`, one pattern per line (`docs/`, `**/examples`) |
| doctor: "kit files edited" | intended edits stay yours. Otherwise `update --force` restores them, with backups |
| "answers-gate: … belongs to the OpenSpec of the clone …" | a clone's own `openspec/` is not edited from the meta-repository root. Start a session in the clone to work on it |
| "check-tasks: task group … names no repository" | meta-repository change: start each task group heading with its repository, `## 2. [backend] Order API` |
| doctor: "the clone `…` at … is missing" | clone the repository into that folder, or remove its line from `openspec/clones` |
| subagent: "This command requires approval" | accept the workspace trust dialog, or approve the command once |
