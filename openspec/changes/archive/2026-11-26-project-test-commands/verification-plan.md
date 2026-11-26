# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| workflow/test-commands | Test commands file | File with three commands | unit | no | file content passed to the parser | — |
| workflow/test-commands | Test commands file | Line that is not a command item | unit | no | file content passed to the parser | — |
| workflow/test-commands | Test commands file | Duration in another form | unit | no | file content passed to the parser | — |
| workflow/test-commands | Test commands file | Same label twice | unit | no | file content passed to the parser | — |
| workflow/test-commands | Test commands file | Quality checks stay in the instructions | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The kit never overwrites the file | Update keeps the file | integration | yes | temporary project with the file, then the installer's update or the health check | — |
| workflow/test-commands | The kit never overwrites the file | Health check ignores the file | integration | no | temporary project with the file, then the installer's update or the health check | — |
| workflow/test-commands | The agent drafts the file and the developer confirms it | Developer confirms the draft | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The agent drafts the file and the developer confirms it | Developer corrects the draft | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The agent drafts the file and the developer confirms it | Developer declines | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The agent drafts the file and the developer confirms it | Nothing written before the answer | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The file is proposed right after the Main round | First change of a project | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The file is proposed right after the Main round | File already exists | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The file is proposed right after the Main round | Test-case schema change | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | The file is proposed right after the Main round | Tool list and commands in one message | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Expected duration is written once | Duration from the developer | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Expected duration is written once | Unknown duration | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Expected duration is written once | No test run while drafting | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Expected duration is written once | A slower real run changes nothing | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A missing file or command never blocks the work | No file at apply | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A missing file or command never blocks the work | One command missing | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A missing file or command never blocks the work | File says none | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A command that does not work is a stop | Unknown flag | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A command that does not work is a stop | Failing tests are not this stop | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A command that does not work is a stop | Import error in the group's code | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A command that does not work is a stop | Command from the instructions does not work | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A command that does not work is a stop | Developer gives the right command | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | A command that does not work is a stop | Subagent meets the broken command | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Independent work goes on before the stop for a command | Other repository's groups go on | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Independent work goes on before the stop for a command | Every remaining group needs the command | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | One file with a section per repository in a meta-repository | Group uses its repository's section | unit | no | file content passed to the parser | — |
| workflow/test-commands | One file with a section per repository in a meta-repository | Repository without a section | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | One file with a section per repository in a meta-repository | Draft covers every declared clone | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-commands | Changes started under earlier rules keep them | Change stamped 0.6.1 | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | A task group runs only its own test files | Group runs its two test files | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | A task group runs only its own test files | Fix after a failing own test | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | Fix subagents run only the test files of their work | Review fix | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | Wider runs happen at the end, by the main agent | Neighbouring test broken by a group | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | Wider runs happen at the end, by the main agent | Fix subagent reruns only the failing tests | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | Wider runs happen at the end, by the main agent | No test is left out | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | Wider runs happen at the end, by the main agent | Tests of two groups after a collision | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | Subagent runs the full suite | integration | yes | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | Fix subagent at the end of apply | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | Another kind of subagent | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | Change stamped 0.6.1 | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | Section of a meta-repository | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | Main agent runs the full suite | integration | yes | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | No commands file | integration | yes | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | How a command line is matched with the full-suite command | One-file command passes | integration | yes | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | How a command line is matched with the full-suite command | Full suite inside a longer command line | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | How a command line is matched with the full-suite command | Full suite wrapped in another program | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | How a command line is matched with the full-suite command | Full suite inside a quoted shell string | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | How a command line is matched with the full-suite command | Extra spaces | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | How a command line is matched with the full-suite command | Full suite with its output piped | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | A long run goes into the background | Full suite of 12 minutes | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | A long run goes into the background | Short one-file run stays in the foreground | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | A long run goes into the background | Failed-only run without a duration | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | A long run goes into the background | One-file run of 3 minutes | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/test-runs | The kit blocks a long full-suite run in the foreground | Foreground full suite of 12 minutes | integration | yes | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks a long full-suite run in the foreground | Full suite without a duration | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks a long full-suite run in the foreground | Background full suite passes | integration | yes | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks a long full-suite run in the foreground | Two sections with different durations | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit blocks a long full-suite run in the foreground | Short full suite in the foreground | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | The kit code names no test tool | Kit runs in a project of any stack | integration | no | temporary project with a prepared `openspec/test-commands.md`; the hook run as a process with a prepared hook input | — |
| workflow/test-runs | Changes started under earlier rules keep their test runs | Protocol limits the new rule to new changes | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Early start check right after the Main round | Application starts during planning | integration | no | temporary change; the start-check script against a local test server, then its status | — |
| workflow/environment-check | Early start check right after the Main round | Change that does not need the application | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Early start check right after the Main round | No start instructions | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Early start check right after the Main round | Start command without an address | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Early start check right after the Main round | Test-case schema change | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Early start check right after the Main round | Meta-repository | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | A failed early start check stops planning | Ports refused during planning | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | A failed early start check stops planning | Developer fixes the cause | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | A failed early start check stops planning | Developer goes on without a passed check | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Start check at the beginning of apply | Application starts | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/environment-check | Start check at the beginning of apply | Application does not answer in time | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/environment-check | Start check at the beginning of apply | No running application needed | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/environment-check | Start check at the beginning of apply | No instructions or no address | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/environment-check | Start check at the beginning of apply | Early check already passed | integration | yes | temporary change; the start-check script against a local test server, then its status | — |
| workflow/environment-check | Start check at the beginning of apply | Lean change keeps the check at the start of apply | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Start check at the beginning of apply | Early check was skipped | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| workflow/environment-check | Project tool list | Agent proposes the list | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/environment-check | Project tool list | Developer declines the list | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/autonomous-apply | Stops that remain | Requirement gap during apply | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/autonomous-apply | Stops that remain | Test still fails after two fix attempts | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/autonomous-apply | Stops that remain | Environment blocks the start during the work | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/autonomous-apply | Stops that remain | Situation outside the plan | unit | no | unchanged behaviour: the scenario's present marked test | — |
| workflow/autonomous-apply | Stops that remain | Test command of the file does not start | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |
| metarepo/apply | The agent works in the group's repository | Protocol names the group's repository | unit | no | unchanged behaviour: the scenario's present marked test | — |
| metarepo/apply | The agent works in the group's repository | Protocol names the commands file first | unit | no | text of the protocols, the schema instructions and the `task-implementer` definition | — |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| workflow/test-commands | Test commands file | [D1][Q10][Q11] |
| workflow/test-commands | The kit never overwrites the file | [Q2][Q10] |
| workflow/test-commands | The agent drafts the file and the developer confirms it | [Q2] |
| workflow/test-commands | The file is proposed right after the Main round | [Q3][Q14] |
| workflow/test-commands | Expected duration is written once | [Q10][Q12] |
| workflow/test-commands | A missing file or command never blocks the work | [Q4] |
| workflow/test-commands | A command that does not work is a stop | [Q5] |
| workflow/test-commands | Independent work goes on before the stop for a command | [Q5] |
| workflow/test-commands | One file with a section per repository in a meta-repository | [Q6] |
| workflow/test-commands | Changes started under earlier rules keep them | [D1] |
| workflow/test-runs | A task group runs only its own test files | [D1][Q7] |
| workflow/test-runs | Fix subagents run only the test files of their work | [D1][Q7] |
| workflow/test-runs | Wider runs happen at the end, by the main agent | [D1][Q7] |
| workflow/test-runs | The kit blocks the full suite inside an implementation subagent | [Q7][Q13] |
| workflow/test-runs | How a command line is matched with the full-suite command | [Q13] |
| workflow/test-runs | A long run goes into the background | [D1][Q12] |
| workflow/test-runs | The kit blocks a long full-suite run in the foreground | [D1][Q12][Q13] |
| workflow/test-runs | The kit code names no test tool | [D1] |
| workflow/test-runs | Changes started under earlier rules keep their test runs | [D1] |
| workflow/environment-check | Early start check right after the Main round | [D1][Q8][Q10][Q14] |
| workflow/environment-check | A failed early start check stops planning | [D1][Q8] |
| workflow/environment-check | Start check at the beginning of apply | [Q9][Q10] |
| workflow/environment-check | Project tool list | [Q3] |
| workflow/autonomous-apply | Stops that remain | [Q5] |
| metarepo/apply | The agent works in the group's repository | [Q4][Q6] |

## Environment

- Node and the pinned OpenSpec CLI 1.15.0; the tests build temporary projects, with and without `openspec/test-commands.md` and `openspec/clones`, and changes stamped 0.7.0, 0.6.1 and without a stamp.
- The start-check tests use a local HTTP server started by the test itself, as the present start-check tests do.
- The command is `npm test`.
- Assumed without a question: the critical scenarios are those marked `yes` above (the two blocks of the hook, what it must let through, the untouched project file and the check that is not repeated); scenarios about the agent's behaviour are proven by tests that find the rule in the protocols, the schema instructions and the subagent definition; hook scenarios run the hook as a process, so they are `integration`; scenarios of modified requirements that keep their behaviour keep their present tests; the field that tells the hook it runs inside a `task-implementer` is confirmed once by hand with a real subagent run during the implementation and recorded in `docs/openspec-facts.md`.
- Running application: no
