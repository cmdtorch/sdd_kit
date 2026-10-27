<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Testing and verification protocol

Applies to changes on the `clarify`, `clarify-ai-qa`, `clarify-qa` and `lean` schemas. The parts about
test cases (§2 *Test case coverage*, §3 case references, §6 the lists of cases) apply only to
`clarify-ai-qa` and `clarify-qa`, whose test cases are written per `openspec/protocols/test-cases.md`.

Every spec scenario is a promise. A test exists to prove one promise — never just to raise the test
count. A test that would still pass with the feature broken is worse than no test: it gives false confidence.

The kit does not know the project's stack and never runs the project's tests itself, except the E2E tests of
the E2E stage, which it runs through its own script (`openspec/protocols/e2e.md`). Use the project's own commands
(README, CLAUDE.md, Makefile, package scripts, CI config). Say which commands you used. If you cannot
find how to run the tests, ask the developer once and suggest writing the commands into CLAUDE.md.

## 1. Verification levels

| Level | What | When it runs |
|---|---|---|
| `unit` | a unit of logic in isolation (rules, calculations, validation) | during TDD, scoped to what you are changing |
| `integration` | several parts together through a real interface (an API call, a database, a component with its data layer) | during TDD, scoped; again with the full suite |
| `manual` | a check that cannot be automated, or the extra check of a dangerous function | listed for QA in `apply-report.md`, never a task (`openspec/protocols/apply.md` §7) |
| full suite | the whole test suite + the project's quality checks (lint, types, build) | once at the end of apply, and in the project's CI |

Test cases carry coarser **verification labels** (`openspec/protocols/test-cases.md`): `automated` (a test
below the user interface), `e2e` (the full user path through the interface, tested in the E2E stage of
`openspec/protocols/e2e.md`) and
`manual` (checked by hand). A case never names a level; the verification plan picks `unit` and/or
`integration` for each `automated` case.

**Manual only with a reason.** A `manual` row of the plan (its "Manual reason" column) and a test case labelled
`manual` (its `Manual reason:` line) give a reason that starts with `cannot be automated:` or `dangerous:`,
followed by the explanation, e.g. `cannot be automated: a new developer judges whether the README is clear`.
Difficulty or effort is never a reason: automate the check. Never ask the developer whether a check should be
automated or stay manual; decide by these rules. The kit's checks report a missing or malformed reason, and the
next artifact cannot be written until it is fixed.

**Dangerous functions.** A function is **dangerous** when it moves money (payments, payouts, charges, balances),
acts on many users or records at once, or deletes or changes data irreversibly. Sign-in, roles and access rights
alone do not make a function dangerous: a check that a user without the admin role cannot open the admin page
gets no `dangerous:` row. A dangerous scenario is tested automatically like any other (a `unit` or
`integration` row, or an E2E test) and gets an additional `manual` row whose reason names why it is dangerous —
e.g. a payout to the card of every user whose balance is above 1000, every hour: `dangerous: money, many users`.

Pick the **cheapest level that really proves the scenario**. Use `integration` when the risk is in how
the parts work together (permissions, persistence, serialisation, wiring), not for every validation rule.

## 2. `verification-plan.md`

```markdown
# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| inventory/sale-export | Accountant exports sales | Successful export | integration | yes | 3 sales across 2 months | — |
| inventory/sale-export | Accountant exports sales | Totals are rounded | unit | no | amounts 0.005, 0.015 | — |
| inventory/sale-export | Accountant exports sales | Export file opens in a spreadsheet | manual | no | the March file | cannot be automated: a person judges how the file looks in a spreadsheet |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| inventory/sale-export | Accountant exports sales | [Q3][Q14][D1] |

## Environment

- <what the tests need: services, seed data, feature flags>
- Running application: no

## Test case coverage

| Capability | Scenario | Case | Labels | Level |
|---|---|---|---|---|
| inventory/sale-export | Successful export | Export of a month with two sales | automated, e2e | integration |
| inventory/sale-export | Totals are rounded | Amount 0.005 rounds up | automated | unit |
| inventory/sale-export | Successful export | Long shop name wraps in the header | manual | — |
```

- **Every** scenario of every delta spec of the change appears in *Scenario coverage* or *Exclusions*.
  Use the exact capability path, requirement name and scenario name.
- `Level` is one of `unit`, `integration`, `manual`. A scenario may need two rows (for example `unit`
  for the rule and `integration` for the permission check).
- An exclusion needs a real reason, e.g. "behaviour unchanged, covered by existing test X". Being hard
  to test is a reason neither for an exclusion nor for `manual`: automate it.
- `Manual reason` is filled only on `manual` rows (§1); other rows have `—`.
- *Requirement trace* maps each requirement to its sources (`[Q<n>]`, `[D<n>]`, `[desc]`). This is the
  only place where spec items are tied to clarification answers. On the test-case schemas, a requirement
  changed during the test-case review may also cite its entry of "Spec changes during test-case review".
- *Test case coverage* — test-case schemas only: **every** test case of `test-cases.md`, with its exact
  capability path, scenario name, case name and labels. A case labelled `automated` names its level:
  `unit`, `integration` or both (`unit, integration`). A case labelled only `e2e` or `manual` has no
  level (`—`).
- *Environment* ends with the line `Running application: yes` or `Running application: no`: `yes` when
  checks need the application running (integration checks through the running stack, or the E2E stage). With
  `yes` the agent runs the start check before the first task (`openspec/protocols/apply.md` §4).

## 3. Scenario markers

Every test that verifies a scenario carries a marker: a comment with the **capability path** and the
**exact scenario name**, on its own line, usually right above the test. It works in any language:

```python
# @scenario inventory/sale-export :: Successful export
def test_successful_export(...):
```

```ts
// @scenario inventory/sale-export :: Successful export
it('exports the paid sales of the period', async () => { /* ... */ });
```

- The format is `@scenario <capability-path> :: <Scenario name>`. Only indentation and a comment opener
  (`#`, `//`, `/*`, `<!--`, `--`, …) may come before it, and nothing after the name except a comment
  closer (`*/`, `-->`). A marker mentioned in prose or inside a string is not counted.
- One test may carry several markers (one per line). A scenario may have several tests.
- Helper tests without a marker are fine. Each test that comes from a spec scenario carries its marker,
  and so does each regression test for a bug in specified behaviour.
- **Case references** (test-case schemas): a test that proves a test case also carries
  `@case <capability-path> :: <case name>` with the exact case name of `test-cases.md`, with the same
  placement rules. One test may reference several cases; a case may have several tests. Before archive,
  every `automated` case has at least one test that references it; an `e2e` case needs an E2E test in the
  E2E stage (`openspec/protocols/e2e.md`), a `manual` case none.
  A reference to a case of an archived change is fine; a reference that matches no case of an active or
  archived change is warned about (usually a typo or a renamed case).

  ```ts
  // @scenario inventory/sale-export :: Successful export
  // @case inventory/sale-export :: Export of a month with two sales
  it('exports the paid sales of March 2026', async () => { /* ... */ });
  ```

- The kit finds markers and case references by reading the project files (git-tracked and untracked, not ignored, outside
  `openspec/`). Paths listed in `openspec/markers-ignore` (one pattern per line: `docs/`, `CHANGELOG.md`,
  `**/examples`) are skipped: use it for documentation or sample code that shows markers. Check them with
  `node openspec/tooling/checks/check-traceability.mjs --change <change> --markers`.

## 4. What a good test looks like

1. **Every `THEN` and `AND` of the scenario is asserted** on an observable outcome: the response body,
   a status *together with* the payload, state that can be read back through the public interface,
   text on screen, an emitted message.
2. **Assertions are specific.** Check exact values, not merely that something exists.
   - Weak: "status is 200" alone, "the result is truthy", "the list is not empty".
   - Strong: "the items are exactly `[{id: 7, total: "150.00"}]`".
3. **Error scenarios assert the error itself** — the status, error code or field, and message — not just "it failed".
4. **Test behaviour, not wiring.**
   - "The mock was called" is never the *only* assertion.
   - Do not mock the unit under test.
5. **Given data is explicit.** The test builds exactly the state the scenario's WHEN needs, with
   factories or seed data, so a reader can see why the outcome follows.
6. **Ask yourself: would this test fail if the feature were broken in the way the scenario describes?**
   If not, strengthen it.

## 5. During apply

- **TDD per task group:** write the tests for the group's scenarios first and watch them fail for the
  right reason, then implement and watch them pass, then refactor.
- **Run tests scoped** to what you are changing. The full suite runs at the end.
- Gaps in requirements found while coding → `## Apply round` in `clarifications.md` (see `questions.md`).
  Do not guess.

## 6. End of apply

1. Run the `test-reviewer` subagent (`openspec/protocols/review-tests.md`) and fix its blocker and
   major findings.
2. Run the project's **full test suite and quality checks**. Fix what fails (§7). Report the commands
   and their result to the developer.
3. Write `apply-report.md` (`openspec/protocols/apply.md` §7): every `manual` row and every test case labelled
   `manual` under "Manual checks", with its steps, expected outcome and reason, dangerous checks first. QA
   performs them after the archive; they are not tasks.
4. **E2E stage**, when the change needs it (`openspec/protocols/e2e.md`): E2E tests for the `e2e` cases
   (or the listed scenarios on `clarify` and `lean`), run only with `node openspec/tooling/bin/e2e-run.mjs`,
   and in UI mode the comparison with the screenshots. When E2E is skipped, every test case labelled `e2e`
   (alone or with other labels) goes under "Not verified automatically" in `apply-report.md`; accepted cases
   go there too, with their reasons. Then ask the consent list (`openspec/protocols/apply.md` §8).
5. Run the archive checks yourself:
   `node openspec/tooling/checks/check-traceability.mjs --change <change> --markers`, and when the change has
   `e2e.md`, `node openspec/tooling/checks/check-e2e.mjs --change <change> --mode archive`.
6. Tell the developer the change is ready to archive (`openspec/protocols/apply.md` §9); the developer
   archives it with `/opsx:archive`. The archive gate checks that every task is done, every
   automated scenario has a marked test, the artifacts pass the kit checks and the test review is done; on
   the test-case schemas also that `test-cases.md` passes its check and every `automated` case has a test
   with its case reference; and that the E2E stage is complete (on the test-case schemas `e2e.md` with the
   E2E decision is required; `Mode: skipped` never blocks). On a change with the kit version stamp it also
   checks `apply-report.md`: a missing test is accepted only for an entry of "Not verified automatically" with
   the developer's `Consent:`, and every such entry needs one. Test cases stay in the archived change; they are
   not merged into the specs.

## 7. When something fails

- **Never weaken quality to get green.** Do not delete tests, skip them, mark them as expected failures,
  loosen assertions, lower thresholds or edit a test so it matches wrong behaviour. Change a test only
  when the test itself is wrong, and say why. Weakening a test needs the developer's explicit consent and goes
  under "Weakened tests" in `apply-report.md` (`openspec/protocols/apply.md` §6).
- **At most two fix attempts** per failure (an E2E test of the E2E stage gets three,
  `openspec/protocols/e2e.md` §8). Then stop and ask the human. Give the options and their
  consequences (cost, risk, what stays unverified). Giving up on a target is the human's decision,
  never yours.
