# Progress

| Phase | Status | Notes |
|---|---|---|
| Planning | ✅ done | `docs/planning.md`, goals filled in, CLAUDE.md updated (D4, D13–D19, phases) |
| 0. Bootstrap | ✅ done | `docs/openspec-facts.md`; upstream fixture; D20 (XDG trick), D21 (kit spec parser) |
| 1. Prompt layer | ✅ done | protocols, `clarify` + `lean`, config fragment, kit profile; dry run in `fixtures/dry-runs/` |
| 2. Checks | ✅ done | 6 checks + 7 libs; 101 tests; 49 planted defects caught |
| 3. Hooks | ✅ done | answers-gate, session-start, artifact-feedback, settings merge; hook semantics verified (facts §9) |
| 4. Installer | ✅ done | `sdd-kit install/update/status/uninstall`; npx from a packed tarball: ~8 s |
| 5. Verification | ✅ done | verify.yaml + presets, verify.mjs, test-gate (Stop), archive-gate; real pytest/Playwright checked; **pilot can start** |
| 6. Handoff | ✅ done | api.mjs (diff/snapshot/check), openapi diff, handoff protocol, check-handoff, archive gate, handoff.mjs import; real UI-only questions |
| 7. CI | ✅ done (not yet run on GitHub) | ci.mjs checks/verify, generated workflow (--ci), kit repo CI; actionlint clean |
| 8. Reviewers + /clarify | ✅ done | spec-reviewer, test-reviewer, /sdd:clarify, review-input + heuristics; real reviews found every planted defect |
| 9. Monorepo adapter | ✅ done (compose stack not run here) | `cwd` levels, `--adapter monorepo`, sample monorepo green end to end with real pytest + Playwright |
| 10. Split adapter | ✅ done | Stores/references experiments answered; `--adapter split --role …`; real split pair works end to end |
| 11. Docs & release | ✅ done | README, guides (install, workflow, pilot, releasing), doctor.mjs, versioning + CHANGELOG; v0.1.0 tagged locally |

## Phase 0 — checklist

- [x] Pinned OpenSpec 1.13.0 installed in a scratch dir (isolated config, telemetry off)
- [x] `spec-driven` forked; pristine copy saved to `fixtures/upstream/spec-driven-1.13.0/`
- [x] Completion rule (file existence) — verified
- [x] Instruction replacement — verified
- [x] `context` / `rules` / `operations` reach — verified
- [x] JSON of `status`, `instructions <artifact|apply|archive>`, `show`, `validate`, `archive` — recorded
- [x] `validate --strict` — verified; 500-char rule and the Purpose check refuted/partial
- [x] XDG profile trick — works; plus two side effects found (W5, W6)
- [x] Extra folders under `openspec/` ignored — verified
- [x] Owner decisions: XDG trick approved (D20); kit spec parser (D21)
- [x] Repo put under git

## Phase 0 vs goals (`docs/goals.md`)

- *"ИИ задает все вопросы…"* — no direct progress; we confirmed that answer gating must be done by hooks (S2).
- *"Система ставится быстро"* — XDG trick confirmed → one command can install the kit's workflow set.
- *"Хорошие тесты"* — found a blocker for scenario→test traceability (J5); a solution is proposed.

## Phase 1 — checklist

- [x] Protocols: `questions.md`, `grounding.md`, `testing.md` (`kit/core/openspec/protocols/`)
- [x] `clarify` schema + templates (clarifications, verification-plan; proposal/design + Assumptions section)
- [x] `lean` schema + templates
- [x] Config fragment (`kit/core/config-fragment.yaml`, context only) and kit workflow profile (`tooling/xdg`)
- [x] `openspec schema validate` passes for both; `tests/schemas.test.mjs` (16 tests) green; planted defect caught
- [x] Dry run (`claude -p` on `fixtures/projects/school-api`): 14 good questions, sources saved, agent stops;
      `/opsx:continue` with blank answers refuses to write the proposal (prompt-level gate)
- [x] Owner: questions language is a project setting (D22)

## Phase 1 vs goals

- *"ИИ задает все вопросы…"* — moved: the dry run turned a 4-sentence vague request into 14 concrete
  questions (permissions, statuses, which date, which class, totals, email schedule, scope boundary, language).
- *"Разрабы не блокают друг друга"* — PO/PM questions are marked and forwardable (13 of 14 in the dry run).
- *"Хорошие тесты"* — `testing.md` defines strong assertions and scenario markers; enforcement comes in phases 2, 5, 8.

## Phase 2 — checklist

- [x] Libraries: markdown, spec-parser (D21, matches `show --json`), clarifications, plan, yaml, project, report
- [x] `check-answers` (artifact / round / CI modes), `check-grounding`, `check-specs` (new), `check-traceability`
      (plan + trace + markers), `check-verification`, `lint-kit`
- [x] Every check: human-readable text, `--json`, exit 0/1, `--help`, root discovery from subdirectories
- [x] `tests/checks.test.mjs`: good fixture clean in all 6 checks; 49 planted defects, each caught with the right message;
      warnings for marker typos / missing markers / missing kit block; non-kit changes skipped
- [x] Real dry-run file: `check-answers --artifact proposal` → 14 unanswered + no summary = blocked

## Phase 2 vs goals

- *"ИИ задает все вопросы…"* — the gate is now mechanical: the proposal cannot pass `check-answers` with blank
  answers or without the exact "Looks correct" (hooks wire it in phase 3).
- *"Хорошие тесты"* — `check-traceability` proves every scenario has a planned level and a marked test;
  `check-verification` refuses `Unverified`. Assertion strength itself is the test reviewer's job (phase 8).

## Phase 3 — checklist

- [x] Claude Code hook semantics verified empirically on 2.1.288 (facts §9; two docs-summary errors found)
- [x] `answers-gate` (PreToolUse Write|Edit|MultiEdit|Bash): blocks gated artifacts, explains what is missing
- [x] `session-start`: per-change status, open questions, CLI version and skills drift warnings
- [x] `artifact-feedback` (PostToolUse): check errors returned to the agent right after writing
- [x] `settings-merge`: pilot graphify hooks preserved, idempotent, update replaces old kit hooks, clean removal
- [x] `tests/hooks.test.mjs`: 22 tests (real processes, Claude Code-shaped input)
- [x] End-to-end with real Claude Code: proposal cannot be written with blank answers (E1, E2)

## Phase 3 vs goals

- *"ИИ задает все вопросы… / AI не начинает без подтверждённых ответов"* — now enforced by a hook, not only
  by the prompt: the proposal cannot be written while the Main round is open (E2).

## Phase 4 — checklist

- [x] `installer/sdd-kit.mjs` + `installer/lib/{manifest,gitignore,config-edit}.mjs`, `package.json` with `bin`
- [x] Install into a pilot-shaped project (`fixtures/projects/pilot-like`): kit files, config block, schema
      default, settings merge (graphify kept), .gitignore per D6 (checked with `git check-ignore`), lint-kit clean
- [x] Re-run is byte-for-byte idempotent; dry run writes nothing; invalid settings → nothing written
- [x] Update with a newer kit: unedited files updated, edited kept (conflict persists), `--force` with backup,
      foreign files never touched, deleted restored, dropped removed
- [x] Uninstall restores the original project byte for byte (except kept edited files); refuses while kit-schema
      changes exist
- [x] Real OpenSpec CLI: new project gets the kit profile skills (no propose); the developer's global config dir
      stays empty; a pilot with `core` skills is switched to the kit profile, project skills untouched
- [x] `npm pack` + `npx --package=<tgz> sdd-kit install` in an empty repo: works, ~8 s
- [x] `tests/installer.test.mjs`: 20 tests

## Phase 4 vs goals

- *"Система ставится на комп разраба очень быстро и без усилий"* — one command, ~8 s, safe to re-run and to
  remove. Still needed for "<10 min for a new developer": README / install guide (phase 11) and publishing the
  kit to the company's private GitHub.

## Phase 5 — checklist

- [x] `verify.yaml` contract + validation (also in lint-kit); presets `django` (pytest plugin) and `playwright`
- [x] pytest plugin verified with real pytest 9.1.1 and xdist; Playwright 1.63 JSON verified (list + run)
- [x] `verify.mjs`: full / scoped runs, matrix from real results, manual rows preserved, state + fingerprint
- [x] `test-gate` (Stop): armed by the last checked task; blocks with failures; limit 3; handover; quiet until changes
- [x] `archive-gate` (PreToolUse Bash): open tasks, failed checks, stale or failed verification, pending manual checks
- [x] Installer `--preset` (remembered), verify.yaml composed once and then owned by the project
- [x] Tests: 170 total (26 in `tests/verify.test.mjs`), real pytest test with `SDD_KIT_PYTHON`
- [x] Real Claude Code: apply cannot finish with a failing test; no infinite stop loop; archive blocked (facts §12)

## Phase 5 vs goals

- *"Разработка на TDD… ИИ себя проверяет"* — the agent cannot end apply with red tests; the result is checked
  by the machine, not reported by the agent.
- *"Хорошие тесты"* — a scenario counts only when a test carrying its marker actually passed; skipped or
  missing tests show up as `Unverified`.
- Pilot preparation: the `django` preset follows the pilot's Makefile (`make test`, `make lint`, `make typecheck`);
  the marker must be registered in the pilot's pytest config (preset note).

## Phase 6 — checklist

- [x] `api` section in verify.yaml (+ django preset: drf-spectacular export), `api.mjs diff|snapshot|check`
- [x] Zero-dependency OpenAPI operation diff, verified on real drf-spectacular output (6 ops, 5 breaking)
- [x] `protocols/handoff.md` (format + rules + frontend side), `check-handoff` with planted defects
- [x] Archive gate: current API diff + complete handoff + updated baseline required
- [x] `handoff.mjs import` (active or archived backend change) → frontend `clarify` change with sources D1/D2
- [x] Schemas, questions protocol and config context point to the handoff flow
- [x] Fingerprint made commit-independent (regression test)
- [x] Real Claude Code: imported frontend change → 13 UI/UX questions, API gaps routed to the backend
- [x] Tests: 189 total (19 in `tests/handoff.test.mjs`)

## Phase 6 vs goals

- *"Меньше коммуникации между беком и фронтом"* — the frontend change starts from a machine-checked handoff:
  every changed endpoint described with permissions, request, response, errors and an example; breaking
  changes listed; the agent asks the frontend team only UI questions and routes real API gaps to the backend
  in one file instead of chat.

## Phase 7 — checklist

- [x] `ci.mjs checks` (lint-kit, openspec validate --strict with the pinned CLI, kit checks, archived-in-PR checks)
- [x] `ci.mjs verify` (one full run for all completed changes, markers, in-progress warnings, API baseline)
- [x] GitHub step summary (Markdown table + details)
- [x] Workflow generated by `install --ci` for the presets; validated with actionlint and action-validator
- [x] Kit repository CI (`.github/workflows/test.yml`)
- [x] Red PR on a missing scenario test and on a failing test (tests/ci.test.mjs); also on planning defects that
      bypassed hooks, strict validation errors, unverified archived changes and API drift
- [x] Tests: 206 total (15 in `tests/ci.test.mjs`)
- [ ] First real run on GitHub (pilot PR)

## Phase 7 vs goals

- *"AI не начинает код без подтверждённых ответов" / "хорошие тесты"* — what the hooks enforce locally is now
  enforced again on every PR, including work done outside Claude Code or with hooks bypassed.

## Phase 8 — checklist

- [x] Protocols `review-specs.md`, `review-tests.md`; thin subagents and `/sdd:clarify` (installed by the installer)
- [x] `review-input.mjs` with weak-test heuristics for pytest and Playwright (no false signals on strong tests)
- [x] Test review required by the archive gate and CI; human decision path for NOT-READY
- [x] Schemas: spec review after specs (clarify), test review in the final task group and apply rules
- [x] Kit permissions for read-only scripts in settings merge (+ clean removal)
- [x] Real Claude Code: both reviewers produced concrete findings, all planted defects caught; `/sdd:clarify` works
- [x] Tests: 220 total (15 in `tests/review.test.mjs`)

## Phase 8 vs goals

- *"Хорошие тесты а не бесполезные"* — a second pair of eyes with a narrow brief: every THEN asserted, the break
  each weak test would miss, and the change cannot be archived without that review (or a human's explicit decision).
- *"ИИ задает все вопросы…"* — the spec reviewer catches what the questions missed (in the run: the client's
  "see totals" requirement lost between the request and the specs).

## Phase 9 — checklist

- [x] `cwd` + `{root}` in verify.yaml; root-relative test paths; validation
- [x] `--adapter monorepo`: verify.yaml, CI job with docker compose + Playwright, remembered, no switching
- [x] Sample monorepo: Django + DRF backend (uv), static frontend + proxy, Playwright E2E, docker-compose.yml,
      one complete change (clarifications → handoff → real test review → verification)
- [x] End to end: real pytest + real Chromium E2E + API baseline → verify, CI, archive gate, archive, CI on the
      archived change — green, also in a fresh clone
- [x] Bug fixed: API archive checks are content-based (worked only in the clone that ran the diff)
- [x] Kit CI job for the sample; workflows lint-clean
- [x] Tests: 226 total + 1 opt-in end-to-end test
- [ ] Compose stack and workflows on real GitHub runners (no Docker daemon here)

## Phase 9 vs goals

- *"Ускорение разработки фронта и бека" / "не блокают друг друга"* — in a monorepo one change carries the backend,
  the handoff, the frontend page and its E2E proof; one CI run verifies the whole journey.

## Phase 10 — checklist

- [x] Stores / references experiments: every "Unknown" of CLAUDE.md answered (facts §17)
- [x] Decisions D23 (E2E only in monorepos) and D24 (backend as a referenced store) — owner answers
- [x] Installer `--adapter split --role backend|frontend`, references editing (+ uninstall), registration
- [x] Session start: stale backend checkout warning, handoffs waiting for a UI change
- [x] `handoff.mjs list` and `import --from-store`
- [x] Hook blocks writes into a referenced store
- [x] Tests: 230 total (`tests/split.test.mjs`: real CLI, isolated store registry, upstream remote, teammate push)
- [x] Real Claude Code on a split frontend: UI-only questions, API gaps routed to the backend, backend spec read
      through references, stale-checkout warning respected
- [ ] Frontend unit-test preset with scenario markers (later; frontend stack still open)

## Phase 10 vs goals

- *"Разрабы больше не блокают друг друга"* — in split repos the frontend sees the backend specs inside OpenSpec,
  is told when a backend handoff is ready and when its backend checkout is stale, and starts the UI change with one
  command; the backend repository is never written from the frontend.

## Phase 11 — checklist

- [x] README for teams; guides: install/update/uninstall/onboarding/troubleshooting, daily workflow, pilot migration,
      releasing
- [x] `doctor.mjs` (readiness check with fixes)
- [x] Versioning: semver, `package.json` = `kit.json` = CHANGELOG (tested); release process documented
- [x] Docs tested against the code (tools, links, installer options)
- [x] Onboarding measured on a clean environment: mechanical steps ≈ 5 s, team-lead install ≈ 3 s (facts §18)
- [x] Tests: 237 total
- [ ] Publish to the company's GitHub and run the first real CI (owner)

## Phase 11 vs goals

- *"Система ставится на комп разраба очень быстро и без усилий"* — the kit is committed with the repository; a new
  developer installs the pinned OpenSpec CLI, clones, runs `doctor.mjs` and opens Claude Code. The mechanical part
  took about 5 seconds in the measurement.

## Overall status vs goals (docs/goals.md)

| Goal / success criterion | Where it stands |
|---|---|
| AI asks every question that makes the spec complete | question rounds before every artifact, answer analysis, summary confirmation, hard gate (hooks + CI), spec reviewer as a second check — verified with real runs; real quality is measured by the pilot |
| Developers no longer block each other | backend handoff from the OpenAPI diff, checked; frontend starts from it with UI-only questions; split repos: references, handoff list, stale checkout warning |
| Fast, effortless install | one command for the lead, nothing per developer beyond the CLI; `doctor.mjs` |
| Good tests, not junk | scenario markers, matrix from real results, weak-test heuristics, required test review, test gate, CI |
| TDD so the AI checks itself | tdd-guard + test gate + archive gate |
| Open | the pilot itself (owner), first GitHub CI run, frontend unit-test preset, `.claude/CLAUDE.md` versioning decision |

## After 0.1.0 (2026-10-05)

- [x] Kit published by the owner to GitHub: `github:cmdtorch/sdd_kit` (install verified from GitHub on a scratch
      Django project; anonymous read works — the owner may want to make the repository private)
- [x] Install wizard (`installer/lib/wizard.mjs`, `tests/wizard.test.mjs`; decisions.md 2026-10-05). Tests: 253 total
- [ ] Owner: `git push origin main` and `git push origin v0.1.0` (the tag and the wizard commit are not on GitHub yet;
      this machine has no write access)
- [ ] Release 0.2.0 with the wizard (version in `package.json` + `kit.json`, CHANGELOG `Unreleased` → `0.2.0`, tag) —
      owner to confirm
- [ ] Proposed, waiting for the owner's answer: a `fastapi` stack preset (same pytest plugin and uv steps as
      `django`; API export via `app.openapi()`; wizard detects `fastapi` in pyproject). Needed for the owner's next
      project: a monorepo with FastAPI backend and Vue frontend (`--adapter monorepo --preset fastapi,playwright`).
      Workaround today: `--preset django,playwright` and edit `verify.yaml` (api.export, gate).
- [ ] Optional: a Russian quick-start guide for teams (the owner asked for a step-by-step "install from zero" guide;
      it was given in chat only)
