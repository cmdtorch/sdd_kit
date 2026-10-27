<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Autonomous apply protocol

Applies to the implementation of changes on the `clarify`, `clarify-ai-qa`, `clarify-qa` and `lean` schemas that
carry the kit version stamp: the line `x-sdd-kit: <version>` in the change's `.openspec.yaml`, which the kit
writes with the first artifact of a new change. A change without the stamp started under older kit rules:
finish it as its tasks say (its manual checks stay tasks, and it needs no `apply-report.md`).

When the planning artifacts are complete, the developer has made every decision that belongs to them. Apply
then runs to the end — every task, the test review, the full suite and the E2E stage, without a question to the
developer — except at the stops of §2. How the tests are written and run: `openspec/protocols/testing.md`;
the E2E stage: `openspec/protocols/e2e.md`.

## 1. Order of work

1. **Start check** (§4), before the first task, when the verification plan needs a running application.
2. **Tasks**, group by group, test first (`openspec/protocols/testing.md` §5).
3. **Test review and full suite** (`openspec/protocols/testing.md` §6).
4. **E2E stage**, when the change needs it (`openspec/protocols/e2e.md`).
5. **`apply-report.md`** (§7), then the **consent list** (§8).
6. **Ready message** (§9).

## 2. Stops

Stop and wait for the developer only in these cases:

- **Requirement gap**: behaviour that no source, answer or spec decides. Append the question to the
  `## Apply round` of `clarifications.md` (`openspec/protocols/questions.md`; on `lean` ask in the chat and record
  the answer in the proposal's `## Clarifications`) and wait for the answer. Do not guess.
- **Failing test**: a test still fails after your second fix attempt (an E2E test of the E2E stage gets three,
  `openspec/protocols/e2e.md` §8). Show the developer the failing test and both attempts, with the options and
  what each leaves unverified. Weakening the test is one option only with consent (§6).
- **Start check**: the start check failed, or the project's instructions do not say how to start the
  application (§4).
- **Environment**: during a task the application or the stack no longer starts with the project's own
  instructions — for example a container is unreachable, Docker does not see the project folders or a port is
  closed. Stop, describe what blocks you and wait for the developer's decision.
- **Consent**: before an action outside the project (§5) or before weakening a test (§6).
- **Outside the plan**: a situation that the plan and the kit's rules do not cover and that needs a decision —
  for example a library version that the design relies on has been withdrawn from the package registry. Do not
  pick a replacement: report it and wait instead of choosing a way around it.
- **Consent list** at the end (§8).

Nothing else is a reason to ask: not "shall I go on", not a detail the design or the specs already settle, not
which test level to use (the verification plan says it).

**Independent work first.** When a stop concerns a single test or the environment, first finish the tasks that
do not depend on it, then stop. Example: a test of task group 3 still fails after two attempts and group 4 does
not depend on it: finish group 4, then show the failing test. A failed start check stops before the first task.
A requirement gap stops at once: ask before you start any other task.

**Options are suggested, not carried out.** In a stop you may suggest options — for example port 5432 is taken
by another program: you may suggest stopping that program or changing the project's port. Carry out none of them
until the developer has chosen.

## 3. A single check that cannot run

When the application starts with the project's instructions but one check still cannot be run — for example a
case requires an SMS to arrive on a real phone — do not stop: record it under "Not verified automatically" in
`apply-report.md` with the cause and go on with the next task. The developer agrees to it in the consent list
(§8).

When the application itself no longer starts with the project's instructions, that is the environment stop
(§2), not a recorded check.

## 4. Start check

**When.** The verification plan's Environment section says `Running application: yes` — integration checks
through the running stack, or the E2E stage. Otherwise do not start the application before the first task.

**How.**

1. Find in the project's instructions (README, CLAUDE.md, Makefile, package scripts, compose files) the command
   that starts the application, the one that stops it, and an address it serves: the main page or a health
   check. When the instructions do not say how to start it or which address it serves, ask the developer once
   and suggest writing the commands and the address into CLAUDE.md.
2. At the first start check of a change, settle the project tool list (§10).
3. Run `node openspec/tooling/bin/start-check.mjs --change <name> --start "<command>" --url <address>
   [--stop "<command>"]`. It starts the application, requests the address every 2 seconds for up to 2 minutes
   (a status below 500 passes), stops the application again and writes `start-check.json` in the change. The
   archive gate asks for that record when the plan needs a running application.
4. Passed: go on with the first task.

**Failed start.** Stop before the first task. Report what failed, from the script's output — for example the
stack starts but its published ports are refused — and offer the ways the developer chooses from:

- **E2E stage** — three ways: switch it off; fix the cause; skip it deliberately.
  - *Switch it off*: the change goes on as if E2E had not been chosen: `e2e.md` says `Mode: skipped`, and every
    case labelled `e2e` (on `clarify` and `lean`: every scenario listed for E2E) goes under "Not verified
    automatically" with the reason "E2E switched off" and a `Consent:` line with the developer's choice.
  - *Skip it deliberately*: `e2e.md` says `Mode: skipped`, and every case labelled `e2e` goes under "Not verified
    automatically" with the reason "tests were not run", the cause and a `Consent:` line with the developer's
    choice.
- **Integration checks through the stack** — two ways: fix the cause; skip them deliberately. Skipped checks go
  under "Not verified automatically" with the reason "tests were not run", the cause and a `Consent:` line with
  the developer's choice.

Never pick a way yourself, and do nothing else until the developer chooses. When the fix lies inside the
project (its compose file, its configuration, a port in its own settings), make it and run the start check
again. When the fix lies outside the project (Docker settings, another program, a system package), change
nothing outside the project unless the developer allows that specific change; after the fix run the start
check again.

## 5. The project boundary

Without the developer's explicit consent change nothing outside the project folder and your own temporary
folder:

- no system or Docker settings;
- no programs installed into the system (system package managers, global installs). When a tool the tests need
  is missing, do not install it into the system; you may install it into your temporary folder or into a
  container;
- do not stop, kill or reconfigure another program. When another application holds a port the project's stack
  needs, do not touch it: stop and report the conflict;
- no Docker containers, volumes or networks you did not create yourself. When a foreign container blocks the
  project's stack, do not stop or remove it: report it.

Workarounds inside the application and its tests are fine: create test data in advance (a user created before
the test), or replace an external service with a stub — for example a registration test fails because no mail
server is available: replace mail sending in the test with a stub and go on. Never work around the system, the
environment or the kit's workflow (its gates, its checks, its files).

The kit's command guard (`boundary-guard`) asks the developer before commands such as `sudo`, system and global
installs, `kill` / `pkill` / `killall`, and Docker commands that stop or remove containers, volumes or
networks. Those prompts are the developer's to answer: do not try another command that does the same. The rule
holds also where the guard does not ask.

## 6. Weakening a test needs consent

Weakening covers relaxing an assertion, skipping or deleting a test, lowering a threshold, switching off a
quality rule (a lint rule, a type check). Without the developer's explicit consent a failing test keeps its
assertions and stays enabled. Ask at the stop after two failed fix attempts (`openspec/protocols/testing.md`
§7). Record each agreed weakening under "Weakened tests" in `apply-report.md`: the test (or the rule and the
file), what was weakened, the reason and the developer's consent.

## 7. `apply-report.md`

One implementation report in the change root. Write it when the last task is done, update it after the E2E stage
and after the consent list. It stays in the archived change; QA works from it after the archive.

```markdown
# Apply Report

## Manual checks

### payments/payout :: Hourly payout to cards — required before release
Reason: dangerous: money, many users
Steps: run the payout job on staging with three test cards above 1000
Expected: each card gets exactly one payout

### docs/readme :: README is clear
Reason: cannot be automated: a new developer judges whether the README is clear
Steps: a developer who has not seen the project follows the README from a clean checkout
Expected: the project runs without asking anyone

## Not verified automatically

### dev-environment :: Frontend change is picked up
Reason: tests were not run — Docker does not see the project folders
Consent: "skip live reload, QA will check it" (developer, 2026-10-28)

## Weakened tests

None.
```

- **Manual checks**: every `manual` row of the verification plan and every test case labelled `manual`, with
  its steps, the expected outcome and its reason. Checks of dangerous functions come first, each marked
  "required before release". A manual check is never a task and never blocks the archive.
- **Not verified automatically**: every check that should have been automated but was not verified: single
  checks that could not run (§3), checks skipped after a failed start (§4), E2E cases accepted at the stop
  after the fix attempts, and, when E2E is skipped, every case labelled `e2e`. Each entry has its reason; the
  entries agreed by the developer carry `Consent:`.
- **Weakened tests**: §6.
- An empty section says `None.`. Entries are `### <capability-path> :: <scenario or case name>` (for weakened
  tests `### <test file> :: <test name>` or `### <file> :: lint rule <rule>`) with the lines `Reason:`,
  `Steps:`, `Expected:`, `Change:` and `Consent:` as above.
- Check it with `node openspec/tooling/checks/check-apply-report.mjs --change <name>` (the kit also runs it after
  every write of the file).

## 8. The consent list

When "Not verified automatically" has entries without a `Consent:` line, ask the developer once, after
everything else is done, with one question that lists all of them; they agree to all at once or one by one.
Record each consent next to its entry as `Consent: "<the developer's words>" (developer, <date>)`, quoting the
developer; never write a consent the developer did not give. Entries that already carry a `Consent:` line —
from the developer's choice at a failed start check or an E2E case accepted at the stop — are not in the
question.

When the developer does not agree to an entry, report that the change is not ready to archive, name that entry
and wait for the developer's instructions; the entry gets no `Consent:` line. The archive gate blocks while an
entry has none.

## 9. Ready message

When every task is done, the consent list is answered and the archive checks pass, tell the developer that the
change is ready to archive, name `apply-report.md` (the manual checks for QA and what was not verified
automatically) and give the command `/opsx:archive`. Do not archive the change yourself: the developer archives
it.

## 10. The project tool list

`openspec/project-tools` lists the commands the project's checks need, one line per tool:
`<command> — <checks it is needed for>`, or the single line `none`. It is a project file: the kit never
overwrites it, and the kit's health check (`node openspec/tooling/bin/doctor.mjs`, also shown at the end of an
install) warns about each listed command that is not on the path.

At the first start check of a change, when the file is missing, propose a list from the project's instructions —
for example the README starts the stack with `docker compose` and runs the tests with `make test`: propose
`docker — stack, E2E` and `make — tests`. Write `openspec/project-tools` only after the developer confirms. When
the developer declines, write the single line `none` and do not propose a list again.
