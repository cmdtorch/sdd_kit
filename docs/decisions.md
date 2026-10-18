# Decision log (append-only)

The 0.1.0 log is on the `archive/v0.1` branch (`docs/decisions.md`). Decisions below replace it where they differ.

## 2026-10-18 — Restart: 0.2.0, a stack-agnostic kit

Why: 0.1.0 tied the kit to one setup (Django + pytest + Playwright presets, monorepo/split adapters, an install
wizard that asked for the stack). The owner wants one kit that any project can use as is.

| # | Decision |
|---|---|
| R1 | **No stack, no layout.** No presets, no adapters, no `verify.yaml`. The kit never runs the project's tests; the agent runs the project's own commands (README, CLAUDE.md). |
| R2 | **Markers are plain comments**: `@scenario <capability-path> :: <Scenario name>`, any language. The kit finds them by reading git-tracked and untracked (not ignored) files outside `openspec/`. |
| R3 | **Levels:** `unit`, `integration`, `manual`. **No browser E2E for now** (too heavy at this stage). |
| R4 | **No role labels on questions** (`For: Dev | PO/PM` removed). Every question is written so it can be forwarded as is; the developer decides who answers. The question protocol itself is unchanged otherwise (the owner tested it and liked it). |
| R5 | **Removed**: Stop-hook test gate, `verify.mjs` / `verification.md` / run fingerprints, weak-test heuristics for pytest/Playwright (the `test-reviewer` subagent reads tests in any language), generated GitHub workflow and `ci.mjs`, install wizard. |
| R6 | **Archive gate** checks: all tasks done; check-answers, check-grounding, check-specs, check-traceability pass; every automated scenario has a marked test; test review READY or a human decision. |
| R7 | **Backend → frontend handoff removed** (`api.mjs`, OpenAPI diff, `handoff.mjs`, `check-handoff`, stores). It ran only after the backend was finished, so the frontend still waited. To be redesigned **contract-first**: the API contract is agreed during design, and both sides start from it. |
| R8 | Kept from 0.1.0: Node ESM with zero dependencies; OpenSpec pinned to 1.13.0; the `clarify` and `lean` schemas; grounding; spec and test reviewers; answers-gate; artifact-feedback; session-start; installer with a hash manifest; the kit workflow profile (no `propose`). |
