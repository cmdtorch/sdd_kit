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
