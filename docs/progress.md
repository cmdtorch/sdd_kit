# Progress

| Phase | Status | Notes |
|---|---|---|
| Planning | ✅ done | `docs/planning.md`, goals filled in, CLAUDE.md updated (D4, D13–D19, phases) |
| 0. Bootstrap | ✅ done | `docs/openspec-facts.md`; upstream fixture; D20 (XDG trick), D21 (kit spec parser) |
| 1. Prompt layer | ✅ done | protocols, `clarify` + `lean`, config fragment, kit profile; dry run in `fixtures/dry-runs/` |
| 2. Checks | ✅ done | 6 checks + 7 libs; 101 tests; 49 planted defects caught |
| 3. Hooks | ⏳ | verify Claude Code hook semantics first |
| 4. Installer | ⏳ | |
| 5. Verification | ⏳ | pilot starts after this phase |
| 6. Handoff | ⏳ | |
| 7. CI | ⏳ | |
| 8. Reviewers + /clarify | ⏳ | |
| 9. Monorepo adapter | ⏳ | |
| 10. Split adapter | ⏳ | |
| 11. Docs & release | ⏳ | |

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
