# Design

## Context

See proposal.md, *Why*, for the motivation. The kit steers the agent with schema instructions, protocols, the
`task-implementer` subagent definition, hooks and checks; in-flight changes keep the rules of the kit version
stamped into their `.openspec.yaml` [D1]. Today `testing.md` §5 already says "run tests scoped", and the
measured subagents still ran a folder or the whole suite in 45 of 93 slow runs, so the two run rules get a hook
in addition to the text [D1][Q13]. The start check is a script (`bin/start-check.mjs`) that writes
`start-check.json` in the change; the archive gate reads that record [D1]. The kit never runs the project's
tests itself and must stay stack-agnostic [D1].

## Goals / Non-Goals

**Goals:**

- One place for the project's test commands that both the agent and one kit hook can read [Q11][Q13].
- The two run rules held mechanically where the file allows it, by text everywhere else [Q13].
- A broken environment found before the proposal is written [D1][Q8].

**Non-Goals:**

- Kit code that runs, times or validates the project's test commands [Q10][Q12].
- A gate that forces the early start check or the file proposal: both are protocol steps [Q4].
- Any change to the test-case schemas or to `lean` planning [Q10][Q14].

## Decisions

### D-1. One version gate

`lib/project.mjs` gets `TEST_RUNS_VERSION = '0.7.0'` and `usesTestCommands(root, name)`: the change is stamped
0.7.0 or later, like the 0.5.0 and 0.6.0 gates. `kit.json` and `package.json` go to 0.7.0 in this change, so
new changes get the stamp [D1]. The protocols name the stamp in words; only the early-check and file-proposal
steps also require the `clarify` schema [Q10][Q14]. Rejected: a project setting, since the earlier changes of
the plan are gated by the stamp alone [D1].

### D-2. The file is Markdown read by one small parser

`openspec/test-commands.md` is a project file like `openspec/project-tools`: not in the kit manifest, never
written by the installer, ignored by `doctor` [Q10][Q11]. A new `lib/test-commands.mjs` exports
`parseTestCommands(content)` and `readTestCommands(root)`: it returns, per section, the commands by label with
their duration in minutes or `null`. A command item is the line
``- <One file|Failed only|Full suite>: `<command>` [— <n> min]``; other lines are ignored; `## Repository:
<name>` headings open sections, and outside a meta-repository every item belongs to one unnamed section; the
first item of a label wins; the single line `none` yields no commands [Q6][Q11]. The parser is the only kit
code that reads the file, and it is used only by the hook of D-3 [Q13]. Rejected: YAML or JSON (the developer
edits the file by hand and the agent drafts it; `project-tools` set the precedent of a plain file) and a
section in `CLAUDE.md` (the owner chose a separate file) [Q11].

### D-3. One PreToolUse hook holds both run rules

A new hook `openspec/tooling/hooks/test-run-guard.mjs` on `PreToolUse` for `Bash`, registered in
`kit/claude-settings.fragment.json` next to `boundary-guard` [Q13]. For each part of the command line it
compares the normalised words with every `Full suite` command of the file:

- parts and words come from `boundary-guard`'s `commandParts` and its word splitter, moved into a shared
  `lib/command-line.mjs` so both hooks use one implementation; leading `VAR=value` and the wrappers `env`,
  `nohup`, `time`, `nice`, `timeout` (with its duration argument) are dropped, trailing redirections are
  dropped, runs of spaces count as one [Q13];
- a match inside a `task-implementer` subagent is blocked (exit 2) with the rule and the section's one-file
  command [Q7][Q13];
- otherwise a match whose duration is `null` or 2 minutes or more is blocked when the tool input's
  `run_in_background` is not `true`, with the message to run it in the background [D1][Q12][Q13].

The hook reads no change and no stamp: it works from the file alone and fails open (no file, `none`, no
`Full suite` item, a parse error: nothing is blocked) [Q4][Q13]. Rejected: matching by prefix (the one-file
command usually starts with the full-suite command) and blocking folder runs (the kit cannot tell a folder
from a file in an unknown stack) [D1].

### D-4. How the hook knows it runs inside a `task-implementer`

The hook input of a call made inside a subagent carries `agent_type` (kit fact K10, taken from the Claude Code
documentation and not exercised yet) [D1]. The first task of the hook group verifies it with a real
`task-implementer` run that dumps the hook input. If the field is absent, the fallback is a `hooks:` block in
the frontmatter of `kit/claude/agents/task-implementer.md` that runs the same script with a
`--subagent` flag; the specs do not change either way [Q13]. The verified fact is recorded in
`docs/openspec-facts.md`.

### D-5. Long runs are a protocol rule plus the hook for the full suite

`testing.md` gets the rule: a run whose command has a written duration of 2 minutes or more, or a failed-only
or full-suite run without a duration, is started with the Bash tool's background mode, and the agent ends its
step and waits for the completion notice instead of a sleep-and-check loop [D1][Q12]. The hook can hold this
only for the full-suite command, because the one-file command contains a placeholder and the failed-only run
is short in most projects; the rest stays text in `testing.md`, `subagents.md` and the `task-implementer`
definition [Q13].

### D-6. The early step lives in the planning protocol

`planning.md` gets a section "After the Main round" for `clarify` changes stamped 0.7.0 or later, and the
proposal instruction of the `clarify` schema points to it: (1) when `openspec/project-tools` or
`openspec/test-commands.md` is missing, show both drafts in one chat message, run `planning.mjs wait`, end the
turn, and write the files from the answer; (2) when the instructions name the start command and the address,
run `start-check.mjs`; (3) on a failure, report, offer the two ways, `planning.mjs wait` [Q2][Q3][Q8]. The
existing Stop hook already lets a turn end on a wait, so no hook changes; the developer's next message ends the
wait [Q3]. Rejected: a gate that blocks the proposal until the step is done (a missing file must never block,
and a skipped check is legitimate) [Q4].

### D-7. The start check at the beginning of apply reads the record

`apply.md` §4 and the apply instruction of `clarify` say: when `start-check.json` records a passed check, do
not run the check again; otherwise proceed as today [Q9]. `start-check.mjs` already overwrites the record on
every run, so a failed early check followed by "go on" leaves a failed record and the apply-time check runs
[Q8][Q9]. The archive gate keeps its rule (the record exists when the plan needs a running application); an
early passed record satisfies it [Q9]. `lib/start-check.mjs` gets `startCheckPassed(root, change)` for the
protocol's one-line check command `start-check.mjs --change <name> --status`, which prints `passed`, `failed`
or `none` [Q9].

### D-8. Protocol texts

- `testing.md`: the header paragraph names the file first and the instructions as the fallback; §5 gets the
  own-test-files rule for changes stamped 0.7.0 or later, with the earlier wording kept for older changes; a
  new section describes the file, the draft and confirmation, the ready-message proposal of missing commands
  and the stop for a command that does not work, with its boundary to failing tests [Q2][Q4][Q5][Q7][Q12].
- `apply.md`: §1 and §4 (D-7), §2 gets the new stop, §9 gets the proposal of missing commands in the ready
  message [Q4][Q5][Q9].
- `subagents.md`: §5 (the tests of two groups after a collision are their own test files with the one-file
  command), §7 (the new stop is relayed like the environment stop), §8 (the full suite in the background)
  [D1][Q5][Q7].
- `metarepo.md` §4: the repository's section of the root file first [Q6].
- `task-implementer.md`: only its own test files, the file's commands, the stop report for a command that does
  not work, long runs in the background [Q5][Q7].
- `docs/how-it-works.md`, the kit's guide and `CONTRIBUTING.md` release notes follow in the same change [D1].

## Risks / Trade-offs

- [The measured gain is an upper bound: about 420 of 1290 minutes were test runs and waits, measured on kit
  0.4.0] → the handoff's scripts are rerun after the first feature on the new version [D1].
- [A regression in a neighbouring test file surfaces only in the final full suite, far from the group that
  caused it] → accepted by the owner; the fix subagent gets the failing output [Q7].
- [A project that writes no file gets no mechanical block] → the text rules still apply, and the ready message
  proposes the file [Q4].
- [The early start check costs up to 2 minutes on a change that never needs the application] → accepted by the
  owner [Q8].
- [`agent_type` may be missing from the hook input] → D-4 names the fallback; the block of a foreground long
  run does not depend on it [Q13].
- [A full suite hidden in `bash -c "…"` or a script passes the hook] → the text rule forbids it; the hook is
  the second line, as with `boundary-guard` [Q13].

## Assumptions & Open Questions

- [assumption] The gate is the stamp 0.7.0; the hook itself ignores the stamp and works from the file.
- [assumption] The wrappers dropped before matching are `env`, `nohup`, `time`, `nice` and `timeout`.
- [assumption] The early step is a protocol step without a gate; the Stop hook is not changed.
- [assumption] `start-check.mjs --status` is added so the agent can read the record without parsing JSON.
- [assumption] The command splitter of `boundary-guard` is moved into a shared library without changing what
  `boundary-guard` matches.
