# Decision log (append-only)

Format: date — decision — reason — alternatives. Table decisions D1–D19 live in `CLAUDE.md`;
this log records how they came about and the smaller decisions made along the way.

---

## 2026-10-03 — Planning round with the owner

Recorded in full in `docs/planning.md` (Q1–Q22, confirmed "Looks correct").
Resulting changes to `CLAUDE.md`: D4 changed (Standard → Comprehensive); D7/D8 reworded (split adapter,
stack-agnostic frontend); D13–D19 added; new phase 6 "Handoff"; the store phase became "Split adapter".

## 2026-10-03 — Pristine upstream schema kept as a fixture

- **Decision:** keep an untouched copy of `spec-driven` 1.13.0 at `fixtures/upstream/spec-driven-1.13.0/`.
- **Reason:** a schema `instruction` replaces the built-in one (fact S3). Kit schemas must *append* to the
  upstream text, and a test can only prove that against the original.
- **Alternatives:** read it from the installed package at test time (depends on what the machine has installed).

## 2026-10-03 — XDG profile trick: technically confirmed, owner approval pending

- **Facts:** W4–W6 in `docs/openspec-facts.md`. The trick works and leaves the committed file untouched.
  But a plain `openspec update` — with the developer's own global profile, or with none at all —
  reverts the skills or rewrites the developer's global config.
- **Proposal:** commit `openspec/tooling/xdg/openspec/config.json`. The kit runs every `openspec update`
  through a wrapper that sets `XDG_CONFIG_HOME` (and `OPENSPEC_TELEMETRY=0`) for that one process only.
  Session-start warns when the installed skills drift from the kit profile.
- **Status:** APPROVED by the owner on 2026-10-03 → D20.

## 2026-10-03 — `show --json` lacks requirement/scenario names (fact J5 refuted)

- **Problem:** CLAUDE.md plans traceability on `openspec show --json` names and forbids regex-parsing
  spec markdown. In 1.13.0 the JSON has neither requirement nor scenario names.
- **Options:**
  1. A small parser in the kit, fence-aware, that mirrors OpenSpec's header rules exactly
     (`### Requirement:` / `#### Scenario:` under `## ADDED|MODIFIED…` / main-spec `## Requirements`).
     Tests cross-check it with `show --json`: requirement and scenario **counts and texts** must match.
  2. Identify scenarios by position (requirement index + scenario index) from `show --json`.
     Fragile: any reorder breaks the markers.
  3. Import OpenSpec's internal parser from `node_modules`. Couples the kit to private internals.
- **Recommendation:** option 1.
- **Status:** APPROVED by the owner (option 1) on 2026-10-03 → D21.

## 2026-10-03 — Kit repository under git

- **Decision:** `git init` the kit repo; first commit holds research, planning docs, phase 0 facts and the upstream fixture.
- **Reason:** working rule 4 (conventional commits, small reviewable steps).

## 2026-10-03 — Phase 1 design decisions

- **Questions file layout:** rounds are `##` sections (`## Main round`, `## Specs round`, …) and
  questions are `### Q<n>.` inside them; numbering is unique across the file. *Reason:* later rounds
  live in the same file (CLAUDE.md), so questions need a level below the round. *Alternative:* `## Q<n>`
  with round marker lines — harder to parse per round.
- **Every round ends with a summary confirmation**, even a round with zero questions (it lists the
  decisions/assumptions about to be used). *Reason:* gives hooks one uniform gate per artifact and a
  human check of what the agent will assume.
- **New source tag `[D<n>]`** for registered requirement sources (files in `changes/<x>/sources/`,
  .md/.pdf/.txt — owner decision 2026-10-03). Valid only for statements explicitly in the source.
- **Config fragment = `context` only.** `rules`/`operations` are keyed by artifact/operation id and
  would also reach in-flight `spec-driven` changes (D11). Kit rules live in kit schema instructions.
- **Installer will set `schema: clarify`** as the config default (fact W10); in-flight changes keep
  their own schema (S8).
- **Kit schemas are assembled once** from the upstream text + appended kit rules and then committed;
  `tests/schemas.test.mjs` guards that the upstream text stays a verbatim prefix (via the CLI, no YAML
  parser needed).
- **Managed-file marking:** protocols and `schema.yaml` carry a header comment; templates cannot (the
  header would leak into artifacts) → phase 4 installer tracks kit files with a manifest of hashes.
- **`lean` keeps clarifications inline:** questions asked in a lean change go to a `## Clarifications`
  section of `proposal.md`; requirement trace uses `[desc]` or that section.

## 2026-10-03 — Questions language (D22)

- **Decision:** option C — the questions language is a per-project setting (`Questions language:` line in
  the kit block of config `context`; default English). Structural keywords stay English.
- **Reason:** PO/PM questions are forwarded verbatim; English text would have to be translated. Specs, tests
  and archive keys stay English (D1), so nothing downstream depends on the setting.
- **Alternatives:** all English (A); clarifications always in the team language (B).
- **Installer (phase 4):** asks for the questions language and writes it into the context line.

## 2026-10-03 — Phase 2 design decisions

- **Shared libraries** under `openspec/tooling/lib/`: `markdown`, `spec-parser` (D21), `clarifications`,
  `plan`, `yaml` (zero-dependency subset parser, cross-checked against the CLI), `project`, `report`.
- **Report format** for every check: `{check, ok, skipped?, findings:[{level, file, line, message, hint}]}`;
  `ok` is false only on errors; warnings never fail. CLI: text by default, `--json`; exit 0 / 1
  (usage problems also exit 1, as CLAUDE.md asks for 0/1 only).
- **check-answers modes:** `--artifact <id>` (hook gate before writing), `--round <name>`, and the default
  consistency mode for CI: every round whose artifact already exists must be confirmed. A summary answer
  other than exactly `Looks correct` never passes a gate.
- **New check `check-specs`** for rules OpenSpec does not enforce before archive (facts V5, V6) plus
  the kit's spec rules (no tags/IDs, `#### Scenario:` form, unique scenario names = marker keys).
- **Name matching** (scenario/requirement names in plans, matrices and markers): exact after trimming,
  removing backticks and collapsing whitespace; case-sensitive (same as OpenSpec's requirement matching).
- **Markers input format** for `check-traceability --markers`: JSON array
  `[{level: "unit"|"e2e", capability, scenario, test}]`. Phase 5 adds collectors (verify.yaml) that produce it.
- **Non-kit changes are skipped** by every change-level check (D11); `lint-kit` still lints the whole project.
- **Fixtures:** `fixtures/projects/checks-good` is the single good project; tests plant one defect per case.

## 2026-10-03 — Phase 3 design decisions

- **Hooks fail open.** An internal error exits 1 (non-blocking) with a message; only a real gate failure
  exits 2. A kit bug must never lock the developer out; CI is the backstop.
- **answers-gate also watches Bash** (redirects, tee, cp, mv, sed -i, … into a gated artifact path). Heuristic;
  a false positive only happens while the round is still open, and the message explains it.
- **New PostToolUse hook `artifact-feedback`** (not in the original plan): runs the matching check after an
  artifact is written and feeds errors back as context. Cheap, never blocks, catches grounding/spec mistakes
  at write time instead of in CI.
- **Checks are imported, not spawned,** by hooks (one node process per hook call).
- **`openspec/tooling/kit.json`** holds `kitVersion` and the pinned `openspecVersion` (D12); session-start
  compares the CLI version with it. The installer (phase 4) writes it.
- **Settings merge:** kit hooks are identified by `openspec/tooling/hooks/` in the command; merge removes old
  kit hooks then appends the fragment's groups after the project's own; `removeKitHooks` is the uninstall.
- **Hook commands** use `node "${CLAUDE_PROJECT_DIR}/openspec/tooling/hooks/<hook>.mjs"` (K8).
- **Not done (noted for later):** a hook that resets a confirmed summary when an answer in that round is edited.
  Today the protocol tells the agent to reset it; detecting answer edits needs the previous file version.

## 2026-10-03 — Phase 4 design decisions (installer)

- **Commands:** `sdd-kit install` (= `update`), `status`, `uninstall`; `--dry-run`, `--force`, `--json`,
  `--questions-language`, `--keep-default-schema`, `--skip-openspec`. Entry point `installer/sdd-kit.mjs`,
  exposed as the `sdd-kit` bin of a dependency-free `package.json` (D18).
- **Managed files are tracked by a manifest of sha256 hashes** (`openspec/tooling/kit-manifest.json`) instead of
  header comments (templates cannot carry a header). Update rules: unedited → replaced; edited → kept and
  reported (`--force` replaces it and keeps `.sdd-kit-backup`); a project file at a kit path that the kit did
  not write → never touched; deleted kit file → restored; file dropped from the kit → removed only if unedited.
- **Plan first, write second.** Invalid `settings.json`, a non-literal `context`, or a broken edit result abort
  before anything is written. Config edits are text-level (comments and examples are kept) and every result is
  re-parsed.
- **.gitignore:** whole-dir ignores of `openspec/` / `.claude/` are commented out (`# sdd-kit disabled: …`) and a
  marked block adds `.claude/*` with negations for settings.json, agents/, commands/, skills/openspec-*/; local
  files (settings.local.json, tdd-guard/, worktrees/) stay ignored. Verified with `git check-ignore`. Projects
  that never ignored `.claude/` only get the "keep ignored" lines.
- **OpenSpec CLI through the kit profile:** `init` (new projects) and `update` run with `XDG_CONFIG_HOME` set to
  the kit profile. The project gets `openspec/tooling/bin/openspec.mjs` — the wrapper developers use instead of a
  plain `openspec update` (D20). The installer refuses a CLI that is not the pinned version (D12) unless
  `--allow-version-mismatch`.
- **Default schema:** set to `clarify` only when it was `spec-driven` or missing; a custom default is kept with a
  warning.
- **Uninstall** refuses while active changes use `clarify`/`lean` (unless `--force`), removes unedited kit files,
  restores config / settings / .gitignore exactly (tested byte for byte), and leaves OpenSpec skills alone.
- **Self-check:** install ends with `lint-kit` from the freshly installed tooling; errors give exit code 1.

## 2026-10-03 — Phase 5 design decisions (verification)

- **verification.md is generated from real results** by `openspec/tooling/bin/verify.mjs`: a row is `Met` only
  when every test carrying its scenario marker at that level passed. Only `manual` rows are written by a human
  (kept across runs). Reason: an agent-written matrix can claim `Met` without evidence.
- **Results formats:** `sdd-json` (the kit's pytest plugin, preset `django`) and `playwright-json` (native JSON
  reporter, annotation `type: 'scenario'`, `description: '<capability> :: <Scenario>'`). A flaky Playwright test
  counts as failed (never weaken quality).
- **verify.yaml is project-owned:** created from presets only when missing, never overwritten; presets are
  remembered in the manifest. The pytest plugin is a managed kit file.
- **Stop gate arming:** the gate runs only for changes whose last task was checked (armed by artifact-feedback on
  tasks.md), not on every stop; a green run disarms. Reason: the pilot's full suite takes ~75 s.
- **Re-entry:** a counter per session (reset when `stop_hook_active` is false, i.e. on a new human message)
  blocks at most `stop_block_limit` (3) times, then allows the stop and tells the human (`systemMessage`). After a
  handover the gate stays quiet until files change. Blocking uses exit 2 + stderr (verified, K4).
- **Freshness:** results are tied to a working-tree fingerprint (HEAD + content of changed/untracked files,
  excluding the change's verification.md and tasks.md), stored in `<git dir>/sdd-kit/` (never committed).
  The archive gate refuses when the fingerprint changed since the last green full run, when manual checks are
  pending, when tasks are open (even with `--yes`), or when any check fails.
- **Open (owner):** `.claude/CLAUDE.md` and project skills stay ignored per D6 until the owner decides (asked
  after phase 4).
- **Later:** monorepo/split layouts may need `cd <dir> && …` in verify.yaml commands and path mapping for
  Playwright files (phases 9–10).
