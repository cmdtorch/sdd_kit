# Design

## Context

The kit reads requirement sources only as text (`[desc]`, `[D<n>]` in `## Sources`), and its gates are two hooks: `answers-gate` (writes of planning artifacts) and `archive-gate` (the archive) [D1]. The test-case schemas from the change add-qa-test-cases-stage are already in `kit/` and share their artifact instructions with `clarify`, which a test enforces [Q2]. This change adds screenshots as sources, the UI inventory and its checks to all four schemas [Q1][Q2].

## Goals / Non-Goals

**Goals:**
- Every interactive element and state on the screenshots gets a decision before the proposal, and every built element a scenario before the design [Q7][Q23].
- Late, replaced, deleted and unsupported files are caught deterministically [Q8][Q19][Q20][Q24].
- The screenshots reach the design, the tasks and the implementation [Q15][Q22].

**Non-Goals:**
- Comparing the built screen with the screenshot, reading Figma, design tokens [Q12].
- A kit command that writes fingerprints [Q26].

## Decisions

### D1. The inventory is Markdown

`ui-inventory.md` in the change root holds a screenshots table and one section per screen [Q27]:

```markdown
# UI Inventory

## Screenshots

| Tag | File | Fingerprint |
|---|---|---|
| U1 | 01-orders-list.png | 3f9a…(64 hex) |
| U2 | 02-orders-list-mobile.png | 8c1d… |

## Screen: orders-list

Screenshots: U1 (desktop), U2 (mobile)

| Element | Type | Variants | Decision | Source | Scenarios |
|---|---|---|---|---|---|
| export-button | button | desktop, mobile | in scope | [Q3] | inventory/sale-export :: Successful export |
| bulk-delete | button | desktop | out of scope | [Q5] | — |
| empty-state | state | desktop, mobile | in scope | [D1] | inventory/sale-export :: Empty period |
| logout-button | button | desktop, mobile | existing | — | — |
```

Decisions are `in scope`, `mock`, `out of scope`, `decoration`, `existing` [Q7][Q17][Q18]. `Variants` is required only when the screen has more than one screenshot [Q10]. Scenarios are written as `<capability-path> :: <Scenario name>`, several separated by `;` [Q7]. On `lean` the screenshots table is also the source register [Q14]. Rejected: YAML or JSON, which is harder for developers and QA to read [Q27].

### D2. Fingerprints are SHA-256 written by the AI

The AI computes the fingerprint with `sha256sum` (Linux, WSL) or `shasum -a 256` (macOS) and writes it into the screenshots table [Q26]. A mismatch message names the file and asks to look at the screenshot again and update its elements; it does not print the new fingerprint, so it cannot be copied without opening the image [Q26][Q19]. Rejected: a kit command or a hidden fingerprint file [Q26].

### D3. `check-ui.mjs` and `lib/ui-inventory.mjs`

A new check `openspec/tooling/checks/check-ui.mjs` with the parser `openspec/tooling/lib/ui-inventory.mjs` [Q7]. UI mode is on while `sources/ui/` holds an accepted screenshot (`.png`, `.jpg`, `.jpeg`, `.webp`, any letter case); every file there is format-checked even when the mode is off, except hidden system files (names starting with `.`, such as `.DS_Store`), which are ignored; with every screenshot deleted the mode is off and the inventory is ignored [Q1][Q3][Q20][Q25]. Its checks are staged by the artifact being written [Q7][Q22]:

| Before | Checks | Source |
|---|---|---|
| any artifact after the questions | formats, inventory exists, registration, fingerprints (new, replaced, deleted), every element has a known decision, decision sources, `[U<n>] <element>` citations, lean proposal lists every element | [Q4][Q8][Q14][Q16][Q19][Q24] |
| `design.md` (`lean`: `verification-plan.md`) and later | every `in scope` / `mock` element names existing scenarios | [Q7][Q14] |
| `verification-plan.md`, `tasks.md` | `## Screens` row for every screen with a built element (schemas with a design) | [Q22] |
| archive | all of the above, plus every task that names a screen in backticks links a screenshot of that screen | [Q21][Q22] |


### D4. Hooks call the check

- `answers-gate` runs `check-ui` for writes of `proposal.md`, the specs, `test-cases.md`, `design.md`, `verification-plan.md` and `tasks.md` on all four kit schemas, `lean` included [Q2][Q14].
- A write to `clarifications.md` that adds a `### Q` heading is blocked while screenshots exist and `ui-inventory.md` does not; other writes to `clarifications.md` and to `ui-inventory.md` are never blocked by a UI rule [Q5].
- `archive-gate` adds `check-ui` in archive mode [Q21][Q22].
- `artifact-feedback` (PostToolUse, never blocks) runs `check-ui` after a write of `ui-inventory.md` (stage base) and of `tasks.md` (stage archive, only the findings in `tasks.md`) and shows the errors to the AI, so a gap in the inventory or a UI task without a screenshot link is fixed right away, not at the archive [Q5][Q22].

### D5. Grounding and test cases

`check-grounding` accepts `[U<n>]` tags registered in `## Sources` or, on `lean`, in the inventory, and reports an unregistered tag or a missing file [Q4][Q14]. `check-test-cases` reads the inventory and requires the `e2e` label on every case under a scenario that an `in scope` or `mock` element names [Q11][Q23].

### D6. Protocols and schemas

- A new protocol `openspec/protocols/ui-inventory.md`: where screenshots go, the inventory format, fingerprints, decisions and their sources, the UI questions of the Main round, late screenshots, the `## Screens` table, screen names in tasks, and opening the screenshots before building a screen [Q5][Q6][Q15].
- `questions.md` and `grounding.md` point to it and describe `[U<n>]`; `review-specs.md` reads the inventory in UI mode and judges mock outcomes and non-interactive content [Q4][Q23].
- The instructions of `clarifications`, `proposal`, `specs`, `design`, `tasks` and apply in the three clarify schemas get the same added text; `lean` gets its variant [Q2][Q14][Q15].

### D7. Docs

`docs/how-it-works.md` names the new files, `docs/guide/workflow.md` explains screenshots, and `docs/decisions.md` records the decision [D1].

## Risks / Trade-offs

- [Risk] The Main round question gate recognises questions by a `### Q` heading in the written text → a heuristic; the proposal gate is the backstop [Q5][Q7].
- [Risk] The AI may record a fingerprint without looking at the image → the mismatch message does not print the value, and the round summary shows every element to the developer [Q26][Q5].
- [Trade-off] Screenshots cost tokens (about 2 000 per 1 500×1 000 image) and grow the repository; they stay in git as decided [Q9][D1].
- [Risk] The clarify-family instructions are long; a shared text keeps the three schemas equal [Q2].

## Assumptions & Open Questions

None.
