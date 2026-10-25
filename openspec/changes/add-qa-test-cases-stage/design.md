# Design

## Context

The kit ships two schemas, `clarify` and `lean`, and its hooks and checks recognise a question-round change by the literal test "schema is `clarify`" in several places: the answers gate, the grounding check, the archive gate, artifact feedback and session start [Q21]. OpenSpec has no optional artifacts and no schema inheritance, so the test-cases stage needs whole schemas of its own [Q8][Q21][Q43].

The new stage adds one artifact (`test-cases.md`), one subagent (the AI QA reviewer), one check, two hooks (the schema starter and the review-run limit) and changes to the answers gate, the archive gate, marker scanning and the verification plan [Q12][Q22][Q44][Q10].

## Goals / Non-Goals

**Goals:**
- Gherkin test cases written after the specs and before the design, reviewed by an AI QA reviewer and, on `clarify-qa`, by a human QA, with the stage gated deterministically [Q2][Q3][Q7][Q18].
- The choice of schema made by a menu that a hook forces, not by instruction text [Q16][Q22].
- `automated` test cases proven by marked tests before archive, `e2e` and `manual` ones listed [Q10][Q19].
- `clarify` and `lean` behave exactly as before [Q9][Q21].

**Non-Goals:**
- The E2E stage, executable Gherkin, test-case management tools and changes to manual QA [Q14].
- A kit command for switching schemas; switching is a manual edit [Q42].

## Decisions

### D1. A clarify family instead of the literal `clarify`

`openspec/tooling/lib/project.mjs` gets `CLARIFY_FAMILY = ['clarify', 'clarify-ai-qa', 'clarify-qa']`, `TEST_CASE_SCHEMAS = ['clarify-ai-qa', 'clarify-qa']` and helpers `isClarifyFamily(schema)` / `hasTestCases(schema)`; every `schema === 'clarify'` test in hooks and checks uses the helper, and `KIT_SCHEMAS` lists all four schemas [Q21]. Rejected: duplicating each test with the new names, which spreads the schema list over many files, the opposite of "only the schemas decide the flow" [Q21].

### D2. Two full schema copies held equal by a test

`kit/openspec/schemas/clarify-ai-qa/` and `kit/openspec/schemas/clarify-qa/` are copies of `clarify` with a `test-cases` artifact (`generates: test-cases.md`, `requires: [specs]`) and `design.requires: [proposal, test-cases]` [Q3][Q43]. Their instructions differ only in the test-cases artifact: whether the hand-over to QA happens [Q15]. `tests/schemas.test.mjs` asserts that every artifact the copies share with `clarify` has identical `instruction` text and templates, and that the two copies have the same artifact list [Q43]. Rejected: a generator script, which adds a build step to a zero-dependency kit [Q43].

### D3. The test-case document format

One `test-cases.md` per change, defined by a new protocol `openspec/protocols/test-cases.md` and a template in both new schemas [Q25]:

```markdown
# Test Cases

## inventory/sale-export

### Scenario: Successful export

#### Case: Export of a month with two sales
Labels: automated, e2e
- **Given** two paid sales of 100.00 and 50.00 in March 2026
- **When** the accountant exports March 2026
- **Then** the file has exactly two rows with totals 100.00 and 50.00

> **Remark** [open]: the file must also show the shop name
> **Answer:** added the shop name to the Then step

## General remarks

## Spec changes during test-case review

## Stage result

Accepted findings:
- (none)

[Answer]:
```

Remarks are blockquotes under a case or under "General remarks", with a status `open`, `closed` or `reopened` [Q27][Q32]. "Stage result" lists accepted or hand-fixed findings, the line `Handed over to QA`, and the confirmation in an `[Answer]:` line, the same syntax as question rounds [Q7][Q18][Q37]. The headings and labels stay in English; remarks may be in any language [Q13].

### D4. `check-test-cases.mjs`

A new check in `openspec/tooling/checks/` parses `test-cases.md` with a small parser in `openspec/tooling/lib/test-cases.mjs` and reports: scenarios without a case, cases under unknown scenarios, duplicate case names in a capability, missing Given/When/Then, missing or unknown labels, unknown remark statuses [Q2][Q11][Q26]. With `--stage` it also checks completion: on `clarify-ai-qa`, every blocker and major finding of the latest review accepted or fixed by hand (or the review READY) and the confirmation `Looks correct`; on `clarify-qa`, additionally `Handed over to QA` and no open or reopened remark [Q7][Q18][Q37]. It is skipped for schemas without test cases [Q9].

### D5. Gates

- The answers gate maps `design.md` to the Design round as today and, for test-case schemas, also runs `check-test-cases --stage` before letting `design.md` be written [Q3][Q7].
- The archive gate adds `check-test-cases` and the case coverage of `check-traceability --markers` for test-case schemas [Q10].
- The answers gate's round for the Specs round stays the gate for follow-up questions asked during the stage [Q35][Q40].

### D6. AI QA reviewer and the run limit

`kit/claude/agents/test-cases-reviewer.md` runs `openspec/protocols/review-test-cases.md`: the closed checklist (empty input, duplicate entries, repeated submission, an unavailable external service), the positive / error / boundary rule, severities and the READY rule; it writes `reviews/test-cases-review.md` and reads "Stage result" to skip accepted findings [Q12]. A new PreToolUse hook `test-cases-run-limit.mjs` on the subagent tool counts runs of this subagent in `reviews/test-cases-runs.json` and blocks a fourth run in the same loop with a message telling the agent to ask the developer; a new loop starts when the stage confirmation is already `Looks correct` [Q44][Q18][Q30].

### D7. Schema starter hook

A new PreToolUse hook `schema-starter.mjs` on Bash matches `openspec new change` and the wrapper form `node openspec/tooling/bin/openspec.mjs new change`; when neither `--schema <name>` nor `--schema=<name>` is present it blocks with a message that tells the agent to ask the three-choice menu with AskUserQuestion and rerun with the chosen schema [Q16][Q22][Q31]. It ignores the project default schema and passes unknown schema names through to OpenSpec [Q31]. The message also says what to do when the menu is dismissed or answered with free text [Q38].

### D8. Case references

`openspec/tooling/lib/markers.mjs` learns `@case <capability-path> :: <case name>` with the same placement rules as `@scenario` [Q26]. `check-traceability --markers` reports `automated` cases with no reference; a reference that matches no case of an active change is looked up in `openspec/changes/archive/*/test-cases.md` and stays silent if found there, otherwise it is a warning [Q34].

### D9. Verification plan

For test-case schemas, `verification-plan.md` gets a table "Test case coverage" (capability, scenario, case, labels, level for `automated`), parsed by `openspec/tooling/lib/plan.mjs` and checked by `check-traceability`; "Requirement trace" may cite entries of "Spec changes during test-case review" [Q19][Q41]. `testing.md` describes the labels, `@case` and the end-of-apply lists of `manual` and `e2e` cases [Q11][Q19].

### D10. Switching schemas

Switching between `clarify-ai-qa` and `clarify-qa` is a manual edit of `schema:` in the change's `.openspec.yaml`; the guide and the test-case protocol explain it and what changes (the gates of the new schema apply at once) [Q42][Q23]. No code is needed because both schemas have the same artifacts and the gates read the schema on every call [Q42].

### D11. Installer, docs and the kit's own repository

The installer copies the new schemas, agent, protocols and hooks like the existing ones, and merges the two new hooks into `.claude/settings.json` [Q22][Q44]. `docs/how-it-works.md` and `docs/guide/workflow.md` describe the stage, the schemas and the starter [Q8][Q22][Q42]. In this repository the installed copy is refreshed only after this change is archived (CLAUDE.md rule), so the change itself runs under the current `clarify` hooks [desc].

## Risks / Trade-offs

- [Risk] The starter blocks the stock `/opsx:new` skill on its first try, because the skill omits `--schema` by default → the block message is short and says exactly what to do; one extra round trip per new change [Q22].
- [Risk] Two schema copies can drift from `clarify` on an OpenSpec upgrade → the equality test fails the suite until both copies are updated [Q43].
- [Risk] The run limit depends on a counter file the agent could delete → it is a guard against loops, not a security boundary; the archive gate and check still enforce the stage result [Q44].
- [Trade-off] Remarks live in `test-cases.md`, so a QA who works in the repository edits the same file as the AI; git shows the history [Q5][Q28][Q32].

## Assumptions & Open Questions

- The clarify-family helper, the separate test-case check and its gating, the new protocol and agent, the run-limit counter in `reviews/`, the starter's command matching, archived-case lookup, the verification plan table and the installer and docs updates are as described in the Design round summary [assumption]
- QA may write remarks in any language; the test cases themselves are in English [assumption]
- The checks verify that every scenario has a test case and every test case belongs to an existing scenario, and the starter acts only in Claude Code [assumption]
