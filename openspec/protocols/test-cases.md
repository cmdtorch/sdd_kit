<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Test-case protocol

Applies to changes on the `clarify-ai-qa` and `clarify-qa` schemas. The test-cases stage sits between the
specs and the design: before any design, code or TDD test exists, the AI writes the cases a manual QA engineer
would check, has them reviewed, and only then goes on. TDD tests and the later E2E stage are built from the
same cases.

| Schema | Who reviews the test cases | Stage is complete when |
|---|---|---|
| `clarify-ai-qa` | the AI QA reviewer only | every blocker and major finding is fixed or accepted, and the developer confirms |
| `clarify-qa` | the AI QA reviewer, then a human QA | the cases were handed over to QA, no remark is open, and QA confirms |

**`test-cases.md` is the source of truth for the stage.** Remarks, answers, accepted findings, spec changes
and the confirmation all end up in this file. Nothing that is only said in chat counts.

---

## 1. File layout

`openspec/changes/<change>/test-cases.md`:

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

None.

## Stage result

Accepted findings:
- (none)

[Answer]:
```

- One file per change. `## <capability-path>` for every capability of the delta specs, in it
  `### Scenario: <exact scenario name>` for every scenario of that capability, in it one or more
  `#### Case: <case name>`.
- The headings (`Scenario:`, `Case:`, the three closing sections), `Labels:` and the step keywords stay
  exactly as shown and in English: the kit's checks read them.
- Check the file with `node openspec/tooling/checks/check-test-cases.mjs --change <change>`; add `--stage`
  to check that the stage is complete (§7).

## 2. Writing test cases

- **At least one case per scenario.** Every scenario of every delta spec has a case; every case sits under a
  scenario that exists in the delta specs. Write the cases a QA engineer would check: the positive path, the
  errors and the boundary values, plus the unusual conditions of the reviewer's checklist (empty input,
  duplicate entries, repeated submission, an unavailable external service) where they apply.
- **Gherkin steps.** Each case has at least one `**Given**`, one `**When**` and one `**Then**` step, as list
  items; `**And**` and `**But**` continue the previous step.
- **Concrete data.** Real amounts, dates, names and messages — "two paid sales of 100.00 and 50.00", not
  "some sales". Every Then states an observable outcome: a value, a message text, a status, a resulting state.
- **English.** Cases are written in English, also when the remark that led to them is in another language.
- **Labels.** Each case has a `Labels:` line with one or more of:

  | Label | Meaning |
  |---|---|
  | `automated` | proven by a test below the user interface (the verification plan picks `unit` or `integration`) |
  | `e2e` | the full user path through the interface; tested in the E2E stage (`openspec/protocols/e2e.md`) |
  | `manual` | checked by hand only, by QA after the archive; needs a `Manual reason:` line |

  A case labelled `manual` has a `Manual reason:` line under `Labels:` that starts with `cannot be automated:`
  or `dangerous:` (`openspec/protocols/testing.md` §1), e.g.
  `Manual reason: cannot be automated: a person judges how the name wraps`. Effort is not a reason; a dangerous
  function keeps its `automated` cases and gets a `manual` case in addition.
  `automated, e2e` is common: the backend now, the path through the UI later. A case never names `unit` or
  `integration`; that choice belongs to the verification plan (`openspec/protocols/testing.md`).
- **Unique, stable names.** A case name is unique within its capability (the same name in two capabilities
  is fine). Tests reference a case by its exact name (`@case <capability-path> :: <case name>`), so a
  renamed case counts as uncovered until its tests use the new name. Rename only when the meaning changes.

## 3. The AI review loop

1. Run the `test-cases-reviewer` subagent (`openspec/protocols/review-test-cases.md`), naming the change. It
   writes `reviews/test-cases-review.md` with the verdict READY or NOT-READY and findings of severity
   `blocker`, `major` or `minor`. It only reports.
2. Fix the test cases for each blocker and major finding and run the reviewer again. In its task, name the
   cases and scenarios you added or changed since its previous run: a repeated run re-checks its previous
   findings and looks for new ones only there, so the loop converges.
3. **At most three reviewer runs per loop.** The kit's hook `test-cases-run-limit` counts the runs in
   `reviews/test-cases-runs.json` and blocks a fourth one. Stop earlier when a run is READY. After a third
   NOT-READY run, show the developer every remaining blocker and major finding and ask them to fix or accept
   each one.
4. Record each finding the developer accepted or fixed by hand under "Stage result" (§6).
5. **After the last run of a loop, the AI reviewer sees nothing more.** Change cases then only to settle what
   the developer decided. List every case added or changed after the last run under "Stage result" as
   `- Not reviewed by the AI QA reviewer: <case name> (<capability>)` and show that list to the developer
   before the hand-over or the confirmation, so a human checks those cases with extra care.

Minor findings never block; fix them when cheap.

## 4. Spec changes during the stage

The stage may change the delta specs. Every rule below ends the same way: record the change under
"Spec changes during test-case review" and run the `spec-reviewer` subagent again (§4.4).

### 4.1 From an AI reviewer finding

When a finding needs a scenario the spec lacks, add the scenario and its cases **yourself only** when all hold:

- it adds an error case, an empty state, a boundary value or an unusual condition;
- it changes no existing scenario's outcome;
- it contradicts no confirmed answer in `clarifications.md`.

Otherwise (a new business rule, a changed outcome, a conflict with a confirmed answer) leave the spec as it is
and ask the developer a follow-up question first (§4.3).

### 4.2 From a human QA remark

When a QA remark shows behaviour that is missing, wrong or not wanted in a spec, add, change or remove the
scenario **yourself, without asking the developer**, also when the remark contradicts a confirmed answer.
Remove the cases of a removed scenario; rewrite the cases of a changed scenario for the new behaviour.

### 4.3 Follow-up questions

A follow-up question asked during the stage goes into the **Specs round** of `clarifications.md`, as any
follow-up does (`openspec/protocols/questions.md`): next free number, `(follow-up to Q<n>)` when it follows up
an answer, and the round's summary `[Answer]:` reset to blank. Write it into the file right away and then
tell the developer; do not ask for permission to ask it. Until the round is confirmed again the answers gate
blocks writing the delta specs. Do not run the reviewer again and do not
complete the stage until the Specs round is answered and confirmed with `Looks correct`. QA is asked no
questions.

### 4.4 Recording spec changes

Each spec change made during the stage — from a remark, a finding or a follow-up answer — is a list item under
"Spec changes during test-case review" that quotes the remark, finding or question and names the changed
scenario:

```markdown
## Spec changes during test-case review

- Finding "Unavailable export service not covered for Export of sales" → added scenario
  "Export while the export service is unavailable" (inventory/sale-export)
- QA remark "an empty period must show an error, not an empty file" → changed scenario
  "Export of an empty period" (inventory/sale-export)
```

The verification plan cites these records in *Requirement trace* as the source of the changed requirements.
After any spec change, run the `spec-reviewer` subagent again before the stage is complete; its report replaces
`reviews/spec-review.md`. Show its verdict and findings to the developer, who decides: fix the spec, ask a
follow-up or accept.

## 5. Human QA remarks (`clarify-qa`)

### 5.1 Hand-over

Hand the cases over only when every blocker and major finding of the latest AI review is fixed by hand or
accepted in "Stage result", or absent from that review. Then write the line `Handed over to QA` under
"Stage result" and tell the developer that the test cases are ready for QA. QA works in the repository
directly, or through the developer, who forwards the cases and enters QA's remarks and decisions.

### 5.2 Remarks

```markdown
> **Remark** [open]: the file must also show the shop name
> **Answer:** added the shop name to the Then step
```

- A remark about one case goes right under that case; a remark not tied to one case goes under
  `## General remarks`.
- Status in brackets: `open`, `closed` or `reopened`. Any other status is an error of the check and counts as
  open for the gates.
- Remarks may be in any language. Test cases stay in English.

### 5.3 Who does what

- On `done` from whoever works in Claude Code (QA or the developer), handle **every** open or reopened remark:
  revise the cases (and the spec, §4.2), then write an `> **Answer:**` line under the remark that says how it
  was handled. A reopened remark gets a new answer.
- **Only QA closes or reopens a remark** (a reopen comes with an explanation). The developer may enter QA's
  decisions on QA's behalf. Never change a remark's status yourself: an answered remark stays `open`.
- **Closed remarks are removed** at your next pass or when the stage is completed, whichever comes first —
  except a remark that changed a spec: it is kept in "Spec changes during test-case review" (§4.4) together
  with the changed scenario.

## 6. "Stage result"

```markdown
## Stage result

Accepted findings:
- No case for a 256-character name — inventory/sale-export, accepted: names are cut by the form
- Then "the export works" is not observable — Export works, fixed by hand by the developer

Handed over to QA

[Answer]: Looks correct
```

- **Accepted or hand-fixed findings.** One list item each. A blocker or major finding counts as accepted when
  a list item contains the finding's text from the Finding column of `reviews/test-cases-review.md`
  (case- and whitespace-insensitive; finding IDs are not used — the reviewer renumbers them). Add the
  requirement or test case it is about and a short reason. The reviewer skips these findings, and the gates
  read them.
- **READY** means no blocker or major finding remains, not counting accepted ones.
- **`Handed over to QA`** — `clarify-qa` only (§5.1).
- **Confirmation.** The `[Answer]:` line, the same syntax as a question-round summary:
  - blank — not confirmed yet;
  - `Looks correct` — exactly this text completes the stage;
  - `Request changes: <what to change>` — on `done`, make the changes, then reset the `[Answer]:` to blank and
    ask for the confirmation again.

On `clarify-ai-qa` the developer confirms. On `clarify-qa` QA confirms, or the developer on QA's behalf.
At the end of the stage, show the developer the list "Spec changes during test-case review".

## 7. Gates

The stage is complete when `node openspec/tooling/checks/check-test-cases.mjs --change <change> --stage` passes:

- the structure check (§1–§2) reports no error;
- the latest AI review is READY, or each of its blocker and major findings is listed in "Stage result";
- the confirmation is exactly `Looks correct`;
- `clarify-qa` also: the line `Handed over to QA` and no open or reopened remark.

Until then the answers gate blocks writing `design.md`. The archive gate runs the structure check again, so a
scenario added later without a case blocks the archive. Do not try to get around the gates.

## 8. Late scenarios

A scenario added to a delta spec after the stage is complete (for example during implementation) gets its test
cases at once, and they are reviewed in a **new AI review loop** with its own limit of three runs; after it the
developer decides on what remains. A human QA is not asked again, no new hand-over is requested, and the stage
confirmation stays `Looks correct`. The run-limit hook starts the new loop by itself once the stage is
confirmed. Record the spec change (§4.4) and add the new cases to the verification plan.

## 9. Switching between `clarify-ai-qa` and `clarify-qa`

Both schemas have the same artifacts, so a change can switch at any time by editing one line of
`openspec/changes/<change>/.openspec.yaml`:

```yaml
schema: clarify-qa
```

The gates read the schema on every call, so the rules of the new schema apply at once. Switching to
`clarify-qa` after the AI loop adds the hand-over and the QA remarks before the stage is complete; switching
to `clarify-ai-qa` drops them (open remarks no longer block the stage, so handle them before switching).
Tell the developer what changed. Switching to or from `clarify` or
`lean` is not supported: their artifacts differ.
