<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Testing and verification protocol

Applies to changes on the `clarify`, `clarify-ai-qa`, `clarify-qa` and `lean` schemas. The parts about
test cases (§2 *Test case coverage*, §3 case references, §6 the lists of cases) apply only to
`clarify-ai-qa` and `clarify-qa`, whose test cases are written per `openspec/protocols/test-cases.md`.

Every spec scenario is a promise. A test exists to prove one promise — never just to raise the test
count. A test that would still pass with the feature broken is worse than no test: it gives false confidence.

The kit does not know the project's stack and never runs the project's tests itself, except the E2E tests of
the E2E stage, which it runs through its own script (`openspec/protocols/e2e.md`). Use the project's own commands:
first those of `openspec/test-commands.md` (§8), then the project's instructions (README, CLAUDE.md, Makefile,
package scripts, CI config). Say which commands you used. If you cannot find how to run the tests, ask the
developer once and suggest writing the commands into CLAUDE.md.

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

On a change stamped 0.5.0 or later each task group is done by a subagent that follows this section
(`openspec/protocols/subagents.md`).

- **TDD per task group:** write the tests for the group's scenarios first and watch them fail for the
  right reason, then implement and watch them pass, then refactor.
- **Own test files only.** On a change stamped 0.7.0 or later a task group runs only its own test files: the test
  files it creates or changes and the existing test files of the code it changes, each with the one-file command
  of `openspec/test-commands.md` (§8), or with the project's instructions when the file has none. It never runs a
  whole folder of tests or the full suite. Example: a group that changes `api/orders.py` and writes
  `api/tests/test_orders.py`, in a folder `api/tests/` of 40 test files, runs `api/tests/test_orders.py` and the
  existing test file of `api/orders.py`, each with the one-file command, and neither the folder `api/tests/` nor
  the full suite. After a fix for a failing own test, rerun that test file, or only the failed tests with the
  failed-only command, and no wider run.
- **Fix subagents too.** On the same changes every other implementation subagent of apply (a replacement, a
  collision fix, a review fix, a full-suite fix) runs only the test files of its work, with the one-file or the
  failed-only command, and no folder or full-suite run: a subagent that strengthens the assertions of
  `api/tests/test_orders.py` after the test review runs `api/tests/test_orders.py` with the one-file command and no
  wider run. The subagents of the E2E stage keep running the E2E tests through `e2e-run.mjs`
  (`openspec/protocols/e2e.md`).
- **Wider runs at the end.** The tests outside the groups' own files (the rest of a folder, the whole suite) run
  only in the main agent's full-suite run at the end of apply (§6). No test is left out: the full suite at the end
  covers every test of the project. The kit's hook `test-run-guard` blocks the file's `Full suite` command inside
  a `task-implementer` subagent.
- **Earlier changes.** A change stamped below 0.7.0 or without the stamp keeps the earlier rule: run tests scoped
  to what you are changing; the full suite runs at the end.
- **Long runs in the background**, on every change. A test run is long when its command's duration in
  `openspec/test-commands.md` is 2 minutes or more, or when it is wider than single test files (the failed-only
  command, the full suite) and no duration is written. Start a long run with the Bash tool's background mode, end
  your step and read the result when the notice that it ended arrives. Never start it as a foreground command, and
  never wait for it with repeated sleep-and-check commands. Examples: a full suite written as `— 12 min` starts in
  the background, and its result is read when the run has ended; a failed-only command without a duration starts
  in the background; a one-file command written as `— 3 min` starts in the background; a one-file command written
  as `— 1 min` is not long and runs in the foreground. The hook `test-run-guard` blocks a long `Full suite`
  command of the file started in the foreground.
- Gaps in requirements found while coding → `## Apply round` in `clarifications.md` (see `questions.md`).
  Do not guess.

## 6. End of apply

On a change stamped 0.5.0 or later the main agent runs the full suite itself and the fixes run in subagents
(`openspec/protocols/subagents.md` §8).

1. Run the `test-reviewer` subagent (`openspec/protocols/review-tests.md`) and fix its blocker and
   major findings.
2. Run the project's **full test suite and quality checks**. Fix what fails (§7). Report the commands
   and their result to the developer. Start the full suite in the background when it is long (§5). On a change
   stamped 0.7.0 or later this is the only wider run: when it fails, the fix subagent reruns only the failing
   tests (that test file or the failed-only command), never the full suite, and you run the failed commands again
   yourself. Example: group 2 breaks a test in `api/tests/test_invoices.py`, a file that is not its own: your
   full-suite run reports the failing test, and one fix subagent gets it with the failing output. Apply ends
   without a stop only when the full suite has run at least once and its last run covered every test of the
   project and passed.
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
   archives it with `/openspec-archive-change`. The archive gate checks that every task is done, every
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

## 8. The test commands file

`openspec/test-commands.md` holds the project's test commands. It is a project file, like
`openspec/project-tools`: the kit's install and update never create, change or delete it, and the kit's health
check says nothing about it.

```markdown
# Test commands

- One file: `make test FILE=<file>` — 1 min
- Failed only: `make test-failed`
- Full suite: `make test` — 12 min
```

- A command is a list item ``- <label>: `<command>` `` with the label `One file`, `Failed only` or `Full suite`,
  optionally followed by ` — <n> min`, a whole number of minutes. The one-file command holds the placeholder
  `<file>`: with the file above, the test file `tests/orders.test` runs with `make test FILE=tests/orders.test`.
- Every other line is free text and is ignored: a heading, notes, and an item without backticks
  (`- Full suite: make test` is no full-suite command). A duration in another form (`— 90 s`) counts as no
  duration. When a label appears twice in one section, the first item counts.
- A command without a duration is a run of unknown duration: above, the full suite is a run of 12 minutes and the
  failed-only run a run of unknown duration.
- The file holds test commands only: no quality-check command (lint, types, build), no start or stop command and
  no address of the application; those stay in the project's instructions. A draft for a project whose README
  names `make test` and `make lint` holds `make test` and no line for `make lint`.
- The single line `none` means the developer declined the file: it holds no command.
- In a meta-repository the file is the root's, with one section `## Repository: <name>` per repository (a declared
  clone name or `root`), each with its own command items; items outside a section are ignored
  (`openspec/protocols/metarepo.md`). A draft has a section for every declared clone, and a `## Repository: root`
  section only when the root's instructions name test commands of the root itself. Never write a commands file
  inside a clone.

**Draft and confirmation.** When the file is missing, draft it from the project's instructions (README, CLAUDE.md,
Makefile, package scripts, CI configuration), show the draft to the developer and write it only after the developer
confirms: until the developer answers, the file does not exist. Write exactly the confirmed commands, with the
developer's corrections: when the developer answers that the full suite needs the flag `--reuse-db`, the
`Full suite:` command carries `--reuse-db`. When the developer declines, write the single line `none` and do not
propose the file in a later change. On a `clarify` change stamped 0.7.0 or later the draft is shown right after the
Main round (`openspec/protocols/planning.md` §14). A change stamped below 0.7.0 or without the stamp gets no
proposal of the file: find the commands in the project's instructions.

**Where a duration comes from.** A duration comes from the project's instructions or from the developer's words at
the confirmation: when the developer says that the full suite takes about 12 minutes, the `Full suite:` line ends
with `— 12 min`. When neither names a duration, the line has none. Run none of the project's test commands while
you draft the file, not even to measure a duration. A duration is written once: never update it from a real run.
A full suite written as `— 12 min` that takes 20 minutes stays `— 12 min`.

**A missing file or command never blocks.** When the file is missing, holds `none`, or lacks the command you need,
find the command in the project's instructions, as before, and go on: never stop for the file. In a meta-repository
a repository without a section is a missing command: a `[frontend]` group in a root file with a section for
`backend` only takes its commands from the meta-repository's instructions and goes on, and the ready message
proposes a `## Repository: frontend` section with the commands it used. On a change stamped 0.7.0 or later, unless
the file holds `none`, the ready message proposes the commands you used that the file lacks: a missing file, section
or line (`openspec/protocols/apply.md` §9); write them only after the developer confirms. Example: a file with a
`Full suite:` line and no `One file:` line, and a README that runs one file with `make test FILE=<path>`: run the
file with the README's command, and the ready message proposes adding ``One file: `make test FILE=<file>` `` to the
file. A file with the single line `none` gets no proposal.

**A command that does not work.** A command of the file does not work when the shell or the tool it calls rejects
the command itself before the project's tests are loaded: the command is not found, an option is unknown, a task or
target is missing. Then stop (`openspec/protocols/apply.md` §2): show the developer the command and its output, and
wait. Do not replace the command and do not edit the file on your own. Example: the one-file command ends with the
error "unknown option --reuse-db" before any test runs: stop and show the developer the command and that error;
`openspec/test-commands.md` stays unchanged. When the developer answers with the corrected command, write it into
the file and go on with the stopped work. A `task-implementer` subagent that meets such a command ends with a stop
report; the main agent asks the developer (`openspec/protocols/subagents.md` §7).

- When the command runs the tests and some of them fail, those are failing tests, handled with the fix attempts of
  §7, not this stop.
- An error in the project's code or tests (an import, syntax or collection error), for example an import error in
  the file the group has just changed, is a failing test too: fix the code, not the command.
- A command found in the project's instructions, not in the file, that does not work is handled as before: look
  for the right command in the instructions, and ask the developer once when you find none.
