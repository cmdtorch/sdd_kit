# Tasks

## 1. Version gate and model setting

Depends on: none
Area: kit/openspec/tooling/lib/project.mjs, kit/openspec/tooling/bin/subagent-model.mjs, kit/openspec/tooling/bin/doctor.mjs, kit/openspec/tooling/checks/lint-kit.mjs, tests/subagents.test.mjs, docs/how-it-works.md, docs/decisions.md, CHANGELOG.md
Shared: none

- [x] 1.1 Write failing tests in `tests/subagents.test.mjs` for "Change stamped by an older kit", "Change without a stamp", "Older change verified by the main agent" (version helper: `0.4.0` and no stamp → old rules; `0.5.0-beta.1`, `0.5.0`, `0.6.0` → new rules) and for "Model set in the project", "No model set", "Full model ID is accepted", "Apply falls back to the main model", "Doctor warns about a typo", "Kit update keeps the setting" (scripts run as processes on temp projects), and verify they fail
- [x] 1.2 Add the version helper and the model reader/validator (`opus`, `sonnet`, `haiku`, `fable`, `inherit`, `claude-*`) to `kit/openspec/tooling/lib/project.mjs`; verified by the unit tests of 1.1 passing
- [x] 1.3 Add `kit/openspec/tooling/bin/subagent-model.mjs` (prints the model to pass, or a warning and the main-model fallback); verified by the script tests of 1.1 passing
- [x] 1.4 Accept `x-sdd-kit-subagent-model` in `lint-kit.mjs` (`CONFIG_KEYS`) and warn about an unknown value in `doctor.mjs`; verified by the doctor, lint-kit and installer-update tests of 1.1 passing
- [x] 1.5 Document the script, the key and the version gate in `docs/how-it-works.md`, add the decision entries (design D5, D6) to `docs/decisions.md` and a `CHANGELOG.md` Unreleased entry; verified by `node --test tests/release.test.mjs` (every kit file mentioned) passing

## 2. Subagent runs in the implementation report

Depends on: none
Area: kit/openspec/tooling/lib/apply-report.mjs, kit/openspec/tooling/checks/check-apply-report.mjs, kit/openspec/protocols/apply.md, tests/apply-protocol.test.mjs, docs/how-it-works.md
Shared: none

- [x] 2.1 Write failing tests in `tests/apply-protocol.test.mjs` for "Missing subagent record does not block" (report without the section: no error, no warning; report with a `## Subagent runs` section: no error) and for "Report records the subagent runs" (`apply.md` §7 names the section and its line format), keeping the existing tests of "Report after the tasks" and "Report after the E2E stage" green, and verify the new ones fail
- [x] 2.2 Make `lib/apply-report.mjs` and `check-apply-report.mjs` accept an optional `## Subagent runs` section and never report on it; verified by the tests of 2.1 passing
- [x] 2.3 Describe the section and its line format (`<group | fix: <what> | full suite> — <tasks> — <model> — <test result>`) in `kit/openspec/protocols/apply.md` §7 and mention it in `docs/how-it-works.md`; verified by the text test of 2.1 passing

## 3. Subagents protocol: scheduling and the changed-files check

Depends on: none
Area: kit/openspec/protocols/subagents.md, tests/subagents.test.mjs, docs/how-it-works.md
Shared: none

- [x] 3.1 Write failing text tests for "Change with three groups", "Change with one group", "Apply protocol states the rule", "Chain of groups", "Dependent group waits", "Backend and frontend groups", "Overlapping areas run in order", "Both groups change migrations", "Group without an area runs alone", "Project gives each run its own database", "One shared test database", "Groups sharing ports", "Kit does not add isolation", "No commits during apply" and "Backend and frontend clones", and verify they fail
- [x] 3.2 Write failing text tests for "Change inside the group's area", "File outside every declared area", "Collision with another group, tests pass", "Collision with a group still running", "Collision with a group not started yet", "Collision with another group, tests fail twice", "Group accepted", "First subagent breaks off" and "Second subagent also breaks off", and verify they fail
- [x] 3.3 Write `kit/openspec/protocols/subagents.md` part 1: when it applies (version gate 0.5.0), reading the plan lines, scheduling (dependencies, areas, changed shared files, `Area: unknown`, unreadable lines), test runs on `database` / `ports` / `docker`, one working folder with no commits, branches or worktrees, meta-repository groups in order; verified by the tests of 3.1 passing
- [x] 3.4 Add part 2: the `Changed files:` self-report and the `git status` reconciliation, collisions (accepted, running, not started, two fix attempts), only the main agent checks off tasks, one replacement for an unfinished subagent; verified by the tests of 3.2 passing
- [x] 3.5 Add the protocol to the protocol table of `docs/how-it-works.md`; verified by `node --test tests/release.test.mjs` passing

## 4. Subagents protocol: stops, final group, progress, delegation, pointers

Depends on: 3
Area: kit/openspec/protocols/subagents.md, kit/openspec/protocols/apply.md, kit/openspec/protocols/testing.md, kit/openspec/protocols/e2e.md, kit/config-fragment.yaml, tests/subagents.test.mjs, docs/how-it-works.md
Shared: settings

- [x] 4.1 Write failing text tests for "Requirement gap while another group runs", "Consent needed while another group runs", "Failing test with independent groups left", "Failed start check", "Final group", "End-of-apply suite", "Fix after the test review", "Failing E2E test", "Group finished, tests pass", "Full-suite subagent finished", "Group finished, tests fail" and "Full-suite subagent ignores the setting", and verify they fail
- [x] 4.2 Write failing text tests for "Developer runs verify", "Verify finding is fixed", "Code study before the questions", "Reading subagent proposes a decision" and "Protocol limits what is delegated", and verify they fail
- [x] 4.3 Add to `subagents.md`: stops relayed by the main agent, the final group, the full suite, E2E fixes, the progress line, the model per run (`subagent-model.mjs`), verify through `change-verifier`, code reading through `Explore` with the reason in the chat, and the limits outside apply; verified by the tests of 4.1 and 4.2 passing
- [x] 4.4 Point to `subagents.md` from `apply.md` (§1 and §2), `testing.md` (§5, §6) and `e2e.md` (fixes), and add one line to the kit block of `kit/config-fragment.yaml`; verified by text tests for the pointers and by `node --test tests/installer.test.mjs` passing

## 5. Agent definitions

Depends on: 4
Area: kit/claude/agents/task-implementer.md, kit/claude/agents/change-verifier.md, tests/subagents.test.mjs, docs/how-it-works.md
Shared: none

- [x] 5.1 Write failing tests for "Subagent definition states the limits" (`task-implementer.md`: no subagents, no questions, no planning artifacts, no `tasks.md`, `Changed files:` report) and "Verify subagent changes nothing" (`change-verifier.md` tools without Edit and Write), and verify they fail
- [x] 5.2 Add `kit/claude/agents/task-implementer.md` and `kit/claude/agents/change-verifier.md` (`model: inherit`, managed-file header); verified by the tests of 5.1 passing and by `node --test tests/installer.test.mjs` showing both installed into `.claude/agents/`
- [x] 5.3 Add both agents to the subagents table of `docs/how-it-works.md`; verified by `node --test tests/release.test.mjs` passing

## 6. Schema instructions

Depends on: 4, 5
Area: kit/openspec/schemas/clarify/schema.yaml, kit/openspec/schemas/clarify-ai-qa/schema.yaml, kit/openspec/schemas/clarify-qa/schema.yaml, kit/openspec/schemas/lean/schema.yaml, tests/schemas.test.mjs, tests/subagents.test.mjs, docs/how-it-works.md
Shared: none

- [x] 6.1 Write failing text tests on the four `tasks` instructions for "Tasks instruction shows the plan lines", "Group with its plan lines", "Independent group", "Area of a frontend group", "Rename across the project", "Tasks instruction lists the shared resources", "Group installs a library", "Group whose tests use the database", "Tasks instruction states the limit", "Large group is split" and "Final group depends on all", and verify they fail
- [x] 6.2 Write failing tests for "Group above the limit is not blocked", "Group without plan lines" and "Malformed plan line" (tasks gate and `check-tasks` run as processes on a `tasks.md` with 7 tasks in a group, without plan lines, and with `Depends on: the API group`), and verify the text parts fail
- [x] 6.3 Add the plan lines, the shared-resource list, the size limit and the final-group dependency to the `tasks` instruction of all four schemas; verified by the tests of 6.1 and 6.2 passing
- [x] 6.4 Add the subagent rules (follow `subagents.md` on changes stamped 0.5.0 or later, groups to `task-implementer`, no code edits by the main agent, verify through `change-verifier`) to the `apply` instruction of all four schemas; verified by text tests on the four `apply` instructions and by `node openspec/tooling/checks/lint-kit.mjs` on a temp install passing
- [x] 6.5 Describe the schema changes in `docs/how-it-works.md`; verified by `node --test tests/release.test.mjs` passing

## 7. Final checks

Depends on: 1, 2, 3, 4, 5, 6
Area: unknown
Shared: none

- [x] 7.1 Run the `test-reviewer` subagent and fix its blocker and major findings (`openspec/protocols/review-tests.md`); verified by `reviews/test-review.md` with no open blocker or major finding
- [x] 7.2 Run the full suite `npm test` and `node openspec/tooling/bin/doctor.mjs`, and fix what fails; verified by both passing
- [x] 7.3 Write `apply-report.md` (`openspec/protocols/apply.md` §7) with every manual row of the verification plan under "Manual checks" (the pilot in this repository); verified by `node openspec/tooling/checks/check-apply-report.mjs --change add-subagent-execution` passing
- [x] 7.4 Run `node openspec/tooling/checks/check-traceability.mjs --change add-subagent-execution --markers`; verified by it reporting no error
