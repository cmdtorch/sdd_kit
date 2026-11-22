# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| workflow/manual-checks | Implementation report | Report after the tasks | unit | no | existing test in tests/apply-protocol.test.mjs (behaviour unchanged) | — |
| workflow/manual-checks | Implementation report | Report after the E2E stage | unit | no | existing test in tests/apply-protocol.test.mjs (behaviour unchanged) | — |
| workflow/manual-checks | Implementation report | Report records the subagent runs | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/manual-checks | Implementation report | Report records the subagent runs | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/manual-checks | Implementation report | Missing subagent record does not block | integration | no | apply-report.md with the three sections and no "Subagent runs", check-apply-report run as a process | — |
| workflow/subagent-apply | Each task group runs in a fresh subagent | Change with three groups | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Each task group runs in a fresh subagent | Change with three groups | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Each task group runs in a fresh subagent | Change with one group | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Each task group runs in a fresh subagent | Change with one group | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Each task group runs in a fresh subagent | Apply protocol states the rule | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changes started under older rules | Change stamped by an older kit | unit | no | protocol intro (older/unstamped exception, pre-release rule) and the apply instruction of the four schemas read by the test | — |
| workflow/subagent-apply | Changes started under older rules | Change without a stamp | unit | no | protocol intro and the apply instruction of the four schemas read by the test | — |
| workflow/subagent-apply | The final group is run by the main agent | Final group | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | The final group is run by the main agent | Final group | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Every code edit goes through a subagent | Fix after the test review | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Fix after the test review | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Every code edit goes through a subagent | Failing E2E test | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Every code edit goes through a subagent | Failing E2E test | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Limits of an implementation subagent | Subagent definition states the limits | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Dependent groups run in order | Chain of groups | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Dependent groups run in order | Chain of groups | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Independent groups may run in parallel | Backend and frontend groups | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Independent groups may run in parallel | Backend and frontend groups | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Independent groups may run in parallel | Overlapping areas run in order | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Independent groups may run in parallel | Overlapping areas run in order | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Independent groups may run in parallel | Both groups change migrations | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Independent groups may run in parallel | Both groups change migrations | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Independent groups may run in parallel | Group without an area runs alone | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Independent groups may run in parallel | Group without an area runs alone | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Test runs on shared test resources | Project gives each run its own database | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Test runs on shared test resources | Project gives each run its own database | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Test runs on shared test resources | One shared test database | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Test runs on shared test resources | One shared test database | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Test runs on shared test resources | Groups sharing ports | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Test runs on shared test resources | Groups sharing ports | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Test runs on shared test resources | Kit does not add isolation | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Test runs on shared test resources | Kit does not add isolation | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Parallel subagents share the working folder | No commits during apply | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Parallel subagents share the working folder | No commits during apply | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Changed files are checked after each subagent | Change inside the group's area | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changed files are checked after each subagent | Change inside the group's area | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Changed files are checked after each subagent | File outside every declared area | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changed files are checked after each subagent | File outside every declared area | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with another group, tests pass | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with another group, tests pass | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with a group still running | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with a group still running | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with a group not started yet | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with a group not started yet | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with another group, tests fail twice | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Changed files are checked after each subagent | Collision with another group, tests fail twice | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Only the main agent checks off tasks | Group accepted | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Only the main agent checks off tasks | Group accepted | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Unfinished subagent is replaced once | First subagent breaks off | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Unfinished subagent is replaced once | First subagent breaks off | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Unfinished subagent is replaced once | Second subagent also breaks off | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Unfinished subagent is replaced once | Second subagent also breaks off | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Stops are relayed by the main agent | Requirement gap while another group runs | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Stops are relayed by the main agent | Requirement gap while another group runs | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Stops are relayed by the main agent | Consent needed while another group runs | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Stops are relayed by the main agent | Consent needed while another group runs | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Stops are relayed by the main agent | Failing test with independent groups left | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Stops are relayed by the main agent | Failing test with independent groups left | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Stops are relayed by the main agent | Failed start check | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Stops are relayed by the main agent | Failed start check | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Full suite at the end runs in a subagent | End-of-apply suite | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Full suite at the end runs in a subagent | End-of-apply suite | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Progress line after each subagent | Group finished, tests pass | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Progress line after each subagent | Group finished, tests pass | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Progress line after each subagent | Full-suite subagent finished | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Progress line after each subagent | Full-suite subagent finished | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Progress line after each subagent | Group finished, tests fail | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Progress line after each subagent | Group finished, tests fail | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Model of the implementation subagents | Model set in the project | integration | yes | temp project, config.yaml with `x-sdd-kit-subagent-model: sonnet`; subagent-model.mjs run as a process | — |
| workflow/subagent-apply | Model of the implementation subagents | No model set | integration | yes | temp project, config.yaml without the key and with `inherit`; subagent-model.mjs run as a process | — |
| workflow/subagent-apply | Model of the implementation subagents | Full-suite subagent ignores the setting | unit | yes | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Model of the implementation subagents | Full-suite subagent ignores the setting | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-apply | Model of the implementation subagents | Kit update keeps the setting | integration | yes | temp project from fixtures with the key; installer `update --yes`, then lint-kit run as a process | — |
| workflow/subagent-apply | Unknown model value | Doctor warns about a typo | integration | yes | temp project, `x-sdd-kit-subagent-model: sonet`; doctor.mjs run as a process | — |
| workflow/subagent-apply | Unknown model value | Full model ID is accepted | integration | yes | temp project, `x-sdd-kit-subagent-model: claude-sonnet-5-5`; doctor.mjs and subagent-model.mjs run as processes | — |
| workflow/subagent-apply | Unknown model value | Apply falls back to the main model | integration | yes | temp project, `x-sdd-kit-subagent-model: sonet`; subagent-model.mjs prints the warning and the fallback | — |
| workflow/subagent-apply | Meta-repository groups of different repositories run in order | Backend and frontend clones | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-apply | Meta-repository groups of different repositories run in order | Backend and frontend clones | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-delegation | Verify runs in a subagent | Developer runs verify | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-delegation | Verify runs in a subagent | Developer runs verify | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-delegation | Verify runs in a subagent | Verify finding is fixed | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-delegation | Verify runs in a subagent | Verify finding is fixed | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-delegation | Verify runs in a subagent | Verify subagent changes nothing | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-delegation | Verify runs in a subagent | Verify subagent changes nothing | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-delegation | Verify runs in a subagent | Older change verified by the main agent | unit | no | protocol §10 and the apply instruction of the four schemas read by the test | — |
| workflow/subagent-delegation | Code reading may be handed to a subagent | Code study before the questions | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-delegation | Code reading may be handed to a subagent | Code study before the questions | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-delegation | Decisions and artifacts stay with the main agent | Reading subagent proposes a decision | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/subagent-delegation | Decisions and artifacts stay with the main agent | Reading subagent proposes a decision | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/subagent-delegation | Decisions and artifacts stay with the main agent | Protocol limits what is delegated | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Group plan lines | Tasks instruction shows the plan lines | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Group plan lines | Group with its plan lines | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Group plan lines | Group with its plan lines | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Every task group states its dependencies | Independent group | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group states its dependencies | Independent group | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Every task group states its dependencies | Dependent group waits | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group states its dependencies | Dependent group waits | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Every task group declares its area | Area of a frontend group | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group declares its area | Area of a frontend group | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Every task group declares its area | Rename across the project | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group declares its area | Rename across the project | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Every task group names its shared resources | Tasks instruction lists the shared resources | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group names its shared resources | Group installs a library | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group names its shared resources | Group installs a library | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Every task group names its shared resources | Group whose tests use the database | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Every task group names its shared resources | Group whose tests use the database | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Group size limit | Tasks instruction states the limit | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Group size limit | Large group is split | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Group size limit | Large group is split | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Group size limit | Group above the limit is not blocked | integration | no | tasks.md with a group of 7 tasks; tasks gate and check-tasks run as processes | — |
| workflow/task-groups | Plan lines are not checked | Group without plan lines | integration | yes | tasks.md whose group 2 has no plan lines; tasks gate and check-tasks run as processes | — |
| workflow/task-groups | Plan lines are not checked | Group without plan lines | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Plan lines are not checked | Malformed plan line | integration | yes | tasks.md with `Depends on: the API group`; check-tasks run as a process (plus protocol text) | — |
| workflow/task-groups | Plan lines are not checked | Malformed plan line | manual | yes | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |
| workflow/task-groups | Final group depends on every other group | Final group depends on all | unit | no | protocol, four schema files and agent definitions read by the test | — |
| workflow/task-groups | Final group depends on every other group | Final group depends on all | manual | no | pilot: the next kit change after the beta release, in the kit repository | cannot be automated: agent behaviour in a real session, checked in the pilot |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| workflow/manual-checks | Implementation report | [Q14][Q31] |
| workflow/subagent-apply | Each task group runs in a fresh subagent | [desc][Q4][Q10][Q11] |
| workflow/subagent-apply | Changes started under older rules | [Q26] |
| workflow/subagent-apply | The final group is run by the main agent | [Q3][Q21] |
| workflow/subagent-apply | Every code edit goes through a subagent | [Q21][Q36] |
| workflow/subagent-apply | Limits of an implementation subagent | [Q9][Q21][Q30] |
| workflow/subagent-apply | Dependent groups run in order | [desc][Q4][Q17] |
| workflow/subagent-apply | Independent groups may run in parallel | [desc][Q6][Q8][Q17][Q19][Q27][Q28] |
| workflow/subagent-apply | Test runs on shared test resources | [Q18][Q35] |
| workflow/subagent-apply | Parallel subagents share the working folder | [Q7][Q19][Q20] |
| workflow/subagent-apply | Changed files are checked after each subagent | [Q22][Q23][Q38] |
| workflow/subagent-apply | Only the main agent checks off tasks | [Q30] |
| workflow/subagent-apply | Unfinished subagent is replaced once | [Q29] |
| workflow/subagent-apply | Stops are relayed by the main agent | [Q9] |
| workflow/subagent-apply | Full suite at the end runs in a subagent | [Q3] |
| workflow/subagent-apply | Progress line after each subagent | [Q14] |
| workflow/subagent-apply | Model of the implementation subagents | [Q13][Q32][Q33] |
| workflow/subagent-apply | Unknown model value | [Q34][Q37] |
| workflow/subagent-apply | Meta-repository groups of different repositories run in order | [Q15] |
| workflow/subagent-delegation | Verify runs in a subagent | [Q3][Q21][Q26] |
| workflow/subagent-delegation | Code reading may be handed to a subagent | [Q16] |
| workflow/subagent-delegation | Decisions and artifacts stay with the main agent | [Q16] |
| workflow/task-groups | Group plan lines | [Q4][Q17][Q19][Q27] |
| workflow/task-groups | Every task group states its dependencies | [Q4][Q17] |
| workflow/task-groups | Every task group declares its area | [Q19][Q28] |
| workflow/task-groups | Every task group names its shared resources | [Q18][Q27][Q35] |
| workflow/task-groups | Group size limit | [desc][Q5][Q24][Q25] |
| workflow/task-groups | Plan lines are not checked | [Q12][Q25][Q28] |
| workflow/task-groups | Final group depends on every other group | [Q4][Q17] |

## Environment

- Node.js and the pinned OpenSpec CLI, as for the rest of the kit suite (`npm test`).
- Script tests run the kit files (`subagent-model.mjs`, `doctor.mjs`, `lint-kit.mjs`, `check-apply-report.mjs`, `check-tasks.mjs`, the tasks gate, the installer) as child processes on temp projects built from `fixtures/`.
- Text tests read `kit/openspec/protocols/subagents.md`, `apply.md`, `testing.md`, `e2e.md`, the `tasks` and `apply` instructions of the four kit schemas, `kit/config-fragment.yaml` and the agent definitions `task-implementer.md` and `change-verifier.md`.
- Pilot: the next kit change after the beta release, run in this repository on a change stamped with the beta version; the manual rows go to QA in `apply-report.md`.
- Running application: no (the kit itself has no application to start).
