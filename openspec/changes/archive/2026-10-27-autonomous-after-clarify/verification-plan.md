# Verification Plan

## Scenario coverage

| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |
|---|---|---|---|---|---|---|
| workflow/autonomous-apply | Implementation runs without the developer after planning | Planning complete, nothing blocks | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Implementation runs without the developer after planning | Planning complete, nothing blocks | manual | no | repeat pilot of the monorepo scaffold, same project and environment as the first pilot | cannot be automated: agent behaviour in a real session, checked in the repeat pilot |
| workflow/autonomous-apply | Implementation runs without the developer after planning | No task for the developer in the task list | unit | no | tasks.md with a "verify by hand" task, tasks check run by the test |  |
| workflow/autonomous-apply | Implementation runs without the developer after planning | No task for the developer in the task list | manual | no | repeat pilot of the monorepo scaffold, same project and environment as the first pilot | cannot be automated: agent behaviour in a real session, checked in the repeat pilot |
| workflow/autonomous-apply | Stops that remain | Requirement gap during apply | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Stops that remain | Test still fails after two fix attempts | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Stops that remain | Environment blocks the start during the work | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Stops that remain | Situation outside the plan | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | A single check that cannot run is recorded | Case needs a real phone | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | A single check that cannot run is recorded | Application itself does not start | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Independent work goes on before a stop | Stop on one test with independent tasks left | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Independent work goes on before a stop | Requirement gap stops at once | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Options are suggested, not carried out | Agent suggests freeing a port | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Workarounds inside the application only | Mail service missing in a test | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Workarounds inside the application only | Other application holds a needed port | integration | yes | boundary-guard run as a process with sample commands: `kill`, `pkill`, `killall` |  |
| workflow/autonomous-apply | Nothing outside the project without consent | Tool missing on the system | integration | yes | boundary-guard run as a process with sample commands: `sudo apt-get install`, `brew install`, `npm i -g`, `pip install --user` |  |
| workflow/autonomous-apply | Nothing outside the project without consent | Foreign Docker container in the way | integration | yes | boundary-guard run as a process with sample commands: `docker stop`, `docker rm`, `docker kill`, `docker volume rm`, `docker network rm`, `docker system prune`; `docker compose down` allowed |  |
| workflow/autonomous-apply | Weakening a test needs consent and a record | Weakening without consent | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Weakening a test needs consent and a record | Relaxed assertion with consent | unit | no | apply-report.md with a "Weakened tests" entry, check-apply-report run by the test |  |
| workflow/autonomous-apply | Weakening a test needs consent and a record | Switched-off quality rule with consent | unit | no | apply-report.md with a "Weakened tests" entry for a lint rule, check-apply-report run by the test |  |
| workflow/autonomous-apply | Ready message | Change ready to archive | unit | no | protocol and four schema files read by the test |  |
| workflow/autonomous-apply | Ready message | Change ready to archive | manual | no | repeat pilot of the monorepo scaffold, same project and environment as the first pilot | cannot be automated: agent behaviour in a real session, checked in the repeat pilot |
| workflow/environment-check | Project tool list | Agent proposes the list | unit | no | protocol and four schema files read by the test |  |
| workflow/environment-check | Project tool list | Agent proposes the list | manual | no | repeat pilot of the monorepo scaffold, same project and environment as the first pilot | cannot be automated: agent behaviour in a real session, checked in the repeat pilot |
| workflow/environment-check | Project tool list | Developer declines the list | unit | no | `openspec/project-tools` with the line `none`, doctor run by the test; protocol text |  |
| workflow/environment-check | Doctor warns about missing project tools | Listed tool missing | unit | no | temp project with `openspec/project-tools`, doctor run as a process with a controlled PATH |  |
| workflow/environment-check | Doctor warns about missing project tools | All listed tools present | unit | no | temp project with `openspec/project-tools`, doctor run as a process with a controlled PATH |  |
| workflow/environment-check | Doctor warns about missing project tools | No tool list | unit | no | temp project with `openspec/project-tools`, doctor run as a process with a controlled PATH |  |
| workflow/environment-check | Doctor warns about missing project tools | Install shows the result | integration | no | installer run into a temp project whose tool list names a missing command |  |
| workflow/environment-check | Start check at the beginning of apply | Application starts | integration | no | start-check.mjs run as a process against a small HTTP server started by the test (200, 503, no answer; shortened wait) |  |
| workflow/environment-check | Start check at the beginning of apply | Application does not answer in time | integration | no | start-check.mjs run as a process against a small HTTP server started by the test (200, 503, no answer; shortened wait) |  |
| workflow/environment-check | Start check at the beginning of apply | No running application needed | unit | no | protocol and four schema files read by the test |  |
| workflow/environment-check | Start check at the beginning of apply | No instructions or no address | unit | no | protocol and four schema files read by the test |  |
| workflow/environment-check | Failed start is decided by the developer | Ports unreachable | unit | no | protocol and four schema files read by the test |  |
| workflow/environment-check | Failed start is decided by the developer | Ports unreachable | manual | no | repeat pilot of the monorepo scaffold, same project and environment as the first pilot | cannot be automated: agent behaviour in a real session, checked in the repeat pilot |
| workflow/environment-check | Failed start is decided by the developer | Developer switches off E2E | integration | yes | temp project from a fixture, archive-gate run as a process: e2e.md `Mode: skipped`, e2e cases under "Not verified automatically" with `Consent:` |  |
| workflow/environment-check | Failed start is decided by the developer | Developer skips E2E deliberately | integration | yes | temp project from a fixture, archive-gate run as a process: e2e.md `Mode: skipped`, e2e cases with reason "tests were not run" and `Consent:` |  |
| workflow/environment-check | Failed start is decided by the developer | Developer chooses to fix inside the project | unit | no | protocol and four schema files read by the test |  |
| workflow/environment-check | Failed start is decided by the developer | Fix outside the project | unit | no | protocol and four schema files read by the test |  |
| workflow/environment-check | Failed start is decided by the developer | Developer skips the integration checks | integration | yes | temp project from a fixture, archive-gate run as a process: integration scenario without a test, entry with `Consent:` |  |
| workflow/manual-checks | Manual only with a reason | Manual row with a reason | unit | no | verification-plan.md with a `Manual reason` column, check-traceability run by the test |  |
| workflow/manual-checks | Manual only with a reason | Manual row without a reason | integration | yes | temp change, answers-gate run as a process on a write of tasks.md |  |
| workflow/manual-checks | Manual only with a reason | Manual test case without a reason | integration | yes | temp clarify-ai-qa change, answers-gate run as a process on a write of design.md |  |
| workflow/manual-checks | Manual only with a reason | Effort given as the reason | unit | no | test-case reviewer protocol and agent file read by the test |  |
| workflow/manual-checks | Manual only with a reason | Lean change with a manual row | unit | no | temp lean change, check-traceability run by the test |  |
| workflow/manual-checks | Dangerous functions | Hourly payout to cards | unit | no | protocol and four schema files read by the test |  |
| workflow/manual-checks | Dangerous functions | Role check only | unit | no | protocol and four schema files read by the test |  |
| workflow/manual-checks | Dangerous functions get both | Dangerous scenario in the plan | unit | no | verification-plan.md with a `dangerous:` row with and without a unit row, check-traceability run by the test |  |
| workflow/manual-checks | No automate-or-manual question | Verification round on an infrastructure change | unit | no | questions protocol read by the test |  |
| workflow/manual-checks | Manual checks are not apply tasks | Plan with manual rows | integration | yes | temp project from a fixture, archive-gate run as a process: plan with three manual rows, no task for them |  |
| workflow/manual-checks | Implementation report | Report after the tasks | unit | no | apply-report.md fixtures, check-apply-report run by the test |  |
| workflow/manual-checks | Implementation report | Report after the E2E stage | unit | no | E2E protocol read by the test; apply-report.md with an accepted case and `Consent:` |  |
| workflow/manual-checks | List for QA | Manual check entry | unit | no | apply-report.md fixtures, check-apply-report run by the test |  |
| workflow/manual-checks | List for QA | Check that could not run | unit | no | apply-report.md fixtures, check-apply-report run by the test |  |
| workflow/manual-checks | Dangerous checks first | Two manual checks, one dangerous | unit | no | apply-report.md with the dangerous check second, check-apply-report run by the test |  |
| workflow/manual-checks | Consent list at the end | Two unverified entries | unit | no | protocol and four schema files read by the test |  |
| workflow/manual-checks | Consent list at the end | Two unverified entries | manual | no | repeat pilot of the monorepo scaffold, same project and environment as the first pilot | cannot be automated: agent behaviour in a real session, checked in the repeat pilot |
| workflow/manual-checks | Consent list at the end | Entry already agreed | unit | no | protocol and four schema files read by the test |  |
| workflow/manual-checks | Consent list at the end | Developer refuses an entry | unit | no | protocol and four schema files read by the test |  |
| workflow/manual-checks | Unverified checks need consent to archive | Unverified case with consent | integration | yes | temp project from a fixture, archive-gate run as a process: clarify-ai-qa change, automated case without a test, entry with `Consent:` |  |
| workflow/manual-checks | Unverified checks need consent to archive | Unverified case without consent | integration | yes | temp project from a fixture, archive-gate run as a process: clarify-ai-qa change, automated case without a test, entry without `Consent:` |  |
| workflow/manual-checks | Changes started under the old rules | Old change with open manual tasks | integration | no | temp project from a fixture, archive-gate run as a process: change without `x-sdd-kit` and an open task |  |
| workflow/manual-checks | Changes started under the old rules | New change during apply | unit | no | artifact-feedback run on a first artifact write; `.openspec.yaml` read back |  |

## Exclusions

| Capability | Scenario | Reason |
|---|---|---|
| — | — | None. |

## Requirement trace

| Capability | Requirement | Sources |
|---|---|---|
| workflow/autonomous-apply | Implementation runs without the developer after planning | [Q1][Q5][Q12][desc] |
| workflow/autonomous-apply | Stops that remain | [Q1][Q2][Q3][Q6][Q8][Q19] |
| workflow/autonomous-apply | A single check that cannot run is recorded | [Q8][Q19] |
| workflow/autonomous-apply | Independent work goes on before a stop | [Q2][Q3][Q19] |
| workflow/autonomous-apply | Options are suggested, not carried out | [Q6][Q8][Q16] |
| workflow/autonomous-apply | Workarounds inside the application only | [Q16] |
| workflow/autonomous-apply | Nothing outside the project without consent | [Q7][Q44] |
| workflow/autonomous-apply | Weakening a test needs consent and a record | [Q17][Q22] |
| workflow/autonomous-apply | Ready message | [Q15][Q25] |
| workflow/environment-check | Project tool list | [Q36] |
| workflow/environment-check | Doctor warns about missing project tools | [Q9][Q28][Q36] |
| workflow/environment-check | Start check at the beginning of apply | [Q9][Q21][Q37][Q43] |
| workflow/environment-check | Failed start is decided by the developer | [Q10][Q29][Q33][Q38][Q39] |
| workflow/manual-checks | Manual only with a reason | [Q4][Q27][D1] |
| workflow/manual-checks | Dangerous functions | [Q18][Q30][Q34] |
| workflow/manual-checks | Dangerous functions get both | [Q23][Q24] |
| workflow/manual-checks | No automate-or-manual question | [Q11] |
| workflow/manual-checks | Manual checks are not apply tasks | [Q5][Q41] |
| workflow/manual-checks | Implementation report | [Q25][Q22] |
| workflow/manual-checks | List for QA | [Q20][Q8] |
| workflow/manual-checks | Dangerous checks first | [Q31] |
| workflow/manual-checks | Consent list at the end | [Q35][Q42] |
| workflow/manual-checks | Unverified checks need consent to archive | [Q26] |
| workflow/manual-checks | Changes started under the old rules | [Q32][Q40] |

## Environment

- Node.js and the pinned OpenSpec CLI, as for the rest of the kit suite (`npm test`).
- Hook and script tests run the kit files as child processes on temp projects built from `fixtures/`.
- The start-check tests start a small local HTTP server inside the test and use a shortened wait.
- Doctor tests control `PATH` so that a listed command is present or missing.
- Running application: no (the kit itself has no application to start).
- Repeat pilot: the `setup-monorepo` scaffold re-planned in the same project and environment as the first pilot (remote Docker, published ports and bind mounts unreachable).
