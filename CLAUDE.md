# CLAUDE.md — sdd-kit

## What this project is

`sdd-kit` is a reusable **Spec-Driven Development template** built on **OpenSpec + Claude Code**.
It will be installed into startup projects (2–3 developers each). It adds to OpenSpec:

1. **AI-DLC-style clarifying questions** — the agent asks structured questions *before* writing
   artifacts, records answers in a file, checks them for vagueness and contradictions, and gets
   an explicit confirmation before generating anything.
2. **Test gates** — scoped tests during TDD, a full test-suite gate at the end of apply,
   and browser **E2E (Playwright)** for key user scenarios.
3. **Traceability** — every spec scenario maps to a test at a declared verification level.
4. **Hard guarantees via hooks and CI**, not just prompts.

You (Claude Code) build the kit in this repository. The human owner reviews and makes decisions.

## Communication

- Talk to the user in **Russian**.
- Everything that ships in the kit (protocols, schemas, templates, scripts, comments, docs) is in **English**.

## Read first

Before any work, read everything in `research/`:

- `docs/goals.md` — the owner's goals, success criteria and priorities. They win over your own
  judgment in trade-offs. Never edit this file; propose changes to the user instead.
- `research/aidlc-analysis-report.md` — deep analysis of an AWS AI-DLC v2.10 installation.
  Section 3 (question mechanism), 9 (code vs prompt enforcement), 10 (prompt patterns) and
  11 (what to port / what not to port) are the most important.
- `research/openspec-stage0-report.md` — reconnaissance of the first pilot project
  (Django backend). Contains the **verbatim built-in `spec-driven` schema and templates of
  OpenSpec 1.13.0** — this is the base we fork.

Then read this whole file again. It contains decisions made in a long design discussion
that are **not** in the research files.

---

## Decisions (do not re-litigate without asking the user)

| # | Decision |
|---|---|
| D1 | Artifact language: **English**. Spec structural keywords stay English (`### Requirement:`, `#### Scenario:`, WHEN/THEN, SHALL/MUST). |
| D2 | AI tool: **Claude Code only**. Hooks are the primary enforcement; CI is the backstop. |
| D3 | Kit tooling runtime: **plain Node.js ESM (`.mjs`), zero dependencies, no build step**. Node is the only runtime guaranteed in every project because the OpenSpec CLI needs it. Use only Node built-ins (`node:fs`, `node:child_process`, `node:test`, …). Must work on Linux/macOS; avoid bash-isms in scripts. |
| D4 | Default question depth: **Comprehensive** (~8–12+ in the main round, fewer in later rounds) — completeness beats speed. Depth levels Minimal/Standard/Comprehensive are configurable; small changes use the `lean` schema (no question rounds). *(Changed 2026-10-03 from Standard; see `docs/planning.md` Q10/Q17.)* |
| D5 | CI: **GitHub Actions**. |
| D6 | `openspec/` is versioned in git; `.claude/` is versioned **selectively** (settings.json, agents, commands, OpenSpec skills). Keep ignored: `settings.local.json`, plugin data (e.g. `.claude/tdd-guard/`), `worktrees/`. The installer patches `.gitignore`. |
| D7 | Topology: **monorepo is the default** for new projects (`backend/`, `frontend/`, `e2e/`, `openspec/`). Split repos are common in existing company projects and stay long-term: they are supported through a **split adapter** where the backend repo is the source of truth and the frontend repo reads it (OpenSpec `references:` / kit command); OpenSpec Stores (beta) is a secondary option. |
| D8 | Kit structure: **core + topology adapters (monorepo, split) + stack presets (django, playwright)**. Frontend stacks vary, so the kit is frontend-stack-agnostic: commands live in `verify.yaml`, no framework-specific frontend preset. |
| D9 | Everything the kit installs into a project goes under `openspec/` (protocols, schemas, `openspec/tooling/`). Outside it only what tools require: `.claude/settings.json`, thin `.claude/agents/*`, thin `.claude/commands/*`, `.github/workflows/*`. Thin files only point to protocols in `openspec/protocols/`. |
| D10 | Never overwrite a project's existing hooks/plugins. The installer **merges** `.claude/settings.json` (the pilot already has graphify hooks and the tdd-guard plugin). |
| D11 | Existing in-flight changes keep their schema. Kit gates apply **only** to changes whose `.openspec.yaml` uses a kit schema (`clarify`, `lean`). |
| D12 | Pin OpenSpec CLI version in kit config (pilot runs **1.13.0**). Hooks warn on mismatch; CI installs exactly the pinned version. |
| D13 | Only the developer who owns the change answers questions. Business questions are marked `For: PO/PM` and written so the developer can forward them verbatim; the developer brings the answers back into the file. No PO/PM tooling. |
| D14 | Client requirements arrive as documents, tracker tasks or verbal/chat text. `clarifications.md` starts with a `## Sources` register (`[desc]` developer description, `[doc]` requirement text/file placed in the change). |
| D15 | **Backend first, then frontend** (no contract-first). Goal: when the backend is done, the frontend starts without questions or chat. The backend change produces **`frontend-handoff.md`** (endpoints, fields, errors, permissions, pagination, examples, API diff) from delta specs + OpenAPI diff; a check requires it when the API changed. |
| D16 | Bad tests = weak assertions and tests not tied to requirements. Every `THEN` must be asserted on an observable outcome. A **`test-reviewer` agent** reviews tests before apply finishes. Mutation testing is "later". |
| D17 | TDD Red→Green enforcement is left to **tdd-guard** (kept, recommended by presets); the kit does not duplicate it. Kit gates: traceability, full suite, E2E, test review. |
| D18 | Distribution: private GitHub repo, install with `npx github:<org>/sdd-kit install` (kit repo has a dependency-free `package.json` with `bin`). Supported OS: Linux, macOS, WSL — no native Windows. |
| D19 | Non-goals: other AI tools, tracker integrations, dashboards/metrics inside the kit, native Windows, manual-QA workflow changes. Success is judged informally by the owner and the team (fewer QA bugs, faster features, less frontend waiting) — no formal measurement. No deadline — quality over speed. |
| D20 | **XDG profile trick approved.** The kit's workflow profile is committed at `openspec/tooling/xdg/openspec/config.json`; every `openspec update` runs through a kit wrapper that sets `XDG_CONFIG_HOME` and `OPENSPEC_TELEMETRY=0` for that process only. Session-start warns when installed skills drift from the kit profile. |
| D21 | **Scenario names come from a kit parser** (`show --json` has no names in 1.13.0). One small fence-aware module mirrors OpenSpec's header rules; tests cross-check it against `show --json` (requirement and scenario counts and texts). All kit scripts use only this module to read specs. |
| D22 | Exception to D1: the **questions** in `clarifications.md` (question text, options, summary bullets) use a per-project *questions language* (`Questions language: <lang>` in config context, default English), so PO/PM questions can be forwarded verbatim. Structural keywords stay English (parsed by checks); all other artifacts stay English. |

---

## Verified OpenSpec facts (from official docs, openspec.dev)

> **Phase 0 (2026-10-03): `docs/openspec-facts.md` is authoritative for 1.13.0.** Corrections to the list below:
> `show --json` has **no** requirement/scenario names (J5); a requirement >500 chars is only INFO under
> `--strict` (V5); a short `## Purpose` is not checked on change deltas, only on main specs after archive (V6);
> `archive --json` refuses incomplete tasks unless `--yes`, which bypasses the check (A1); an unknown top-level
> `config.yaml` key is ignored **silently** (C2); `openspec update` with no global `profile` rewrites the
> developer's global config (W6).

These shape the design. Docs describe a slightly **newer** version than 1.13.0 — always verify
behaviour against the installed CLI before relying on it (see "Working rules").

**Schemas**
- `schema.yaml` top level: `name` (required), `version` (required, positive int), `description`,
  `artifacts` (required), `apply`.
- Artifact fields: `id`, `generates`, `description`, `template` (all required), `instruction`,
  `requires`. `apply`: `requires` (required), `tracks`, `instruction`.
- **An artifact is "complete" as soon as its output file exists. OpenSpec never reads content.**
  → An empty questions file unlocks the next artifact. Answer gating MUST be done by hooks.
- A custom `instruction` **replaces** the built-in one. Fork and **append** to the built-in
  instructions; do not rewrite them (they are good: e.g. design already says "ask the user
  instead of guessing" for decisions that change specs/approach/tasks).
- Misspelled schema fields are silently ignored and validation doesn't report them.
  → The kit needs its own schema/config linter.
- `openspec update` never touches `openspec/schemas/`. Schema dir name is the lookup key.
- Schema is stored per change in `openspec/changes/<name>/.openspec.yaml` and wins over config.

**config.yaml**
- Fields: `schema` (required), `context` (string, ≤50 KB), `rules` (artifact id → list),
  `operations` (`apply`/`archive` → `guidance` list), `store`, `references`.
- `context` reaches every artifact, apply and archive; `rules` reach only that artifact's
  creation; `operations` only apply/archive. **`verify` never receives rules.**
- Docs warn: keep rules short; verbose rules degrade output. → Reference protocol files from
  `context` instead of pasting them.
- Invalid fields are dropped with a warning, never fail a command.

**Workflows / skills / profiles**
- `openspec-propose` creates **all** artifacts in one pass → conflicts with stopping for answers.
  `openspec-continue-change` creates one artifact per run.
- Default profile `core` = explore, propose, apply, update, sync, archive. Optional: new,
  continue, ff, verify, bulk-archive, onboard.
- Profile lives in machine-global `config.json` (`profile`, `delivery`, `workflows`);
  `$XDG_CONFIG_HOME` overrides its location on every platform → candidate trick: a committed
  project-level `config.json` + a wrapper that runs `openspec update` with `XDG_CONFIG_HOME`
  pointing to it (also set telemetry opt-out so the file stays clean). **Verified and approved (D20).**
- Generated skills/commands live in `.claude/` and can be committed.
- Useful built-ins: `explore` (thinking partner, writes nothing until asked), `update` with no
  args (coherence review across artifacts), `verify` (scorecard report, read-only).

**Spec format (delta specs)**
- `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`, `### Requirement: <name>`,
  `#### Scenario: <name>` (exactly 4 #), WHEN/THEN bullets, SHALL/MUST.
- Requirement description ≤500 chars (`--strict` fails above). New capability needs `## Purpose` (50+ chars).
- Requirement **name** is the archive matching key; deltas merge into `openspec/specs/` on archive.
  → Do NOT put change-local IDs (`FR1`) or source tags (`[Q3]`) inside spec text.
- `skip_specs: true` in `.openspec.yaml` for refactor/tooling/docs changes.

**CLI (use JSON for all scripting)**
- `openspec status --change X --json` → per-artifact `done|ready|blocked`.
- `openspec instructions apply --change X --json` → `state: blocked|ready|all_done`, tasks.
- `openspec show X --json` → requirement/scenario **texts only, no names** in 1.13.0. Names come from
  the kit's own spec parser (D21); never ad-hoc regex spec markdown anywhere else.
- `openspec validate --all --strict --json` for CI.
- `openspec archive`: incomplete tasks only **warn**; validation is structural only.
  → The kit needs an archive gate.

**Stores (beta)**
- A store = `openspec/` in its own git repo; code repos use `store: <id>` in their
  `openspec/config.yaml` (store-only mode) or `references:` (read-only).
- No sync by design (never pulls/pushes) → stale checkouts are a real risk.
- `init`, `update`, `templates`, `schemas`, `openspec schema` act on the current dir only.
- Each machine registers the store once (`openspec store register <path>`).
- Unknown, must test: where a custom schema resolves for a change living in a store; where
  `context/rules` are read from; how hooks in a code repo locate store files; CI checkout of
  the store repo. Worksets (beta) open store + repo in one editor window.

---

## What we take from AI-DLC (and what we don't)

Take (all prompt-level, highly portable):
1. Questions file is the source of truth; all answer modes (interactive via AskUserQuestion,
   edit-the-file, free chat/explore) converge into it.
2. Question format: `## Q<n>.`, `Why this is asked:` line, options A–E, an explicit
   `Not yet defined / Not applicable` option, last option `X. Other (please specify)`, blank `[Answer]:`.
3. Topics are guidance, not a script; volume by depth; fewer questions as the lifecycle advances.
4. Self-explanatory questions (expand identifiers, domain language, one line of context).
5. Never re-ask; narrow follow-up that cites the prior answer.
6. Mandatory answer analysis: vague words, 4 contradiction classes (scope, risk, technology,
   timeline-vs-scope), red flags, reframe "up to you".
7. Follow-ups in the same file, continued numbering, `(follow-up to Q<n>)`.
8. Consolidated summary confirmation (`Looks correct` / `Request changes`) before generation.
   Assumptions are listed inside this summary (no separate assumption ritual).
9. Grounding: unselected options never become requirements; assumptions never silently become facts.
10. Build-and-test discipline: verification matrix, `Unverified` counts as failure, never weaken
    quality targets, max 2 fix attempts then halt-and-ask ("giving up is the human's decision").

Do NOT take: directive engine, audit shards, Bolt/swarm/worktrees, composer/scope grid,
learnings ritual, separate assumption-confirmation step, formal sensors, scope-confirmation
question. Keep **one** cycle per artifact: questions → follow-ups → summary → generate.
Advisory review must be narrow ("can a developer and QA start without asking anything?").

---

## Target architecture

### Kit schemas

**`clarify`** (features), forked from 1.13.0 `spec-driven`:

| Artifact | requires | Question round | Notes |
|---|---|---|---|
| `clarifications` (`clarifications.md`) | — | main round: goal, users, in/out of scope, success, constraints | one explicit boundary question |
| `proposal` | clarifications | none | source tags `[Q<n>]` / `[assumption]`, `## Assumptions & Open Questions` |
| `specs` | proposal | round on 6 completeness dimensions (functional, NFR, scenarios & errors, business, technical, quality) | standard OpenSpec delta format, no tags inside |
| `design` | proposal | architectural forks only | decisions cite `[Q<n>]` |
| `verification-plan` | specs, design | which scenarios are critical, test data, environment | each scenario → level (`unit/integration`, `e2e`, `manual`) + requirement→question trace table |
| `tasks` | specs, design, verification-plan | none | each task group lands its own tests (incl. E2E); final group = integration run only |
| apply | tasks, verification-plan | only on real gaps | TDD; scoped tests; full-suite gate; E2E; fill matrix |

Later rounds live as sections of the same `clarifications.md`
(`## Specs round`, `## Design round`, `## Verification round`).
`verification.md` (the matrix: scenario, level, expected, actual, evidence, verdict
`Met|Not Met|Unverified`) is written at the end of apply.

**`lean`** (small changes): proposal → specs → verification-plan → tasks; no question rounds,
same verification and gates.

### Verification levels

1. **Unit/integration** (e.g. pytest + factory-boy + DRF APIClient) — TDD during apply, run scoped.
2. **Full-suite gate** — whole suite + project quality gate (e.g. `make check`) at the end of apply.
3. **Contract check** (preset) — OpenAPI schema export/diff (e.g. drf-spectacular); feeds `frontend-handoff.md` (D15) and CI.
4. **Browser E2E (Playwright)** — key user journeys only.

Scenario markers:
- pytest: `@pytest.mark.scenario("<capability-path>", "<Scenario name>")`, collected via `pytest --collect-only`.
- Playwright: test tags/annotations carrying capability + scenario name, collected via `npx playwright test --list --reporter=json`.

### verify.yaml (per project, stack-agnostic contract)

Scripts never hardcode a stack; they read `openspec/tooling/verify.yaml`, e.g.:

```yaml
openspec_version: 1.13.0
levels:
  unit:
    scoped: "make test FILE={targets}"
    full: "make test"
    gate: "make check"
    collect_scenarios: "<command that prints scenario markers as JSON>"
  e2e:
    run: "npx playwright test --grep {tags}"
    full: "npx playwright test"
    collect_scenarios: "npx playwright test --list --reporter=json"
hooks:
  e2e_gate: scoped        # scoped | full | off
  stop_block_limit: 3
```

Exact shape is yours to design; keep it small and documented. Presets: `django`, `playwright`.

### Checks (`openspec/tooling/checks/*.mjs`, CLI + used by hooks and CI)

- `check-answers` — no blank `[Answer]:` (blank or only underscores) in the required section;
  summary answer is exactly `Looks correct`.
- `check-grounding` — every substantive block in `proposal.md`/`design.md` carries `[Q<n>]`,
  `[desc]` or `[assumption]`; every `[Q<n>]` exists and is answered; `[assumption]` only in the assumptions section.
- `check-traceability` — every scenario from `openspec show --json` appears in
  verification-plan with a level and has a test with the matching marker at that level (or an explicit exclusion).
- `check-verification` — matrix covers all scenarios; no `Not Met` / `Unverified`.
- `lint-kit` — unknown fields in kit schemas and `config.yaml` (OpenSpec ignores them silently).
- `check-specs` (added in phase 2) — Purpose ≥50 chars for new capabilities, requirement text ≤500,
  `#### Scenario:` form, unique scenario names per capability, no tags/IDs in spec text
  (OpenSpec 1.13.0 does not enforce these before archive).

All checks: clear human-readable messages, `--json` output, exit codes 0/1, tested with `node:test`.

### Hooks (`openspec/tooling/hooks/*.mjs`, registered in `.claude/settings.json`)

1. **answers-gate** — PreToolUse on Write/Edit/MultiEdit: if the target is a kit artifact of a
   kit-schema change, run `check-answers` for the section that artifact depends on; block with an
   explanation of what is missing.
2. **e2e/test gate** — Stop: when `openspec instructions apply --json` says the change is in apply,
   run the full-suite gate and scoped E2E + `check-traceability`; on failure return the output to the
   agent. Respect the stop-hook re-entry flag and a block counter, then hand over to the human.
3. **archive-gate** — PreToolUse on Bash matching `openspec archive`: require `check-verification`.
4. **session-start** — print active change status, open questions, stale store checkout warning.
5. **artifact-feedback** (added in phase 3) — PostToolUse on Write/Edit of a kit artifact: run the matching
   check and return its errors as `additionalContext` (never blocks).

Verify current Claude Code hook semantics (events, stdin JSON fields, exit code 2, JSON
`decision` output, stop-hook re-entry flag) against the official Claude Code docs before coding.
Writes through Bash can bypass Write/Edit matchers — CI is the backstop.

### Other pieces

- `openspec/protocols/questions.md`, `grounding.md`, `testing.md` — referenced from config `context`.
- `config.yaml` fragment: short `context` (project facts + protocol pointers + language),
  short `rules`, `operations.apply.guidance` for testing rules.
- `.claude/agents/spec-reviewer.md` — runs after specs, gets only specs + clarifications,
  outputs `review.md` with READY/NOT-READY and a findings table; findings go to the human.
- `.claude/agents/test-reviewer.md` — runs before apply finishes, gets specs + verification-plan +
  test diff; flags weak assertions (a `THEN` not asserted on an observable outcome) and tests not
  traced to a scenario (D16).
- `.claude/commands/clarify.md` — ad-hoc question round for the current change.
- GitHub Actions templates: kit checks, `openspec validate --all --strict`, unit gate,
  Playwright (browser install, cache, HTML report artifact), archive check.
- Installer `install.mjs`: copy core + chosen adapter + presets, merge settings.json, patch
  `.gitignore`, set profile (new, continue, verify, explore, apply, update, sync, archive),
  generate `verify.yaml` from preset. Re-running updates only kit-managed files
  (marked with a header comment) and never touches user edits.

### Kit repository layout (proposal, adjust if you find better)

```
sdd-kit/
├─ CLAUDE.md
├─ research/                 # input reports (read-only)
├─ docs/
│  ├─ decisions.md           # running decision log (append-only)
│  ├─ progress.md            # phase checklist with status
│  └─ openspec-facts.md      # facts verified against the real CLI, with version
├─ kit/
│  ├─ core/                  # mirrors the target project layout (openspec/, .claude/)
│  ├─ adapters/{monorepo,split}/
│  ├─ presets/{django,playwright}/
│  └─ ci/
├─ installer/install.mjs
├─ fixtures/                 # sample projects / changes for tests (fake commands are fine)
└─ tests/                    # node:test suites
```

---

## Phases

Update `docs/progress.md` as you go. Stop and report to the user at the end of each phase.

| Phase | Deliverable | Done when |
|---|---|---|
| 0. Bootstrap | Install pinned OpenSpec in a scratch dir, fork `spec-driven`, record verified facts in `docs/openspec-facts.md` (completion rule, instruction replacement, `operations`, JSON outputs of `status`/`instructions apply`/`show`, `validate --strict`, XDG profile trick, extra folders under `openspec/` are ignored by CLI) | every fact above marked verified/refuted for 1.13.0 |
| 1. Prompt layer | protocols, `clarify` + `lean` schemas and templates (`## Sources`, `For: Dev \| PO/PM` marks, Comprehensive default), config fragment | `openspec schema validate` passes; a dry-run change in a fixture produces a good questions file and stops |
| 2. Checks | all checks + `lint-kit` with `node:test` suites over good/broken fixtures | every planted defect is caught |
| 3. Hooks | answers-gate, session-start, settings merge | proposal cannot be written with blank answers; existing hooks preserved |
| 4. Installer (repo-local) | `install.mjs`, idempotent update | install into a scratch project, run, re-run, uninstall-safe |
| 5. Verification | verify.yaml + presets, test gate, matrix, archive-gate | apply cannot finish with failing tests; archive blocked without green matrix; no infinite stop loop |
| 6. Handoff | `frontend-handoff` artifact, OpenAPI export command in verify.yaml, `check-handoff`, archive-gate requires handoff when API changed, frontend-side import command | a backend change with API edits cannot archive without a complete handoff; a frontend change starts from it with UI-only questions |
| 7. CI | workflow templates | red PR on missing scenario test or failing test |
| 8. Reviewers + /clarify | `spec-reviewer`, `test-reviewer` agents and `/clarify` command | reviews yield concrete findings (weak assertions, untraced tests) |
| 9. Monorepo adapter | layout + single CI with docker-compose + Playwright | sample monorepo green end-to-end |
| 10. Split adapter | backend repo is the source of truth, frontend reads via `references:` / kit command; Stores experiments are secondary | sample split pair works end-to-end; findings in `docs/decisions.md` |
| 11. Docs & release | README for teams, install/update guide, versioning | a new developer installs in <10 min |

The first real pilot (Django backend, separate frontend repo) is done by the user after phase 5.
Pilot facts: Django 5.2 + DRF, Python 3.13, uv, pytest/pytest-django/factory-boy/xdist,
`make test FILE=...`, `make check FILE=...`, full suite ~75 s, strict TDD with tdd-guard plugin,
graphify hooks, 8 in-flight changes on `spec-driven`, `openspec/` and `.claude/` currently gitignored.

---

## Open questions (ask the user when you reach them)

- ~~Frontend stack of the pilot~~ — resolved: stacks vary, kit is stack-agnostic (D8).
- How E2E gets a backend for a frontend PR in split repos (docker image from ECR by tag?).
- ~~Whether the XDG profile trick is acceptable~~ — resolved: yes (D20).
- ~~Store vs `references:`~~ — resolved: backend repo is the source, frontend reads (D7).
- Which requirement file formats to accept in `[doc]` sources (`.docx` is unreadable without deps — ask for md/pdf/text?) — phase 1.
- CI budget for full suite + E2E on every PR — phase 7.

---

## Working rules

1. **Verify, don't assume.** OpenSpec docs are ahead of 1.13.0. Before relying on any CLI
   behaviour or field, test it in a scratch directory (`/tmp/...`) with the pinned version and
   record the result in `docs/openspec-facts.md`. Same for Claude Code hook semantics.
2. **Zero dependencies.** No npm packages in the kit tooling. Node built-ins only.
3. **Tests first** for checks, hooks and installer (`node --test`). Every bug gets a regression test.
4. **Small, reviewable steps**; conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
5. **Log decisions** in `docs/decisions.md` (date, decision, reason, alternatives). If a decision
   contradicts the table above, stop and ask.
6. **Short prompts.** Protocol files can be detailed; `config.yaml` rules and thin agent/command
   files stay short and point to protocols.
7. **Never break a host project**: merge, don't overwrite; kit-managed files carry a header;
   unknown existing files are left alone.
8. Do not touch `research/`.
9. At the end of each phase, check the result against `docs/goals.md` and report which
   success criteria moved forward.