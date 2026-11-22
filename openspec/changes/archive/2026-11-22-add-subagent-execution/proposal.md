# Proposal

## Why

On a change with many tasks, one apply chat fills up quickly: the agent's context rots, and today the developer has to clear the chat and restart apply by hand. Development should also go faster by running independent work, such as backend and frontend, at the same time. [desc]

When speed and a fresh context pull in different directions, quality wins: every piece of work gets a fresh context, and work runs in parallel only when that is safe. [Q2]

## What Changes

- **Task groups carry an execution plan.** When the agent writes `tasks.md` it also records, for each task group: the groups it depends on, the area of the project it touches (files, folders), and any shared resources its tests use (database, ports, Docker). [Q4][Q17][Q19][Q18]
- **Group size limit.** At planning time a group is kept small enough, by the number of tasks or of files it touches, that a subagent doing it stays within about 200–300 thousand tokens of context. [Q5][desc]
- **Apply runs through subagents.** Each task group is done by a fresh subagent; dependent groups run one after another. The main agent orchestrates and does not edit project code itself [Q21]. This holds for every change on a kit schema, whatever its size, and cannot be switched off. [Q4][Q10][Q11][desc]
- **Parallel groups.** The main agent runs in parallel only groups that the plan marks as independent of each other, and it chooses which ones and when. There is no numeric limit, but the main agent runs fewer at once when the groups' tests share resources such as a database, ports or Docker. [Q6][Q8][Q17][Q18]
- **One working folder.** Parallel subagents work in the same folder, with no separate copies of the repository: only groups whose declared areas do not overlap and that share no resources run together. Nothing is merged, and the kit commits nothing; the developer commits, as today. [Q7][Q19][Q20]
- **Changed-files check.** After each subagent the main agent checks which files it changed. Nothing outside its area, or nothing in another group's area: accepted. Another group's area touched: the main agent runs the tests of both groups and gives the fix to a new subagent, at most two attempts, then stops and asks the developer. [Q22][Q23]
- **Every code edit goes through a subagent**, including small fixes after the test review and after checks. [Q21]
- **Stops stay as they are.** A subagent cannot ask the developer; the main agent asks. On a requirement gap no new subagent starts and running ones finish their current group; on a failing test independent groups are finished first. [Q9]
- **End of apply and verify.** The full test suite run with the fixing of failures at the end of apply, and the final check of the implementation against the specs (verify), are also done by subagents. [Q3]
- **Code reading elsewhere.** At other stages the agent may hand reading and studying the project's code to a subagent, never decisions or edits to artifacts, and says in the chat why. [Q16]
- **Progress.** After each finished subagent the developer sees one line in the chat (the group, what was done, whether its tests pass), and the same goes into the implementation report. [Q14]
- **Model.** The model of the implementation subagents is set in the project; the default is the main chat's model. [Q13]
- **Enforced by the protocol only.** Delegation is a rule in the kit's protocol, with no new blocking check or hook. [Q12]
- **Out of scope:** parallel work in the planning stages (questions, specs, design); external orchestrators and agent teams outside Claude Code; parallel work in different repositories of a meta-repository. [Q15]

## Capabilities

### New Capabilities

- `workflow/task-groups`: how `tasks.md` records each task group's dependencies, touched area and shared resources, and the group size limit set at planning time. [Q4][Q5][Q17][Q18][Q19]
- `workflow/subagent-apply`: apply through subagents: one fresh subagent per group, dependent groups in order, independent groups in parallel in one folder, the changed-files check and collision fixes by a new subagent, stops relayed by the main agent, every code edit through a subagent, the full suite at the end, the progress line, and the configurable model. [Q3][Q6][Q7][Q8][Q9][Q10][Q11][Q13][Q14][Q21][Q22][Q23]
- `workflow/subagent-delegation`: delegation outside apply: verify run by a subagent, and code reading handed to a subagent at other stages, never decisions or artifact edits, with the reason given in the chat. [Q3][Q16]

### Modified Capabilities

- `workflow/manual-checks`: the implementation report `apply-report.md` gains a record of the subagent runs (which group, what was done, test result). [Q14]

## Impact

- `kit/openspec/protocols/`: `apply.md` and `testing.md` (orchestration, stops relayed by the main agent, the full suite through a subagent), or a new protocol for subagent execution referenced from them. [Q3][Q9][Q12]
- `kit/openspec/schemas/` (`clarify`, `clarify-ai-qa`, `clarify-qa`, `lean`): the `tasks` instruction (group markup and size limit) and the `apply` instruction (delegation). [Q4][Q5][Q10]
- `kit/claude/agents/`: a new implementation subagent definition with the project-configurable model. [Q13]
- The kit's guidance for verify and for code reading at other stages. [Q3][Q16]
- `apply-report.md` format and `check-apply-report.mjs`, for the subagent runs record. [Q14]
- `docs/how-it-works.md`, `docs/decisions.md`, `CONTRIBUTING.md` where relevant, and tests in `tests/`. [desc]

## Assumptions & Open Questions

- [assumption] The concrete numbers of the group size limit (tasks, files) are settled in the Specs or Design round, not now.
- [assumption] A subagent cannot ask the developer itself and does not start other subagents: questions and the test reviewer run go through the main agent.
- [assumption] The existing reviewers (specs, test cases, tests) stay as they are.
- [assumption] The E2E stage stays with the main agent: it was not chosen among the stages for subagents.
- [assumption] In a meta-repository, groups of different repositories run one after another; parallel work is possible only between groups of the same repository.
