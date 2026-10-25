<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Testing and verification protocol

Applies to changes on the `clarify` and `lean` schemas.

Every spec scenario is a promise. A test exists to prove one promise — never just to raise the test
count. A test that would still pass with the feature broken is worse than no test: it gives false confidence.

The kit does not know the project's stack and never runs tests itself. Use the project's own commands
(README, CLAUDE.md, Makefile, package scripts, CI config). Say which commands you used. If you cannot
find how to run the tests, ask the developer once and suggest writing the commands into CLAUDE.md.

## 1. Verification levels

| Level | What | When it runs |
|---|---|---|
| `unit` | a unit of logic in isolation (rules, calculations, validation) | during TDD, scoped to what you are changing |
| `integration` | several parts together through a real interface (an API call, a database, a component with its data layer) | during TDD, scoped; again with the full suite |
| `manual` | checks that cannot reasonably be automated | listed for a human, never silently skipped |
| full suite | the whole test suite + the project's quality checks (lint, types, build) | once at the end of apply, and in the project's CI |

Pick the **cheapest level that really proves the scenario**. Use `integration` when the risk is in how
the parts work together (permissions, persistence, serialisation, wiring), not for every validation rule.

## 2. `verification-plan.md`

```markdown
## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| inventory/sale-export | Accountant exports sales | Successful export | integration | yes | 3 sales across 2 months |
| inventory/sale-export | Accountant exports sales | Totals are rounded | unit | no | amounts 0.005, 0.015 |

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
```

- **Every** scenario of every delta spec of the change appears in *Scenario coverage* or *Exclusions*.
  Use the exact capability path, requirement name and scenario name.
- `Level` is one of `unit`, `integration`, `manual`. A scenario may need two rows (for example `unit`
  for the rule and `integration` for the permission check).
- An exclusion needs a real reason, e.g. "behaviour unchanged, covered by existing test X". Being hard
  to test is not a reason; such a scenario is `manual`.
- *Requirement trace* maps each requirement to its sources (`[Q<n>]`, `[D<n>]`, `[desc]`). This is the
  only place where spec items are tied to clarification answers.

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
- The kit finds markers by reading the project files (git-tracked and untracked, not ignored, outside
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
3. `manual` rows: list them for the developer, with what to check and the expected outcome. A human
   performs them.
4. Run the archive checks yourself:
   `node openspec/tooling/checks/check-traceability.mjs --change <change> --markers`.
5. Archive with `openspec archive <change>`. The archive gate checks that every task is done, every
   automated scenario has a marked test, the artifacts pass the kit checks and the test review is done.

## 7. When something fails

- **Never weaken quality to get green.** Do not delete tests, skip them, mark them as expected failures,
  loosen assertions, lower thresholds or edit a test so it matches wrong behaviour. Change a test only
  when the test itself is wrong, and say why.
- **At most two fix attempts** per failure. Then stop and ask the human. Give the options and their
  consequences (cost, risk, what stays unverified). Giving up on a target is the human's decision,
  never yours.
