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
