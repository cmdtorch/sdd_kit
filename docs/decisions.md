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

## 2026-10-25 — Fewer false scenario markers

Why: in a repository whose docs and samples show markers (the kit's own repository: 28 false hits), every hit
became a "marker names unknown scenario" warning.

| # | Decision |
|---|---|
| R9 | A marker counts only at the start of its line (indentation and a comment opener of at most five characters before it). Paths in `openspec/markers-ignore` are not scanned. The file belongs to the project: the installer never ships, updates or removes it. |

## 2026-10-25 — OpenSpec 1.15.0

Why: 1.15.0 changed the `spec-driven` instructions and templates the kit schemas fork, and how `openspec`
counts tasks; staying on 1.13.0 would keep teams on guidance upstream has since corrected.

| # | Decision |
|---|---|
| R10 | **OpenSpec pinned to 1.15.0.** The kit schemas take the 1.15.0 upstream text verbatim as a prefix (pristine copy in `fixtures/upstream/spec-driven-1.15.0/`); kit rules are unchanged. The kit follows upstream where they overlap: tasks are counted with OpenSpec's checkbox rules (only `x` is done), a MODIFIED requirement over 500 characters only warns (upstream: keep an existing requirement whole), `x-` keys of `.openspec.yaml` are allowed, the kit-only `verification-plan.md` template gets a `# Verification Plan` title like the upstream ones. Facts re-verified in `docs/openspec-facts.md`. |

## 2026-10-25 — Test-cases stage (`clarify-ai-qa`, `clarify-qa`)

Why: question rounds find gaps in requirements, but nothing made the AI think through the cases a manual QA
engineer would check; they surfaced later as QA bugs, and tests were written from the developer's point of
view. The owner wants Gherkin test cases before the code, reviewed by QA in a loop, as the common source of TDD
tests and the later E2E stage. The stage stays optional while it is tried out.

| # | Decision |
|---|---|
| R11 | **Two new schemas, `clarify-ai-qa` and `clarify-qa`**: full copies of `clarify` with a `test-cases` artifact between the specs and the design (the design requires it). `clarify-ai-qa`: the AI QA reviewer only; `clarify-qa`: the AI QA reviewer, then a human QA. They differ only in the hand-over; a test holds every shared artifact equal to `clarify`. `clarify` and `lean` are unchanged; `lean` gets no stage. Only the schema decides the flow. |
| R12 | **Clarify family.** `clarify`, `clarify-ai-qa` and `clarify-qa` are recognised by helpers in `openspec/tooling/lib/project.mjs` (`isClarifyFamily`, `hasTestCases`, `KIT_SCHEMAS`) instead of the literal `clarify` in each hook and check. |
| R13 | **`test-cases.md` format** (`openspec/protocols/test-cases.md`): `## <capability>` / `### Scenario:` / `#### Case:`, a `Labels:` line (`automated`, `e2e`, `manual`; never `unit`/`integration`), Given / When / Then with concrete data, in English; case names unique per capability. QA remarks are blockquotes with status `open` / `closed` / `reopened`; only QA closes. "Spec changes during test-case review" records every spec change; "Stage result" holds accepted findings (matched by Finding text, no IDs), `Handed over to QA` and the `Looks correct` confirmation. |
| R14 | **Gates.** `check-test-cases` checks structure and coverage; with `--stage` the completion of the stage. The answers gate blocks `design.md` until `--stage` passes; the archive gate runs the check and needs an `@case` test for every `automated` case. |
| R15 | **AI review loop limit.** At most three runs of the `test-cases-reviewer` subagent per loop, enforced by the `test-cases-run-limit` hook (counter in `reviews/test-cases-runs.json`); then the developer fixes or accepts. A scenario added after the stage is confirmed starts a new loop; QA is not asked again. |
| R16 | **Schema starter.** A `schema-starter` hook blocks `openspec new change` without `--schema` and makes the agent ask a three-choice menu (`clarify`, `clarify-ai-qa`, `clarify-qa`); the project default does not count, `lean` is not offered, the terminal is not affected. Code, not instruction text. |
| R17 | **`@case <capability-path> :: <case name>`** references in tests, with the marker placement rules. The verification plan gets a *Test case coverage* table with a level for each `automated` case. A reference to an archived change's case is silent; an unknown one is a warning. |
| R18 | **Test cases are not merged on archive**: `test-cases.md` stays in the archived change. Switching between the two test-case schemas is a manual edit of `schema:` in `.openspec.yaml`; no command. |
| R19 | **E2E stage deferred.** `e2e` cases are only listed at the end of apply, waiting for it; executable Gherkin and test-case management tools are out of scope. |
