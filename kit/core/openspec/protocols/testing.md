<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Testing and verification protocol

Applies to changes on the `clarify` and `lean` schemas.

Every spec scenario is a promise. A test exists to prove one promise — never just to raise the test
count. A test that would still pass with the feature broken is worse than no test: it gives false confidence.

Project-specific commands (scoped run, full suite, quality gate, E2E, marker collection) live in
`openspec/tooling/verify.yaml`. If that file does not exist yet, use the commands from the project's
README or CLAUDE.md, and say which ones you used.

## 1. Verification levels

| Level | What | When it runs |
|---|---|---|
| `unit` | unit and integration tests (e.g. pytest + factories + API client) | during TDD, **scoped** to the tests you are working on |
| `e2e` | browser tests (Playwright) for key user journeys only | in the task group that delivers the journey; again at the end of apply |
| `manual` | checks that cannot reasonably be automated | listed for a human, never silently skipped |
| full-suite gate | the whole test suite + the project's quality gate (lint, types) | once at the end of apply, and in CI |

Pick the **cheapest level that really proves the scenario**. E2E is for journeys where the browser,
the frontend and the backend together are the risk — not for every validation rule.

## 2. `verification-plan.md`

```markdown
## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup |
|---|---|---|---|---|---|
| inventory/sale-export | Accountant exports sales | Successful export | unit | yes | 3 sales across 2 months |
| inventory/sale-export | Accountant exports sales | Export from the sales page | e2e | yes | seeded accountant user |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| inventory/sale-export | Accountant exports sales | [Q3][Q14][D1] |

## Environment

- <what the tests need: services, seed data, feature flags, browsers> 
```

- **Every** scenario of every delta spec of the change appears in *Scenario coverage* or *Exclusions*.
  Use the exact capability path, requirement name and scenario name.
- `Level` is one of `unit`, `e2e`, `manual`. A scenario may need two rows (for example `unit` for the rule
  and `e2e` for the journey).
- An exclusion needs a real reason, e.g. "behaviour unchanged, covered by existing test X". Being hard
  to test is not a reason; such a scenario is `manual`.
- *Requirement trace* maps each requirement to its sources (`[Q<n>]`, `[D<n>]`, `[desc]`). This is the
  only place where spec items are tied to clarification answers.

## 3. Scenario markers

Every test that verifies a scenario carries a marker with the **capability path** and the **exact scenario name**:

- pytest: `@pytest.mark.scenario("inventory/sale-export", "Successful export")`
- Playwright:
  ```ts
  test('accountant exports sales', {
    annotation: { type: 'scenario', description: 'inventory/sale-export :: Successful export' },
  }, async ({ page }) => { /* ... */ });
  ```
- other stacks: whatever `verify.yaml → collect_scenarios` can collect.

One test may carry several markers. A scenario may have several tests. Helper tests without a
marker are fine. Each test that comes from a spec scenario carries its marker, and so does each
regression test for a bug in specified behaviour.

## 4. What a good test looks like

1. **Every `THEN` and `AND` of the scenario is asserted** on an observable outcome: the response body,
   a status *together with* the payload, state that can be read back through the public interface,
   text on screen, an emitted message.
2. **Assertions are specific.** Check exact values, not merely that something exists.
   - Weak: `assert response.status_code == 200`, `assert data`, `assert len(items) > 0`,
     `expect(page).toBeTruthy()`.
   - Strong: `assert response.json()["items"] == [{"id": sale.id, "total": "150.00"}]`.
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
  right reason, then implement and watch them pass, then refactor. If the project runs `tdd-guard`, it
  enforces this order — work with it, not around it.
- **Run tests scoped** to what you are changing (`verify.yaml → unit.scoped`). The full suite runs at the end.
- E2E tests for journeys marked `e2e` belong to the task group that delivers the journey.
- Gaps in requirements found while coding → `## Apply round` in `clarifications.md` (see `questions.md`).
  Do not guess.

## 6. End of apply

1. Run the full suite and the quality gate (`verify.yaml → unit.full`, `unit.gate`).
2. Run E2E for the change's `e2e` scenarios (`verify.yaml → e2e.run`).
3. Write `verification.md` in the change directory:

   ```markdown
   ## Verification matrix

   | Capability | Scenario | Level | Expected | Actual | Evidence | Verdict |
   |---|---|---|---|---|---|---|
   | inventory/sale-export | Successful export | unit | CSV with 3 rows | CSV with 3 rows | tests/test_export.py::test_successful_export passed | Met |

   ## Commands run

   - `make test` — 1523 passed
   - `make check` — ok
   - `npx playwright test --grep @sale-export` — 2 passed
   ```

   - **Every** row of `verification-plan.md` appears in the matrix.
   - Verdict is one of `Met`, `Not Met`, `Unverified`. `Unverified` counts as a failure.
   - `manual` rows are `Unverified` until a human records the result.
4. Apply is finished only when every command passed and every row is `Met`.

## 7. When something fails

- **Never weaken quality to get green.** Do not delete tests, skip them, mark them xfail, loosen
  assertions, lower thresholds or edit a test so it matches wrong behaviour. Change a test only when
  the test itself is wrong, and say why.
- **At most two fix attempts** per failure. Then stop and ask the human. Give the options and their
  consequences (cost, risk, what stays unverified). Giving up on a target is the human's decision,
  never yours.
