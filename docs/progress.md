# Progress

| Phase | Status | Notes |
|---|---|---|
| Planning | ✅ done | `docs/planning.md`, goals filled in, CLAUDE.md updated (D4, D13–D19, phases) |
| 0. Bootstrap | ✅ done | `docs/openspec-facts.md`; upstream fixture; D20 (XDG trick), D21 (kit spec parser) |
| 1. Prompt layer | ✅ done (1 question open) | protocols, `clarify` + `lean`, config fragment, kit profile; dry run in `fixtures/dry-runs/` |
| 2. Checks | ⏳ | |
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
- [ ] Owner: language of clarifications.md (see report)

## Phase 1 vs goals

- *"ИИ задает все вопросы…"* — moved: the dry run turned a 4-sentence vague request into 14 concrete
  questions (permissions, statuses, which date, which class, totals, email schedule, scope boundary, language).
- *"Разрабы не блокают друг друга"* — PO/PM questions are marked and forwardable (13 of 14 in the dry run).
- *"Хорошие тесты"* — `testing.md` defines strong assertions and scenario markers; enforcement comes in phases 2, 5, 8.
