# Proposal

## Why

The end of apply is the slowest part of a feature: on a measured change the full suite, the test review fixes and
the E2E stage took about three hours, half of it E2E (18 tests, a second application start, a new subagent for
every fix), and E2E runs make developers' machines lag. Most of that time is spent on how the tests
are run, not on what they check: cold subagent starts for a command run, and
full E2E reruns while one test is being fixed.

## What Changes

- **E2E runs do not lag the machine.** `e2e-run.mjs` runs Playwright with two workers unless the developer sets
  another number (`E2E_WORKERS`, or `--workers` after `--`). The Playwright config reuses an application that is
  already running instead of starting a second one. E2E never runs at the same time as another test suite.
- **Only the failing tests run while they are fixed.** After the first full E2E run, fixes rerun only the failing
  tests; one full run at the end proves the stage.
- **One fix subagent per E2E run, not per fix.** The failing tests of a run go to one subagent, which reruns its
  tests through `e2e-run.mjs` itself, with the same limit of three attempts per test.
- **One fix subagent per test review.** Every blocker and major finding of a review goes to one subagent.
- **The main agent runs the full suite itself.** A subagent is started only when something fails, with the failing
  output. **BREAKING** for the rule "the full suite runs in a subagent".
- Kit version 0.6.1. The rules apply to every change that is implemented through subagents (stamped 0.5.0 or
  later); no new version gate, since they only remove work.

Not in this change: which scenarios get an E2E test (unchanged: every scenario that goes through the interface),
the QA stage and the test-case schemas, the screenshot comparison, one subagent per track of
task groups, and small fixes by the main agent.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `e2e/tests`: the worker limit and the reuse of a
  running application; which tests run while failing tests are fixed.
- `workflow/subagent-apply`: the main agent runs the full suite; one fix subagent per test review and per E2E run.

## Impact

- `kit/openspec/protocols/e2e.md`, `subagents.md`, `testing.md`, `apply.md`; `kit/claude/agents/task-implementer.md`.
- `kit/openspec/tooling/bin/e2e-run.mjs` (worker limit).
- Schema instructions that repeat the changed rules, `docs/how-it-works.md`, `docs/decisions.md`, `CHANGELOG.md`,
  kit version files.
- Projects: an existing `playwright.config` keeps working; the worker limit comes from the script.

## Clarifications

- The mockups question was not asked: the kit has no user interface, so the change cannot have mockups.
- Scope and the E2E selection rule come from the owner's earlier decisions (2026-11-25): E2E "only for real
  business moments", "1–3 tests is too few", "the machine must not lag", and on 2026-11-26: "just speed up the
  tests now, what you proposed; my colleague is about to start a new feature".
- 2026-11-26, after the first implementation, the owner rejected the narrower E2E selection: "I do not want the
  tests to be cut; make the tests run so that time is saved, not so that they are cut". The selection rule was
  taken out of the change; the set of E2E tests stays as before.
