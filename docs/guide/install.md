# Install, update, uninstall, onboarding

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Node.js ≥ 20 | the kit's tooling and the OpenSpec CLI | your usual way (nvm, package manager) |
| OpenSpec CLI **1.13.0** (pinned) | specs and changes | `npm i -g @fission-ai/openspec@1.13.0` |
| Claude Code | the agent; the kit's hooks run inside it | https://code.claude.com |
| git | freshness of verification results, CI | — |
| your stack's test tools | whatever `openspec/tooling/verify.yaml` runs (e.g. `uv`, `make`, `npx`) | — |

Linux, macOS and WSL are supported. Native Windows is not (decision D18).

## Installing into a repository (once, by the team lead)

```bash
npx github:<org>/sdd-kit install [options] --dry-run   # show the plan, write nothing
npx github:<org>/sdd-kit install [options]
```

Options:

| Option | Meaning |
|---|---|
| `--target <dir>` | project root (default: current directory) |
| `--questions-language <lang>` | language of the clarifying questions. PO/PM questions are forwarded as they are, so use the language the business speaks. Default: keep the current setting, else English. Artifacts stay English |
| `--preset <names>` | `django` (pytest plugin + drf-spectacular API export), `playwright` (browser E2E). Creates `openspec/tooling/verify.yaml` when it does not exist yet |
| `--adapter <name>` | `monorepo` or `split`; remembered for updates |
| `--role <backend\|frontend>` | split adapter: which side this repository is |
| `--store-id <id>` | split adapter: store id of the backend repository (default `backend`) |
| `--backend-path <dir>` | split adapter, frontend: register this backend checkout on this machine |
| `--ci` | also write `.github/workflows/sdd-kit.yml` (generated for the presets) |
| `--keep-default-schema` | do not make `clarify` the default schema for new changes |
| `--skip-openspec` | do not run the OpenSpec CLI (no `init`/`update` of the skills) |
| `--allow-version-mismatch` | accept an OpenSpec CLI other than the pinned one (not recommended) |
| `--force` | replace kit files you edited locally (a `.sdd-kit-backup` copy is kept) |
| `--yes` | never ask questions |
| `--json` | machine-readable output |
| `--dry-run` | show the plan, write nothing |

What the installer does:

1. Runs `openspec init --tools claude` with the kit's workflow profile if the repository has no `openspec/` yet.
2. Copies the kit into `openspec/`: protocols, schemas, `tooling/` (checks, hooks, tools). It also copies the
   subagents and `/sdd:clarify` into `.claude/`.
3. Adds the kit block to `context` in `openspec/config.yaml` and makes `clarify` the default schema. In-flight
   changes keep their own schema (D11).
4. Merges the kit's hooks and permissions into `.claude/settings.json`. Your own hooks and plugins (e.g. graphify,
   tdd-guard) stay as they are.
5. Edits `.gitignore` so that `openspec/` and the shared parts of `.claude/` (settings.json, agents, commands, OpenSpec
   skills) are versioned, while `settings.local.json`, plugin data and worktrees are not.
6. Runs `openspec update` with the kit profile: `new`, `continue`, `apply`, `verify`, … but not `propose`, which writes
   every artifact in one pass and so skips the question rounds.
7. Ends with a self-check (`lint-kit`).

Nothing is written if a step cannot be done safely (e.g. invalid `settings.json`). Review the diff, then commit:
`openspec/`, `.claude/settings.json`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/openspec-*`,
`.gitignore`, `.github/workflows/sdd-kit.yml`.

After installing:

- `openspec/tooling/verify.yaml` belongs to your project. Check that its commands are the ones your team runs.
- django preset: register the pytest marker (see `kit/presets/django/PRESET.md`).
- API handoff (`api` in verify.yaml): on the main branch, run `node openspec/tooling/bin/api.mjs snapshot` once and
  commit the baseline.

## Onboarding a developer (under 10 minutes)

The kit is committed with the repository; nothing is installed per developer except the prerequisites.

1. `npm i -g @fission-ai/openspec@1.13.0` (and Node 20+, Claude Code).
2. Clone the repository.
3. Split frontend only: clone the backend too and register it:
   `node openspec/tooling/bin/openspec.mjs store register ../backend --id backend --yes`.
4. `node openspec/tooling/bin/doctor.mjs` — checks Node, the OpenSpec version, hooks, skills, test tools, the API
   baseline and the backend store, and says how to fix each problem.
5. Open Claude Code in the repository and **accept the workspace trust dialog**. Until then Claude Code ignores
   the project's `permissions.allow` entries, so the kit's read-only scripts ask for approval.

## Updating the kit

```bash
npx github:<org>/sdd-kit#v<version> update     # same as install; presets, adapter and --ci are remembered
npx github:<org>/sdd-kit status                # version, edited files, hooks, questions language
```

- Kit files you did not edit are replaced.
- Kit files you edited are kept and reported. `--force` replaces them and keeps a `.sdd-kit-backup` copy.
- Files that are not the kit's are never touched.
- `verify.yaml` and `.openspec-store/store.yaml` are yours and are never overwritten.
- Read the [changelog](../../CHANGELOG.md) before a MAJOR update.

**Never run a plain `openspec update`.** It applies your personal OpenSpec profile, which puts `propose` back. If the
global config has no profile, it even rewrites your machine-wide settings. Use
`node openspec/tooling/bin/openspec.mjs update`; session start warns when the skills drifted.

## Uninstalling

```bash
npx github:<org>/sdd-kit uninstall --dry-run
npx github:<org>/sdd-kit uninstall
```

- Removes the kit files you did not edit.
- Restores `config.yaml`, `settings.json` and `.gitignore`.
- Removes the frontend `references` entry the kit added.
- Refuses while active changes still use the kit schemas: archive them first, or use `--force`.
- OpenSpec skills stay as they are; run `openspec update` afterwards to return to your personal profile.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "answers-gate: proposal … cannot be written yet" | a question round is open. Answer the questions in `clarifications.md` and confirm the summary with exactly `Looks correct` |
| the agent keeps working after saying it is done | the test gate found failing tests or unplanned scenarios. After 3 attempts it hands over to you |
| "archive-gate: … no full verification run on record" | run `node openspec/tooling/bin/verify.mjs --change <c>`. It must be run again after any file changes |
| "the API changed after the baseline was updated" | `api.mjs diff --change <c>`, update `frontend-handoff.md`, `api.mjs snapshot` |
| doctor: "kit files edited" | intended edits stay yours. Otherwise `update --force` restores them, with backups |
| subagent: "This command requires approval" | accept the workspace trust dialog, or approve the command once |
| "referenced store is not registered on this machine" | `node openspec/tooling/bin/openspec.mjs store register <path> --id <id> --yes` |
