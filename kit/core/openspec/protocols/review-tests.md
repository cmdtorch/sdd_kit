<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Test review protocol (test-reviewer)

Tests exist to prove the change's spec scenarios. Your question: **would these tests fail if the feature were
broken in the way each scenario describes?** Bad tests are worse than none: they give false confidence.
Judge against `openspec/protocols/testing.md` §4.

## Input

1. Run `node openspec/tooling/bin/review-input.mjs --change <change>`. If you are not allowed to run it,
   say so in the review and collect the same facts by hand: scenarios from the delta specs, markers by
   searching the tests. Never stop because of it. The script gives you:
   - every scenario with its THEN / AND clauses and planned level;
   - every test that carries the scenario's marker, with file and line;
   - heuristic signals (no assertion, status-only, truthiness-only, mock-only, fewer assertions than THEN
     clauses, skipped). The signals are **hints**: confirm or dismiss each one by reading the test.
2. Read the marked tests in full. Read the code under test only when you need it to judge whether a test
   really exercises the behaviour.
3. `openspec/changes/<change>/verification-plan.md` — what was planned.

## What to check

1. **Every THEN / AND is asserted** on an observable outcome: response body, status *with* payload, state
   read back through the public interface, text on screen, an emitted message.
2. **Specific assertions.** Exact values, not "something exists". Weak: `status_code == 200` alone,
   `assert data`, `len(x) > 0`, `toBeTruthy()`.
3. **Error scenarios assert the error itself** — status, code or field, message.
4. **Behaviour, not wiring.** "The mock was called" is never the only assertion; the unit under test is
   not mocked.
5. **Explicit given data.** The test builds exactly the state the scenario's WHEN needs.
6. **Right marker.** The test really exercises the scenario it is marked with — not a neighbouring one.
7. **Gaps and noise.** A planned scenario without a real test. Tests that prove nothing about a requirement.
   Skipped or xfail tests.

For each finding, describe a concrete break the test would miss: "if the export included draft sales, this
test still passes because it only counts rows".

## Output

Write `openspec/changes/<change>/reviews/test-review.md` — the only file you write:

```markdown
# Test review — <change>

Verdict: READY | NOT-READY

| ID | Severity | Test | Scenario | Finding | Break it would miss | Suggested fix |
|---|---|---|---|---|---|---|
| T1 | major | tests/test_export.py::test_successful_export | Successful export | only `status_code == 200` is asserted | a CSV with wrong totals passes | assert the rows and the total |

## Human decision

<!-- Filled by the human when the verdict stays NOT-READY: which findings are accepted, why, by whom. -->
```

- Severity: `blocker` (a scenario is not really tested), `major` (an important THEN is not asserted,
  or the assertion is too weak to catch the break), `minor` (readability, small gaps).
- Verdict `READY` = no blocker and no major.

Return the verdict and the blocker and major findings to the caller.

## For the main agent (after the review)

1. Fix the blocker and major findings in the **tests**. Never weaken them; when a stronger test fails,
   fix the code.
2. Run the reviewer once more. At most two review rounds.
3. If it is still `NOT-READY`, show the remaining findings to the human. The human writes the decision under
   `## Human decision`. The archive gate needs either `Verdict: READY` or that decision.
