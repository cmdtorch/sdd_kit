# Proposal

## Why

The kit's question rounds find gaps in requirements, but nothing makes the AI think through the cases a manual QA engineer would check, so those cases surface later as QA bugs, and tests are written from the developer's point of view rather than from how QA verifies the feature [Q1][desc].

The owner wants Gherkin test cases written before the code and the TDD tests, reviewed by QA in a loop like the clarify rounds, so that TDD tests and the later E2E stage are built from the same cases [desc]. The stage stays optional while it is being tried out [desc].

## What Changes

- A new **test-cases stage** between the specs and the design: the AI writes Gherkin test cases (Given / When / Then) in a separate document inside the change, one or more cases per spec scenario, with concrete data, each linked to its scenario [Q2][Q3].
- Each test case carries a coarse verification label: `automated`, `e2e` or `manual`, one or several (for example `automated` + `e2e`: the backend API now, the path through the UI later); unit or integration is not chosen in the test case [Q11][Q19].
- Test cases are written in English, like the other artifacts of a change [Q13].
- A new **AI QA reviewer** subagent checks the test cases, including a sweep over unusual conditions (empty data, duplicates, repeated submission, an unavailable service and the like); the fix-and-review loop with it runs at most three times, after which a human decides [Q12][Q18].
- A **human QA review loop**: QA reads the test cases and writes free-form remarks; the AI handles every remark and revises the cases, round after round. QA is asked no questions [Q6]. QA can work in the repository directly or through the developer, who forwards the cases and enters the remarks [Q5].
- When a human QA remark shows behaviour that is missing, wrong or not wanted in the spec, the AI adds, changes or removes the scenario and its test cases itself, also when the remark contradicts an answer already confirmed in a question round; the developer is not asked again [Q4][Q20][Q36].
- When the AI QA reviewer finds a case the spec lacks, the AI adds the scenario itself only for an error case, empty state, boundary value or unusual condition that changes no existing outcome and contradicts no confirmed answer; otherwise it asks the developer a follow-up question first [Q35][Q40].
- Every spec change made during the stage is kept in a section of the test-case document and is the source of the changed requirement; after any spec change the spec reviewer runs again [Q29][Q33][Q41].
- QA writes remarks in the test-case document, under the case or in a general section; only QA closes or reopens a remark, and the developer may enter QA's decisions on QA's behalf; closed remarks are removed unless they changed the spec [Q27][Q28][Q32][Q37].
- Stage completion: with a human QA, when no remark is open and QA explicitly confirms the result [Q7]; with the AI reviewer only, when its findings are fixed or explicitly accepted by the developer and the developer confirms the result [Q18].
- Two new **schemas**, one per mode: `clarify-ai-qa` (AI QA reviewer only) and `clarify-qa` (AI QA reviewer followed by human QA) [Q39]. The existing `clarify` schema is the mode without test cases. Only the schemas decide the flow; no separate mode checks elsewhere [Q15][Q21].
- A **schema starter**: when a change is created without an explicitly named schema, a selection menu always asks whether QA is needed and whether it is the AI reviewer only or a human QA too, and picks the schema; with a named schema nothing is asked, the project's default schema does not count as named, and a dismissed menu creates no change [Q31][Q38]. It is implemented in code, deterministically, not as long instruction text in the AI's context [Q16][Q22][Q21].
- **Test coverage of test cases**: for `automated` cases, the verification plan (written after the design) chooses unit or integration tests; before archive every `automated` case has a marked test. `e2e` and `manual` cases do not block the archive: `e2e` cases wait for the future E2E stage, `manual` cases go to the list of manual checks [Q10][Q19].
- The `lean` schema does not get the stage [Q9].
- Test cases stay in the change and go to the archive with it; tests reference a test case by capability and case name, and references to cases of archived changes are not reported [Q24][Q25][Q26][Q34].
- A scenario added after the stage gets test cases reviewed by the AI QA reviewer, without the human QA [Q30].

Out of scope: the E2E stage itself (only room is left for it), running Gherkin as executable tests, integration with test-case management tools, and changes to QA's manual testing process [Q14][desc].

## Capabilities

### New Capabilities
- `test-cases/document`: the test-case document of a change — Gherkin format, link from each case to its spec scenario, concrete data, verification labels, language [Q2][Q11][Q13][Q19]
- `test-cases/review`: reviewing test cases — the AI QA reviewer and its round limit, the human QA remark loop, how remarks change the spec and the cases, and when the stage is complete [Q4][Q6][Q7][Q12][Q18][Q20]
- `test-cases/coverage`: how test cases become tests — the verification plan's choice of level for `automated` cases, marked tests, and the archive rule for `automated`, `e2e` and `manual` cases [Q10][Q19]
- `workflow/test-case-schemas`: the two schemas with the test-cases stage, where the stage sits in the flow, and what stays unchanged in `clarify` and `lean` [Q3][Q9][Q15][Q21]
- `workflow/schema-starter`: choosing the schema when a change is created without a named one [Q16][Q21][Q22]

### Modified Capabilities

None.

## Impact

- `kit/openspec/schemas/`: two new schemas with templates for the test-case document; `clarify` and `lean` are left as they are [Q9][Q21].
- `kit/openspec/protocols/`: a protocol for writing and reviewing test cases, and changes to `testing.md` for verification labels and the coverage of test cases [Q11][Q19].
- `kit/claude/agents/`: a new AI QA reviewer subagent [Q12].
- `kit/openspec/tooling/`: the schema starter, a gate for the test-case review loop, and checks and the archive gate extended to test cases [Q7][Q10][Q22].
- `installer/`, `docs/how-it-works.md` and the tests in `tests/` follow the new kit files [desc].

## Assumptions & Open Questions

- Switching an in-flight change to the other test-case schema is done only if both new schemas have the same set of steps and switching is a change of the schema in the change's file before the test-cases stage is complete; if the design shows it is harder, it is dropped and recorded as out of scope [assumption]
- Both new schemas are based on `clarify`: the same steps plus the test-cases stage between the specs and the design; `clarify` and `lean` do not change [assumption]
- The starter offers a choice only between `clarify` and the two new schemas; `lean` is still chosen only when it is named explicitly [assumption]
- The three-round limit applies to the loop with the AI QA reviewer in both modes (in the human QA mode, before the hand-over to QA); the loop with a human QA has no round limit [assumption]
- QA remarks are recorded in the test-cases stage file; a spec changed because of a remark cites the remark as its source; the developer sees the list of such spec changes at the end of the stage but does not approve them [assumption]
- QA may write remarks in any language; the test cases themselves are in English [assumption]
