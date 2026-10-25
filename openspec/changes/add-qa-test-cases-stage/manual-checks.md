# Manual checks — add-qa-test-cases-stage

Pilot checklist for task 8.4. It covers every `manual` row of `verification-plan.md` (42 rows). Each row
names the capability and scenario, what to do in the pilot, and the expected outcome taken from the
scenario's THEN. Fill in **Result** (`pass` / `fail: <what happened>`), and record usability findings at the
end. Rows are grouped by pilot step, in the order you meet them.

Conventions: `<repo>` is this repository; `<pilot>` is the test project. "Run the reviewer" means letting the
AI run the `test-cases-reviewer` subagent as part of the stage, not calling it by hand, unless a row says so.

## (a) Set up the test project

No verification-plan row is checked here; this step prepares the ground for all others.

1. Create a small project with a git repository and a tiny feature area to change, for example "export the
   paid sales of a period as a file" (a list of sales, a name field limited to 255 characters, an order
   submission). Any stack works; the kit is stack-agnostic.
2. Install the pinned CLI (`npm i -g @fission-ai/openspec@1.15.0`), then from `<pilot>` run
   `node <repo>/installer/sdd-kit.mjs install`.
3. Run `node openspec/tooling/bin/doctor.mjs` in `<pilot>`: it must report `Ready.` and the hooks
   `schema-starter` and `test-cases-run-limit` must be registered in `.claude/settings.json`.
4. Agree with the tester who acts as human QA for step (c): they edit `test-cases.md` (remarks, statuses,
   confirmation) and may type `done` in Claude Code.

Setup result:

## (b) Start changes through the starter menu

In Claude Code in `<pilot>`, ask for a new change without naming a schema (for example "start a change
add-export", or `/opsx:new add-export`). The schema-starter hook must block the `openspec new change` call
and the agent must show the three-choice menu.

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 1 | workflow/schema-starter | Menu dismissed | Start "add-export"; dismiss the menu without choosing. | No change `add-export` exists (`ls openspec/changes`), and the agent tells you how to start the change again. | |
| 2 | workflow/schema-starter | Free-text answer | Start "add-export"; answer the menu with free text "not sure, what is the difference?". | No change `add-export` exists yet, and the agent explains the three choices and shows the menu again. | |
| 3 | workflow/schema-starter | Choosing no test cases | Start "add-export"; choose no test cases. Delete the change afterwards. | The change `add-export` is created on the `clarify` schema (`schema: clarify` in its `.openspec.yaml`). | |
| 4 | workflow/schema-starter | Choosing a human QA | Start "add-export"; choose review by the AI QA reviewer and then a human QA. Keep this change for step (c). | The change `add-export` is created on the `clarify-qa` schema. | |

Also start the change for step (d) through the menu, choosing review by the AI QA reviewer only; it must be
created on `clarify-ai-qa` (not a manual row, but it confirms the third choice).

## (c) A change on `clarify-qa` with a real tester as QA

Use the `add-export` change from row 4. Go through the Proposal and Specs rounds as usual. The rows below
follow the test-cases stage in order: the AI review loop, spec changes from findings, hand-over, the human
QA's remarks, completion, and a late scenario during apply. Where a row needs a "seeded gap", edit
`test-cases.md` (or the delta spec) by hand before the reviewer runs, so that the gap exists.

### (c1) The AI review loop

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 5 | test-cases/review | Review report is written | Let the AI write `test-cases.md` and run the reviewer once. Note the hashes of `test-cases.md` and the delta specs before the run (`git diff --stat` or `sha1sum`). | `reviews/test-cases-review.md` exists with the verdict READY or NOT-READY and a severity for each finding; `test-cases.md` and the delta specs are unchanged by the reviewer itself. | |
| 6 | test-cases/review | Missing positive case is a finding | Seed: leave one requirement with only error-path cases. Run the reviewer. | The review has a major finding that names the requirement and says a positive case is missing; the verdict is NOT-READY. | |
| 7 | test-cases/review | Missing error case is a finding | Seed: leave one requirement with only the successful path. Run the reviewer. | The review has a major finding that names the requirement and says an error case is missing; the verdict is NOT-READY. | |
| 8 | test-cases/review | Missing boundary values are a finding | Seed: a requirement limits a name to 255 characters; no case uses a 255- or 256-character name. Run the reviewer. | The review has a major finding that names the requirement and the missing boundary values; the verdict is NOT-READY. | |
| 9 | test-cases/review | Unsettled repeated submission is a finding | Seed: a requirement for submitting an order, no case for submitting the same order twice. Run the reviewer. | The review has a major finding that names the requirement and the unusual condition "repeated submission"; the verdict is NOT-READY. | |
| 10 | test-cases/review | Vague outcome is a finding | Seed: change one case's Then to "the system works correctly". Run the reviewer. | The review has a major finding that names the test case and says its outcome is not observable; the verdict is NOT-READY. | |
| 11 | test-cases/review | Developer decides after the third run | Keep at least two major findings open through three reviewer runs (for example, do not fix seeded gaps). Let the AI continue the stage. | The reviewer is not run a fourth time (the run-limit hook blocks it), and you are shown both major findings and asked to fix or accept each one. | |
| 12 | test-cases/review | Accepted finding is read by the next run | List the major finding "No case for a 256-character name" (the finding's text from the review) under "Accepted findings" in "Stage result". Run the reviewer again. | That finding does not count against the verdict READY. | |
| 13 | test-cases/review | Accepted major finding does not block READY | With the accepted major finding from row 12 and no other blocker or major finding, run the reviewer again. | The verdict is READY. | |
| 14 | test-cases/review | Only minor findings | Fix everything except a minor wording issue; run the reviewer. | The verdict is READY and the minor findings are listed. | |
| 15 | test-cases/review | Loop ends early when the review is READY | In a fresh loop, make the second reviewer run return READY (fix the findings of the first run). Let the AI continue. | The reviewer is not run a third time. | |

### (c2) Spec changes from findings and follow-up questions

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 16 | test-cases/review | Missing error scenario is added by the AI | Seed: no scenario for exporting while the export service is unavailable, and no confirmed answer about it. Let the reviewer report it and the AI handle it. | The delta spec has a new scenario for exporting while the export service is unavailable, and `test-cases.md` has at least one test case under it. | |
| 17 | test-cases/review | AI reviewer finding is recorded | Continue from row 16. | "Spec changes during test-case review" lists that finding together with the added scenario "Export while the export service is unavailable" (or the name the AI gave it). | |
| 18 | test-cases/review | New business rule goes to the developer | Seed a gap that needs a new rule (for example a discount rule not in the spec). Let the AI handle the finding. | The delta spec is unchanged, and `clarifications.md` has a new follow-up question about the discount rule with a blank answer. | |
| 19 | test-cases/review | Stage waits for the answer | Continue from row 18 without answering the follow-up question. Let the AI continue the stage. | The Specs round summary answer is blank; the reviewer is not run again and the stage is not completed. | |
| 20 | test-cases/review | Change after a follow-up answer is recorded | Answer the follow-up from row 18 and confirm the Specs round; let the AI add the scenario. | "Spec changes during test-case review" lists the change with the question it answers. | |
| 21 | test-cases/review | Finding that contradicts a confirmed answer goes to the developer | Have a confirmed answer "no error message is shown for an empty period"; seed a finding that asks for an error message there (or wait for one). Let the AI handle it. | The delta spec is unchanged, and `clarifications.md` has a new follow-up question about that error message with a blank answer. | |

### (c3) Hand-over to the human QA

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 22 | test-cases/review | Hand-over waits for the AI findings | Leave one major finding open (not fixed, not accepted). Let the AI continue the stage. | "Stage result" has no line `Handed over to QA`, and you are shown the open finding. | |
| 23 | workflow/test-case-schemas | Human-QA schema hands over to QA | Fix or accept every blocker and major finding so the AI loop ends. | The test cases are handed over to the human QA. | |
| 24 | test-cases/review | Hand-over is recorded | Continue from row 23 (latest review READY). | "Stage result" has the line `Handed over to QA`, and you are told that the test cases are ready for QA. | |

### (c4) The tester's remarks

The tester works in `test-cases.md`. Remark format: `> **Remark** [open]: <text>`; statuses `open`,
`closed`, `reopened`.

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 25 | test-cases/review | Remark under a test case | The tester finds that the case "Export of an empty period" (or a similar case) expects the wrong message and writes a remark. | The remark sits under that test case in `test-cases.md` with the status open. | |
| 26 | test-cases/review | General remark about a forgotten case | The tester notes that no case covers exporting while the export service is unavailable (or another forgotten case) and writes a remark. | The remark sits in "General remarks" at the end of `test-cases.md` with the status open. | |
| 27 | test-cases/review | Done starts a new pass | With the two open remarks from rows 25–26, tell the AI `done`. | Each of the two remarks has an `Answer` under it that says how it was handled. | |
| 28 | test-cases/review | AI answers a remark without closing it | Check the remarks after row 27. | Each answered remark keeps the status open. | |
| 29 | test-cases/review | QA reopens a remark | The tester sets one answered remark to `reopened` with an explanation; tell the AI `done`. | The AI handles the remark again and writes a new answer under it. | |
| 30 | test-cases/review | Remark in Russian | The tester writes an open remark in Russian asking for a case with an empty period; tell the AI `done`. | The new test case is written in English. | |
| 31 | test-cases/review | Closed remark is removed | The tester closes a remark that changed only test cases; tell the AI `done` (its next pass). | That remark is no longer in `test-cases.md`. | |
| 32 | test-cases/review | Remark adds a scenario | The tester writes a general remark that the export of a period with no sales is not specified; `done`. | The delta spec has a new scenario for exporting a period with no sales, and `test-cases.md` has at least one test case under it. | |
| 33 | test-cases/review | Remark changes a scenario | The scenario for an empty period expects an empty file; the tester remarks that an error message must be shown instead; `done`. | The scenario in the delta spec expects the error message, and the test cases under it expect the error message instead of an empty file. | |
| 34 | test-cases/review | Remark removes a scenario | Add a scenario "Export to PDF" beforehand; the tester remarks that it is not wanted; `done`. | The delta spec no longer has the scenario "Export to PDF", and `test-cases.md` has no test case under it. | |
| 35 | test-cases/review | Spec reviewer runs after a change | After rows 32–34 changed the spec, let the AI move to complete the stage. | The spec reviewer has been run after that change and you have been shown its verdict. | |

### (c5) Completing the stage

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 36 | test-cases/review | Request changes starts another pass | The tester sets the confirmation to `[Answer]: Request changes: add a case for a closed shop`; tell the AI `done`. | `test-cases.md` has a case for a closed shop, and the confirmation is blank again. | |
| 37 | test-cases/review | Last closed remarks are removed at completion | The tester closes the last two remarks (they changed only test cases) and confirms with `Looks correct`; let the AI complete the stage. | Neither remark is in `test-cases.md`. | |
| 38 | test-cases/review | Spec-changing remark is kept and shown | At completion, check the remark from row 32 (closed by the tester; it made the AI add a scenario). | The remark is listed in "Spec changes during test-case review" together with the added scenario, and you are shown that list. | |

### (c6) Late scenario during apply

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 39 | test-cases/review | Scenario added during implementation | With the stage complete (`Looks correct`), add a scenario to a delta spec during `/opsx:apply`. | `test-cases.md` gets at least one test case under the new scenario; the AI QA reviewer is run on the change (a new loop, `loop` incremented in `reviews/test-cases-runs.json`); no new hand-over to the human QA is requested; the confirmation stays `Looks correct`. | |

## (d) A short change on `clarify-ai-qa`

Use the change started in step (b) with "AI QA reviewer only". Keep it small (one or two scenarios).

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 40 | workflow/test-case-schemas | AI-only schema has no human hand-over | Run the test-cases stage until every blocker and major finding is fixed or accepted. | No hand-over to a human QA is requested (no `Handed over to QA` line is needed), and you are asked to confirm the result. | |

## (e) End of apply lists

In either pilot change, make sure `test-cases.md` has a case labelled `manual` named "Long name wraps in the
header" (or similar) and a case labelled `automated, e2e`, then finish `/opsx:apply`.

| # | Capability | Scenario | What to do | Expected outcome | Result |
|---|---|---|---|---|---|
| 41 | test-cases/coverage | Manual case is listed for the developer | Let apply end. | The list of manual checks shown to you contains "Long name wraps in the header" with its expected outcome. | |
| 42 | test-cases/coverage | E2E case is listed as waiting | Let apply end. | The `automated, e2e` case is listed among the cases waiting for the E2E stage. | |

## Usability findings

<!-- What was confusing or slow in the pilot, and what was changed in this change because of it. -->
