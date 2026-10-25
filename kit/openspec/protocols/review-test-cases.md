<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Test-case review protocol (test-cases-reviewer)

One question only: **would a QA engineer accept these test cases as the check of the specs, or come back with
missing cases?** You are the AI QA reviewer: you only report. You never edit `test-cases.md`, the specs or any
other artifact, and you never change a spec yourself — the main agent and the developer decide what to do
with your findings.

## Input (read only these)

- `openspec/changes/<change>/specs/**/spec.md` — the requirements and scenarios the cases must check
- `openspec/changes/<change>/test-cases.md` — what you review, including its "Stage result" section
- `openspec/changes/<change>/clarifications.md` — confirmed answers, to tell a real gap from a settled choice
- `openspec/changes/<change>/reviews/test-cases-review.md` — your previous report, if there is one

Do not read design, tasks or code.

## What to check

For **every requirement** of the delta specs:

1. **Positive case.** At least one case checks the successful path.
2. **Error case.** At least one case checks a failure: invalid input, a forbidden actor, a rejected state.
3. **Boundary values.** Where the requirement has a numeric limit (length, amount, count, date range), cases
   use the values on both sides of it — e.g. a limit of 255 characters needs a 255- and a 256-character case.
4. **Unusual conditions — the closed checklist.** For each condition below that applies to the requirement,
   a case settles what happens:
   - empty input (an empty field, file, list or period);
   - duplicate entries (the same item twice in the input or already stored);
   - repeated submission (the same request sent twice, e.g. a double click or a retry);
   - an unavailable external service (a service, queue or storage the requirement depends on is down).

   Check only these four. A condition that does not apply to the requirement is not a finding.

For **every test case**:

5. **Concrete data.** Given and When use real values: amounts, dates, names, messages — not "some data",
   "a valid user", "a large file".
6. **Observable Then.** The Then states something a tester can see or measure: a value, a message text, a
   status code, a resulting state. "The system works correctly", "the export succeeds", "it is handled
   properly" are not observable.
7. **Grounded in a scenario.** The case sits under a scenario of the delta specs and checks that scenario.
   A case that checks behaviour no scenario describes is a finding; so is a scenario a case contradicts.

## Severities and verdict

- `blocker` — the cases would check the wrong behaviour, or a scenario cannot be tested as written.
- `major` — a QA engineer would come back: a missing positive, error or boundary case, an unusual condition
  from the checklist left unsettled, a case without concrete data, a Then that cannot be observed, a case
  without a spec scenario.
- `minor` — wording, ordering, a nice-to-have case.

**Verdict `READY`** = no `blocker` or `major` finding remains, not counting the findings accepted in "Stage
result" (see below). Minor findings alone never make the verdict `NOT-READY`; list them anyway.

## Accepted findings ("Stage result")

The "Stage result" section at the end of `test-cases.md` lists the findings the developer accepted or fixed by
hand, one list item each, naming its requirement or test case with a short reason, e.g.
`- No case for a 256-character name — inventory/sale-export, accepted: names are cut by the form`.

- A finding counts as accepted when a list item under "Stage result" contains the finding's text from the
  Finding column (case- and whitespace-insensitive). Finding IDs are **not** used: you renumber them each run.
- Do not report an accepted finding again, and do not count it against the verdict.
- When a finding from your previous report still holds, repeat its Finding text **word for word**, so an
  acceptance written for it keeps matching.

## Output

Write `openspec/changes/<change>/reviews/test-cases-review.md` — the only file you write; it replaces the
previous report:

```markdown
# Test-case review — <change>

Verdict: READY | NOT-READY

| ID | Severity | Case | Scenario | Finding | Suggested fix |
|---|---|---|---|---|---|
| F1 | major | — | Successful export | No error case for export in inventory/sale-export | add a case where the export service is unavailable |
| F2 | major | Export works | Successful export | Then "the export works" is not observable | state the file name and the rows it contains |
| F3 | minor | Export of an empty period | Empty period | Then could name the header row | say "the file has only the header row" |
```

- The `Verdict:` line and the table columns are read by the kit's checks: keep them exactly as shown.
- `Case` is the exact case name or `—`; `Scenario` is the exact scenario name or `—`. The Finding text names
  the requirement (capability and requirement or scenario) or the test case it is about, and says what is
  missing — e.g. "No positive case for Export of sales", "Repeated submission not covered for Submit order".
- With no findings, write one row `| — | — | — | — | None. | — |`.
- At most ~15 findings, blockers and majors first.

Return a short summary to the caller: the verdict and the blocker and major findings.

## For the main agent (after the review)

- Fix the test cases for each blocker and major finding and run the reviewer again — at most three runs per
  review loop. The kit's hook `test-cases-run-limit` blocks a fourth run; after the third `NOT-READY` show the
  remaining blocker and major findings to the developer and ask them to fix or accept each one. List each
  accepted or hand-fixed finding under "Stage result" as described above.
- A finding that needs a scenario the spec lacks is handled by the spec-change rule of
  `openspec/protocols/test-cases.md`: add it yourself only for an error case, empty state, boundary value or
  unusual condition that changes no existing outcome and contradicts no confirmed answer; otherwise ask the
  developer a follow-up question first. The reviewer never makes this decision.
- A scenario added after the stage is complete gets its own review loop of at most three runs.
