# Progress

| Phase | Status | Notes |
|---|---|---|
| Planning | ✅ done | `docs/planning.md`, goals filled in, CLAUDE.md updated (D4, D13–D19, phases) |
| 0. Bootstrap | ✅ done | `docs/openspec-facts.md`; upstream fixture; D20 (XDG trick), D21 (kit spec parser) |
| 1. Prompt layer | ⏳ not started | |
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
