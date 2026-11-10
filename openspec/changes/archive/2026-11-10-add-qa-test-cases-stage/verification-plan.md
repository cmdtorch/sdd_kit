# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| test-cases/document | One test-case document per change | Test cases are grouped by capability and scenario | unit | no | fixture change on clarify-qa with two capabilities |
| test-cases/document | Every scenario has a test case | Scenario without a test case is reported | unit | yes | test-cases.md missing the case for "Successful export" |
| test-cases/document | Every scenario has a test case | Test case under an unknown scenario is reported | unit | yes | case under a scenario name absent from the delta specs |
| test-cases/document | Every scenario has a test case | Several cases for one scenario pass | unit | no | two cases (0.005, 0.015) under one scenario |
| test-cases/document | The test-case check gates design and archive | Design is blocked by a coverage error | integration | yes | hook run as a process on a clarify-ai-qa fixture with an uncovered scenario |
| test-cases/document | The test-case check gates design and archive | Late scenario without a test case blocks the archive | integration | yes | archive gate on a fixture with a scenario added after confirmation |
| test-cases/document | Test cases stay with the change | Archive does not merge test cases | integration | no | real openspec archive of a complete clarify-qa fixture in a temp project |
| test-cases/document | Test cases use Gherkin with concrete data in English | Test case without a Then is reported | unit | no | case with Given and When only |
| test-cases/document | Test cases use Gherkin with concrete data in English | Test case without a Given is reported | unit | no | case with When and Then only |
| test-cases/document | Test case names are unique and stable | Duplicate test case name is reported | unit | no | two "Export of an empty period" cases in one capability |
| test-cases/document | Test case names are unique and stable | Same name in different capabilities is allowed | unit | no | "Empty list" in two capabilities |
| test-cases/document | Test case names are unique and stable | Renamed case loses its coverage | unit | no | test file referencing the old case name |
| test-cases/document | Test cases carry verification labels | Several labels on one case | unit | no | case labelled automated, e2e |
| test-cases/document | Test cases carry verification labels | Missing label is reported | unit | no | case without a Labels line |
| test-cases/document | Test cases carry verification labels | Unknown label is reported | unit | no | case labelled unit |
| test-cases/review | AI QA reviewer checks the test cases | Review report is written | manual | no | pilot change in the test project |
| test-cases/review | What the AI QA reviewer checks | Missing positive case is a finding | manual | no | pilot change with test cases seeded with that gap |
| test-cases/review | What the AI QA reviewer checks | Missing error case is a finding | manual | no | pilot change with test cases seeded with that gap |
| test-cases/review | What the AI QA reviewer checks | Missing boundary values are a finding | manual | no | pilot change with test cases seeded with that gap |
| test-cases/review | What the AI QA reviewer checks | Unsettled repeated submission is a finding | manual | no | pilot change with test cases seeded with that gap |
| test-cases/review | What the AI QA reviewer checks | Vague outcome is a finding | manual | no | pilot change with test cases seeded with that gap |
| test-cases/review | READY means no open blocker or major finding | Only minor findings | manual | no | pilot change; Stage result with an accepted finding |
| test-cases/review | READY means no open blocker or major finding | Accepted major finding does not block READY | manual | no | pilot change; Stage result with an accepted finding |
| test-cases/review | The AI review loop runs at most three times | Loop ends early when the review is READY | manual | no | pilot change |
| test-cases/review | The AI review loop runs at most three times | Developer decides after the third run | unit | yes | run counter at 3 runs; hook input for the reviewer subagent |
| test-cases/review | The AI review loop runs at most three times | Developer decides after the third run | manual | no | pilot: developer is shown the remaining findings |
| test-cases/review | Spec changes from AI reviewer findings | Missing error scenario is added by the AI | manual | no | pilot change with a seeded gap |
| test-cases/review | Spec changes from AI reviewer findings | New business rule goes to the developer | manual | no | pilot change with a seeded gap |
| test-cases/review | Spec changes from AI reviewer findings | Finding that contradicts a confirmed answer goes to the developer | manual | no | pilot change with a seeded gap |
| test-cases/review | Follow-up questions from the test-cases stage | Stage waits for the answer | manual | no | pilot change with a follow-up in the Specs round |
| test-cases/review | Spec changes during the test-cases stage are recorded | AI reviewer finding is recorded | manual | no | pilot change |
| test-cases/review | Spec changes during the test-cases stage are recorded | Change after a follow-up answer is recorded | manual | no | pilot change |
| test-cases/review | Hand-over to a human QA | Hand-over waits for the AI findings | manual | no | pilot change on clarify-qa |
| test-cases/review | Hand-over to a human QA | Hand-over is recorded | manual | no | pilot change on clarify-qa |
| test-cases/review | Human QA writes remarks in the test-case document | Remark under a test case | manual | no | pilot: QA writes a remark |
| test-cases/review | Human QA writes remarks in the test-case document | General remark about a forgotten case | manual | no | pilot: QA writes a general remark |
| test-cases/review | Human QA writes remarks in the test-case document | Unknown status is reported | unit | no | remark with status fixed |
| test-cases/review | Human QA writes remarks in the test-case document | Remark in Russian | manual | no | pilot: remark in Russian |
| test-cases/review | Remarks are answered by the AI and closed only by QA | Done starts a new pass | manual | no | pilot change |
| test-cases/review | Remarks are answered by the AI and closed only by QA | AI answers a remark without closing it | manual | no | pilot change |
| test-cases/review | Remarks are answered by the AI and closed only by QA | QA reopens a remark | manual | no | pilot change |
| test-cases/review | Closed remarks are removed except spec-changing ones | Closed remark is removed | manual | no | pilot change |
| test-cases/review | Closed remarks are removed except spec-changing ones | Last closed remarks are removed at completion | manual | no | pilot change |
| test-cases/review | Closed remarks are removed except spec-changing ones | Spec-changing remark is kept and shown | manual | no | pilot change |
| test-cases/review | Human QA remarks change the spec | Remark adds a scenario | manual | no | pilot change |
| test-cases/review | Human QA remarks change the spec | Remark changes a scenario | manual | no | pilot change |
| test-cases/review | Human QA remarks change the spec | Remark removes a scenario | manual | no | pilot change |
| test-cases/review | Spec reviewer runs again after spec changes | Spec reviewer runs after a change | manual | no | pilot change |
| test-cases/review | Stage decisions are recorded in the test-case document | Accepted finding is read by the next run | manual | no | pilot change |
| test-cases/review | Stage decisions are recorded in the test-case document | Request changes starts another pass | manual | no | pilot change |
| test-cases/review | Stage completion with the AI reviewer only | Design is blocked before confirmation | integration | yes | answers-gate as a process; clarify-ai-qa fixture, blank confirmation |
| test-cases/review | Stage completion with the AI reviewer only | Unlisted major finding blocks the design | integration | yes | NOT-READY report with an unlisted major finding, confirmation Looks correct |
| test-cases/review | Stage completion with the AI reviewer only | Design is allowed after confirmation | integration | yes | findings listed in Stage result, Looks correct |
| test-cases/review | Stage completion with a human QA | Open remark blocks the design | integration | yes | clarify-qa fixture with one open remark |
| test-cases/review | Stage completion with a human QA | Confirmation without a hand-over blocks the design | integration | yes | Looks correct without "Handed over to QA" |
| test-cases/review | Stage completion with a human QA | Confirmed result allows the design | integration | yes | hand-over line, no open remark, Looks correct |
| test-cases/review | Stage completion with a human QA | Developer confirms on QA's behalf | unit | no | same file state as entered by the developer; check reads only the file |
| test-cases/review | Late scenarios get test cases | Scenario added during implementation | manual | no | pilot: add a scenario during apply |
| test-cases/review | Late scenarios get test cases | Late review loop has its own limit | unit | yes | counter at 3 runs, then confirmation Looks correct |
| test-cases/coverage | Verification plan covers every test case | Automated case without a level is reported | unit | no | plan row for an automated case with no level |
| test-cases/coverage | Verification plan covers every test case | Test case missing from the plan is reported | unit | no | plan without one case |
| test-cases/coverage | Verification plan covers every test case | Manual case needs no level | unit | no | manual-only case without a level |
| test-cases/coverage | Tests reference the test cases they prove | Case reference is found | unit | no | temp file with a // @case line |
| test-cases/coverage | Tests reference the test cases they prove | Reference inside a string is not counted | unit | no | @case inside a string literal |
| test-cases/coverage | Tests reference the test cases they prove | Same case name in two active changes | unit | no | two active changes with "Empty list" |
| test-cases/coverage | Archive requires a test for every automated case | Uncovered automated case blocks the archive | integration | yes | archive gate on a fixture with an unreferenced automated case |
| test-cases/coverage | Archive requires a test for every automated case | E2E-only case does not block the archive | integration | yes | fixture with an unreferenced e2e-only case, all else passing |
| test-cases/coverage | Archive requires a test for every automated case | Automated and e2e case needs its automated test | integration | yes | unreferenced automated+e2e case |
| test-cases/coverage | Manual and e2e cases are listed at the end of apply | Manual case is listed for the developer | manual | no | pilot: end of apply |
| test-cases/coverage | Manual and e2e cases are listed at the end of apply | E2E case is listed as waiting | manual | no | pilot: end of apply |
| test-cases/coverage | Unknown case references are warned, archived ones are not | Reference to an archived case stays silent | unit | no | archive dir with test-cases.md holding the case |
| test-cases/coverage | Unknown case references are warned, archived ones are not | Reference with a typo is warned | unit | no | reference to "Export of an emty period" |
| test-cases/coverage | Schemas without test cases are unchanged | Clarify change without test cases archives as before | integration | yes | existing clarify fixture through the archive gate |
| workflow/test-case-schemas | Two test-case schemas | Both schemas are available after install | integration | no | installer into a temp project, then openspec schemas --json |
| workflow/test-case-schemas | Two test-case schemas | AI-only schema has no human hand-over | manual | no | pilot or a second trial change on clarify-ai-qa |
| workflow/test-case-schemas | Two test-case schemas | Human-QA schema hands over to QA | manual | no | pilot change on clarify-qa |
| workflow/test-case-schemas | Test-cases stage sits between specs and design | Test cases come after the specs | integration | no | openspec status on a clarify-qa change with specs written |
| workflow/test-case-schemas | Test-cases stage sits between specs and design | Same artifacts in both schemas | unit | no | both schema.yaml files |
| workflow/test-case-schemas | Clarify rules hold in the test-case schemas | Question gate applies | integration | yes | answers-gate on a clarify-ai-qa change with an unconfirmed Main round |
| workflow/test-case-schemas | Clarify rules hold in the test-case schemas | Archive gate applies to scenarios | integration | yes | clarify-qa fixture with a unit scenario without a marker |
| workflow/test-case-schemas | Clarify and lean are unchanged | Clarify has no test-cases artifact | integration | yes | openspec status on a new clarify change |
| workflow/test-case-schemas | Clarify and lean are unchanged | Lean has no test-cases artifact | integration | yes | openspec status on a new lean change |
| workflow/schema-starter | Creating a change without a schema starts the menu | Unnamed schema is blocked | unit | yes | Bash hook inputs with each command form |
| workflow/schema-starter | Creating a change without a schema starts the menu | Unnamed schema through the wrapper is blocked | unit | yes | Bash hook inputs with each command form |
| workflow/schema-starter | Creating a change without a schema starts the menu | Schema named with a space is not blocked | unit | yes | Bash hook inputs with each command form |
| workflow/schema-starter | Creating a change without a schema starts the menu | Schema named with an equals sign is not blocked | unit | yes | Bash hook inputs with each command form |
| workflow/schema-starter | Creating a change without a schema starts the menu | Unknown schema is passed through | unit | no | Bash hook inputs with each command form |
| workflow/schema-starter | The menu offers three choices | Choosing a human QA | manual | no | pilot: start the change through the menu |
| workflow/schema-starter | The menu offers three choices | Choosing no test cases | manual | no | trial change in the test project |
| workflow/schema-starter | The menu offers three choices | Lean is not offered | unit | no | block message text |
| workflow/schema-starter | No change without a choice | Menu dismissed | manual | no | trial in the test project |
| workflow/schema-starter | No change without a choice | Free-text answer | manual | no | trial in the test project |
| workflow/schema-starter | The project default schema is not a choice | Default schema in settings still starts the menu | unit | yes | project config with schema: clarify |
| workflow/schema-starter | The terminal is not affected | Change created in a terminal | integration | no | real openspec new change in a temp project with schema: clarify |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| test-cases/document | One test-case document per change | [Q2][Q25] |
| test-cases/document | Every scenario has a test case | [Q2][Q19] |
| test-cases/document | The test-case check gates design and archive | [Q3][Q7][Q10][Q30] |
| test-cases/document | Test cases stay with the change | [Q24] |
| test-cases/document | Test cases use Gherkin with concrete data in English | [Q2][Q13][desc] |
| test-cases/document | Test case names are unique and stable | [Q26] |
| test-cases/document | Test cases carry verification labels | [Q11][Q19] |
| test-cases/review | AI QA reviewer checks the test cases | [Q12] |
| test-cases/review | What the AI QA reviewer checks | [Q12] |
| test-cases/review | READY means no open blocker or major finding | [Q12][Q18] |
| test-cases/review | The AI review loop runs at most three times | [Q18][Q44] |
| test-cases/review | Spec changes from AI reviewer findings | [Q35][Q40] |
| test-cases/review | Follow-up questions from the test-cases stage | [Q35][Q40] |
| test-cases/review | Spec changes during the test-cases stage are recorded | [Q33][Q41] |
| test-cases/review | Hand-over to a human QA | [Q12][Q15] |
| test-cases/review | Human QA writes remarks in the test-case document | [Q5][Q6][Q13][Q27][Q32] |
| test-cases/review | Remarks are answered by the AI and closed only by QA | [Q6][Q27][Q37] |
| test-cases/review | Closed remarks are removed except spec-changing ones | [Q28][Q33] |
| test-cases/review | Human QA remarks change the spec | [Q4][Q20][Q36] |
| test-cases/review | Spec reviewer runs again after spec changes | [Q29][Q36] |
| test-cases/review | Stage decisions are recorded in the test-case document | [Q7][Q18][Q37] |
| test-cases/review | Stage completion with the AI reviewer only | [Q18] |
| test-cases/review | Stage completion with a human QA | [Q7][Q37] |
| test-cases/review | Late scenarios get test cases | [Q30][Q44] |
| test-cases/coverage | Verification plan covers every test case | [Q10][Q19] |
| test-cases/coverage | Tests reference the test cases they prove | [Q26] |
| test-cases/coverage | Archive requires a test for every automated case | [Q10][Q19] |
| test-cases/coverage | Manual and e2e cases are listed at the end of apply | [Q19] |
| test-cases/coverage | Unknown case references are warned, archived ones are not | [Q34] |
| test-cases/coverage | Schemas without test cases are unchanged | [Q9][Q21] |
| workflow/test-case-schemas | Two test-case schemas | [Q15][Q21][Q39] |
| workflow/test-case-schemas | Test-cases stage sits between specs and design | [Q3][Q43] |
| workflow/test-case-schemas | Clarify rules hold in the test-case schemas | [Q21][Q8] |
| workflow/test-case-schemas | Clarify and lean are unchanged | [Q9][Q21] |
| workflow/schema-starter | Creating a change without a schema starts the menu | [Q16][Q22] |
| workflow/schema-starter | The menu offers three choices | [Q8][Q22][Q39] |
| workflow/schema-starter | No change without a choice | [Q38] |
| workflow/schema-starter | The project default schema is not a choice | [Q31] |
| workflow/schema-starter | The terminal is not affected | [Q16][Q22] |

## Environment

- Node and the pinned OpenSpec CLI 1.15.0 (`npm i -g @fission-ai/openspec@1.15.0`) for the integration tests, as for the current suite; run with `npm test`.
- Fixture changes on `clarify-ai-qa` and `clarify-qa` under `fixtures/`: two capabilities, a complete `test-cases.md` and broken variants, AI QA review reports with READY and NOT-READY verdicts, a verification plan with the "Test case coverage" table.
- Manual rows: one pilot change in a separate small test project with the kit installed, on the `clarify-qa` schema, with a real tester as QA; a short trial change on `clarify-ai-qa` and the starter menu in the same project. The developer goes through the manual rows there before archive and records the outcome.
