# Proposal

## Why

A third of all subagent time in the measured project went into test runs and into waiting for them: about 312
of 1290 minutes were runs and about 109 minutes were wait loops, and 9 backend runs ended at the 10-minute tool
limit without a result (90 minutes lost) [D1]. Half of the slow backend runs were a whole folder or the whole
suite started from inside a task group, and a broken environment is found only at the start of apply, after
planning is finished [D1].

The owner's rule: the set of tests is never cut; time is saved only by how the tests are run [D1].

## What Changes

- A project file holds the project's test commands: how to run one test file, only the failed tests and the full
  suite, with the flags the project needs and the expected duration of each [D1]. It holds test commands only:
  no quality-check commands (lint, types, build) and no start or stop commands or address of the application,
  which are still found in the project's instructions [Q10].
- The agent drafts the file from the project's instructions and writes it only after the developer confirms [Q2].
- The agent proposes the file, when it is missing, at the first change, right after the Main round, together with
  the early start check [Q3].
- A missing file or a missing command never blocks the work: the agent finds the command in the project's
  instructions, as today, and proposes adding it to the file [Q4].
- When a command of the file itself does not work (a start error, not failing tests), the agent stops and asks
  the developer [Q5].
- In a meta-repository there is one file in the root with a section per repository [Q6].
- The expected duration is written when the file is created; the kit does not update it from real runs [Q10].
- The kit's health check (`doctor`) does not check the file [Q10].
- Inside a task group only the group's own test files are run. Every other test (the rest of the folder, the
  whole suite) runs once, at the end, by the main agent; failing tests go to a fix subagent [Q7][D1].
- A long test run never goes into a foreground command with the tool time limit: it runs in the background and
  the agent waits for its result [D1].
- The start check moves earlier: it runs right after the Main round, on every change, whenever the project's
  instructions say how to start the application, even when the change will not need it [D1][Q8].
- A passed early start check counts: the check is not repeated before the first task [Q9].
- Changes without a question round (`lean`) keep the start check at the start of apply [Q10].
- The file is `openspec/test-commands.md`, next to the project tool list [Q11].
- A duration comes from the project's instructions or from the developer at the confirmation; an unknown one
  stays blank, and a run wider than single test files is then treated as long. The agent does not run the tests
  to measure it [Q12].
- The two run rules are held by the kit, not only written: it blocks the file's full-suite command inside a
  task-group subagent and blocks it when it is started outside the background [Q13].
- The kit stays stack- and layout-agnostic: commands such as `pytest --lf` appear only as values the project
  writes into its own file, never in kit code [D1].

Not part of this change: a smaller set of tests or a "test depth" setting, the marker check before the E2E
stage, parallel task groups across the clones of a meta-repository, a kit notification for waiting, and the QA
stage with the test-case schemas [D1].

## Capabilities

### New Capabilities

- `workflow/test-commands`: the project file with the test commands: what it holds, who writes it and when, what
  happens when it or a command is missing or a command does not work, and its form in a meta-repository
  [D1][Q2][Q3][Q4][Q5][Q6][Q10][Q11][Q12].
- `workflow/test-runs`: how tests are run during apply: only the group's own test files inside a task group, the
  wider runs once at the end by the main agent, long runs in the background, and the kit's blocking of a
  full-suite run inside a subagent or in the foreground [D1][Q7][Q13].

### Modified Capabilities

- `workflow/environment-check`: the start check runs right after the Main round on every change whose project
  says how to start the application, its result counts for apply, and `lean` keeps the check at the start of
  apply [D1][Q8][Q9][Q10].
- `workflow/autonomous-apply`: a command of the test-commands file that does not work is a stop; the start check
  is no longer always the first step of apply [Q5][Q9].
- `metarepo/apply`: a repository's test commands are read from its section of the root file first, then from the
  meta-repository's instructions [Q4][Q6].

## Impact

- Kit protocols (`testing.md`, `apply.md`, `subagents.md`, `planning.md`, `metarepo.md`), the `task-implementer`
  subagent definition, the schema instructions of `clarify` and `lean`, the start-check script and the gates that
  read its record, the kit's guide and `docs/how-it-works.md` [D1][Q8][Q9].
- Projects that already use the kit: the new rules reach them with the kit update; the file is a project file
  that the kit never overwrites [Q2].

## Assumptions & Open Questions

- [assumption] The new rules apply to changes stamped with the kit version of this release (0.7.0) or later;
  changes started earlier keep the rules they started with.
- [assumption] When the project's instructions do not say how to start the application, the early start check is
  skipped without a question; if the verification plan later needs a running application, the check runs at the
  start of apply as today (ask once, suggest writing the commands into the instructions).
- [assumption] The start check also still runs at the start of apply when the change has no record of a passed
  early check: a `lean` change, a change started under earlier rules, or a skipped or failed early check.
- [assumption] A failed early start check stops planning, and the developer chooses between two ways: fix the
  cause and run the check again, or go on with planning without a passed check. The ways about E2E and the
  integration checks stay at the start of apply, where the plan says what needs the application.
- [assumption] The proposal of the test-commands file is made once per project: when the developer declines it,
  the file holds the single line `none` and the agent does not propose it again, as with the project tool list.
- [assumption] When the project tool list is missing too, the agent proposes it in the same message as the
  test-commands file and asks once.
- [assumption] "The group's own test files" are the test files the group creates or changes and the existing
  test files of the code it changes.
- [assumption] A run is long when its expected duration in the file is 2 minutes or more, or when it is wider
  than single test files and no duration is written.
- [assumption] The early start check and the proposal of the file exist only on `clarify`: `clarify-ai-qa` and
  `clarify-qa` keep their present planning rules, as they did in the planning change of 0.6.0.
- [assumption] The early start check needs both the start command and the address; when either is missing it is
  skipped.
- [assumption] The stop for a command that does not work is handled like the environment stop: independent
  groups are finished first.
- [assumption] The kit blocks the full-suite command for every `task-implementer` subagent, the fix subagents
  included; the command is matched part by part of the command line, with redirections, leading variable
  assignments and common wrappers ignored; a command inside a quoted shell string is not caught, and the written
  rule still forbids it.
- [assumption] The file has up to three lines, `One file:`, `Failed only:` and `Full suite:`, each with the
  command in backticks and an optional `— <n> min`; the one-file command holds the placeholder `<file>`.
- [assumption] The kit's blocking works from the file alone, whatever the stamp of the change: without the file
  or without a `Full suite:` line nothing is blocked. A command that only starts like the full-suite command
  (the one-file command) passes.
- [assumption] A command the file lacks, and a missing file or section, is proposed in the ready message at the
  end of apply, not at a stop.
- [assumption] After the developer answers the stop of a command that does not work with the right command, the
  agent writes it into the file.
- [assumption] The tests of two groups that the changed-files check runs after a collision are run by the main
  agent with the one-file command, as part of the existing check.
- [assumption] The kit's health check and installer do not read the test-commands file; the installer only
  leaves it alone.
