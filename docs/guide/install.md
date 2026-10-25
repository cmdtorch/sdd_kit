# Install, update, uninstall, onboarding

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js ≥ 20 | the kit's tooling and the OpenSpec CLI | your usual way (nvm, package manager) |
| OpenSpec CLI **1.15.0** (pinned) | specs and changes | `npm i -g @fission-ai/openspec@1.15.0` |
| Claude Code | the agent; the kit's hooks run inside it | https://code.claude.com |
| git | the kit finds test markers through git | — |

Linux, macOS and WSL are supported. Native Windows is not.

The kit does not depend on the project's language, framework or repository layout. It never runs tests: the agent
uses the project's own commands. Write them into `CLAUDE.md` or the README (how to run one test file, the whole
suite, lint and type checks).

## Installing into a repository (once, by the team lead)

```bash
npx github:cmdtorch/sdd_kit#v0.3.0 install --dry-run   # show the plan, write nothing
npx github:cmdtorch/sdd_kit#v0.3.0 install
```

Always name a release tag (`#v0.3.0`): without one, npx installs whatever is on `main`. Releases and their notes:
https://github.com/cmdtorch/sdd_kit/releases.

In a terminal the installer asks one question: the language of the clarifying questions.

Options:

| Option | Meaning |
|---|---|
| `--target <dir>` | project root (default: current directory) |
| `--questions-language <lang>` | language of the clarifying questions. They are often forwarded as they are, so use the language the team speaks. Default: keep the current setting, else English. Artifacts stay English |
| `--keep-default-schema` | do not make `clarify` the default schema for new changes |
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
5. Edits `.gitignore` so that `openspec/` and the shared parts of `.claude/` (settings.json, agents, commands, OpenSpec
   skills) are versioned, while `settings.local.json`, plugin data and worktrees are not.
6. Runs `openspec update` with the kit profile: `new`, `continue`, `apply`, `verify`, … but not `propose`, which writes
   every artifact in one pass and so skips the question rounds.
7. Ends with a self-check (`lint-kit`).

Nothing is written if a step cannot be done safely (e.g. invalid `settings.json`). Review the diff, then commit:
`openspec/`, `.claude/settings.json`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/openspec-*`,
`.gitignore`.

## Onboarding a developer

The kit is committed with the repository; nothing is installed per developer except the prerequisites.

1. `npm i -g @fission-ai/openspec@1.15.0` (and Node 20+, Claude Code).
2. Clone the repository.
3. `node openspec/tooling/bin/doctor.mjs` — checks Node, the OpenSpec version, Claude Code, hooks, skills and edited
   kit files, and says how to fix each problem.
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
| subagent: "This command requires approval" | accept the workspace trust dialog, or approve the command once |
