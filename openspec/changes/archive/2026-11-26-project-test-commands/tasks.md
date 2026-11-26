# Tasks

All kit edits go into `kit/` (never the installed copy `openspec/` or `.claude/`); tests into `tests/`. Every
test carries its scenario marker. The scenarios of each task are those of the named requirements in the
change's delta specs; `verification-plan.md` lists them all.

## 1. Version gate and the test-commands file parser

Depends on: none
Area: kit/openspec/tooling/lib/project.mjs, kit/openspec/tooling/lib/test-commands.mjs, kit/openspec/tooling/kit.json, package.json, tests/test-commands.test.mjs, tests/lib.test.mjs, tests/release.test.mjs, tests/installer.test.mjs, docs/how-it-works.md
Shared: settings

- [x] 1.1 Write failing tests in `tests/test-commands.test.mjs` for `workflow/test-commands`: "File with three commands", "Line that is not a command item", "Duration in another form", "Same label twice", "Group uses its repository's section" (the parser returns the section's one-file command with `<file>` replaced), and for `usesTestCommands` (stamped 0.7.0 or `0.7.0-beta.1`: yes; 0.6.1 and no stamp: no); verify they fail
- [x] 1.2 Add `TEST_RUNS_VERSION` and `usesTestCommands` to `lib/project.mjs` and set the kit version to 0.7.0 in `kit.json` and `package.json` (design D-1); verify `tests/release.test.mjs` and `tests/lib.test.mjs` pass
- [x] 1.3 Write `lib/test-commands.mjs` with `parseTestCommands` and `readTestCommands` (design D-2: command items, durations in whole minutes or `null`, `## Repository:` sections, first item of a label wins, `none`); verify the tests of 1.1 pass
- [x] 1.4 Write tests in `tests/installer.test.mjs` for "Update keeps the file" and "Health check ignores the file" (a project with `openspec/test-commands.md`, then the installer's update and `doctor`); verify they pass without a change to the installer, or fix what makes them fail
- [x] 1.5 Mention `lib/test-commands.mjs` and the 0.7.0 gate in `docs/how-it-works.md`; verify the test that requires every kit file to be mentioned there passes

## 2. The hook that holds the two run rules

Depends on: 1
Area: kit/openspec/tooling/hooks/test-run-guard.mjs, kit/openspec/tooling/hooks/boundary-guard.mjs, kit/openspec/tooling/lib/command-line.mjs, kit/claude-settings.fragment.json, kit/claude/agents/task-implementer.md, tests/test-run-guard.test.mjs, tests/hooks.test.mjs, docs/openspec-facts.md, docs/how-it-works.md
Shared: settings

- [x] 2.1 In a scratch project outside the repository, register a `PreToolUse` hook for `Bash` that logs its stdin, start a `task-implementer` subagent with `claude -p` that runs one Bash command, and record in `docs/openspec-facts.md` §9 whether the input carries `agent_type` with the subagent's name and whether `tool_input.run_in_background` is present for a background command; verify the logged input is quoted in the record. When `agent_type` is absent, use the fallback of design D-4 in 2.4 (a `hooks:` block in `task-implementer.md` passing `--subagent`)
- [x] 2.2 Write failing tests in `tests/test-run-guard.test.mjs`, running the hook as a process with a prepared input, for every scenario of `workflow/test-runs` under "The kit blocks the full suite inside an implementation subagent", "How a command line is matched with the full-suite command", "The kit blocks a long full-suite run in the foreground" and "The kit code names no test tool"; verify they fail
- [x] 2.3 Move `commandParts` and the word splitter of `boundary-guard.mjs` into `lib/command-line.mjs` and make `boundary-guard` import them; verify the present boundary-guard tests in `tests/hooks.test.mjs` pass unchanged
- [x] 2.4 Write `hooks/test-run-guard.mjs` (design D-3: match against every `Full suite` command, block inside a `task-implementer`, block a long one outside the background, fail open) and register it in `kit/claude-settings.fragment.json`; verify the tests of 2.2 pass
- [x] 2.5 Describe the hook in `docs/how-it-works.md` (hook table and the part about test runs); verify the kit-file mention test passes

## 3. The start check reads its record

Depends on: 2
Area: kit/openspec/tooling/bin/start-check.mjs, kit/openspec/tooling/lib/start-check.mjs, kit/openspec/protocols/apply.md, kit/openspec/schemas/clarify/schema.yaml, kit/openspec/schemas/lean/schema.yaml, tests/start-check-early.test.mjs, tests/apply-protocol.test.mjs, docs/how-it-works.md
Shared: ports

- [x] 3.1 Write failing tests in `tests/start-check-early.test.mjs` for `workflow/environment-check`: "Application starts during planning" and "Early check already passed" (the script against a local test server writes a passed record; `start-check.mjs --change <name> --status` prints `passed`, `failed` after a failed run, `none` without a record), and text tests on `apply.md` and the apply instructions of `clarify` and `lean` for "Lean change keeps the check at the start of apply" and "Early check was skipped"; verify they fail
- [x] 3.2 Add `startCheckPassed` to `lib/start-check.mjs` and the `--status` mode to `bin/start-check.mjs` (design D-7); verify the script tests of 3.1 pass
- [x] 3.3 Rewrite `apply.md` §1 and §4 and the "Start check first" lines of the `clarify` and `lean` apply instructions: a passed record means no second check, otherwise the check runs as today (design D-7); verify the text tests of 3.1 pass and the present tests of "Application starts", "Application does not answer in time", "No running application needed" and "No instructions or no address" still pass
- [x] 3.4 Update `docs/how-it-works.md` for the `--status` mode and the check that is not repeated; verify the kit-file mention test passes

## 4. The step after the Main round and the file's rules

Depends on: 3
Area: kit/openspec/protocols/planning.md, kit/openspec/protocols/testing.md, kit/openspec/schemas/clarify/schema.yaml, tests/planning-protocol.test.mjs, tests/test-commands-protocol.test.mjs, docs/how-it-works.md, docs/guide/
Shared: none

- [x] 4.1 Write failing text tests in `tests/test-commands-protocol.test.mjs` for every scenario of `workflow/test-commands` under "The agent drafts the file and the developer confirms it", "The file is proposed right after the Main round", "Expected duration is written once" and "Changes started under earlier rules keep them" and "Quality checks stay in the instructions", and of `workflow/environment-check` under "Early start check right after the Main round" (except "Application starts during planning"), "A failed early start check stops planning" and "Project tool list"; verify they fail
- [x] 4.2 Add the section "After the Main round" to `planning.md` and point the proposal instruction of the `clarify` schema to it (design D-6: both drafts in one message, `planning.mjs wait`, the early start check, the two ways after a failure, `clarify` stamped 0.7.0 or later only); verify the matching tests of 4.1 pass
- [x] 4.3 Add the section about `openspec/test-commands.md` to `testing.md` (format, draft and confirmation, `none` after a decline, where a duration comes from, no test run while drafting) and name the file first in its header paragraph; verify the remaining tests of 4.1 pass
- [x] 4.4 Describe the file and the early step in `docs/how-it-works.md` and the kit's guide under `docs/guide/`; verify the kit-file mention test passes and the guide names `openspec/test-commands.md`

## 5. The run rules in the protocols and the subagent

Depends on: 4
Area: kit/openspec/protocols/testing.md, kit/openspec/protocols/apply.md, kit/openspec/protocols/subagents.md, kit/openspec/protocols/metarepo.md, kit/claude/agents/task-implementer.md, tests/test-runs-protocol.test.mjs, tests/metarepo.test.mjs, tests/autonomous-apply.test.mjs, docs/how-it-works.md, CHANGELOG.md
Shared: none

- [x] 5.1 Write failing text tests in `tests/test-runs-protocol.test.mjs` for every scenario of `workflow/test-runs` under "A task group runs only its own test files", "Fix subagents run only the test files of their work", "Wider runs happen at the end, by the main agent", "A long run goes into the background" and "Changes started under earlier rules keep their test runs"; of `workflow/test-commands` under "A missing file or command never blocks the work", "A command that does not work is a stop", "Independent work goes on before the stop for a command" and "One file with a section per repository in a meta-repository" (except "Group uses its repository's section"); of `workflow/autonomous-apply` "Test command of the file does not start"; of `metarepo/apply` "Protocol names the commands file first"; verify they fail
- [x] 5.2 Rewrite `testing.md` §5 and §6 (own test files on changes stamped 0.7.0 or later, the earlier wording for older changes, long runs in the background without sleep-and-check loops, the stop for a command that does not work and its boundary to failing tests) and `apply.md` §2 and §9 (the new stop; the ready message proposes the commands the file lacks); verify the matching tests of 5.1 pass
- [x] 5.3 Rewrite `subagents.md` §5, §7 and §8 (own test files of both groups after a collision, the new stop relayed like the environment stop, the full suite in the background) and `metarepo.md` §4 (the repository's section first); verify the matching tests of 5.1 pass and the present test of "Protocol names the group's repository" passes with the reworded scenario
- [x] 5.4 Update `kit/claude/agents/task-implementer.md`: only the test files of its work, the commands of the file, a stop report for a command that does not work, long runs in the background; verify the remaining tests of 5.1 pass
- [x] 5.5 Update `docs/how-it-works.md` and add the 0.7.0 entry to `CHANGELOG.md` (what changes for a project, the new project file, the hook); verify `tests/release.test.mjs` and the kit-file mention test pass

## 6. Final checks

Depends on: 1, 2, 3, 4, 5
Area: openspec/changes/project-test-commands/
Shared: none

- [x] 6.1 Run the `test-reviewer` subagent and fix its blocker and major findings (`openspec/protocols/review-tests.md`); verify `reviews/test-review.md` says READY
- [x] 6.2 Run `npm test` and fix what fails; verify every test passes
- [x] 6.3 Write `apply-report.md` (`openspec/protocols/apply.md` §7); verify `node openspec/tooling/checks/check-apply-report.mjs --change project-test-commands` passes
- [x] 6.4 Run `node openspec/tooling/checks/check-traceability.mjs --change project-test-commands --markers`; verify it reports no error

## Workflow follow-up

- Delete the `handoff/` folder before the commit, after the owner has decided what happens to its three
  measurement scripts.
- After the archive, refresh the installed copy with `node installer/sdd-kit.mjs update --yes`.
- After the first feature built on 0.7.0, rerun the measurement scripts and compare with the numbers of
  `sources/D1.md`.
