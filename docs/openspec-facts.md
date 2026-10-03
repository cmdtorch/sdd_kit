# OpenSpec facts — verified against the real CLI

**Version:** `@fission-ai/openspec@1.13.0` (installed with `npm i` into a scratch dir; Node v20.20.2, Linux).
**Date:** 2026-10-03.
**Method:** each fact was checked in a throwaway project (`git init` + `openspec init --tools claude`)
using an isolated config dir (`XDG_CONFIG_HOME=<scratch>`, `OPENSPEC_TELEMETRY=0`). Where the behaviour
needed explaining, the CLI source in `dist/` was also read; the file is named in the Evidence column.

Status legend: **VERIFIED**, **REFUTED** (the claim from CLAUDE.md or the docs is wrong for 1.13.0),
**PARTLY** (true with caveats).

Pristine copy of the built-in schema: `fixtures/upstream/spec-driven-1.13.0/`
(`schema.yaml` sha256 `37ace6cc…2f1c`). It matches the verbatim copy in
`research/openspec-stage0-report.md` byte for byte (apart from the markdown fences).

---

## 1. Schemas

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| S1 | `openspec schema fork <src> <name>` copies a schema into `openspec/schemas/<name>/` (`schema.yaml` + `templates/`) | VERIFIED | `fork spec-driven kitx --json` → `{forked:true, destinationPath:…/openspec/schemas/kitx}`. The only changes: `name:` is rewritten, and `requires: [tasks]` becomes `requires: [ tasks ]` | Fork once, then edit. Keep the upstream copy in fixtures so we can diff |
| S2 | An artifact is "complete" as soon as its output file exists; content is never read | VERIFIED | Empty `proposal.md` (via `touch`) → `status`: proposal `done`, specs/design `ready`. The generated propose skill says it too: "`status` is file-existence only" | Gating answers is the job of hooks/checks, never of the schema |
| S3 | A schema `instruction` replaces the built-in one, with nothing prepended or merged | VERIFIED | A marker added to the forked proposal instruction comes back verbatim as `instruction`. With the field removed, `instructions design --json` returns `instruction: undefined` — no fallback | Kit schemas copy the upstream text and **append** to it. A test should check that the upstream text is still a prefix |
| S4 | Misspelled schema fields are silently ignored, and validation does not report them | VERIFIED | `typoTop:` (top level), `requries:` and `instrution:` (artifact level) → `schema validate` gives `valid:true, issues:[]`; the dependency graph ignores `requries` | `lint-kit` must whitelist the fields |
| S5 | `schema validate` catches a missing template file | VERIFIED | `template: nope.md` → `valid:false`, issue `Template file 'nope.md' not found` | — |
| S6 | The schema **directory name** is the lookup key | VERIFIED | Copied `kitx/` to `dirname/` (still `name: kitx`) → listed as `dirname`; `new change --schema dirname` works; the mismatch is never reported | `lint-kit`: `name` must equal the directory name |
| S7 | `openspec update` never touches `openspec/schemas/` | VERIFIED | After `update --force` the edited `templates/design.md` is unchanged and `git status` is clean | Safe to ship schemas there |
| S8 | The schema in `changes/<x>/.openspec.yaml` wins over `config.yaml` | VERIFIED | config `schema: spec-driven`, change created with `--schema kitx` → `status.schemaName: kitx` | D11 works: in-flight `spec-driven` changes keep their schema |
| S9 | Project schemas appear in `openspec schemas --json` with `source: "project"` | VERIFIED | `[{name:"kitx",source:"project"}, {name:"spec-driven",source:"package"}]` | — |

## 2. `config.yaml`

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| C1 | Recognised fields: `schema`, `context`, `rules`, `operations`, `store`, `references` (plus `githubCopilot`) | VERIFIED | `dist/core/project-config.js` reads only these `raw.*` keys | — |
| C2 | Invalid fields are dropped with a warning | **PARTLY** | Wrong *types* in known fields and unknown `operations.*` keys warn. Rule keys that match no artifact in any schema warn (`Unknown artifact ID in rules: "apply"`). **An unknown top-level key (`bogusField: 1`) is ignored with no warning at all** | `lint-kit` must report unknown top-level keys |
| C3 | `context` reaches artifact instructions, apply and archive | VERIFIED | Marker present in `instructions proposal/apply/archive --json` → `context` | Put protocol pointers in `context` |
| C4 | `rules.<artifact>` reach only that artifact's instructions | VERIFIED | `RULE_PROPOSAL_MARKER` only in `instructions proposal`; absent from apply/archive | — |
| C5 | `operations.apply.guidance` / `operations.archive.guidance` reach only apply / archive | VERIFIED | `instructions apply --json` → `operationGuidance: ["OPS_APPLY_MARKER"]`; archive → `["OPS_ARCHIVE_MARKER"]` | Testing rules for apply go in `operations.apply.guidance` |
| C6 | `verify` never receives rules | VERIFIED | `instructions verify` fails ("Artifact 'verify' not found"). The verify skill only runs `status` and `instructions apply`, so it sees `context` + apply guidance, never `rules` | Rules verify needs go in `context` or `operations.apply` |
| C7 | `context` is limited to 50 KB | VERIFIED | A 51.8 KB context → stderr `Context too large (51.8KB, limit: 50KB) / Ignoring context field`; `context` becomes `undefined` (the **whole** context is dropped, not truncated) | Keep `context` short; reference protocol files instead of pasting them |

## 3. JSON outputs used by scripts

| # | Command | Status | Shape (relevant keys) |
|---|---|---|---|
| J1 | `status --change X --json` | VERIFIED | `changeName, schemaName, planningHome{root,…}, artifactPaths{id:{outputPath,existingOutputPaths}}, isPlanningComplete, isComplete, applyRequires, nextSteps, artifacts[{id, outputPath, status: ready\|blocked\|done, requires, missingDeps?}]` |
| J2 | `instructions <artifact> --change X --json` | VERIFIED | `instruction, context, rules[], template, dependencies, unlocks, outputPath, resolvedOutputPath, planningHome` |
| J3 | `instructions apply --change X --json` | VERIFIED | `state: blocked\|ready\|…, progress{total,complete,remaining}, tasks[{id,description,done}], contextFiles{artifact:[paths]}, missingArtifacts, instruction, context, operationGuidance`. Note: task `id` is a running index (`"1"`, `"2"`), **not** the `1.1` number from tasks.md; that number stays inside `description`. `all_done` not seen yet (to check in phase 5) |
| J4 | `instructions archive --change X --json` | VERIFIED | `changeName, context, operationGuidance` |
| J5 | `show X --json` gives structured requirements and scenarios **with names** | **REFUTED** | Change: `deltas[{spec, operation, description, requirement{text, scenarios[{rawText}]}, requirements[…]}]`. Spec (`--type spec`): `requirements[{text, scenarios[{rawText}]}]`. **Neither requirement nor scenario names are in the JSON.** The parser reads the `### Requirement:` / `#### Scenario:` headers but drops the titles (`dist/core/parsers/markdown-parser.js` `parseRequirements`/`parseScenarios`). `--deltas-only` and `--diff` give the same shape | **Traceability by name cannot rely on `show --json`.** Needs a decision (see `docs/decisions.md`, open item) |
| J6 | `validate --all --strict --json` | VERIFIED | `items[{id,type,valid,issues[{level,message}]}], summary{totals,byType}, version`. Exit code 0 when everything is valid |
| J7 | `archive X --json` | VERIFIED | `archive{change, archivedAs, path, specsUpdated, totals{added,modified,removed,renamed}} \| null`, `status[{severity,code,message,fix}]` |

## 4. Validation (`--strict`)

| # | Claim | Status | Evidence |
|---|---|---|---|
| V1 | `#### Scenario:` needs exactly 4 `#` | VERIFIED | `### Scenario:` → INFO "not a Requirement header… ignored" + ERROR "must include at least one scenario" |
| V2 | Every requirement needs at least one scenario | VERIFIED | Same as V1 |
| V3 | Missing SHALL/MUST | VERIFIED | WARNING. Under `--strict` the change is `valid:false` |
| V4 | A change with zero deltas is rejected unless `skip_specs: true` | VERIFIED | ERROR "Change must have at least one delta…"; with `skip_specs: true` → valid + INFO |
| V5 | Requirement description >500 chars fails `--strict` | **REFUTED** | In a change delta: not reported. In a main spec: only **INFO** "Requirement text is very long (>500 characters)", and the spec stays `valid:true` under `--strict` | If the kit wants a hard limit, `lint-kit` enforces it |
| V6 | A new capability needs `## Purpose` of 50+ chars | **PARTLY** | **Not checked on the change delta** — a change with a 10-char Purpose validates and archives. After archive the main spec fails `--strict` (WARNING "Purpose section is too brief") | The kit checks Purpose length **before** archive; otherwise CI turns red after the merge |

## 5. Archive

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| A1 | Incomplete tasks only **warn** | **PARTLY** | With `--json` and without `--yes`: exit 1, `archive_tasks_incomplete` ("Complete the tasks or rerun with --yes"). **With `--yes` it archives anyway** (exit 0) | An agent can bypass this with `--yes` → the kit archive-gate is still needed |
| A2 | Validation at archive time is structural only | VERIFIED | A spec with a short Purpose archived fine (V6) | Same |
| A3 | Archive merges deltas into `openspec/specs/<path>/spec.md` and moves the change to `changes/archive/<date>-<name>` | VERIFIED | `archivedAs: 2026-10-03-c1`, `openspec/specs/demo/data-export/spec.md` created |

## 6. Workflows, profiles, skills

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| W1 | The `core` profile = propose, explore, apply, update, sync, archive. All workflows: + new, continue, ff, bulk-archive, verify, onboard | VERIFIED | `dist/core/profiles.js` `CORE_WORKFLOWS`, `ALL_WORKFLOWS`. A custom profile that has `archive` but not `sync` gets `sync` inserted automatically | — |
| W2 | `openspec-propose` creates **all** artifacts in one pass; `continue` creates one per run | VERIFIED | Propose skill: "generate all artifacts in one step", loops until done. Continue skill: "STOP after creating ONE artifact", "Create ONE artifact per invocation" | Kit profile drops `propose` and uses `new` + `continue` |
| W3 | Profile lives in global `config.json`; `$XDG_CONFIG_HOME` overrides its location on every platform | VERIFIED | `dist/core/global-config.js` `getGlobalConfigDir()` checks `XDG_CONFIG_HOME` first, also on win32 | — |
| W4 | **XDG trick**: a committed project-level `config.json` + `XDG_CONFIG_HOME=<project>/openspec/tooling/xdg openspec update` installs the kit's workflow set | VERIFIED | With `{"profile":"custom","workflows":[new,continue,verify,explore,apply,update,sync,archive], "telemetry":{"enabled":false}}`, `update` removed `propose` and added new/continue/verify. **The committed file was not modified** (byte-identical after `update`). `config list --json` shows the project file | Works. Needs a wrapper (installer / `npm run`-style script) that sets the env var only for that one `openspec` process |
| W5 | Without the trick, a developer's own global profile **reverts** the kit's skills | VERIFIED (new) | With an explicit global `{"profile":"core"}`, `openspec update` removed new/continue/verify and restored propose | The kit must tell developers to run updates through the wrapper. Session-start can warn when installed skills drift from the kit profile |
| W6 | **Migration side effect**: if the global config has no `profile` field (or no file at all), `init`/`update` **writes** a global config, inferring a custom profile from the skills installed in *this* project | VERIFIED (new) | With an empty `XDG_CONFIG_HOME`, `update` created `<xdg>/openspec/config.json` with `profile: custom` and the 8 detected workflows (`dist/core/migration.js` `migrateIfNeeded`) | A developer without a global config who runs plain `openspec update` in a kit project changes **their machine-wide** profile → one more reason to use the wrapper. Document it |
| W7 | Generated skills/commands live in `.claude/skills/openspec-*` and `.claude/commands/opsx/*` | VERIFIED | `init --tools claude` → 6 skills + 6 commands (core) | Can be committed (D6) |
| W8 | `update --force` does not touch `openspec/` | VERIFIED | `git diff -- openspec` empty after `update --force` | — |
| W9 | Telemetry opt-out | VERIFIED | `OPENSPEC_TELEMETRY=0` or `DO_NOT_TRACK=1` (env overrides config); also `telemetry.enabled: false` in config. These env vars also disable the npm version check (`dist/core/version-check.js`) | The wrapper sets `OPENSPEC_TELEMETRY=0` |

## 7. Project layout

| # | Claim | Status | Evidence |
|---|---|---|---|
| L1 | Extra folders under `openspec/` (`tooling/`, `protocols/`) are ignored by the CLI | VERIFIED | With `openspec/tooling/xdg/…` and `openspec/protocols/questions.md` present: `list`, `validate --all --strict`, `doctor --json` (healthy), `update --force` all behave normally and never mention them |
| L2 | `init` creates `openspec/{config.yaml, specs/.gitkeep, changes/archive/.gitkeep}` | VERIFIED | — |
| L3 | `init --language <lang>` exists ("Write new OpenSpec artifacts in this language") | VERIFIED (new) | `init --help`. Not needed: D1 = English |

## 7a. Added in phase 1

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| L4 | Extra files/dirs inside a change dir (`sources/`, `clarifications.md`, `verification-plan.md`) do not disturb `status`/`validate` | VERIFIED | change with `sources/D1.md`: only the usual spec-delta issues are reported | Requirement sources can live in `changes/<x>/sources/` |
| W10 | The `new` skill uses the **config default schema** unless the user names one | VERIFIED | `openspec-new-change/SKILL.md` step 2 ("Use the default schema (omit `--schema`) unless the user explicitly requests…"); the dry run with `schema: clarify` in config created a `clarify` change | Installer sets `schema: clarify` in config; in-flight changes keep theirs (S8) |
| W11 | `init --tools claude` honours the XDG profile like `update` | VERIFIED | `XDG_CONFIG_HOME=<project>/openspec/tooling/xdg openspec init` installed new/continue/verify, no propose | Installer can use `init` or `update` through the wrapper |
| J8 | `show <change> --json` needs `proposal.md` with a `## What Changes` section | VERIFIED (new) | without proposal: `show_error` "has no proposal.md yet"; with `## Why` only: "Change must have a What Changes section" | Kit checks never depend on `show`; the kit parser (D21) reads specs directly |
| J9 | Kit spec parser == `show --json` for requirement texts and scenario bodies | VERIFIED | `tests/lib.test.mjs` cross-check (multi-line text, `**ID**:` metadata, fenced `####`) | — |
| C8 | `.openspec.yaml` fields: `schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities`; the object is not strict → unknown keys ignored silently | VERIFIED | `dist/core/change-metadata/schema.js` | `lint-kit` whitelists them |
| H1 | In `claude -p` (headless) the AskUserQuestion tool is not available | VERIFIED | dry run: agent said so and fell back to listing modes in text | Protocol works without it; hooks must not rely on AskUserQuestion events |

## 8. Not covered in phase 0 (planned later)

- Stores: where a custom schema and `context/rules` resolve for a change living in a store; CI checkout → phase 10 (split adapter). Note: store registration sits under `XDG_DATA_HOME` (`getGlobalDataDir`), **not** `XDG_CONFIG_HOME`, so the XDG trick does not hide stores.
- `references:` read-only behaviour → phase 10.
- `instructions apply` → `state: all_done` → phase 5.
- Claude Code hook semantics (events, stdin JSON, exit code 2, `decision` output, stop-hook re-entry flag) → phase 3, before writing any hook.
