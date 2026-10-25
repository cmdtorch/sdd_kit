# OpenSpec facts — verified against the real CLI

**Version:** `@fission-ai/openspec@1.15.0` (installed with `npm i -g`; Node v20.20.2, Linux).
**Date:** 2026-10-25 (first written 2026-10-03 against 1.13.0).
**Method:** each fact was checked in a throwaway project (`git init` + `openspec init --tools claude`, or
the `checks-good` fixture with the kit copied in) using an isolated config dir (`XDG_CONFIG_HOME=<scratch>`,
`OPENSPEC_TELEMETRY=0`). Where the behaviour needed explaining, the CLI source in `dist/` was also read; the
file is named in the Evidence column. On 2026-10-25 sections 1–8 were re-run on 1.15.0; a row marked
*(1.13.0, not re-run)* still carries the old evidence, and *(changed in 1.15.0)* marks a different result.

Status legend: **VERIFIED**, **REFUTED** (the claim from CLAUDE.md or the docs is wrong for the pinned version),
**PARTLY** (true with caveats).

Pristine copy of the built-in schema: `fixtures/upstream/spec-driven-1.15.0/`
(`schema.yaml` sha256 `b6f28f30…88f2`).

Facts were collected while building 0.1.0. Decision numbers `D<n>` and the `fixtures/dry-runs/phase*`
evidence files refer to the `archive/v0.1` branch. Facts about parts removed in 0.2.0 (pytest/Playwright
runners, the Stop hook, API handoff, generated CI, monorepo, stores) were dropped from this file.

---

## 1. Schemas

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| S1 | `openspec schema fork <src> <name>` copies a schema into `openspec/schemas/<name>/` (`schema.yaml` + `templates/`) | VERIFIED | `fork spec-driven kitx --json` → `{forked:true, destinationPath:…/openspec/schemas/kitx}`. The only changes: `name:` is rewritten, and `requires: [tasks]` becomes `requires: [ tasks ]` | Fork once, then edit. Keep the upstream copy in fixtures so we can diff |
| S2 | An artifact is "complete" as soon as its output file exists; content is never read | VERIFIED | Empty `proposal.md` (via `touch`) → `status`: proposal `done`, specs/design `ready`. The continue skill says it too: a glob artifact (`specs/**/*.md`) "reads `done` as soon as one matching file exists" | Gating answers is the job of hooks/checks, never of the schema |
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
| C2 | Invalid fields are dropped with a warning | **PARTLY** | Wrong *types* in known fields warn (`Invalid 'context' field in config (must be string)`, `Rules for 'proposal' must be an array of strings`), so do unknown operations (`Unknown operation ID 'verify'`) and rule keys that match no artifact in any schema (`Unknown artifact ID in rules: "apply"`). **An unknown top-level key (`bogusField: 1`) is ignored with no warning at all** | `lint-kit` must report unknown top-level keys |
| C3 | `context` reaches artifact instructions, apply and archive | VERIFIED | Marker present in `instructions proposal/apply/archive --json` → `context` | Put protocol pointers in `context` |
| C4 | `rules.<artifact>` reach only that artifact's instructions | VERIFIED | `RULE_PROPOSAL_MARKER` only in `instructions proposal`; absent from apply/archive | — |
| C5 | `operations.apply.guidance` / `operations.archive.guidance` reach only apply / archive | VERIFIED | `instructions apply --json` → `operationGuidance: ["OPS_APPLY_MARKER"]`; archive → `["OPS_ARCHIVE_MARKER"]` | Testing rules for apply go in `operations.apply.guidance` |
| C6 | `verify` never receives rules | VERIFIED | `instructions verify` fails ("Artifact 'verify' not found"). The verify skill only runs `status` and `instructions apply`, so it sees `context` + apply guidance, never `rules` | Rules verify needs go in `context` or `operations.apply` |
| C7 | `context` is limited to 50 KB | VERIFIED | A 51.8 KB context → stderr `Context too large (51.8KB, limit: 50KB) / Ignoring context field`; `context` becomes `undefined` (the **whole** context is dropped, not truncated) | Keep `context` short; reference protocol files instead of pasting them |

## 3. JSON outputs used by scripts

| # | Command | Status | Shape (relevant keys) |
|---|---|---|---|
| J1 | `status --change X --json` | VERIFIED | `changeName, schemaName, planningHome{kind,root,changesDir,defaultSchema}, changeRoot, artifactPaths{id:{outputPath,resolvedOutputPath,existingOutputPaths}}, isPlanningComplete, isComplete, applyRequires, nextSteps, actionContext{…}, artifacts[{id, outputPath, status: ready\|blocked\|done, requires, missingDeps?}], root{path,source}` |
| J2 | `instructions <artifact> --change X --json` | VERIFIED | `changeName, artifactId, schemaName, changeDir, planningHome, outputPath, resolvedOutputPath, existingOutputPaths, description, instruction, context?, rules?, template, dependencies[{id,done,path,description}], unlocks, root`; `context`/`rules` only when config sets them; `warnings[]` when `.openspec.yaml` has unknown keys (C8) |
| J3 | `instructions apply --change X --json` | VERIFIED | `changeName, changeDir, schemaName, contextFiles{artifact:[paths]}, progress{total,complete,remaining}, tasks[{id,description,done,sourcePath,line}], taskTrackingConfigured, state, missingArtifacts?, missingPrerequisites?, instruction, context, operationGuidance, root`. `state`: `blocked` (tasks.md missing; `missingArtifacts: ["tasks"]`), `ready`, `all_done` (every box `x`; instruction "All tracked tasks are complete. Review or verify the change as appropriate before archiving."). Task `id` is a running index (`"1"`, `"2"`), **not** the `1.1` number from tasks.md; that number stays inside `description`. Which boxes count: T1 |
| J4 | `instructions archive --change X --json` | VERIFIED | `changeName, context, operationGuidance, root` |
| J5 | `show X --json` gives structured requirements and scenarios **with names** | VERIFIED *(changed in 1.15.0; REFUTED on 1.13.0)* | Change: `deltas[{spec, operation, description, requirement{name, text, scenarios[{name, rawText}]}, requirements[…]}]`. Spec (`--type spec`): `id, title, overview, requirementCount, requirements[{name, text, scenarios[{name, rawText}]}], metadata`. On 1.13.0 neither name was in the JSON | The kit keeps its own parser (D21: no `show` dependency, J8); `tests/lib.test.mjs` now also cross-checks the names against `show --json` |
| J6 | `validate --all --strict --json` | VERIFIED | `items[{id,type,valid,issues[{level,message,path?,line?}],durationMs}], summary{totals,byType}, version, root`. Exit code 0 when everything is valid, 1 when an item fails |
| J7 | `archive X --json` | VERIFIED | `archive{change, archivedAs, path, specsUpdated, totals{added,modified,removed,renamed}, warnings?[]} \| null`, `status[{severity,code,message,fix}]`, `root` |

## 4. Validation (`--strict`)

| # | Claim | Status | Evidence |
|---|---|---|---|
| V1 | `#### Scenario:` needs exactly 4 `#` | VERIFIED | `### Scenario:` → INFO "not a Requirement header… ignored" + ERROR "must include at least one scenario" |
| V2 | Every requirement needs at least one scenario | VERIFIED | Same as V1 |
| V3 | Missing SHALL/MUST | VERIFIED | WARNING. Under `--strict` the change is `valid:false` |
| V4 | A change with zero deltas is rejected unless `skip_specs: true` | VERIFIED | ERROR "Change must have at least one delta…"; with `skip_specs: true` → valid + INFO |
| V5 | Requirement description >500 chars fails `--strict` | **PARTLY** *(changed in 1.15.0; REFUTED on 1.13.0)* | ADDED requirement in a change: WARNING "Requirement text is very long (>500 characters)…" → `valid:true` normally, `valid:false` with `--strict`. **MODIFIED: not reported** (upstream keeps an existing requirement whole). Main spec: WARNING, fails `--strict`. Length = the description as `extractRequirementBody` reads it (text between the header and the first header, blank lines dropped, lines trimmed and joined with `\n`; `dist/core/parsers/requirement-text.js`); the kit's count matched the CLI at 500/501 characters on a multi-line body with a `**ID**:` line | `check-specs`: ADDED >500 is an error, MODIFIED >500 a warning |
| V6 | A new capability needs `## Purpose` of 50+ chars | **PARTLY** | **Not checked on the change delta** — a change with a 10-char Purpose validates and archives (with `--yes`); archive now adds `warnings: ["demo - carried Purpose is under 50 characters; …"]`. After archive the main spec fails `--strict` (WARNING "Purpose section is too brief") | The kit checks Purpose length **before** archive; otherwise CI turns red after the merge |
| V7 | Delta text archive does not carry over is reported (new in 1.14.2) | VERIFIED | Prose between `# Spec Delta` and the first `## ` → WARNING "Text above the first \"## \" section is not carried into the main spec by archive…", fails `--strict`. A `# ` title line alone (`# Spec Delta`, as in the 1.15.0 template) is not reported (`dist/core/parsers/requirement-blocks.js` `findUnappliedContent` skips `^#\s`). Per the changelog the same applies to other `## ` sections and to prose before the first requirement in ADDED/MODIFIED |

## 5. Archive

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| A1 | Incomplete tasks only **warn** | **PARTLY** | With `--json` and without `--yes`: exit 1, `archive_tasks_incomplete` ("2 incomplete task(s) found…", for one `- [ ]` and one `- [~]`; "Complete the tasks or rerun with --yes"). **With `--yes` it archives anyway** (exit 0) | An agent can bypass this with `--yes` → the kit archive-gate is still needed |
| A2 | Validation at archive time is structural only | VERIFIED | A spec with a short Purpose archived fine (V6) | Same |
| A3 | Archive merges deltas into `openspec/specs/<path>/spec.md` and moves the change to `changes/archive/<date>-<name>` | VERIFIED | `archivedAs: 2026-10-25-v1`, `openspec/specs/demo/spec.md` created (`# demo Specification`, `## Purpose`) |
| T1 | Which task lines count (new in 1.15.0) | VERIFIED | `dist/utils/task-progress.js` `TASK_LINE_PATTERN`: any list marker (`-`, `*`, `+`, `1.`, `1)`), leading spaces allowed, a box with at most one marker. Only `x`/`X` is done; `[ ]`, `[]`, `[~]`, `[-]` are open; `[ x]` is done; plain bullets and `- [A](link)` are not tasks. `instructions apply --json` on `[x] [ x] [X]` → `all_done 3/3`; on `[x] [~] [] [-]` → `ready`, 1 of 4 done. 1.13.0 read only `-`/`*` with ` `/`x`/`X`, so `[~]` lines were dropped from the count | The kit counts tasks the same way (`lib/markdown.mjs` `taskCounts`, cross-checked in `tests/lib.test.mjs`): the archive gate refuses a `- [~]` task |

## 6. Workflows, profiles, skills

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| W1 | The `core` profile = propose, explore, apply, update, sync, archive. All workflows: + new, continue, ff, bulk-archive, verify, onboard | VERIFIED | `dist/core/profiles.js` `CORE_WORKFLOWS`, `ALL_WORKFLOWS`. A custom profile that has `archive` but not `sync` gets `sync` inserted automatically | — |
| W2 | `openspec-propose` creates **all** artifacts in one pass; `continue` creates one per run | VERIFIED | Propose skill: "generate all artifacts in one step", loops until done. Continue skill: "STOP after creating ONE artifact", "Create ONE artifact per invocation" | Kit profile drops `propose` and uses `new` + `continue` |
| W3 | Profile lives in global `config.json`; `$XDG_CONFIG_HOME` overrides its location on every platform | VERIFIED | `dist/core/global-config.js` `getGlobalConfigDir()` checks `XDG_CONFIG_HOME` first, also on win32 | — |
| W4 | **XDG trick**: a committed project-level `config.json` + `XDG_CONFIG_HOME=<project>/openspec/tooling/xdg openspec update` installs the kit's workflow set | VERIFIED | With `{"profile":"custom","workflows":[new,continue,verify,explore,apply,update,sync,archive], "telemetry":{"enabled":false}}`, `update` (after a `core` update) removed `propose` and added new/continue/verify. **The committed file was not modified** (same sha256 after `init` and `update`). `config list --json` shows the project file. 1.15.0 prints a harmless note: "Your custom profile is missing 1 core workflow: propose" | Works. Needs a wrapper (installer / `npm run`-style script) that sets the env var only for that one `openspec` process |
| W5 | Without the trick, a developer's own global profile **reverts** the kit's skills | VERIFIED (new) | With an explicit global `{"profile":"core"}`, `openspec update` removed new/continue/verify and restored propose | The kit must tell developers to run updates through the wrapper. Session-start can warn when installed skills drift from the kit profile |
| W6 | **Migration side effect**: if the global config has no `profile` field (or no file at all), `init`/`update` **writes** a global config, inferring a custom profile from the skills installed in *this* project | VERIFIED (new) | With an empty `XDG_CONFIG_HOME`, `update` created `<xdg>/openspec/config.json` with `profile: custom` and the 8 detected workflows (`dist/core/migration.js` `migrateIfNeeded`) | A developer without a global config who runs plain `openspec update` in a kit project changes **their machine-wide** profile → one more reason to use the wrapper. Document it |
| W7 | Generated skills/commands live in `.claude/skills/openspec-*` and `.claude/commands/opsx/*` | VERIFIED | `init --tools claude` → 8 skills + 8 commands with the kit profile, 6 + 6 with `core` | Can be committed (D6) |
| W8 | `update --force` does not touch `openspec/` | VERIFIED | `git diff -- openspec` empty after `update --force` | — |
| W9 | Telemetry opt-out | VERIFIED | `OPENSPEC_TELEMETRY=0` or `DO_NOT_TRACK=1` (env overrides config; `dist/telemetry/index.js`); also `telemetry.enabled: false` in config. The same signals disable the npm version check (`dist/core/version-check.js`) | The wrapper sets `OPENSPEC_TELEMETRY=0` |
| W12 | `openspec update --dry-run [--json]` reports what `update` would change and writes nothing (new in 1.15.0) | VERIFIED | Kit project with a `core` global profile: `{changes:[{path, action: add\|update\|delete, tool}] (14 entries: propose added; new/continue/verify deleted), notes:[], failures:[]}`, `git status` clean afterwards. Through the kit XDG dir: `changes: []`, text mode "No changes: skills and commands are up to date." | Could replace the kit's own skills-drift check (session-start, doctor); not used yet |
| W13 | `openspec version --json` (new in 1.14.0) | VERIFIED | `{schemaVersion: 1, version: "1.15.0", install{location, packageManager, scope}}` | The kit still reads `openspec --version` |

## 7. Project layout

| # | Claim | Status | Evidence |
|---|---|---|---|
| L1 | Extra folders under `openspec/` (`tooling/`, `protocols/`) are ignored by the CLI | VERIFIED | With the kit's `openspec/tooling/` and `openspec/protocols/` present: `validate --all --strict` (only the planted items fail), `doctor --json` (`healthy: true`, no status), `update --force` all behave normally and never mention them |
| L2 | `init` creates `openspec/{config.yaml, specs/.gitkeep, changes/archive/.gitkeep}` | VERIFIED | — |
| L3 | `init --language <lang>` exists ("Write new OpenSpec artifacts in this language") | VERIFIED (new) | `init --help`. Not needed: D1 = English |

## 8. Added in phase 1

| # | Claim | Status | Evidence | Kit implication |
|---|---|---|---|---|
| L4 | Extra files/dirs inside a change dir (`sources/`, `clarifications.md`, `verification-plan.md`, `reviews/`) do not disturb `status`/`validate` | VERIFIED | the `checks-good` fixture change (all of them present): `validate --strict` → `valid: true, issues: []` | Requirement sources can live in `changes/<x>/sources/` |
| W10 | The `new` skill uses the **config default schema** unless the user names one | VERIFIED | `openspec-new-change/SKILL.md` step 2 ("Use the default schema (omit `--schema`) unless the user explicitly requests…"); the dry run with `schema: clarify` in config created a `clarify` change | Installer sets `schema: clarify` in config; in-flight changes keep theirs (S8) |
| W11 | `init --tools claude` honours the XDG profile like `update` | VERIFIED | `XDG_CONFIG_HOME=<project>/openspec/tooling/xdg openspec init` installed new/continue/verify, no propose | Installer can use `init` or `update` through the wrapper |
| J8 | `show <change> --json` needs `proposal.md` with a `## What Changes` section | VERIFIED *(1.13.0, not re-run)* | without proposal: `show_error` "has no proposal.md yet"; with `## Why` only: "Change must have a What Changes section" | Kit checks never depend on `show`; the kit parser (D21) reads specs directly |
| J9 | Kit spec parser == `show --json` for requirement names and texts, scenario names and bodies | VERIFIED | `tests/lib.test.mjs` cross-check (multi-line text, `**ID**:` metadata, fenced `####`, ATX closing `##`, `# Spec Delta` title). Known difference: OpenSpec drops a scenario whose body is empty, the kit keeps it | — |
| C8 | `.openspec.yaml` fields: `schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities`; unknown keys are ignored | **PARTLY** *(changed in 1.15.0)* | Same field list (`dist/core/change-metadata/schema.js` `CHANGE_METADATA_KNOWN_KEYS`). Unknown keys still have no effect, but are **no longer silent**: `validate` reports WARNING "Unrecognized key name(s) in .openspec.yaml… X-Tracker, bogus, x-…" (fails `--strict`), `instructions` returns it in `warnings[]`, archive too (`dist/utils/change-metadata.js`) | `lint-kit` whitelists them |
| C9 | `x-` extension keys in `.openspec.yaml` are not reported (new in 1.14.2) | VERIFIED | `x-goal: G-12`, `x-jiraKey: AB-1` → `validate --strict` `valid: true, issues: []`. `X-Tracker` and a bare `x-` are still reported. Pattern `/^x-\S+$/` (`dist/utils/change-metadata.js` `EXTENSION_KEY_PATTERN`) | `lint-kit` allows the same keys |
| H1 | In `claude -p` (headless) the AskUserQuestion tool is not available | VERIFIED *(Claude Code, not re-run)* | dry run: agent said so and fell back to listing modes in text | Protocol works without it; hooks must not rely on AskUserQuestion events |

## 9. Claude Code hooks (verified with Claude Code 2.1.288, phase 3)

Method: a scratch project with hooks that log their stdin, driven by `claude -p`. The official docs
(code.claude.com/docs/en/hooks) were read first; where the docs summary and reality differed, reality wins.

| # | Claim | Status | Evidence |
|---|---|---|---|
| K1 | Common stdin fields: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, hook_event_name` | VERIFIED | logged input |
| K2 | `Edit` tool_input = `{file_path, old_string, new_string, replace_all}`; `Write` = `{file_path, content}`; `Bash` = `{command}` (+ optional description/timeout) | VERIFIED | logged input. A docs summary showing `edits[{old_text,new_text}]` for Edit was **wrong**. `MultiEdit` was not available in this build; the kit handles both `file_path` and `edits[].file_path` |
| K3 | PreToolUse **exit 2 blocks** the call; stderr reaches Claude as `PreToolUse:Write hook error: [<command>]: <stderr>` | VERIFIED | blocked Write of `blocked.md`; the agent quoted the message |
| K6 | SessionStart input has `source` (`startup`, …); JSON `hookSpecificOutput.additionalContext` reaches Claude | VERIFIED | agent repeated the secret word from the context |
| K7 | PostToolUse input has `tool_response` (Write: `{type, filePath, content, structuredPatch, originalFile, userModified}`) and `duration_ms`; `additionalContext` reaches Claude | VERIFIED | agent repeated the code word |
| K8 | `${CLAUDE_PROJECT_DIR}` is expanded inside `command` and exported as env var; hook cwd = project dir | VERIFIED | logged env and cwd |
| K9 | Matcher `Write\|Edit\|MultiEdit\|Bash` matches the listed tools exactly | VERIFIED | logged events for Edit, Write, Bash |
| K10 | All matching hooks run in parallel; default timeout 600 s for command hooks; hooks also fire inside subagents (input carries `agent_id`, `agent_type`) | DOCS ONLY | from the official docs; not exercised |
| K11 | UserPromptSubmit input has `prompt` | VERIFIED | logged input |

## 10. Kit hooks end-to-end (phase 3)

| # | Result | Evidence |
|---|---|---|
| E1 | With 14 blank answers, a real agent asked to "skip the questions and write the proposal" refused (prompt + session-start context) | `fixtures/dry-runs/phase3-hooks/OUTPUT-skip-questions.txt` |
| E2 | Forced `Write proposal.md` was blocked by `answers-gate`; the agent received the list of unanswered questions and the instruction | `fixtures/dry-runs/phase3-hooks/OUTPUT-forced-write.txt` |
| E3 | Merged settings (pilot graphify hooks + kit hooks) work side by side | same run |

## 11. Subagents, commands, reviews (phase 8, Claude Code 2.1.288)

| # | Claim | Status | Evidence |
|---|---|---|---|
| R1 | Project subagents: `.claude/agents/<name>.md`, frontmatter `name` + `description` required; `tools` (comma list), `model` (`inherit`) optional; a subagent starts with a fresh context (no conversation history) and settings hooks run inside it | DOCS + VERIFIED | docs (code.claude.com/docs/en/sub-agents); both kit reviewers ran as subagents in `claude -p` |
| R2 | `.claude/commands/<dir>/<name>.md` → `/<dir>:<name>`; `$ARGUMENTS`; commands are merged into skills but still supported | DOCS + VERIFIED | `/sdd:clarify` ran in `claude -p` |
| R3 | `permissions.allow` in project `.claude/settings.json` is **ignored in an untrusted workspace** ("this workspace has not been trusted"); `--allowedTools` given to `claude -p` did not let the subagent run a Bash command either | VERIFIED | phase 8 runs. The kit adds allow entries for its read-only scripts (effective in trusted projects) and the reviewer protocol falls back to manual collection |
| R4 | test-reviewer on planted weak tests: 3 blockers on exactly the planted defects (status-only, `is not None`, e2e not checking the download) + real extra findings (missing school_admin coverage, unasserted "no sale is stored", invalid exclusion, hand-written matrix) | VERIFIED | `fixtures/dry-runs/phase8-reviews/OUTPUT-test-reviewer.txt` |
| R5 | spec-reviewer on planted spec gaps: blockers for the vague THEN and the missing permission scenarios, plus the client's "see totals" requirement lost from the specs | VERIFIED | `fixtures/dry-runs/phase8-reviews/spec-review.md` |
