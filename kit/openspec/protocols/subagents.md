<!-- sdd-kit: managed file. Do not edit; local changes are overwritten on kit update. -->
# Subagent execution protocol

Applies to apply and verify of changes on the `clarify`, `clarify-ai-qa`, `clarify-qa` and `lean` schemas
stamped with kit version 0.5.0 or later (`x-sdd-kit` in the change's `.openspec.yaml`; a pre-release such as
`0.5.0-beta.1` counts as its base version). A change without the stamp, or stamped below 0.5.0, is implemented
and verified as before: by the main agent alone, without implementation, full-suite or verify subagents.

You are the main agent: you orchestrate and edit no project code or tests yourself. Hand every task group of
`tasks.md` before the final group to a new subagent, one subagent per group, whatever the size of the change: a
change with a single group also runs it in a subagent, not in the main agent. No setting switches this off.
Stops, the project boundary and the report stay as `openspec/protocols/apply.md` says; how tests are written
and run: `openspec/protocols/testing.md`.

## 1. Plan lines

Right under each task group heading, before its tasks, `tasks.md` has three plan lines:

```text
## 2. Order API

Depends on: 1
Area: api/src/orders/, api/tests/orders/
Shared: database
```

- `Depends on:` the numbers of the groups this group needs, or `none`.
- `Area:` the files and folders the group changes, or `unknown` when they cannot be named in advance (a rename
  across the whole project). A file lies in an area when the area names it or a folder that contains it.
- `Shared:` the shared resources the group changes or its tests use, or `none`. Changed files: `dependencies`
  (dependency manifests and lock files), `migrations` (database migrations and schema), `settings` (shared
  project settings: build, linter, test configuration, environment variables), `assembly` (shared assembly
  points: route files, module registration). Test resources: `database`, `ports`, `docker`.

A group with a plan line missing or unreadable (for example `Depends on: the API group`) depends on every
earlier group and has an unknown area. No check reports such lines; treat them so and go on.

## 2. Scheduling

- **Dependencies.** Start a group only after every group in its `Depends on:` line is accepted (§6). Example:
  group 2 has `Depends on: 1` and group 3 has `Depends on: 2`: run groups 1, 2 and 3 one after another, each
  after the previous one is accepted.
- **Parallel groups.** Run subagents at the same time only for groups that do not depend on each other, whose
  areas are known and do not overlap, and that do not both name the same one of `dependencies`, `migrations`,
  `settings` or `assembly`. Example: group 2 with `Area: api/` and group 3 with `Area: web/`, both with
  `Depends on: none` and `Shared: none`, may run at the same time. Two groups whose areas both contain
  `src/config.ts` run one after the other. Likewise, two groups with disjoint areas that both name `migrations`
  run one after the other.
- **Unknown area.** A group with `Area: unknown` runs alone: no other group's subagent runs at the same time.
- **How many.** Among the groups that may run together you choose which run together and when; there is no
  fixed limit. Shared test resources limit it further (§3).
- **Meta-repository.** In a meta-repository change (`openspec/protocols/metarepo.md`), groups tagged with
  different repositories never run at the same time: `## 2. [backend] Order API` and
  `## 3. [frontend] Order screen` run one after another. Only groups of the same repository may run in parallel.

## 3. Test runs on shared test resources

Groups whose `Shared:` lines name the same one of `database`, `ports` or `docker` may otherwise run in parallel,
but their test runs must not overlap in time. A subagent runs its tests whenever its tasks need it, so:

- When the groups share only `database` and the project's own test setup creates and deletes a separate database
  for each test run: their tests may run at the same time, each against its own database. Read the project's
  test setup to tell.
- Otherwise — for example their tests all use one fixed test database, or start a server on the same fixed
  port — run such groups one after another.

Do not change the project's test setup to create a database per run unless a task of the change asks for it.

## 4. One working folder

Every subagent works in the project's working folder, with no separate copy of the repository. Do not commit,
create branches or worktrees, stash or merge, and tell every subagent the same. When apply ends, the work is
uncommitted changes in the working folder; the developer commits, as before.

## 5. Changed-files check

After each subagent ends, check which files it changed before you accept its group.

- Before you start the first subagent, take a snapshot with `git status --porcelain`; take a new one each time a
  subagent ends. In a meta-repository, take them in every clone the groups name and in the root.
- Each subagent ends its report with a `Changed files:` list of every file it created, changed or deleted,
  including files changed by commands (formatters, generators). A file in that list belongs to that subagent.
- A file in the git delta that no subagent listed has no owner: run the tests of the groups whose areas it lies
  in; when it lies in no declared area, it is a file outside every area (accepted, see below). When a subagent
  whose area holds the file is still running, wait for its list first.

Then judge each file of the subagent's group:

- In the group's own area: accepted.
- In no group's area, for example `README.md`: accepted.
- In the area of an accepted group: run the tests of both groups. When they pass, accept the group without a fix
  subagent. When they fail, hand the fix to a new subagent, at most two fix attempts. When the tests still fail
  after the second attempt, stop: do not accept the group, and show the developer the failing tests and both fix
  attempts.
- In the area of a group whose subagent is still running: wait until that subagent ends, then run the tests of
  both groups before you accept either; a failure is handled as above.
- In the area of a group not started yet: accept the group, and tell that group's subagent, when you start it,
  which of its files were changed and by which group.

A group with an open collision is not accepted.

## 6. Accepting a group

A group is accepted when its subagent reports its tasks done with passing tests and the changed-files check
(§5) leaves no open collision.

**Check-off.** Only you check off tasks in `tasks.md`, and only after you have accepted their group: check every
task of the group; tasks of groups not yet accepted stay unchecked. A subagent never edits `tasks.md`.

**Unfinished subagent.** When a subagent ends without finishing its group for a reason that is not a stop of
`openspec/protocols/apply.md` §2 — a tool error, its context ran out, an incomplete result — start one new
subagent for the group's remaining tasks, with a note of the tasks already done. When that subagent also ends
without finishing, stop and tell the developer which tasks of the group remain and why both subagents ended.

## 7. Stops

A subagent cannot ask the developer. When it reaches a stop of `openspec/protocols/apply.md` §2, it ends and
reports the stop to you; you ask the developer.

- **Requirement gap, consent, outside the plan.** Start no new subagent, let the running subagents finish their
  current group, then ask. Example: groups 2 and 3 run in parallel and group 2's subagent reports a requirement
  gap: start no new subagent, wait for group 3 to finish, append the question to the `## Apply round` of
  `clarifications.md` and ask the developer (on `lean` ask in the chat). When instead group 2's subagent
  reports that it needs to install a tool into the system: start no new subagent, wait for group 3 to finish
  and ask the developer for consent.
- **Failing test, environment.** First complete, through subagents, the groups that do not depend on the
  stopped group, then show the developer the stop. Example: a test of group 2 still fails after two fix
  attempts and group 4 does not depend on group 2: complete group 4 through a subagent, then show the failing
  test.
- **Failed start check.** The start check runs before any subagent starts. When it fails, no implementation
  subagent starts: report what failed and offer the ways of `openspec/protocols/apply.md` §4.

After the developer's answer, hand the rest of the stopped group to a new subagent, with the answer.

## 8. The final group

You run the final group yourself:

1. Start the `test-reviewer` subagent (`openspec/protocols/review-tests.md`). Hand every blocker and major
   finding of one review to one new subagent together; edit no test or code file yourself.
2. Run the project's full test suite and quality checks yourself (`openspec/protocols/testing.md` §6) and report
   the commands and their result to the developer. When they pass, start no subagent. When a command fails, hand
   the fix to one new subagent together with the failing output, then run the failed commands again yourself;
   after the second failed fix attempt stop and show the developer the failures.
3. The E2E stage (`openspec/protocols/e2e.md`), when the change needs it: you write `e2e.md` and make the full
   runs with `e2e-run.mjs`; writing the E2E tests goes to a new subagent. Hand the failing tests of one run to
   one new subagent together: it fixes the application code or the test, reruns only its tests through
   `e2e-run.mjs`, makes at most three fix attempts per test (`openspec/protocols/e2e.md` §8) and reports what
   still fails. Afterwards make the full run yourself.
4. Write `apply-report.md` (`openspec/protocols/apply.md` §7), then the consent list and the ready message.

You write only the change's own files: `tasks.md` check marks, `apply-report.md`, `e2e.md`, `clarifications.md`.
Every other edit, including a small fix after the test review, after a check or in the E2E stage, goes to a new
subagent.

## 9. Subagents, models and the progress line

**The subagent.** Every implementation subagent of apply (a task group, a replacement, a collision fix, a review
fix, a full-suite fix, writing the E2E tests, an E2E fix) is a `task-implementer` subagent. Give it the change
name, its tasks or its fix, and what it must know (files changed by another group, the developer's answer). It
starts no other subagent, asks the developer nothing, edits no planning artifact and no `tasks.md`, and ends
with a stop report or its tasks done, its test result and its `Changed files:` list.

**Model.** Before the first group, run `node openspec/tooling/bin/subagent-model.mjs` and pass that model to the
subagents of task groups, their replacements and collision fixes. `inherit` means: pass no model, the subagent
runs on the main chat's model. When it also prints a `warning:` line, repeat it in the chat (for example that
`sonet` is unknown); those subagents then run on the main chat's model. Every other subagent, among them
full-suite fixes, review fixes, E2E fixes and verify, runs on the main chat's model, whatever the setting.

**Progress line.** After each subagent ends, and after your own full-suite run, write one line in the chat: the
group number and name (for a subagent without a group `fix: <what>`, for your full-suite run `full suite`), the
tasks done, the model it ran on, and whether its tests pass or which fail. Examples:
`2. Order API — 2.1–2.4 — sonnet — tests pass`;
`3. Order screen — 3.1–3.3 — sonnet — 2 tests fail: shows total, hides empty cart`;
`full suite — — opus — every test passes` (your own run, so the model is the main chat's model). The same line
goes into `## Subagent runs` of `apply-report.md` (`openspec/protocols/apply.md` §7).

## 10. Verify

On a change stamped 0.5.0 or later, verify (the check of the implementation against the change's artifacts) runs
in the `change-verifier` subagent, on the main chat's model. It reads the change and the code, reports its
findings to you and changes no file. Show the findings to the developer. Every fix that follows, for example of
a scenario without implementation, goes to a new `task-implementer` subagent, not to you. A change stamped below
0.5.0 or without a stamp is verified by you, as before.

## 11. Outside apply

At other stages (questions, specs, design, tasks) you may hand reading and studying the project's code to a
subagent, Claude Code's `Explore` subagent, and use its summary. Before you start it, say in the chat why: for
example, the request touches code in several folders and reading them all would fill the chat. Only reading and
studying code may be handed over: never decisions, answers to clarifying questions, or writing or editing a
planning artifact (`clarifications.md`, `proposal.md`, specs, `design.md`, `verification-plan.md`, `tasks.md`,
test cases). Ask it for a summary of what it found that describes every option it sees (for example both
possible places for a new module), and decide yourself or ask the developer. The reviewer subagents keep writing
only their review files.
